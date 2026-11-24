-- Migration: 20261124000000_user_profile_likes.sql
-- Fitur Like Akun Profil Pengguna

CREATE TABLE IF NOT EXISTS public.user_profile_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liker_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_user_profile_likes UNIQUE (target_user_id, liker_user_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_likes_target ON public.user_profile_likes(target_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_likes_liker ON public.user_profile_likes(liker_user_id);

ALTER TABLE public.user_profile_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile likes are viewable by everyone" ON public.user_profile_likes;
CREATE POLICY "Profile likes are viewable by everyone"
  ON public.user_profile_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can like profiles" ON public.user_profile_likes;
CREATE POLICY "Users can like profiles"
  ON public.user_profile_likes FOR INSERT
  WITH CHECK (auth.uid() = liker_user_id);

DROP POLICY IF EXISTS "Users can unlike profiles" ON public.user_profile_likes;
CREATE POLICY "Users can unlike profiles"
  ON public.user_profile_likes FOR DELETE
  USING (auth.uid() = liker_user_id);

