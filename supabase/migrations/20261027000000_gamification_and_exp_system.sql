-- ==============================================================================
-- NUENIME GAMIFICATION, QUESTS & EXP ADJUSTMENT SYSTEM MIGRATION
-- File: supabase/migrations/20261027000000_gamification_and_exp_system.sql
-- ==============================================================================
-- Migrasi lengkap untuk fitur Gamifikasi Admin (Leaderboard, Misi & Quests, Aturan EXP):
-- 1. Kolom exp & level pada tabel public.profiles + Index leaderboard
-- 2. Tabel public.user_xp_transactions (riwayat mutasi EXP: bonus, penalty, koreksi)
-- 3. Tabel public.system_configs (penyimpanan konfigurasi quests_config & exp_rules)
-- 4. Fungsi PostgreSQL: calculate_user_level & admin_adjust_user_exp
-- 5. RLS Policies yang aman dan izin Realtime sinkronisasi
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PASTIKAN KOLOM EXP & LEVEL PADA TABEL PROFILES ADA
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exp BIGINT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE NOT NULL;

-- Index performa tinggi untuk sorting Leaderboard Top 50 & pencarian
CREATE INDEX IF NOT EXISTS idx_profiles_exp_desc
  ON public.profiles(exp DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_profiles_level_desc
  ON public.profiles(level DESC NULLS LAST);

-- ------------------------------------------------------------------------------
-- 2. TABEL RIWAYAT TRANSAKSI EXP (USER_XP_TRANSACTIONS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'admin_bonus', 'admin_penalty', 'admin_manual_override', 'watch_episode', 'daily_login', dll.
  target_id TEXT NOT NULL,
  base_xp INTEGER NOT NULL,
  bonus_xp INTEGER DEFAULT 0 NOT NULL,
  total_xp INTEGER NOT NULL,
  multiplier NUMERIC DEFAULT 1.0 NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_xp_transactions_user_date
  ON public.user_xp_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_xp_transactions_type
  ON public.user_xp_transactions(activity_type);

-- RLS Policies untuk user_xp_transactions
ALTER TABLE public.user_xp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own xp transactions" ON public.user_xp_transactions;
CREATE POLICY "Users can view own xp transactions"
  ON public.user_xp_transactions FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow insert xp transactions" ON public.user_xp_transactions;
CREATE POLICY "Allow insert xp transactions"
  ON public.user_xp_transactions FOR INSERT
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. TABEL SYSTEM_CONFIGS (QUESTS & ATURAN EXP)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view system_configs" ON public.system_configs;
CREATE POLICY "Public can view system_configs"
  ON public.system_configs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all manage system_configs" ON public.system_configs;
CREATE POLICY "Allow all manage system_configs"
  ON public.system_configs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed Data: Aturan EXP Dasar (exp_rules) jika belum ada
INSERT INTO public.system_configs (key, value, updated_at)
VALUES (
  'exp_rules',
  jsonb_build_object(
    'watch_episode', 20,
    'comment', 5,
    'daily_login', 10,
    'weekend_boost_active', true,
    'weekend_multiplier', 1.5
  ),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Seed Data: Daftar Misi & Quests (quests_config) jika belum ada
INSERT INTO public.system_configs (key, value, updated_at)
VALUES (
  'quests_config',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'q_watch_3',
      'title', 'Nonton 3 Episode Anime',
      'desc', 'Selesaikan 3 episode anime hari ini',
      'type', 'daily',
      'expReward', 60,
      'crystalReward', 10,
      'isActive', true,
      'icon', 'play-circle-outline'
    ),
    jsonb_build_object(
      'id', 'q_comment_3',
      'title', 'Diskusi & Komentar',
      'desc', 'Tulis 3 komentar pada episode atau forum anime',
      'type', 'daily',
      'expReward', 30,
      'crystalReward', 5,
      'isActive', true,
      'icon', 'comment-text-multiple-outline'
    ),
    jsonb_build_object(
      'id', 'q_login_daily',
      'title', 'Presensi Login Harian',
      'desc', 'Buka dan login ke aplikasi Nuenime hari ini',
      'type', 'daily',
      'expReward', 25,
      'crystalReward', 5,
      'isActive', true,
      'icon', 'calendar-check'
    ),
    jsonb_build_object(
      'id', 'q_gacha_spin',
      'title', 'Coba Keberuntungan Gacha',
      'desc', 'Lakukan summon 1x pada banner gacha apa saja',
      'type', 'daily',
      'expReward', 50,
      'crystalReward', 15,
      'isActive', true,
      'icon', 'crystal-ball'
    ),
    jsonb_build_object(
      'id', 'q_week_marathon',
      'title', 'Maraton Anime Mingguan',
      'desc', 'Tonton total 15 episode anime dalam 1 minggu',
      'type', 'weekly',
      'expReward', 250,
      'crystalReward', 50,
      'isActive', true,
      'icon', 'fire'
    ),
    jsonb_build_object(
      'id', 'q_week_share',
      'title', 'Dukung Kreator & Bagikan',
      'desc', 'Bagikan tautan anime ke media sosial sebanyak 5 kali',
      'type', 'weekly',
      'expReward', 120,
      'crystalReward', 25,
      'isActive', true,
      'icon', 'share-variant'
    )
  ),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. FUNGSI KALKULASI LEVEL DARI TOTAL EXP (KURVA EXP RESMI NUENIME)
-- Rumus: Level 1 -> 2 butuh 50 EXP. Setiap level berikutnya butuh +15 EXP.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_user_level(p_total_xp BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_xp BIGINT := GREATEST(0, COALESCE(p_total_xp, 0));
  v_level INTEGER := 1;
  v_base BIGINT := 0;
  v_cost BIGINT;
BEGIN
  LOOP
    v_cost := 50 + (v_level - 1) * 15;
    IF v_xp < v_base + v_cost THEN
      RETURN v_level;
    END IF;
    v_base := v_base + v_cost;
    v_level := v_level + 1;
    IF v_level >= 200000 THEN
      RETURN v_level;
    END IF;
  END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. STORED PROCEDURE: ADMIN ADJUST USER EXP (TAMBAH, KURANGI, SET NILAI EXP)
-- Memastikan atomisitas database saat admin mengubah EXP pemain.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_user_exp(
  p_user_id UUID,
  p_mode TEXT,          -- 'add', 'deduct', atau 'set'
  p_amount BIGINT,       -- jumlah EXP
  p_reason TEXT DEFAULT '',
  p_admin_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  old_exp BIGINT,
  new_exp BIGINT,
  old_level INTEGER,
  new_level INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_exp BIGINT;
  v_old_level INTEGER;
  v_new_exp BIGINT;
  v_new_level INTEGER;
  v_diff BIGINT;
  v_activity_type TEXT;
  v_desc TEXT;
BEGIN
  -- Ambil data EXP dan Level saat ini
  SELECT exp, level INTO v_old_exp, v_old_level
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::BIGINT, 0::BIGINT, 0, 0, 'Pengguna tidak ditemukan'::TEXT;
    RETURN;
  END IF;

  v_old_exp := COALESCE(v_old_exp, 0);
  v_old_level := COALESCE(v_old_level, 1);

  -- Hitung EXP baru berdasarkan mode
  IF p_mode = 'add' THEN
    v_new_exp := v_old_exp + GREATEST(0, p_amount);
    v_activity_type := 'admin_bonus';
    v_desc := COALESCE(NULLIF(TRIM(p_reason), ''), 'Bonus EXP dari Administrator');
  ELSIF p_mode = 'deduct' THEN
    v_new_exp := GREATEST(0, v_old_exp - GREATEST(0, p_amount));
    v_activity_type := 'admin_penalty';
    v_desc := COALESCE(NULLIF(TRIM(p_reason), ''), 'Pengurangan EXP oleh Administrator');
  ELSIF p_mode = 'set' THEN
    v_new_exp := GREATEST(0, p_amount);
    v_activity_type := 'admin_manual_override';
    v_desc := COALESCE(NULLIF(TRIM(p_reason), ''), 'Koreksi Manual EXP oleh Administrator');
  ELSE
    RETURN QUERY SELECT false, v_old_exp, v_old_exp, v_old_level, v_old_level, 'Mode penyesuaian tidak valid (harus add, deduct, atau set)'::TEXT;
    RETURN;
  END IF;

  v_diff := v_new_exp - v_old_exp;
  v_new_level := public.calculate_user_level(v_new_exp);

  -- Update profiles
  UPDATE public.profiles
  SET
    exp = v_new_exp,
    level = v_new_level,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Insert riwayat transaksi EXP
  INSERT INTO public.user_xp_transactions (
    user_id,
    activity_type,
    target_id,
    base_xp,
    bonus_xp,
    total_xp,
    multiplier,
    description,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    v_activity_type,
    'admin_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT,
    v_diff::INTEGER,
    0,
    v_diff::INTEGER,
    1.0,
    v_desc,
    jsonb_build_object(
      'admin_id', p_admin_id,
      'mode', p_mode,
      'old_exp', v_old_exp,
      'new_exp', v_new_exp,
      'old_level', v_old_level,
      'new_level', v_new_level
    ),
    NOW()
  );

  RETURN QUERY SELECT true, v_old_exp, v_new_exp, v_old_level, v_new_level, 'Berhasil memperbarui EXP dan Level'::TEXT;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. PUBLIKASI REALTIME (SUPABASE REALTIME REPLICATION)
-- ------------------------------------------------------------------------------
ALTER TABLE public.system_configs REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
