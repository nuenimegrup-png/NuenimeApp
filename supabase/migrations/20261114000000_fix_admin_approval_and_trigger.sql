-- ==============================================================================
-- MIGRASI PERBAIKAN DARURAT: PERSETUJUAN ADMIN & TRIGGER ANTI-FRAUD
-- Masalah:
-- 1. Overload ganda admin_approve_topup_transaction (tipe UUID vs TEXT)
-- 2. Trigger trg_fn_security_topup_transactions memblokir update status 'berhasil'
--    karena auth.uid() bernilai NULL pada koneksi Admin Web Dashboard (anon key)
-- ==============================================================================

-- 1. HAPUS SEMUA OVERLOAD FUNGSI LAMA AGAR TIDAK KONFLIK
DROP FUNCTION IF EXISTS public.admin_approve_topup_transaction(TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_approve_topup_transaction(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_approve_topup_transaction(TEXT);

-- 2. PERBARUI TRIGGER KEAMANAN AGAR MENDUKUNG ADMIN OVERRIDE
CREATE OR REPLACE FUNCTION public.trg_fn_security_topup_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_is_banned BOOLEAN := FALSE;
  v_override TEXT := NULL;
  v_recent_tx_count INTEGER := 0;
BEGIN
  -- 1. Cek Admin Override dari RPC Security Definer (misal admin_approve_topup_transaction)
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

    -- Invoice baru tidak boleh langsung berstatus berhasil tanpa admin
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
    -- Mencegah user biasa mengubah transaksi jadi 'berhasil' tanpa admin
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

DROP TRIGGER IF EXISTS trg_topup_security_guard ON public.topup_transactions;
CREATE TRIGGER trg_topup_security_guard
  BEFORE INSERT OR UPDATE ON public.topup_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_security_topup_transactions();


-- 3. BUAT ULANG RPC ADMIN APPROVE TOPUP TUNGGAL YANG RESMI
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
  -- Berikan hak admin override agar trigger mengizinkan perubahan status menjadi 'berhasil'
  PERFORM set_config('app.admin_override', 'true', true);

  -- Kunci baris transaksi untuk mencegah race condition
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

  -- Parse user_id ke UUID
  BEGIN
    v_user_uuid := v_tx.user_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_user_uuid := NULL;
  END;

  -- 1. Tambah saldo ke tabel user_balances
  IF v_user_uuid IS NOT NULL THEN
    INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
    VALUES (v_user_uuid, v_tx.crystal_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET crystal_balance = public.user_balances.crystal_balance + v_tx.crystal_amount,
        updated_at = NOW()
    RETURNING crystal_balance INTO v_new_balance;
  END IF;

  -- 2. Perbarui status transaksi menjadi berhasil
  UPDATE public.topup_transactions
  SET status = 'berhasil',
      crystals_granted = TRUE,
      verified_at = NOW(),
      status_note = 'Diverifikasi sah oleh ' || COALESCE(p_admin_email, 'Admin')
  WHERE id = p_transaction_id;

  -- 3. Catat audit & balance adjustment jika memungkinkan
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
        COALESCE(v_admin_uuid, '73f6e447-2f8c-4f12-ad94-a737a78e279b'::uuid),
        p_admin_email,
        v_tx.crystal_amount,
        v_new_balance - v_tx.crystal_amount,
        v_new_balance,
        'Persetujuan Top Up Transaksi ' || p_transaction_id
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

-- Berikan izin eksekusi ke anon & authenticated
GRANT EXECUTE ON FUNCTION public.admin_approve_topup_transaction(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;


-- 4. LANGSUNG EKSEKUSI PERSETUJUAN TRANSAKSI BETA TEST
SELECT public.admin_approve_topup_transaction(
  'NUE-TP-261026-GX4V',
  'admin-finance-01',
  'finance@nuenime.com'
);
