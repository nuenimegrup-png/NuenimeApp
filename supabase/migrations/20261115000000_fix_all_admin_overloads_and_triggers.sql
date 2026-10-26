-- ==============================================================================
-- MIGRASI PERBAIKAN LENGKAP: CLEANUP SELURUH OVERLOAD RPC & TRIGGER PROFILES
-- Menyelesaikan error PGRST203 (Multiple Choices) pada seluruh fitur Admin Panel:
-- 1. admin_set_user_ban_status (Unban & Ban akun)
-- 2. admin_update_user_role (Ubah role akun)
-- 3. admin_reset_user_cooldown (Reset cooldown nama & foto)
-- 4. admin_swap_member_numbers (Tukar nomor member ID)
-- 5. Trigger trg_fn_security_guard_profiles (Dukungan override unban & role update)
-- ==============================================================================

-- 1. HAPUS SEMUA OVERLOAD LAMA (UUID & TEXT) AGAR BERSIH TOTAL
DROP FUNCTION IF EXISTS public.admin_set_user_ban_status(UUID, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_set_user_ban_status(TEXT, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_set_user_ban_status(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_set_user_ban_status(TEXT, BOOLEAN);

DROP FUNCTION IF EXISTS public.admin_update_user_role(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_user_role(TEXT, TEXT);

DROP FUNCTION IF EXISTS public.admin_reset_user_cooldown(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_reset_user_cooldown(TEXT, TEXT);

DROP FUNCTION IF EXISTS public.admin_swap_member_numbers(UUID, UUID);
DROP FUNCTION IF EXISTS public.admin_swap_member_numbers(TEXT, TEXT);


-- 2. PERBARUI TRIGGER PROFILES AGAR MENGENALI ADMIN OVERRIDE RESMI
CREATE OR REPLACE FUNCTION public.trg_fn_security_guard_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_override TEXT := NULL;
BEGIN
  -- Cek setting admin override dari RPC Security Definer
  BEGIN
    v_override := current_setting('app.admin_override', true);
  EXCEPTION WHEN OTHERS THEN
    v_override := NULL;
  END;

  IF v_override = 'true' THEN
    v_is_admin := TRUE;
  END IF;

  IF NOT v_is_admin AND auth.uid() IS NOT NULL THEN
    SELECT (role IN ('Owner', 'Admin')) INTO v_is_admin
    FROM public.profiles
    WHERE id::text = (auth.uid())::text;
  END IF;

  IF NOT v_is_admin AND auth.uid() IS NOT NULL THEN
    SELECT (status = 'active') INTO v_is_admin
    FROM public.admin_accounts
    WHERE id::text = (auth.uid())::text;
  END IF;

  -- Jika BUKAN admin, cegah manipulasi sensitif
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    IF OLD.is_banned = TRUE AND NEW.is_banned = FALSE THEN
      RAISE EXCEPTION 'UNAUTHORIZED_UNBAN_ATTEMPT: Akun diblokir tidak dapat mengaktifkan diri sendiri.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;

    IF OLD.is_banned = TRUE THEN
      NEW.is_banned := OLD.is_banned;
      NEW.banned_at := OLD.banned_at;
      NEW.banned_by := OLD.banned_by;
      NEW.ban_reason := OLD.ban_reason;
    END IF;
  END IF;

  -- Sanitasi script injection
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


-- 3. BUAT RPC BAN / UNBAN AKUN TUNGGAL YANG RESMI
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

GRANT EXECUTE ON FUNCTION public.admin_set_user_ban_status(TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated, service_role;


-- 4. BUAT RPC UBAH ROLE AKUN TUNGGAL YANG RESMI
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

GRANT EXECUTE ON FUNCTION public.admin_update_user_role(TEXT, TEXT) TO anon, authenticated, service_role;


-- 5. BUAT RPC RESET COOLDOWN PROFIL TUNGGAL YANG RESMI
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

GRANT EXECUTE ON FUNCTION public.admin_reset_user_cooldown(TEXT, TEXT) TO anon, authenticated, service_role;


-- 6. BUAT RPC TUKAR NOMOR MEMBER TUNGGAL YANG RESMI
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

  v_temp_num := 900000000 + FLOOR(RANDOM() * 90000000)::INTEGER + v_num_a;

  UPDATE public.profiles SET member_number = v_temp_num, updated_at = NOW() WHERE id::text = p_user_a_id::text;
  UPDATE public.profiles SET member_number = v_num_a, updated_at = NOW() WHERE id::text = p_user_b_id::text;
  UPDATE public.profiles SET member_number = v_num_b, updated_at = NOW() WHERE id::text = p_user_a_id::text;

  RETURN jsonb_build_object('success', true, 'user_a_num', v_num_b, 'user_b_num', v_num_a);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_swap_member_numbers(TEXT, TEXT) TO anon, authenticated, service_role;
