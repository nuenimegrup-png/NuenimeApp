-- ==============================================================================
-- MIGRASI: LEADERBOARD XP VIEW & INDEXES
-- File: supabase/migrations/20261015030000_leaderboard_xp.sql
-- ==============================================================================
-- Menambahkan:
-- 1. Index tambahan pada profiles.exp untuk query leaderboard all-time yang cepat
-- 2. Index tambahan pada user_xp_transactions.created_at untuk query period
-- 3. View publik leaderboard_alltime (top 100 berdasarkan total exp)
-- 4. RLS policy agar profiles bisa dibaca publik (untuk leaderboard)
-- ==============================================================================

-- 0. Tambah kolom equipped_border ke tabel profiles jika belum ada
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_border TEXT DEFAULT NULL;

-- 1. Index untuk leaderboard all-time
CREATE INDEX IF NOT EXISTS idx_profiles_exp_desc
  ON public.profiles(exp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_profiles_level_desc
  ON public.profiles(level DESC NULLS LAST);

-- 2. Index untuk leaderboard periodik (berdasarkan created_at + user_id)
CREATE INDEX IF NOT EXISTS idx_xp_tx_created_user
  ON public.user_xp_transactions(created_at DESC, user_id);

-- 3. View: Top 100 Leaderboard All-Time (dibaca tanpa auth)
CREATE OR REPLACE VIEW public.leaderboard_alltime AS
SELECT
  ROW_NUMBER() OVER (ORDER BY p.exp DESC NULLS LAST) AS rank,
  p.id                AS user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.member_number,
  p.level,
  p.exp               AS xp_gained,
  p.is_vip,
  p.equipped_border
FROM public.profiles p
WHERE p.exp > 0
ORDER BY p.exp DESC NULLS LAST
LIMIT 100;

-- 4. Pastikan RLS diaktifkan di profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama yang mungkin konflik, lalu buat ulang
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- 5. Pastikan user_xp_transactions bisa dibaca untuk leaderboard periodik
ALTER TABLE public.user_xp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read xp transactions for leaderboard" ON public.user_xp_transactions;
CREATE POLICY "Authenticated users can read xp transactions for leaderboard"
  ON public.user_xp_transactions FOR SELECT
  USING (auth.role() = 'authenticated');

-- 6. Pastikan izin UPDATE pada profiles aktif agar akun pengguna bisa menyimpan border saat dibeli & dipakai
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


