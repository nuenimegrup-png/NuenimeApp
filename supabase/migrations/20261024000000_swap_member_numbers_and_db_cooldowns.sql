-- ==============================================================================
-- 20261024000000_swap_member_numbers_and_db_cooldowns.sql
-- 1. Penambahan/Verifikasi kolom cooldown profil di database
-- 2. RPC admin_swap_member_numbers untuk menukar nomor member (contoh #0001 ditukar dengan #0005)
-- 3. RPC admin_reset_user_cooldown untuk membatalkan/mereset waktu cooldown (name, avatar, banner, atau all)
-- ==============================================================================

-- 1. Pastikan kolom cooldown profil tersedia di tabel profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS name_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

-- 2. RPC: Tukar Nomor Member Antar 2 Akun (Aman dari Collision Unique Constraint)
CREATE OR REPLACE FUNCTION public.admin_swap_member_numbers(
  p_user_a_id UUID,
  p_user_b_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num_a BIGINT;
  v_num_b BIGINT;
  v_user_a_name TEXT;
  v_user_b_name TEXT;
BEGIN
  IF p_user_a_id = p_user_b_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak dapat menukar nomor member dengan akun yang sama');
  END IF;

  SELECT member_number, username INTO v_num_a, v_user_a_name FROM public.profiles WHERE id = p_user_a_id;
  SELECT member_number, username INTO v_num_b, v_user_b_name FROM public.profiles WHERE id = p_user_b_id;

  IF v_num_a IS NULL OR v_num_b IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Salah satu akun tidak memiliki nomor member');
  END IF;

  -- Langkah 1: Pindahkan sementara nomor User A ke angka dummy untuk mencegah bentrok UNIQUE constraint
  UPDATE public.profiles
  SET member_number = (900000000 + v_num_a), updated_at = NOW()
  WHERE id = p_user_a_id;

  -- Langkah 2: Ubah nomor User B ke nomor lama User A
  UPDATE public.profiles
  SET member_number = v_num_a, updated_at = NOW()
  WHERE id = p_user_b_id;

  -- Langkah 3: Ubah nomor User A ke nomor lama User B
  UPDATE public.profiles
  SET member_number = v_num_b, updated_at = NOW()
  WHERE id = p_user_a_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_a_id', p_user_a_id,
    'user_a_name', v_user_a_name,
    'user_a_new_number', v_num_b,
    'user_b_id', p_user_b_id,
    'user_b_name', v_user_b_name,
    'user_b_new_number', v_num_a
  );
END;
$$;

-- 3. RPC: Reset / Batalkan Cooldown Profil Pengguna
CREATE OR REPLACE FUNCTION public.admin_reset_user_cooldown(
  p_user_id UUID,
  p_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_type = 'all' THEN
    UPDATE public.profiles
    SET name_updated_at = NULL, avatar_updated_at = NULL, banner_updated_at = NULL, updated_at = NOW()
    WHERE id = p_user_id;
  ELSIF p_type = 'name' THEN
    UPDATE public.profiles
    SET name_updated_at = NULL, updated_at = NOW()
    WHERE id = p_user_id;
  ELSIF p_type = 'avatar' THEN
    UPDATE public.profiles
    SET avatar_updated_at = NULL, updated_at = NOW()
    WHERE id = p_user_id;
  ELSIF p_type = 'banner' THEN
    UPDATE public.profiles
    SET banner_updated_at = NULL, updated_at = NOW()
    WHERE id = p_user_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Tipe cooldown tidak valid (harus all, name, avatar, atau banner)');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Grant izin eksekusi ke authenticated dan public
GRANT EXECUTE ON FUNCTION public.admin_swap_member_numbers(UUID, UUID) TO authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_cooldown(UUID, TEXT) TO authenticated, anon, public;
