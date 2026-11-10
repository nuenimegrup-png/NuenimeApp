-- ==============================================================================
-- NUENIME - ADMIN SYSTEM GIFTS & MAILBOX CLAIM SYNCHRONIZATION
-- File: supabase/migrations/20261121000000_admin_system_gifts_and_claim_sync.sql
--
-- FOKUS:
-- 1. Izin SELECT untuk publik/anon pada system_gifts agar mailbox pemain & riwayat admin terbaca.
-- 2. Security Definer RPC: admin_create_system_gift untuk membuat hadiah massal/spesifik secara aman.
-- 3. Security Definer RPC: admin_delete_system_gift untuk menghapus hadiah & klaim terkait.
-- 4. Security Definer RPC: admin_get_all_system_gifts untuk riwayat admin.
-- 5. Penguatan claim_system_gift: Anti-double claim (1x klaim per akun), race condition guard, dan target_user_id validation.
-- 6. Izin SELECT untuk publik pada user_gift_claims agar status klaim terbaca di APK.
-- ==============================================================================

-- 1. IZIN SELECT SYSTEM_GIFTS (PUBLIK & ANON)
ALTER TABLE public.system_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_active_gifts" ON public.system_gifts;
DROP POLICY IF EXISTS "anyone_can_read_system_gifts" ON public.system_gifts;
CREATE POLICY "anyone_can_read_system_gifts"
  ON public.system_gifts
  FOR SELECT
  TO public
  USING (true);

-- 2. IZIN SELECT USER_GIFT_CLAIMS (PUBLIK & ANON)
ALTER TABLE public.user_gift_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_gift_claims" ON public.user_gift_claims;
CREATE POLICY "anyone_can_read_gift_claims"
  ON public.user_gift_claims
  FOR SELECT
  TO public
  USING (true);

-- 3. RPC: ADMIN_CREATE_SYSTEM_GIFT
CREATE OR REPLACE FUNCTION public.admin_create_system_gift(
  p_title TEXT,
  p_message TEXT,
  p_gift_type TEXT,
  p_gift_value TEXT,
  p_target_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gift RECORD;
BEGIN
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'TITLE_REQUIRED');
  END IF;

  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MESSAGE_REQUIRED');
  END IF;

  IF p_gift_type NOT IN ('crystal', 'border') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_GIFT_TYPE');
  END IF;

  -- Simpan ke tabel system_gifts
  INSERT INTO public.system_gifts (
    id,
    title,
    message,
    gift_type,
    gift_value,
    is_active,
    target_user_id,
    created_at
  ) VALUES (
    gen_random_uuid(),
    trim(p_title),
    trim(p_message),
    p_gift_type,
    trim(p_gift_value),
    true,
    p_target_user_id,
    NOW()
  )
  RETURNING id, title, message, gift_type, gift_value, is_active, target_user_id, created_at
  INTO v_gift;

  -- Buat notifikasi target jika ditujukan untuk user tertentu
  IF p_target_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, created_at)
    VALUES (
      p_target_user_id,
      '🎁 ' || v_gift.title,
      v_gift.message || ' (' || CASE WHEN v_gift.gift_type = 'crystal' THEN '+' || v_gift.gift_value || ' Dylan Crystal' ELSE 'Border: ' || v_gift.gift_value END || ')',
      'gift',
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_gift.id,
    'title', v_gift.title,
    'message', v_gift.message,
    'gift_type', v_gift.gift_type,
    'gift_value', v_gift.gift_value,
    'is_active', v_gift.is_active,
    'target_user_id', v_gift.target_user_id,
    'created_at', v_gift.created_at
  );
END;
$$;

-- 4. RPC: ADMIN_DELETE_SYSTEM_GIFT
CREATE OR REPLACE FUNCTION public.admin_delete_system_gift(
  p_gift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_gift_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_GIFT_ID');
  END IF;

  -- Hapus klaim pengguna terkait terlebih dahulu (cascade)
  DELETE FROM public.user_gift_claims WHERE gift_id = p_gift_id;

  -- Hapus hadiah dari tabel system_gifts
  DELETE FROM public.system_gifts WHERE id = p_gift_id;

  RETURN jsonb_build_object('success', true, 'deleted_id', p_gift_id);
END;
$$;

-- 5. RPC: ADMIN_GET_ALL_SYSTEM_GIFTS
CREATE OR REPLACE FUNCTION public.admin_get_all_system_gifts()
RETURNS SETOF public.system_gifts
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM public.system_gifts
  ORDER BY created_at DESC;
$$;

-- 6. RPC: CLAIM_SYSTEM_GIFT (ATOMIC ANTI-DOUBLE CLAIM 1X PER AKUN)
CREATE OR REPLACE FUNCTION public.claim_system_gift(
  p_gift_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gift RECORD;
  v_already_claimed BOOLEAN;
  v_amount INTEGER;
  v_current_bal INTEGER;
  v_new_bal INTEGER := 0;
BEGIN
  IF p_gift_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ARGUMENTS');
  END IF;

  -- 1. Ambil data hadiah
  SELECT * INTO v_gift
  FROM public.system_gifts
  WHERE id = p_gift_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'GIFT_NOT_FOUND_OR_INACTIVE');
  END IF;

  -- Jika hadiah memiliki target_user_id spesifik, pastikan hanya user tersebut yang bisa klaim
  IF v_gift.target_user_id IS NOT NULL AND v_gift.target_user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ELIGIBLE');
  END IF;

  -- 2. Cek apakah sudah pernah diklaim sebelumnya (Enforce 1x klaim per akun)
  SELECT EXISTS(
    SELECT 1 FROM public.user_gift_claims
    WHERE gift_id = p_gift_id AND user_id = p_user_id
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  -- 3. Catat klaim secara atomik dengan penanganan unique_violation (Race-Condition Guard)
  BEGIN
    INSERT INTO public.user_gift_claims (gift_id, user_id, claimed_at)
    VALUES (p_gift_id, p_user_id, NOW());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END;

  -- 4. Proses pemberian hadiah
  IF v_gift.gift_type = 'crystal' THEN
    v_amount := NULLIF(REGEXP_REPLACE(v_gift.gift_value, '[^0-9]', '', 'g'), '')::INTEGER;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      v_amount := 100;
    END IF;

    -- Kunci dan tambah saldo pengguna di user_balances
    SELECT crystal_balance INTO v_current_bal
    FROM public.user_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_bal IS NULL THEN
      v_current_bal := 0;
    END IF;

    v_new_bal := v_current_bal + v_amount;

    INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
    VALUES (p_user_id, v_new_bal, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET crystal_balance = v_new_bal,
        updated_at = NOW();

  ELSIF v_gift.gift_type = 'border' THEN
    -- Berikan border avatar ke user
    INSERT INTO public.user_border_purchases (user_id, border_id, border_name, rarity, price_paid, purchased_at)
    VALUES (p_user_id, v_gift.gift_value, v_gift.title, 'Rare', 0, NOW())
    ON CONFLICT (user_id, border_id) DO NOTHING;

    SELECT COALESCE(crystal_balance, 0) INTO v_new_bal
    FROM public.user_balances
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'gift_type', v_gift.gift_type,
    'gift_value', v_gift.gift_value,
    'new_balance', COALESCE(v_new_bal, 0)
  );
END;
$$;

-- 7. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.admin_create_system_gift(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_system_gift(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_all_system_gifts() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.claim_system_gift(UUID, UUID) TO authenticated, service_role, anon;

