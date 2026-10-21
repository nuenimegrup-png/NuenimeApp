-- ==============================================================================
-- MIGRASI: SISTEM PERTEMANAN (FRIENDSHIPS) & KONTROL FILTER 18+ (CONTENT SAFETY)
-- File: supabase/migrations/20261025000000_content_safety_and_friendships_system.sql
-- Tanggal: 21 Oktober 2026
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABEL SYSTEM_CONFIGS: KONTROL FILTER KONTEN 18+ (DEWASA) DARI ADMIN DASHBOARD
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Pastikan RLS aktif dan mengizinkan pembacaan publik & penulisan admin/sistem
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view system_configs" ON public.system_configs;
CREATE POLICY "Public can view system_configs" 
  ON public.system_configs FOR SELECT USING (true);

DROP POLICY IF EXISTS "System and admin can update system_configs" ON public.system_configs;
CREATE POLICY "System and admin can update system_configs" 
  ON public.system_configs FOR ALL USING (true);

-- Inisialisasi default konfig: Mode Aman Aktif (allow_nsfw = false)
INSERT INTO public.system_configs (key, value, updated_at)
VALUES (
  'app_content_safety',
  '{"allow_nsfw": false}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;


-- ------------------------------------------------------------------------------
-- 2. TABEL PERTEMANAN RESMI NUENIME (FRIENDSHIPS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_friend UNIQUE (user_id, friend_id)
);

-- Indeks untuk pencarian cepat daftar teman & permintaan masuk
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON public.friendships(status);

-- Kebijakan Keamanan Baris (RLS) untuk friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read friendships" ON public.friendships;
CREATE POLICY "Allow read friendships" 
  ON public.friendships FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write friendships" ON public.friendships;
CREATE POLICY "Allow write friendships" 
  ON public.friendships FOR ALL USING (true);


-- ------------------------------------------------------------------------------
-- 3. REALTIME PUBLICATION
-- Daftarkan system_configs dan friendships ke publikasi realtime Supabase
-- agar perubahan filter 18+ dan notifikasi pertemanan langsung tersinkron instan.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Daftarkan system_configs ke realtime jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;
  END IF;

  -- Daftarkan friendships ke realtime jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;
END $$;
