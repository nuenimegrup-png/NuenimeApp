-- ==============================================================================
-- 20261023000000_user_management_roles_and_moderation.sql
-- Penambahan sistem role 16 level, status blokir akun, cooldown profil, dan pertemanan
-- ==============================================================================

-- 1. Tambah kolom role, status blokir akun, dan cooldown profil ke tabel profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'Member',
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_by TEXT,
  ADD COLUMN IF NOT EXISTS banner_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS name_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

-- 2. Index untuk pencarian cepat role & status akun
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- 3. Tabel pertemanan resmi Nuenime
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_friend UNIQUE (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friendships' AND policyname = 'Allow read friendships'
  ) THEN
    CREATE POLICY "Allow read friendships" 
      ON public.friendships FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friendships' AND policyname = 'Allow write friendships'
  ) THEN
    CREATE POLICY "Allow write friendships" 
      ON public.friendships FOR ALL USING (true);
  END IF;
END $$;

-- 4. Izinkan Administrator & Sistem memperbarui kolom profiles (Role, Cooldown, Moderasi Status Akun)
DROP POLICY IF EXISTS "Allow admin update profiles" ON public.profiles;
CREATE POLICY "Allow admin update profiles"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 5. RPC Security Definer Function: admin_update_user_role
-- Berfungsi untuk mengubah role akun tanpa terhalang pembatasan RLS auth.uid()
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id UUID,
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
  UPDATE public.profiles
  SET 
    role = p_new_role,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING id, username, role INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pengguna tidak ditemukan di database');
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_row.id, 'role', v_row.role);
END;
$$;

-- 6. RPC Security Definer Function: admin_set_user_ban_status
-- Berfungsi untuk blokir atau buka blokir akun
CREATE OR REPLACE FUNCTION public.admin_set_user_ban_status(
  p_user_id UUID,
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
  UPDATE public.profiles
  SET 
    is_banned = p_is_banned,
    ban_reason = CASE WHEN p_is_banned THEN p_reason ELSE NULL END,
    banned_by = CASE WHEN p_is_banned THEN p_banned_by ELSE NULL END,
    banned_at = CASE WHEN p_is_banned THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING id, username, is_banned INTO v_row;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pengguna tidak ditemukan di database');
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_row.id, 'is_banned', v_row.is_banned);
END;
$$;

-- 7. RPC Security Definer Function: admin_reset_user_cooldown
-- Berfungsi untuk mereset waktu cooldown (name, avatar, atau banner)
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
  IF p_type = 'name' THEN
    UPDATE public.profiles SET name_updated_at = NULL, updated_at = NOW() WHERE id = p_user_id;
  ELSIF p_type = 'avatar' THEN
    UPDATE public.profiles SET avatar_updated_at = NULL, updated_at = NOW() WHERE id = p_user_id;
  ELSIF p_type = 'banner' THEN
    UPDATE public.profiles SET banner_updated_at = NULL, updated_at = NOW() WHERE id = p_user_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Tipe cooldown tidak valid (harus name, avatar, atau banner)');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

