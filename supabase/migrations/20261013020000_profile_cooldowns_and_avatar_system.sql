-- ==============================================================================
-- 20261013020000_profile_cooldowns_and_avatar_system.sql
-- Penambahan kolom cooldown dan RPC pembaruan profil terproteksi (Banner, Nama, Avatar)
-- ==============================================================================

-- 1. Tambah kolom cooldown ke tabel profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS name_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

-- 2. Fungsi periksa cooldown profil
CREATE OR REPLACE FUNCTION public.check_profile_cooldown(p_user_id UUID, p_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_banner_at TIMESTAMPTZ;
  v_name_at TIMESTAMPTZ;
  v_avatar_at TIMESTAMPTZ;
  v_last_at TIMESTAMPTZ;
  v_cooldown_interval INTERVAL;
  v_seconds_remaining BIGINT := 0;
  v_can_change BOOLEAN := TRUE;
BEGIN
  SELECT banner_updated_at, name_updated_at, avatar_updated_at
  INTO v_banner_at, v_name_at, v_avatar_at
  FROM public.profiles
  WHERE id = p_user_id;

  IF p_type = 'banner' THEN
    v_last_at := v_banner_at;
    v_cooldown_interval := INTERVAL '7 days';
  ELSIF p_type = 'name' THEN
    v_last_at := v_name_at;
    v_cooldown_interval := INTERVAL '24 hours';
  ELSIF p_type = 'avatar' THEN
    v_last_at := v_avatar_at;
    v_cooldown_interval := INTERVAL '24 hours';
  ELSE
    RAISE EXCEPTION 'Unknown cooldown type: %', p_type;
  END IF;

  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - v_cooldown_interval) THEN
    v_can_change := FALSE;
    v_seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_last_at + v_cooldown_interval - NOW()))::BIGINT);
  END IF;

  RETURN jsonb_build_object(
    'can_change', v_can_change,
    'seconds_remaining', v_seconds_remaining,
    'last_updated_at', v_last_at
  );
END;
$$;

-- 3. RPC: Pembaruan Banner Profil dengan Validasi Cooldown 7 Hari
CREATE OR REPLACE FUNCTION public.update_profile_banner(p_banner_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_at TIMESTAMPTZ;
  v_remaining BIGINT;
  v_clean_url TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Harus login untuk mengubah banner.';
  END IF;

  v_clean_url := NULLIF(TRIM(p_banner_url), '');

  IF v_clean_url IS NOT NULL THEN
    IF LENGTH(v_clean_url) > 2048 THEN
      RAISE EXCEPTION 'INVALID_URL: Panjang URL banner melebihi batas 2048 karakter.';
    END IF;
    IF v_clean_url !~* '^https?://.+' THEN
      RAISE EXCEPTION 'INVALID_URL: URL banner harus diawali dengan http:// atau https://';
    END IF;
  END IF;

  -- Validasi Cooldown 7 hari (604800 detik)
  SELECT banner_updated_at INTO v_last_at FROM public.profiles WHERE id = v_uid;
  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - INTERVAL '7 days') THEN
    v_remaining := EXTRACT(EPOCH FROM (v_last_at + INTERVAL '7 days' - NOW()))::BIGINT;
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:BANNER:%', v_remaining;
  END IF;

  UPDATE public.profiles
  SET
    banner_url = v_clean_url,
    banner_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'banner_url', v_clean_url,
    'banner_updated_at', NOW()
  );
END;
$$;

-- 4. RPC: Pembaruan Nama Pengguna dengan Validasi Cooldown 24 Jam
CREATE OR REPLACE FUNCTION public.update_profile_display_name(p_display_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_at TIMESTAMPTZ;
  v_remaining BIGINT;
  v_clean_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Harus login untuk mengubah nama.';
  END IF;

  v_clean_name := TRIM(p_display_name);
  IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME: Nama tampilan minimal 2 karakter.';
  END IF;

  IF LENGTH(v_clean_name) > 30 THEN
    RAISE EXCEPTION 'INVALID_NAME: Nama tampilan maksimal 30 karakter.';
  END IF;

  -- Validasi Cooldown 24 jam (86400 detik)
  SELECT name_updated_at INTO v_last_at FROM public.profiles WHERE id = v_uid;
  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - INTERVAL '24 hours') THEN
    v_remaining := EXTRACT(EPOCH FROM (v_last_at + INTERVAL '24 hours' - NOW()))::BIGINT;
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:NAME:%', v_remaining;
  END IF;

  UPDATE public.profiles
  SET
    display_name = v_clean_name,
    name_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  -- Sinkronkan juga user_metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{display_name}',
    to_jsonb(v_clean_name)
  )
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'display_name', v_clean_name,
    'name_updated_at', NOW()
  );
END;
$$;

-- 5. RPC: Pembaruan Avatar Pengguna dengan Validasi Cooldown 24 Jam
CREATE OR REPLACE FUNCTION public.update_profile_avatar(p_avatar_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_at TIMESTAMPTZ;
  v_remaining BIGINT;
  v_clean_url TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Harus login untuk mengubah avatar.';
  END IF;

  v_clean_url := NULLIF(TRIM(p_avatar_url), '');
  IF v_clean_url IS NOT NULL THEN
    IF LENGTH(v_clean_url) > 2048 THEN
      RAISE EXCEPTION 'INVALID_URL: Panjang URL avatar melebihi batas 2048 karakter.';
    END IF;
    IF v_clean_url !~* '^https?://.+' THEN
      RAISE EXCEPTION 'INVALID_URL: URL avatar harus diawali dengan http:// atau https://';
    END IF;
  END IF;

  -- Validasi Cooldown 24 jam (86400 detik)
  SELECT avatar_updated_at INTO v_last_at FROM public.profiles WHERE id = v_uid;
  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - INTERVAL '24 hours') THEN
    v_remaining := EXTRACT(EPOCH FROM (v_last_at + INTERVAL '24 hours' - NOW()))::BIGINT;
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:AVATAR:%', v_remaining;
  END IF;

  UPDATE public.profiles
  SET
    avatar_url = v_clean_url,
    avatar_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  -- Sinkronkan juga user_metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{avatar_url}',
    to_jsonb(v_clean_url)
  )
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'avatar_url', v_clean_url,
    'avatar_updated_at', NOW()
  );
END;
$$;

-- Hak akses eksekusi
GRANT EXECUTE ON FUNCTION public.check_profile_cooldown(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_banner(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_display_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_avatar(TEXT) TO authenticated;
