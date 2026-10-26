-- ==============================================================================
-- MIGRASI SINKRONISASI KEAMANAN: INTEGRASI ADMIN DASHBOARD D:\admin-nuenime
-- File: supabase/migrations/20261110000000_admin_dashboard_security_sync.sql
--
-- TUJUAN:
-- Menyelaraskan seluruh hardening keamanan database (migrasi 20261107, 20261108, 20261109)
-- agar Admin Dashboard (D:\admin-nuenime) dapat beroperasi 100% lancar tanpa terhalang
-- false-alarm security trigger atau RLS permissions.
--
-- FOKUS PERBAIKAN:
-- 1. Update trigger trg_fn_security_guard_profiles() agar mengenali:
--    - setting 'app.admin_override' = 'true'
--    - akun di public.admin_accounts (status = 'active')
--    - role 'Owner' / 'Admin' di profiles
--    Sehingga unban dan role update oleh Super Admin berhasil dieksekusi.
-- 2. Update trigger trg_fn_security_topup_transactions() agar mengenali:
--    - setting 'app.admin_override' = 'true'
--    - akun di public.admin_accounts (status = 'active')
--    - role 'Owner' / 'Admin' / 'Finance' di profiles
--    Sehingga verifikasi topup (approve, reject, reverse) tidak memblokir akun secara keliru.
-- 3. Menyediakan sekumpulan Security Definer RPC Functions resmi untuk Admin Dashboard:
--    - admin_approve_topup_transaction
--    - admin_reject_topup_transaction
--    - admin_reverse_topup_transaction
--    - admin_get_all_transactions
--    - admin_update_user_role
--    - admin_set_user_ban_status
--    - admin_swap_member_numbers
--    - admin_reset_user_cooldown
--    - admin_set_system_config
--    - admin_upsert_avatar_border
--    - admin_delete_avatar_border
--    - admin_upsert_gacha_banner
--    - admin_delete_gacha_banner
-- ==============================================================================

-- ==============================================================================
-- 1. REVISI TRIGGER PROFILES (ANTI-BYPASS & DUKUNGAN UNBAN RESMI ADMIN)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_security_guard_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_override TEXT;
BEGIN
  -- 1. Cek apakah ada bypass resmi dari Security Definer Admin RPC
  BEGIN
    v_override := current_setting('app.admin_override', true);
  EXCEPTION WHEN OTHERS THEN
    v_override := NULL;
  END;

  IF v_override = 'true' THEN
    v_is_admin := TRUE;
  END IF;

  -- 2. Cek apakah auth.uid() adalah Admin di public.profiles
  IF NOT v_is_admin AND auth.uid() IS NOT NULL THEN
    SELECT (role IN ('Owner', 'Admin')) INTO v_is_admin
    FROM public.profiles
    WHERE id::text = (auth.uid())::text;
  END IF;

  -- 3. Cek apakah auth.uid() terdaftar di public.admin_accounts
  IF NOT v_is_admin AND auth.uid() IS NOT NULL THEN
    SELECT (status = 'active') INTO v_is_admin
    FROM public.admin_accounts
    WHERE id::text = (auth.uid())::text;
  END IF;

  -- Jika BUKAN admin yang sah, amankan kolom sensitif
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    -- Cegah self-unban: Akun yang dibanned tidak boleh mengaktifkan diri sendiri
    IF OLD.is_banned = TRUE AND NEW.is_banned = FALSE THEN
      RAISE EXCEPTION 'UNAUTHORIZED_UNBAN_ATTEMPT: Akun diblokir tidak dapat mengaktifkan diri sendiri.';
    END IF;

    -- Cegah eskalasi role mandiri
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;

    -- Pertahankan status ban jika akun sedang diblokir
    IF OLD.is_banned = TRUE THEN
      NEW.is_banned := OLD.is_banned;
      NEW.banned_at := OLD.banned_at;
      NEW.banned_by := OLD.banned_by;
      NEW.ban_reason := OLD.ban_reason;
    END IF;
  END IF;

  -- Sanitasi display_name & bio dari script injection
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


