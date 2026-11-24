-- Migration: 20261125000000_user_profile_gifts_system.sql
-- Fitur Kirim Gift Profil (Mobile Legends Style)

CREATE TABLE IF NOT EXISTS public.user_profile_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_id TEXT NOT NULL,
  gift_name TEXT NOT NULL,
  gift_price INTEGER NOT NULL DEFAULT 0,
  currency_type TEXT NOT NULL DEFAULT 'crystal', -- 'crystal' atau 'coin'
  charisma_value INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profile_gifts_recipient ON public.user_profile_gifts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_profile_gifts_sender ON public.user_profile_gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_profile_gifts_created ON public.user_profile_gifts(created_at DESC);

ALTER TABLE public.user_profile_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile gifts are viewable by everyone" ON public.user_profile_gifts;
CREATE POLICY "Profile gifts are viewable by everyone"
  ON public.user_profile_gifts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can send profile gifts" ON public.user_profile_gifts;
CREATE POLICY "Authenticated users can send profile gifts"
  ON public.user_profile_gifts FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- RPC: Mengambil total Charisma dan ringkasan gift pengguna
CREATE OR REPLACE FUNCTION public.get_user_gift_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_charisma BIGINT := 0;
  v_total_gifts_count BIGINT := 0;
  v_top_gifts JSONB := '[]'::JSONB;
BEGIN
  -- Hitung total charisma yang diterima
  SELECT
    COALESCE(SUM(g.charisma_value * g.quantity), 0),
    COALESCE(SUM(g.quantity), 0)
  INTO v_total_charisma, v_total_gifts_count
  FROM public.user_profile_gifts g
  WHERE g.recipient_id = p_user_id;

  -- Ringkasan per jenis gift
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'gift_id', sub.gift_id,
        'gift_name', sub.gift_name,
        'total_quantity', sub.total_qty,
        'total_charisma', sub.total_char
      ) ORDER BY sub.total_char DESC
    ),
    '[]'::JSONB
  )
  INTO v_top_gifts
  FROM (
    SELECT
      g.gift_id,
      g.gift_name,
      SUM(g.quantity) AS total_qty,
      SUM(g.charisma_value * g.quantity) AS total_char
    FROM public.user_profile_gifts g
    WHERE g.recipient_id = p_user_id
    GROUP BY g.gift_id, g.gift_name
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'total_charisma', v_total_charisma,
    'total_gifts_count', v_total_gifts_count,
    'top_gifts', v_top_gifts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_gift_summary(UUID) TO anon, authenticated, service_role;

