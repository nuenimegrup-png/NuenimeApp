-- ==============================================================================
-- NUENIME - USER BORDER PURCHASES TABLE
-- Menyimpan kepemilikan border avatar per akun pengguna secara persisten di Supabase.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_border_purchases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  border_id    TEXT NOT NULL,
  border_name  TEXT NOT NULL,
  rarity       TEXT NOT NULL CHECK (rarity IN ('Mythic', 'Legends', 'Epic', 'Rare', 'Normal')),
  price_paid   INTEGER NOT NULL DEFAULT 0,
  purchased_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, border_id)
);

CREATE INDEX IF NOT EXISTS idx_border_purchases_user ON public.user_border_purchases(user_id);

-- RLS: Pengguna hanya boleh membaca/menyisipkan record milik diri sendiri.
ALTER TABLE public.user_border_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_borders"
  ON public.user_border_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_borders"
  ON public.user_border_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin service (SECURITY DEFINER functions) dapat membaca/menulis semua baris.
-- Tidak ada DELETE dari sisi user agar kepemilikan bersifat permanen.
