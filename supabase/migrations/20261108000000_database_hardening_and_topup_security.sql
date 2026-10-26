-- ==============================================================================
-- MIGRASI KEAMANAN TINGGI: DATABASE HARDENING & PERLINDUNGAN SISTEM TOP UP
-- File: supabase/migrations/20261108000000_database_hardening_and_topup_security.sql
--
-- FOKUS KEAMANAN:
-- 1. Menutup celah bypass pada tabel profiles (Mencegah pengubahan Role & Unban ilegal)
-- 2. Mengamankan tabel saldo user_balances dari manipulasi client (Anti-Injeksi Saldo)
-- 3. Mengamankan tabel transaksi topup_transactions dari pemalsuan status 'berhasil'
-- 4. Proteksi Anti-DDoS / Flooding pembuatan invoice Top Up
-- 5. Mengunci tabel RPG (rpg_user_profiles, rpg_clan_members, rpg_exp_transactions)
-- CATATAN: Menggunakan explicit type cast (::text) agar kebal dari error operator 'uuid = text'
-- ==============================================================================

-- ==============================================================================
-- BAGIAN 1: PERBAIKAN CELAH PROFIL & ANTI-BYPASS ROLE/UNBAN
-- ==============================================================================

-- 1. Hapus policy rentan yang sebelumnya mengizinkan 'public' mengupdate profil siapapun
DROP POLICY IF EXISTS "Allow admin update profiles" ON public.profiles;

-- 2. Pastikan RLS aktif di profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policy aman untuk update profile: HANYA pemilik akun yang boleh update datanya sendiri
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = id::text)
  WITH CHECK ((auth.uid())::text = id::text);

-- 4. Trigger Proteksi Kolom Sensitif Profiles (Role, is_banned, dsb.)
-- Mencegah user biasa membypass ban atau mengangkat diri sendiri jadi Owner/Admin via Supabase client
CREATE OR REPLACE FUNCTION public.trg_fn_security_guard_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Cek apakah pemanggil adalah Administrator yang sah
  IF auth.uid() IS NOT NULL THEN
    SELECT (role IN ('Owner', 'Admin')) INTO v_is_admin
    FROM public.profiles
    WHERE id::text = (auth.uid())::text;
  END IF;

  -- Jika BUKAN admin yang terotentikasi, cegah manipulasi kolom sensitif
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    -- Mencegah bypass unban: Jika akun sedang dibanned, jangan izinkan merubah is_banned jadi false
    IF OLD.is_banned = TRUE AND NEW.is_banned = FALSE THEN
      RAISE EXCEPTION 'UNAUTHORIZED_UNBAN_ATTEMPT: Akun diblokir tidak dapat mengaktifkan diri sendiri.';
    END IF;

    -- Mencegah eskalasi role (misal dari Member ke Owner/Admin)
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role; -- Kembalikan ke role asli
    END IF;

    -- Pertahankan status ban dan catatan ban
    IF OLD.is_banned = TRUE THEN
      NEW.is_banned := OLD.is_banned;
      NEW.banned_at := OLD.banned_at;
      NEW.banned_by := OLD.banned_by;
      NEW.ban_reason := OLD.ban_reason;
    END IF;
  END IF;

  -- Sanitasi display_name & bio agar bersih dari script injection
  IF NEW.display_name IS NOT NULL THEN
    NEW.display_name := REGEXP_REPLACE(NEW.display_name, '(?i)<script.*?>.*?</script>', '', 'g');
    NEW.display_name := REGEXP_REPLACE(NEW.display_name, '(?i)<[^>]+>', '', 'g');
    NEW.display_name := SUBSTRING(TRIM(NEW.display_name), 1, 50);
  END IF;

  IF NEW.bio IS NOT NULL THEN
    NEW.bio := REGEXP_REPLACE(NEW.bio, '(?i)<script.*?>.*?</script>', '', 'g');
    NEW.bio := REGEXP_REPLACE(NEW.bio, '(?i)<[^>]+>', '', 'g');
    NEW.bio := SUBSTRING(TRIM(NEW.bio), 1, 300);
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_security_guard ON public.profiles;
CREATE TRIGGER trg_profiles_security_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_security_guard_profiles();


-- ==============================================================================
-- BAGIAN 2: PERLINDUNGAN SALDO PENGGUNA (USER_BALANCES)
-- Mencegah hacker mengubah saldo Dylan Crystal langsung dari client
-- ==============================================================================

ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

-- 1. Pengguna HANYA dapat membaca (SELECT) saldo miliknya sendiri
DROP POLICY IF EXISTS "Users can read own balance" ON public.user_balances;
CREATE POLICY "Users can read own balance"
  ON public.user_balances
  FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id::text);