-- ==============================================================================
-- 2. REVISI TRIGGER TOPUP TRANSAKSI (ANTI-FRAUD & DUKUNGAN VERIFIKASI ADMIN)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_security_topup_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_is_banned BOOLEAN := FALSE;
  v_recent_tx_count INTEGER := 0;
  v_override TEXT;
BEGIN
  -- 1. Cek bypass resmi dari Admin RPC
  BEGIN
    v_override := current_setting('app.admin_override', true);
  EXCEPTION WHEN OTHERS THEN
    v_override := NULL;
  END;

  IF v_override = 'true' THEN
    v_is_admin := TRUE;
  END IF;

  -- 2. Cek apakah auth.uid() adalah Admin/Finance di public.profiles
  IF NOT v_is_admin AND auth.uid() IS NOT NULL THEN
    SELECT (role IN ('Owner', 'Admin', 'Finance')) INTO v_is_admin
    FROM public.profiles
    WHERE id::text = (auth.uid())::text;
  END IF;

  -- 3. Cek apakah auth.uid() ada di admin_accounts
  IF NOT v_is_admin AND auth.uid() IS NOT NULL THEN
    SELECT (status = 'active') INTO v_is_admin
    FROM public.admin_accounts
    WHERE id::text = (auth.uid())::text;
  END IF;

  -- Cek status blokir pengguna (hanya saat INSERT atau non-admin UPDATE)
  IF NOT v_is_admin THEN
    SELECT is_banned INTO v_is_banned
    FROM public.profiles
    WHERE id::text = NEW.user_id::text;

    IF COALESCE(v_is_banned, FALSE) THEN
      RAISE EXCEPTION 'USER_BANNED: Akun diblokir tidak dapat melakukan transaksi.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Rate limit pembuatan invoice topup
    SELECT COUNT(*) INTO v_recent_tx_count
    FROM public.topup_transactions
    WHERE user_id::text = NEW.user_id::text
      AND created_at > NOW() - INTERVAL '10 minutes';

    IF v_recent_tx_count >= 5 AND NOT COALESCE(v_is_admin, FALSE) THEN
      RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Terlalu banyak permintaan transaksi. Harap tunggu beberapa menit.';
    END IF;

    -- Validasi nominal
    IF NEW.crystal_amount <= 0 OR NEW.price <= 0 OR NEW.total_payment <= 0 THEN
      RAISE EXCEPTION 'INVALID_AMOUNT: Jumlah Crystal dan nominal pembayaran harus lebih dari 0.';
    END IF;

    -- Invoice baru TIDAK BOLEH langsung berstatus berhasil
    IF (NEW.status = 'berhasil' OR NEW.crystals_granted = TRUE) AND NOT COALESCE(v_is_admin, FALSE) THEN
      UPDATE public.profiles
      SET is_banned = TRUE,
          banned_at = NOW(),
          ban_reason = 'Upaya manipulasi ilegal: mencoba membuat transaksi langsung berstatus berhasil',
          banned_by = 'System Security Defense'
      WHERE id::text = NEW.user_id::text;

      RAISE EXCEPTION 'FRAUD_ATTEMPT_DETECTED: Upaya pemalsuan transaksi terdeteksi. Akun telah diblokir.';
    END IF;

    IF NEW.username IS NOT NULL THEN
      NEW.username := REGEXP_REPLACE(NEW.username, '(?i)<[^>]+>', '', 'g');
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Mencegah user biasa mengubah transaksi jadi 'berhasil'
    IF (NEW.status = 'berhasil' OR NEW.crystals_granted = TRUE) AND NOT COALESCE(v_is_admin, FALSE) THEN
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


