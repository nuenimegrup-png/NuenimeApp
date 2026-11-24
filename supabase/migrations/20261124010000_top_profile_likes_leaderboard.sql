-- Migration: 20261124010000_top_profile_likes_leaderboard.sql
-- Function to retrieve Top Profile Likes Leaderboard

CREATE OR REPLACE FUNCTION public.get_top_profile_likes_leaderboard(
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
  likes_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH like_counts AS (
    SELECT
      l.target_user_id,
      COUNT(*)::BIGINT AS total_likes
    FROM public.user_profile_likes l
    GROUP BY l.target_user_id
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY lc.total_likes DESC, p.level DESC, p.exp DESC) AS rank,
    p.id AS user_id,
    COALESCE(p.username, 'Pengguna')::TEXT AS username,
    COALESCE(p.display_name, p.username, 'Pengguna')::TEXT AS display_name,
    COALESCE(p.avatar_url, '')::TEXT AS avatar_url,
    COALESCE(p.equipped_border, '')::TEXT AS equipped_border,
    p.role::TEXT AS role,
    COALESCE(p.is_vip, false) AS is_vip,
    p.member_number::BIGINT AS member_number,
    COALESCE(p.level, 1)::INTEGER AS level,
    lc.total_likes AS likes_count
  FROM like_counts lc
  JOIN public.profiles p ON p.id = lc.target_user_id
  WHERE (p.role IS NULL OR p.role ILIKE 'member')
  ORDER BY lc.total_likes DESC, p.level DESC, p.exp DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_profile_likes_leaderboard(INTEGER) TO anon, authenticated, service_role;

