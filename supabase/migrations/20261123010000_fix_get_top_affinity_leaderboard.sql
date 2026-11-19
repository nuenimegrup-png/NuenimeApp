-- ==============================================================================
-- FIX: REPAIR get_top_affinity_leaderboard & boost_affinity_bond_xp
-- 1. get_top_affinity_leaderboard: Memperbaiki alias ganda dan memastikan tanda kurung seimbang 100%
-- 2. boost_affinity_bond_xp: Aturan sapaan 1 hari hanya 1x per akun, bonus XP +200
-- ==============================================================================

-- 1. FUNGSI LEADERBOARD
CREATE OR REPLACE FUNCTION public.get_top_affinity_leaderboard(
  p_tier_id TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  bond_id UUID,
  tier_id TEXT,
  user_a_id UUID,
  user_a_name TEXT,
  user_a_avatar TEXT,
  user_a_border TEXT,
  user_a_initial TEXT,
  user_b_id UUID,
  user_b_name TEXT,
  user_b_avatar TEXT,
  user_b_border TEXT,
  user_b_initial TEXT,
  duo_title TEXT,
  level INTEGER,
  xp INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH paired_bonds AS (
    -- Ambil pasangan unik berdasarkan LEAST & GREATEST agar tidak duplikat A-B dan B-A
    SELECT DISTINCT ON (LEAST(b.user_id, b.friend_id), GREATEST(b.user_id, b.friend_id), b.tier_id)
      b.id AS b_id,
      b.tier_id AS b_tier,
      LEAST(b.user_id, b.friend_id) AS u_a,
      GREATEST(b.user_id, b.friend_id) AS u_b,
      b.level AS b_level,
      b.xp AS b_xp
    FROM public.user_affinity_bonds b
    LEFT JOIN public.user_affinity_settings s_a ON s_a.user_id = LEAST(b.user_id, b.friend_id)
    LEFT JOIN public.user_affinity_settings s_b ON s_b.user_id = GREATEST(b.user_id, b.friend_id)
    WHERE b.tier_id = p_tier_id
      AND COALESCE(s_a.privacy, 'publik') = 'publik'
      AND COALESCE(s_b.privacy, 'publik') = 'publik'
    ORDER BY LEAST(b.user_id, b.friend_id), GREATEST(b.user_id, b.friend_id), b.tier_id, b.xp DESC
  )
  SELECT
    cte.b_id AS bond_id,
    cte.b_tier AS tier_id,
    cte.u_a AS user_a_id,
    COALESCE(prof_a.display_name, prof_a.username, 'Pengguna')::TEXT AS user_a_name,
    COALESCE(prof_a.avatar_url, '')::TEXT AS user_a_avatar,
    COALESCE(prof_a.equipped_border, '')::TEXT AS user_a_border,
    UPPER(LEFT(COALESCE(prof_a.display_name, prof_a.username, 'A'), 1))::TEXT AS user_a_initial,
    cte.u_b AS user_b_id,
    COALESCE(prof_b.display_name, prof_b.username, 'Pengguna')::TEXT AS user_b_name,
    COALESCE(prof_b.avatar_url, '')::TEXT AS user_b_avatar,
    COALESCE(prof_b.equipped_border, '')::TEXT AS user_b_border,
    UPPER(LEFT(COALESCE(prof_b.display_name, prof_b.username, 'B'), 1))::TEXT AS user_b_initial,
    (COALESCE(prof_a.display_name, prof_a.username, 'Pengguna') || ' & ' || COALESCE(prof_b.display_name, prof_b.username, 'Pengguna'))::TEXT AS duo_title,
    cte.b_level AS level,
    cte.b_xp AS xp
  FROM paired_bonds cte
  LEFT JOIN public.profiles prof_a ON prof_a.id = cte.u_a
  LEFT JOIN public.profiles prof_b ON prof_b.id = cte.u_b
  ORDER BY cte.b_xp DESC, cte.b_level DESC
  LIMIT p_limit;
END;
$$;

-- 2. FUNGSI BOOST SAPAAN (+200 XP, 1 HARI HANYA 1X PER AKUN)
CREATE OR REPLACE FUNCTION public.boost_affinity_bond_xp(
  p_bond_id UUID,
  p_xp_gain INTEGER DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_new_streak INTEGER;
  v_paired_id UUID;
  v_gain INTEGER;
BEGIN
  v_gain := COALESCE(p_xp_gain, 200);

  -- Ambil data bond
  SELECT * INTO v_bond
  FROM public.user_affinity_bonds
  WHERE id = p_bond_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Ikatan afinitas tidak ditemukan.'
    );
  END IF;

  -- 1 HARI HANYA 1X UNTUK SATU AKUN:
  -- Cek apakah sapaan sudah dikirim hari ini (Asia/Jakarta / WIB)
  IF v_bond.last_interaction_at IS NOT NULL AND 
     (v_bond.last_interaction_at AT TIME ZONE 'Asia/Jakarta')::DATE = (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ALREADY_GREETED_TODAY',
      'message', 'Sapaan sudah dikirim hari ini. Kamu hanya dapat menyapa 1x sehari untuk akun ini.'
    );
  END IF;

  -- Hitung level baru (clamp 1-30)
  v_new_xp := v_bond.xp + v_gain;
  v_new_level := LEAST(30, FLOOR(v_new_xp / 800) + 1);
  v_new_streak := v_bond.streak_days + 1;
  v_paired_id := v_bond.paired_bond_id;

  -- Update bond pengguna
  UPDATE public.user_affinity_bonds
  SET xp = v_new_xp,
      level = v_new_level,
      streak_days = v_new_streak,
      last_interaction_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bond_id;

  -- Update juga bond timbal balik pasangannya jika ada
  IF v_paired_id IS NOT NULL THEN
    UPDATE public.user_affinity_bonds
    SET xp = v_new_xp,
        level = v_new_level,
        streak_days = v_new_streak,
        last_interaction_at = NOW(),
        updated_at = NOW()
    WHERE id = v_paired_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Sapaan berhasil dikirim! (+200 XP)',
    'xp', v_new_xp,
    'level', v_new_level,
    'streak', v_new_streak
  );
END;
$$;

-- Izin eksekusi RPC untuk semua peran (anon, authenticated, service_role)
GRANT EXECUTE ON FUNCTION public.get_top_affinity_leaderboard(TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_affinity_invite_atomic(UUID, UUID, TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_affinity_invite_atomic(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_affinity_bond_atomic(UUID, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.boost_affinity_bond_xp(UUID, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.break_affinity_bond(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_affinity_tier_max_slots(TEXT) TO anon, authenticated, service_role;

-- Muat ulang schema cache PostgREST agar fungsi segera terbaca
NOTIFY pgrst, 'reload schema';