-- ==============================================================================
-- 3. ATOMIC RPC: ADMIN APPROVE TOPUP TRANSACTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_approve_topup_transaction(
  p_transaction_id TEXT,
  p_admin_id TEXT DEFAULT 'admin-super-01',
  p_admin_email TEXT DEFAULT 'admin@nuenime.com'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_new_balance INTEGER := 0;
  v_user_uuid UUID;
  v_admin_uuid UUID;
BEGIN
  -- Aktifkan izin admin override agar trigger mengizinkan verifikasi
  PERFORM set_config('app.admin_override', 'true', true);

  -- Kunci baris transaksi untuk mencegah double-approval race condition
  SELECT * INTO v_tx
  FROM public.topup_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan');
  END IF;

  IF v_tx.status = 'berhasil' AND v_tx.crystals_granted = TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi sudah pernah disetujui sebelumnya');
  END IF;

  -- Parse user_id
  BEGIN
    v_user_uuid := v_tx.user_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_uuid := NULL;
  END;

  -- 1. Tambah saldo ke user_balances
  IF v_user_uuid IS NOT NULL THEN
    INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
    VALUES (v_user_uuid, v_tx.crystal_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET crystal_balance = public.user_balances.crystal_balance + v_tx.crystal_amount,
        updated_at = NOW()
    RETURNING crystal_balance INTO v_new_balance;
  END IF;

  -- 2. Update status transaksi
  UPDATE public.topup_transactions
  SET status = 'berhasil',
      crystals_granted = TRUE,
      verified_at = NOW(),
      status_note = 'Diverifikasi sah oleh ' || COALESCE(p_admin_email, 'Admin')
  WHERE id = p_transaction_id;

  -- Parse admin_id ke UUID jika mungkin untuk balance_adjustments
  BEGIN
    v_admin_uuid := p_admin_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_admin_uuid := '73f6e447-2f8c-4f12-ad94-a737a78e279b'::uuid;
  END;

  -- 3. Catat balance adjustments
  IF v_user_uuid IS NOT NULL THEN
    BEGIN
      INSERT INTO public.balance_adjustments (
        user_id, admin_id, admin_email, amount, balance_before, balance_after, reason
      ) VALUES (
        v_user_uuid,
        v_admin_uuid,
        p_admin_email,
        v_tx.crystal_amount,
        v_new_balance - v_tx.crystal_amount,
        v_new_balance,
        'Persetujuan Top Up Transaksi ' || p_transaction_id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Abaikan error foreign key jika ada
    END;
  END IF;

  -- 4. Catat Audit Log
  BEGIN
    INSERT INTO public.admin_audit_logs (
      admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
      COALESCE(v_admin_uuid, '73f6e447-2f8c-4f12-ad94-a737a78e279b'::uuid),
      p_admin_email,
      'APPROVE_TOPUP',
      'transaction',
      p_transaction_id,
      jsonb_build_object(
        'crystal_amount', v_tx.crystal_amount,
        'total_payment', v_tx.total_payment,
        'user_id', v_tx.user_id,
        'new_balance', v_new_balance
      )
    );
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'crystal_amount', v_tx.crystal_amount,
    'new_balance', v_new_balance
  );
END;
$$;


-- ==============================================================================
-- 4. ATOMIC RPC: ADMIN REJECT TOPUP TRANSACTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_reject_topup_transaction(
  p_transaction_id TEXT,
  p_reason TEXT,
  p_admin_id TEXT DEFAULT 'admin-super-01',
  p_admin_email TEXT DEFAULT 'admin@nuenime.com'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  SELECT * INTO v_tx
  FROM public.topup_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan');
  END IF;

  IF v_tx.status = 'berhasil' AND v_tx.crystals_granted = TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi sudah berstatus berhasil, gunakan fitur reversal untuk membatalkan');
  END IF;

  UPDATE public.topup_transactions
  SET status = 'ditolak',
      status_note = COALESCE(TRIM(p_reason), 'Ditolak oleh admin'),
      verified_at = NOW()
  WHERE id = p_transaction_id;

  BEGIN
    INSERT INTO public.admin_audit_logs (
      admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
      '73f6e447-2f8c-4f12-ad94-a737a78e279b'::uuid,
      p_admin_email,
      'REJECT_TOPUP',
      'transaction',
      p_transaction_id,
      jsonb_build_object('reason', p_reason, 'userId', v_tx.user_id)
    );
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);
END;
$$;


-- ==============================================================================
-- 5. ATOMIC RPC: ADMIN REVERSE TOPUP TRANSACTION (PENARIKAN SALDO BERHASIL)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_reverse_topup_transaction(
  p_transaction_id TEXT,
  p_reason TEXT,
  p_admin_id TEXT DEFAULT 'admin-super-01',
  p_admin_email TEXT DEFAULT 'admin@nuenime.com'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx RECORD;
  v_cur_bal INTEGER := 0;
  v_new_bal INTEGER := 0;
  v_user_uuid UUID;
  v_admin_uuid UUID;
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  SELECT * INTO v_tx
  FROM public.topup_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan');
  END IF;

  IF NOT v_tx.crystals_granted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi ini belum pernah memberikan Crystal');
  END IF;

  BEGIN
    v_user_uuid := v_tx.user_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_uuid := NULL;
  END;

  IF v_user_uuid IS NOT NULL THEN
    SELECT COALESCE(crystal_balance, 0) INTO v_cur_bal
    FROM public.user_balances
    WHERE user_id = v_user_uuid
    FOR UPDATE;

    IF v_cur_bal < v_tx.crystal_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Saldo pengguna saat ini (' || v_cur_bal || ') tidak mencukupi untuk penarikan ' || v_tx.crystal_amount || ' Crystal. Saldo tidak boleh negatif.'
      );
    END IF;

    v_new_bal := v_cur_bal - v_tx.crystal_amount;

    UPDATE public.user_balances
    SET crystal_balance = v_new_bal,
        updated_at = NOW()
    WHERE user_id = v_user_uuid;
  END IF;

  UPDATE public.topup_transactions
  SET status = 'reversed',
      status_note = '[REVERSED]: ' || COALESCE(TRIM(p_reason), 'Ditarik oleh Admin'),
      verified_at = NOW()
  WHERE id = p_transaction_id;

  BEGIN
    v_admin_uuid := p_admin_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_admin_uuid := '73f6e447-2f8c-4f12-ad94-a737a78e279b'::uuid;
  END;

  IF v_user_uuid IS NOT NULL THEN
    BEGIN
      INSERT INTO public.balance_adjustments (
        user_id, admin_id, admin_email, amount, balance_before, balance_after, reason
      ) VALUES (
        v_user_uuid,
        v_admin_uuid,
        p_admin_email,
        -v_tx.crystal_amount,
        v_cur_bal,
        v_new_bal,
        'Reversal Transaksi ' || p_transaction_id || ': ' || p_reason
      );
    EXCEPTION WHEN OTHERS THEN
    END;
  END IF;

  BEGIN
    INSERT INTO public.admin_audit_logs (
      admin_id, admin_email, action, target_type, target_id, details
    ) VALUES (
      COALESCE(v_admin_uuid, '73f6e447-2f8c-4f12-ad94-a737a78e279b'::uuid),
      p_admin_email,
      'REVERSE_TOPUP',
      'transaction',
      p_transaction_id,
      jsonb_build_object('reason', p_reason, 'userId', v_tx.user_id, 'deducted', v_tx.crystal_amount, 'newBalance', v_new_bal)
    );
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'new_balance', v_new_bal
  );
END;
$$;


-- ==============================================================================
-- 6. ATOMIC RPC: AMBIL SEMUA TRANSAKSI TOP UP (UNTUK ADMIN DASHBOARD)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_all_transactions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_result
  FROM (
    SELECT *
    FROM public.topup_transactions
    ORDER BY created_at DESC
  ) t;

  RETURN v_result;
END;
$$;


-- ==============================================================================
-- 7. ATOMIC RPC: UPDATE ROLE PENGGUNA (DENGAN OVERRIDE TRIGGER)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id TEXT,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  UPDATE public.profiles
  SET role = p_new_role,
      updated_at = NOW()
  WHERE id::text = p_user_id::text
  RETURNING id, username, role INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pengguna tidak ditemukan di database');
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_row.id, 'role', v_row.role);
END;
$$;