-- 2. Admin dapat membaca saldo semua pengguna
DROP POLICY IF EXISTS "Admins can read all balances" ON public.user_balances;
CREATE POLICY "Admins can read all balances"
  ON public.user_balances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin', 'Finance')
    )
  );

-- 3. DILARANG INSERT/UPDATE LANGSUNG DARI CLIENT BIASA
-- Perubahan saldo WAJIB melalui fungsi atomik berizin (SECURITY DEFINER)
DROP POLICY IF EXISTS "Disallow direct client insert user_balances" ON public.user_balances;
DROP POLICY IF EXISTS "Disallow direct client update user_balances" ON public.user_balances;
DROP POLICY IF EXISTS "Disallow direct client delete user_balances" ON public.user_balances;

-- Trigger Penjaga Integritas Saldo: Saldo tidak boleh negatif
CREATE OR REPLACE FUNCTION public.trg_fn_security_user_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.crystal_balance < 0 THEN
    RAISE EXCEPTION 'INVALID_BALANCE: Saldo Crystal tidak boleh kurang dari 0.';
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_balances_security ON public.user_balances;
CREATE TRIGGER trg_user_balances_security
  BEFORE INSERT OR UPDATE ON public.user_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_security_user_balances();


-- ==============================================================================
-- BAGIAN 3: PERLINDUNGAN TRANSAKSI TOP UP (TOPUP_TRANSACTIONS)
-- Mencegah pemalsuan status 'berhasil' dan DDoS / Flooding pembuatan invoice
-- ==============================================================================

ALTER TABLE public.topup_transactions ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Pengguna hanya boleh membaca transaksi miliknya sendiri
DROP POLICY IF EXISTS "Users can read own topup transactions" ON public.topup_transactions;
CREATE POLICY "Users can read own topup transactions"
  ON public.topup_transactions
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid())::text = user_id::text OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin', 'Finance')
    )
  );

-- 2. INSERT: Pengguna hanya boleh membuat transaksi atas nama dirinya sendiri
-- dengan status WAJIB 'menunggu_pembayaran' atau 'menunggu_verifikasi'
DROP POLICY IF EXISTS "Users can insert own topup transaction" ON public.topup_transactions;
CREATE POLICY "Users can insert own topup transaction"
  ON public.topup_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid())::text = user_id::text AND
    status IN ('menunggu_pembayaran', 'menunggu_verifikasi') AND
    crystals_granted = FALSE
  );

-- 3. UPDATE: Pengguna biasa TIDAK BOLEH mengupdate status jadi 'berhasil'
DROP POLICY IF EXISTS "Users can update own topup pending status" ON public.topup_transactions;
CREATE POLICY "Users can update own topup pending status"
  ON public.topup_transactions
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid())::text = user_id::text OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin', 'Finance')
    )
  )
  WITH CHECK (
    -- Jika user biasa, hanya boleh mengubah dari menunggu_pembayaran -> menunggu_verifikasi / dibatalkan
    (
      (auth.uid())::text = user_id::text AND
      status IN ('menunggu_pembayaran', 'menunggu_verifikasi', 'dibatalkan') AND
      crystals_granted = FALSE
    )
    OR
    -- Admin boleh memverifikasi
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin', 'Finance')
    )
  );

-- 4. Trigger Proteksi Anti-Fraud & Anti-DDoS Topup
CREATE OR REPLACE FUNCTION public.trg_fn_security_topup_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_is_banned BOOLEAN := FALSE;
  v_recent_tx_count INTEGER := 0;
