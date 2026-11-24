-- Migration: 20261125020000_top_charisma_leaderboard.sql
-- Function to retrieve Top Charisma (Gifts) Leaderboard

CREATE OR REPLACE FUNCTION public.get_top_charisma_leaderboard(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  equipped_border TEXT,
  role TEXT,
  is_vip BOOLEAN,
  member_number BIGINT,
  level INTEGER,
  charisma_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH charisma_totals AS (
    SELECT
      g.recipient_id,
      SUM(g.charisma_value * g.quantity)::BIGINT AS total_charisma
    FROM public.user_profile_gifts g
    GROUP BY g.recipient_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY ct.total_charisma DESC, p.level DESC, p.exp DESC) AS rank,
    p.id AS user_id,
    COALESCE(p.username, 'Pengguna')::TEXT AS username,
    COALESCE(p.display_name, p.username, 'Pengguna')::TEXT AS display_name,
    COALESCE(p.avatar_url, '')::TEXT AS avatar_url,
    COALESCE(p.equipped_border, '')::TEXT AS equipped_border,
    p.role::TEXT AS role,
    COALESCE(p.is_vip, false) AS is_vip,
    p.member_number::BIGINT AS member_number,
    COALESCE(p.level, 1)::INTEGER AS level,
    ct.total_charisma AS charisma_count
  FROM charisma_totals ct
  JOIN public.profiles p ON p.id = ct.recipient_id
  WHERE (p.role IS NULL OR p.role ILIKE 'member')
  ORDER BY ct.total_charisma DESC, p.level DESC, p.exp DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_charisma_leaderboard(INTEGER) TO anon, authenticated, service_role;