-- ==============================================================================
-- 8. ATOMIC RPC: BLOKIR / BUKA BLOKIR AKUN PENGGUNA (UNBAN & BAN AMAN)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_user_ban_status(
  p_user_id TEXT,
  p_is_banned BOOLEAN,
  p_reason TEXT DEFAULT NULL,
  p_banned_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  UPDATE public.profiles
  SET is_banned = p_is_banned,
      banned_at = CASE WHEN p_is_banned THEN NOW() ELSE NULL END,
      ban_reason = CASE WHEN p_is_banned THEN TRIM(p_reason) ELSE NULL END,
      banned_by = CASE WHEN p_is_banned THEN TRIM(p_banned_by) ELSE NULL END,
      updated_at = NOW()
  WHERE id::text = p_user_id::text
  RETURNING id, username, is_banned INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pengguna tidak ditemukan di database');
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_row.id, 'is_banned', v_row.is_banned);
END;
$$;


-- ==============================================================================
-- 9. ATOMIC RPC: TUKAR NOMOR MEMBER (#ID)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_swap_member_numbers(
  p_user_a_id TEXT,
  p_user_b_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num_a INTEGER;
  v_num_b INTEGER;
  v_temp_num INTEGER;
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  IF p_user_a_id = p_user_b_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak dapat menukar nomor member akun yang sama');
  END IF;

  SELECT member_number INTO v_num_a FROM public.profiles WHERE id::text = p_user_a_id::text;
  SELECT member_number INTO v_num_b FROM public.profiles WHERE id::text = p_user_b_id::text;

  IF v_num_a IS NULL OR v_num_b IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Salah satu akun tidak memiliki nomor member');
  END IF;

  -- Temporary unique number untuk menghindari unique violation
  v_temp_num := 900000000 + FLOOR(RANDOM() * 90000000)::INTEGER + v_num_a;

  UPDATE public.profiles SET member_number = v_temp_num, updated_at = NOW() WHERE id::text = p_user_a_id::text;
  UPDATE public.profiles SET member_number = v_num_a, updated_at = NOW() WHERE id::text = p_user_b_id::text;
  UPDATE public.profiles SET member_number = v_num_b, updated_at = NOW() WHERE id::text = p_user_a_id::text;

  RETURN jsonb_build_object('success', true, 'user_a_num', v_num_b, 'user_b_num', v_num_a);
END;
$$;


-- ==============================================================================
-- 10. ATOMIC RPC: RESET COOLDOWN PROFIL
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_reset_user_cooldown(
  p_user_id TEXT,
  p_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  IF p_type = 'all' THEN
    UPDATE public.profiles
    SET name_updated_at = NULL,
        avatar_updated_at = NULL,
        banner_updated_at = NULL,
        updated_at = NOW()
    WHERE id::text = p_user_id::text;
  ELSIF p_type = 'name' THEN
    UPDATE public.profiles SET name_updated_at = NULL, updated_at = NOW() WHERE id::text = p_user_id::text;
  ELSIF p_type = 'avatar' THEN
    UPDATE public.profiles SET avatar_updated_at = NULL, updated_at = NOW() WHERE id::text = p_user_id::text;
  ELSIF p_type = 'banner' THEN
    UPDATE public.profiles SET banner_updated_at = NULL, updated_at = NOW() WHERE id::text = p_user_id::text;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ==============================================================================
-- 11. ATOMIC RPC: SIMPAN / PERBARUI SYSTEM CONFIG
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_set_system_config(
  p_key TEXT,
  p_value JSONB,
  p_admin_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  INSERT INTO public.system_configs (key, value, updated_at)
  VALUES (p_key, p_value, NOW())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'key', p_key);
END;
$$;


-- ==============================================================================
-- 12. ATOMIC RPC: KELOLA BORDER AVATAR (UPSERT & DELETE)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_avatar_border(
  p_border JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT;
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  v_id := p_border->>'id';
  IF v_id IS NULL OR TRIM(v_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID border tidak boleh kosong');
  END IF;

  INSERT INTO public.avatar_borders_config (
    id, name, rarity, asset_url, inner_ratio, offset_x, offset_y, scale,
    is_released, description, price_crystal, is_active, sort_order, updated_at
  ) VALUES (
    v_id,
    COALESCE(p_border->>'name', 'Border Avatar'),
    COALESCE(p_border->>'rarity', 'Rare'),
    p_border->>'asset_url',
    COALESCE((p_border->>'inner_ratio')::NUMERIC, 0.74),
    COALESCE((p_border->>'offset_x')::NUMERIC, 0.0),
    COALESCE((p_border->>'offset_y')::NUMERIC, 0.0),
    COALESCE((p_border->>'scale')::NUMERIC, 1.0),
    COALESCE((p_border->>'is_released')::BOOLEAN, TRUE),
    p_border->>'description',
    (p_border->>'price_crystal')::INTEGER,
    COALESCE((p_border->>'is_active')::BOOLEAN, TRUE),
    COALESCE((p_border->>'sort_order')::INTEGER, 100),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      rarity = EXCLUDED.rarity,
      asset_url = EXCLUDED.asset_url,
      inner_ratio = EXCLUDED.inner_ratio,
      offset_x = EXCLUDED.offset_x,
      offset_y = EXCLUDED.offset_y,
      scale = EXCLUDED.scale,
      is_released = EXCLUDED.is_released,
      description = EXCLUDED.description,
      price_crystal = EXCLUDED.price_crystal,
      is_active = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order,
      updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_avatar_border(
  p_border_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  DELETE FROM public.avatar_borders_config WHERE id = p_border_id;

  RETURN jsonb_build_object('success', true, 'id', p_border_id);
END;
$$;


-- ==============================================================================
-- 13. ATOMIC RPC: KELOLA GACHA BANNER (UPSERT & DELETE)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_gacha_banner(
  p_banner JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id TEXT;
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  v_id := p_banner->>'id';
  IF v_id IS NULL OR TRIM(v_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID banner tidak boleh kosong');
  END IF;

  INSERT INTO public.gacha_banners (
    id, name, anime, rarity, category, exp_bonus, image, color, is_active, created_at, updated_at
  ) VALUES (
    v_id,
    COALESCE(p_banner->>'name', 'Banner Gacha'),
    COALESCE(p_banner->>'anime', 'Anime Series'),
    COALESCE(p_banner->>'rarity', 'Normal'),
    COALESCE(p_banner->>'category', 'Wallpaper'),
    COALESCE((p_banner->>'exp_bonus')::INTEGER, 10),
    COALESCE(p_banner->>'image', ''),
    COALESCE(p_banner->>'color', '#888888'),
    COALESCE((p_banner->>'is_active')::BOOLEAN, TRUE),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      anime = EXCLUDED.anime,
      rarity = EXCLUDED.rarity,
      category = EXCLUDED.category,
      exp_bonus = EXCLUDED.exp_bonus,
      image = EXCLUDED.image,
      color = EXCLUDED.color,
      is_active = EXCLUDED.is_active,
      updated_at = NOW();

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_gacha_banner(
  p_banner_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.admin_override', 'true', true);

  DELETE FROM public.gacha_banners WHERE id = p_banner_id;

  RETURN jsonb_build_object('success', true, 'id', p_banner_id);
END;
$$;