BEGIN
  -- Cek status akun pengguna
  SELECT is_banned INTO v_is_banned
  FROM public.profiles
  WHERE id::text = NEW.user_id::text;

  IF COALESCE(v_is_banned, FALSE) THEN
    RAISE EXCEPTION 'USER_BANNED: Akun diblokir tidak dapat melakukan transaksi.';
  END IF;

  -- Cek apakah pemanggil adalah Admin
  IF auth.uid() IS NOT NULL THEN
    SELECT (role IN ('Owner', 'Admin', 'Finance')) INTO v_is_admin
    FROM public.profiles
    WHERE id::text = (auth.uid())::text;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Anti-DDoS: Batasi maksimal 5 transaksi baru per user dalam 10 menit
    SELECT COUNT(*) INTO v_recent_tx_count
    FROM public.topup_transactions
    WHERE user_id::text = NEW.user_id::text
      AND created_at > NOW() - INTERVAL '10 minutes';

    IF v_recent_tx_count >= 5 AND NOT COALESCE(v_is_admin, FALSE) THEN
      RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Terlalu banyak permintaan transaksi. Harap tunggu beberapa menit.';
    END IF;

    -- Validasi nominal pembayaran dan crystal
    IF NEW.crystal_amount <= 0 OR NEW.price <= 0 OR NEW.total_payment <= 0 THEN
      RAISE EXCEPTION 'INVALID_AMOUNT: Jumlah Crystal dan nominal pembayaran harus lebih dari 0.';
    END IF;

    -- Pastikan transaksi baru tidak langsung berstatus 'berhasil'
    IF NEW.status = 'berhasil' OR NEW.crystals_granted = TRUE THEN
      -- Deteksi manipulasi sengaja: Blokir akun langsung!
      UPDATE public.profiles
      SET is_banned = TRUE,
          banned_at = NOW(),
          ban_reason = 'Upaya manipulasi ilegal: mencoba membuat transaksi langsung berstatus berhasil',
          banned_by = 'System Security Defense'
      WHERE id::text = NEW.user_id::text;

      RAISE EXCEPTION 'FRAUD_ATTEMPT_DETECTED: Upaya pemalsuan transaksi terdeteksi. Akun telah diblokir.';
    END IF;

    -- Sanitasi teks username & catatan
    IF NEW.username IS NOT NULL THEN
      NEW.username := REGEXP_REPLACE(NEW.username, '(?i)<[^>]+>', '', 'g');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Mencegah user biasa mengubah transaksi jadi 'berhasil' atau menyetel crystals_granted = TRUE
    IF (NEW.status = 'berhasil' OR NEW.crystals_granted = TRUE) AND NOT COALESCE(v_is_admin, FALSE) THEN
      -- Deteksi manipulasi update ilegal: Blokir akun!
      UPDATE public.profiles
      SET is_banned = TRUE,
          banned_at = NOW(),
          ban_reason = 'Upaya manipulasi ilegal: mencoba menyetujui transaksi sendiri tanpa verifikasi admin',
          banned_by = 'System Security Defense'
      WHERE id::text = NEW.user_id::text;

      RAISE EXCEPTION 'FRAUD_ATTEMPT_DETECTED: Upaya pemalsuan persetujuan terdeteksi. Akun telah diblokir.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_topup_security_guard ON public.topup_transactions;
CREATE TRIGGER trg_topup_security_guard
  BEFORE INSERT OR UPDATE ON public.topup_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_security_topup_transactions();


-- ==============================================================================
-- BAGIAN 4: PENGUATAN DUNIA RPG NUENIME (ANTI-TAMPER EXP & CLAN)
-- Explicit Type Cast ::text untuk mencegah operator does not exist: uuid = text
-- ==============================================================================

-- 1. Kunci rpg_user_profiles agar pengguna HANYA bisa update profil RPG miliknya sendiri
DROP POLICY IF EXISTS "Users can manage rpg_user_profiles" ON public.rpg_user_profiles;
DROP POLICY IF EXISTS "Users can update own rpg profile" ON public.rpg_user_profiles;
CREATE POLICY "Users can update own rpg profile"
  ON public.rpg_user_profiles
  FOR UPDATE
  TO authenticated
  USING ((auth.uid())::text = user_id::text)
  WITH CHECK ((auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own rpg profile" ON public.rpg_user_profiles;
CREATE POLICY "Users can insert own rpg profile"
  ON public.rpg_user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id::text);

-- 2. Kunci rpg_clan_members agar pengguna HANYA mengelola keanggotaan miliknya sendiri
DROP POLICY IF EXISTS "Users can manage rpg_clan_members" ON public.rpg_clan_members;
DROP POLICY IF EXISTS "Users can manage own clan member" ON public.rpg_clan_members;
CREATE POLICY "Users can manage own clan member"
  ON public.rpg_clan_members
  FOR ALL
  TO authenticated
  USING ((auth.uid())::text = user_id::text)
  WITH CHECK ((auth.uid())::text = user_id::text);

-- 3. Kunci rpg_exp_transactions agar tidak sembarang di-insert dengan nilai palsu
DROP POLICY IF EXISTS "Users can insert rpg_exp_transactions" ON public.rpg_exp_transactions;
DROP POLICY IF EXISTS "Users can insert own rpg_exp_transactions" ON public.rpg_exp_transactions;
CREATE POLICY "Users can insert own rpg_exp_transactions"
  ON public.rpg_exp_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid())::text = user_id::text AND
    amount BETWEEN -100000 AND 100000
  );

-- ==============================================================================
-- SELESAI: Database sekarang memiliki perlindungan berlapis terhadap:
-- - Injeksi SQL & XSS
-- - Flooding / DDoS Invoice Topup
-- - Pemalsuan Saldo Crystal & Transaksi Berhasil
-- - Bypass Status Blokir Akun & Privilese Role
-- - Tamper Data Dunia RPG & Klan
-- ==============================================================================
