-- ==============================================================================
-- NUENIME - SUPABASE DATABASE MIGRATION SCRIPT
-- ==============================================================================
-- Menyiapkan seluruh tabel, RLS (Row Level Security), trigger otomatis profil,
-- indeks performa, dan relasi data untuk Nuenime Anime Streaming.
-- Jalankan skrip ini langsung di SQL Editor Supabase Dashboard Anda.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABEL: PROFILES
-- Menyimpan data profil pengguna yang terhubung langsung dengan auth.users.
-- ==============================================================================
CREATE SEQUENCE IF NOT EXISTS public.profile_member_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  location TEXT,
  socials JSONB DEFAULT '{}'::jsonb,
  member_number BIGINT UNIQUE DEFAULT nextval('public.profile_member_seq'),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 3. TABEL: BOOKMARKS (SUBSCRIBE / FAVORIT)
-- Menyimpan daftar anime langganan / tersimpan dari setiap pengguna.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  image TEXT,
  score NUMERIC,
  type TEXT,
  added_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT NOT NULL,
  CONSTRAINT uq_bookmarks_user_anime UNIQUE (user_id, anime_id)
);

-- ==============================================================================
-- 4. TABEL: WATCH_HISTORY (RIWAYAT NONTON)
-- Menyimpan riwayat episode yang ditonton, durasi, dan progres durasi (resume).
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  anime_title TEXT NOT NULL,
  anime_image TEXT,
  episode_number INTEGER NOT NULL,
  episode_title TEXT,
  episode_thumbnail TEXT,
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT NOT NULL,
  progress NUMERIC DEFAULT 0 NOT NULL,
  duration NUMERIC DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_watch_history_user_anime_ep UNIQUE (user_id, anime_id, episode_number)
);

-- ==============================================================================
-- 5. TABEL: EPISODE_RATINGS (RATING EPISODE)
-- Menyimpan skor rating (1-10) yang diberikan user untuk episode anime.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.episode_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_episode_ratings_user_anime_ep UNIQUE (user_id, anime_id, episode_number)
);

-- ==============================================================================
-- 6. TABEL: NOTIFICATIONS (PEMBERITAHUAN / ALERTS)
-- Notifikasi episode baru, rilis jadwal, atau sistem.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'system',
  anime_id INTEGER,
  episode_number INTEGER,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 7. TABEL: COMMENTS (KOMENTAR & DISKUSI)
-- Komentar diskusi episode anime & balasan (thread).
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  episode_number INTEGER,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  gif_url TEXT,
  is_spoiler BOOLEAN DEFAULT FALSE NOT NULL,
  likes INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 8. TABEL: COMMENT_LIKES (LIKE KOMENTAR)
-- Relasi like komentar agar satu user hanya bisa memberi like 1 kali.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_comment_likes_user_comment UNIQUE (user_id, comment_id)
);

-- ==============================================================================
-- 9. TABEL TAMBAHAN: USER_SETTINGS & USER_ROLES (MENCEGAH ERROR DELETE ACCOUNT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_user_settings_user UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'user' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_user_roles_user UNIQUE (user_id)
);

-- ==============================================================================
-- 10. INDEXES (PENGOPTIMALAN PERFORMA QUERY)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON public.watch_history(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_history_anime ON public.watch_history(anime_id, episode_number);
CREATE INDEX IF NOT EXISTS idx_episode_ratings_lookup ON public.episode_ratings(user_id, anime_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_anime ON public.comments(anime_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_lookup ON public.comment_likes(user_id, comment_id);

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- Menjamin keamanan data setiap user hanya dapat diakses & diubah oleh pemiliknya.
-- ==============================================================================

-- PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- BOOKMARKS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can view own bookmarks"
  ON public.bookmarks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can insert own bookmarks"
  ON public.bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can delete own bookmarks"
  ON public.bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- WATCH_HISTORY
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own watch history" ON public.watch_history;
CREATE POLICY "Users can view own watch history"
  ON public.watch_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own watch history" ON public.watch_history;
CREATE POLICY "Users can insert own watch history"
  ON public.watch_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own watch history" ON public.watch_history;
CREATE POLICY "Users can update own watch history"
  ON public.watch_history FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own watch history" ON public.watch_history;
CREATE POLICY "Users can delete own watch history"
  ON public.watch_history FOR DELETE
  USING (auth.uid() = user_id);

-- EPISODE_RATINGS
ALTER TABLE public.episode_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON public.episode_ratings;
CREATE POLICY "Ratings are viewable by everyone"
  ON public.episode_ratings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own ratings" ON public.episode_ratings;
CREATE POLICY "Users can manage own ratings"
  ON public.episode_ratings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- COMMENTS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
CREATE POLICY "Users can update own comments"
  ON public.comments FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- COMMENT_LIKES
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comment likes are viewable by everyone" ON public.comment_likes;
CREATE POLICY "Comment likes are viewable by everyone"
  ON public.comment_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can like comments" ON public.comment_likes;
CREATE POLICY "Authenticated users can like comments"
  ON public.comment_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own likes" ON public.comment_likes;
CREATE POLICY "Users can remove own likes"
  ON public.comment_likes FOR DELETE
  USING (auth.uid() = user_id);

-- USER_SETTINGS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings"
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- USER_ROLES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- ==============================================================================
-- 12. AUTOMATIC PROFILE CREATION TRIGGER (GOOGLE OAUTH SIGNUP)
-- Saat user login via Google OAuth pertama kali, trigger ini otomatis mengambil
-- nama lengkap, avatar dari akun Google, dan menyimpannya di tabel public.profiles!
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  extracted_username TEXT;
  extracted_display_name TEXT;
  extracted_avatar_url TEXT;
BEGIN
  -- Ekstrak display name dari metadata Google OAuth
  extracted_display_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    SPLIT_PART(new.email, '@', 1),
    'Nuenime Member'
  );

  -- Ekstrak atau generate username unik
  extracted_username := LOWER(REGEXP_REPLACE(
    COALESCE(
      new.raw_user_meta_data->>'user_name',
      SPLIT_PART(new.email, '@', 1),
      'user_' || SUBSTRING(new.id::text, 1, 6)
    ),
    '[^a-zA-Z0-9_]', '_', 'g'
  ));

  -- Pastikan panjang username 3-20 karakter
  IF LENGTH(extracted_username) < 3 THEN
    extracted_username := extracted_username || '_' || SUBSTRING(new.id::text, 1, 4);
  ELSIF LENGTH(extracted_username) > 20 THEN
    extracted_username := SUBSTRING(extracted_username, 1, 20);
  END IF;

  -- Ekstrak avatar URL dari Google
  extracted_avatar_url := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    NULL
  );

  -- Masukkan profil baru atau perbarui jika sudah ada
  INSERT INTO public.profiles (id, username, display_name, avatar_url, member_number)
  VALUES (
    new.id,
    extracted_username,
    extracted_display_name,
    extracted_avatar_url,
    nextval('public.profile_member_seq')
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Pasang trigger ke auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 13. SISTEM LEVEL & EXP PER AKUN SERTA PENGHAPUSAN KOMENTAR AMAN
-- ==============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exp BIGINT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  base_xp INTEGER NOT NULL,
  bonus_xp INTEGER DEFAULT 0 NOT NULL,
  total_xp INTEGER NOT NULL,
  multiplier NUMERIC DEFAULT 1.0 NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_user_xp_activity_target UNIQUE (user_id, activity_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_user_xp_transactions_user_date
  ON public.user_xp_transactions(user_id, created_at DESC);

ALTER TABLE public.user_xp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own xp transactions" ON public.user_xp_transactions;
CREATE POLICY "Users can view own xp transactions"
  ON public.user_xp_transactions FOR SELECT
  USING (auth.uid() = user_id);

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

CREATE OR REPLACE FUNCTION public.grant_user_xp(
  p_activity_type TEXT,
  p_target_id TEXT,
  p_base_xp INTEGER,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_vip BOOLEAN := FALSE;
  v_bonus_xp INTEGER := 0;
  v_multiplier NUMERIC := 1.0;
  v_total_xp INTEGER;
  v_old_exp BIGINT := 0;
  v_old_level INTEGER := 1;
  v_new_exp BIGINT;
  v_new_level INTEGER;
  v_level_up BOOLEAN := FALSE;
  v_today_comment_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pengguna belum terautentikasi');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_xp_transactions
    WHERE user_id = v_user_id AND activity_type = p_activity_type AND target_id = p_target_id
  ) THEN
    SELECT COALESCE(exp, 0), COALESCE(level, 1) INTO v_old_exp, v_old_level
    FROM public.profiles WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'success', false,
      'duplicate', true,
      'message', 'Aktivitas ini sudah pernah memberikan EXP sebelumnya.',
      'current_exp', v_old_exp,
      'current_level', v_old_level
    );
  END IF;

  IF p_activity_type = 'comment' THEN
    SELECT COUNT(*) INTO v_today_comment_count
    FROM public.user_xp_transactions
    WHERE user_id = v_user_id
      AND activity_type = 'comment'
      AND created_at >= CURRENT_DATE;

    IF v_today_comment_count >= 5 THEN
      SELECT COALESCE(exp, 0), COALESCE(level, 1) INTO v_old_exp, v_old_level
      FROM public.profiles WHERE id = v_user_id;

      RETURN jsonb_build_object(
        'success', false,
        'duplicate', false,
        'capped', true,
        'message', 'Batas harian EXP untuk komentar telah tercapai.',
        'current_exp', v_old_exp,
        'current_level', v_old_level
      );
    END IF;
  END IF;

  SELECT COALESCE(exp, 0), COALESCE(level, 1), COALESCE(is_vip, false)
  INTO v_old_exp, v_old_level, v_is_vip
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, exp, level, is_vip)
    VALUES (v_user_id, 0, 1, false)
    ON CONFLICT (id) DO NOTHING;
    v_old_exp := 0;
    v_old_level := 1;
    v_is_vip := false;
  END IF;

  IF v_is_vip = TRUE THEN
    v_bonus_xp := ROUND(p_base_xp * 0.5);
    v_multiplier := 1.5;
  ELSE
    v_bonus_xp := 0;
    v_multiplier := 1.0;
  END IF;

  v_total_xp := p_base_xp + v_bonus_xp;
  v_new_exp := v_old_exp + v_total_xp;
  v_new_level := public.calculate_user_level(v_new_exp);

  IF v_new_level > v_old_level THEN
    v_level_up := TRUE;
  END IF;

  INSERT INTO public.user_xp_transactions (
    user_id, activity_type, target_id, base_xp, bonus_xp, total_xp, multiplier, description, metadata
  )
  VALUES (
    v_user_id, p_activity_type, p_target_id, p_base_xp, v_bonus_xp, v_total_xp, v_multiplier, p_description, p_metadata
  );

  UPDATE public.profiles
  SET exp = v_new_exp, level = v_new_level, updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'activity_type', p_activity_type,
    'description', p_description,
    'base_xp', p_base_xp,
    'bonus_xp', v_bonus_xp,
    'total_xp', v_total_xp,
    'multiplier', v_multiplier,
    'is_vip', v_is_vip,
    'old_level', v_old_level,
    'new_level', v_new_level,
    'level_up', v_level_up,
    'new_total_exp', v_new_exp
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_comment(comment_id_input UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_comment_owner UUID;
  v_is_admin BOOLEAN := FALSE;
  v_exp_row RECORD;
  v_current_exp BIGINT;
  v_new_exp BIGINT;
  v_new_level INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pengguna belum terautentikasi');
  END IF;

  SELECT user_id INTO v_comment_owner
  FROM public.comments
  WHERE id = comment_id_input;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Komentar tidak ditemukan atau sudah dihapus');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND role IN ('admin', 'superadmin', 'owner')
  ) INTO v_is_admin;

  IF v_comment_owner != v_user_id AND NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak memiliki izin untuk menghapus komentar ini');
  END IF;

  FOR v_exp_row IN
    SELECT id, total_xp FROM public.user_xp_transactions
    WHERE user_id = v_comment_owner
      AND activity_type = 'comment'
      AND target_id = comment_id_input::text
  LOOP
    SELECT COALESCE(exp, 0) INTO v_current_exp
    FROM public.profiles WHERE id = v_comment_owner FOR UPDATE;

    v_new_exp := GREATEST(0, v_current_exp - v_exp_row.total_xp);
    v_new_level := public.calculate_user_level(v_new_exp);

    UPDATE public.profiles
    SET exp = v_new_exp, level = v_new_level, updated_at = NOW()
    WHERE id = v_comment_owner;

    INSERT INTO public.user_xp_transactions (
      user_id, activity_type, target_id, base_xp, bonus_xp, total_xp, multiplier, description, metadata
    )
    VALUES (
      v_comment_owner, 'comment_reversal', 'reversal:' || comment_id_input::text,
      -v_exp_row.total_xp, 0, -v_exp_row.total_xp, 1.0,
      'Pengurangan EXP: Komentar dihapus',
      jsonb_build_object('original_transaction_id', v_exp_row.id)
    )
    ON CONFLICT (user_id, activity_type, target_id) DO NOTHING;
  END LOOP;

  DELETE FROM public.comment_likes
  WHERE comment_id IN (SELECT id FROM public.comments WHERE parent_id = comment_id_input);

  DELETE FROM public.comments
  WHERE parent_id = comment_id_input;

  DELETE FROM public.comment_likes
  WHERE comment_id = comment_id_input;

  DELETE FROM public.comments
  WHERE id = comment_id_input;

  RETURN jsonb_build_object('success', true, 'deleted_id', comment_id_input);
END;
$$;

-- ==============================================================================
-- 14. SISTEM COOLDOWN PROFIL (BANNER 7 HARI, NAMA 24 JAM, AVATAR 24 JAM)
-- ==============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS name_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.check_profile_cooldown(p_user_id UUID, p_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_banner_at TIMESTAMPTZ;
  v_name_at TIMESTAMPTZ;
  v_avatar_at TIMESTAMPTZ;
  v_last_at TIMESTAMPTZ;
  v_cooldown_interval INTERVAL;
  v_seconds_remaining BIGINT := 0;
  v_can_change BOOLEAN := TRUE;
BEGIN
  SELECT banner_updated_at, name_updated_at, avatar_updated_at
  INTO v_banner_at, v_name_at, v_avatar_at
  FROM public.profiles
  WHERE id = p_user_id;

  IF p_type = 'banner' THEN
    v_last_at := v_banner_at;
    v_cooldown_interval := INTERVAL '7 days';
  ELSIF p_type = 'name' THEN
    v_last_at := v_name_at;
    v_cooldown_interval := INTERVAL '24 hours';
  ELSIF p_type = 'avatar' THEN
    v_last_at := v_avatar_at;
    v_cooldown_interval := INTERVAL '24 hours';
  ELSE
    RAISE EXCEPTION 'Unknown cooldown type: %', p_type;
  END IF;

  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - v_cooldown_interval) THEN
    v_can_change := FALSE;
    v_seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_last_at + v_cooldown_interval - NOW()))::BIGINT);
  END IF;

  RETURN jsonb_build_object(
    'can_change', v_can_change,
    'seconds_remaining', v_seconds_remaining,
    'last_updated_at', v_last_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_banner(p_banner_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_at TIMESTAMPTZ;
  v_remaining BIGINT;
  v_clean_url TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Harus login untuk mengubah banner.';
  END IF;

  v_clean_url := NULLIF(TRIM(p_banner_url), '');

  IF v_clean_url IS NOT NULL THEN
    IF LENGTH(v_clean_url) > 2048 THEN
      RAISE EXCEPTION 'INVALID_URL: Panjang URL banner melebihi batas 2048 karakter.';
    END IF;
    IF v_clean_url !~* '^https?://.+' THEN
      RAISE EXCEPTION 'INVALID_URL: URL banner harus diawali dengan http:// atau https://';
    END IF;
  END IF;

  SELECT banner_updated_at INTO v_last_at FROM public.profiles WHERE id = v_uid;
  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - INTERVAL '7 days') THEN
    v_remaining := EXTRACT(EPOCH FROM (v_last_at + INTERVAL '7 days' - NOW()))::BIGINT;
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:BANNER:%', v_remaining;
  END IF;

  UPDATE public.profiles
  SET
    banner_url = v_clean_url,
    banner_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'banner_url', v_clean_url,
    'banner_updated_at', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_display_name(p_display_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_at TIMESTAMPTZ;
  v_remaining BIGINT;
  v_clean_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Harus login untuk mengubah nama.';
  END IF;

  v_clean_name := TRIM(p_display_name);
  IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME: Nama tampilan minimal 2 karakter.';
  END IF;

  IF LENGTH(v_clean_name) > 30 THEN
    RAISE EXCEPTION 'INVALID_NAME: Nama tampilan maksimal 30 karakter.';
  END IF;

  SELECT name_updated_at INTO v_last_at FROM public.profiles WHERE id = v_uid;
  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - INTERVAL '24 hours') THEN
    v_remaining := EXTRACT(EPOCH FROM (v_last_at + INTERVAL '24 hours' - NOW()))::BIGINT;
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:NAME:%', v_remaining;
  END IF;

  UPDATE public.profiles
  SET
    display_name = v_clean_name,
    name_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{display_name}',
    to_jsonb(v_clean_name)
  )
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'display_name', v_clean_name,
    'name_updated_at', NOW()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_avatar(p_avatar_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_at TIMESTAMPTZ;
  v_remaining BIGINT;
  v_clean_url TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Harus login untuk mengubah avatar.';
  END IF;

  v_clean_url := NULLIF(TRIM(p_avatar_url), '');
  IF v_clean_url IS NOT NULL THEN
    IF LENGTH(v_clean_url) > 2048 THEN
      RAISE EXCEPTION 'INVALID_URL: Panjang URL avatar melebihi batas 2048 karakter.';
    END IF;
    IF v_clean_url !~* '^https?://.+' THEN
      RAISE EXCEPTION 'INVALID_URL: URL avatar harus diawali dengan http:// atau https://';
    END IF;
  END IF;

  SELECT avatar_updated_at INTO v_last_at FROM public.profiles WHERE id = v_uid;
  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - INTERVAL '24 hours') THEN
    v_remaining := EXTRACT(EPOCH FROM (v_last_at + INTERVAL '24 hours' - NOW()))::BIGINT;
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:AVATAR:%', v_remaining;
  END IF;

  UPDATE public.profiles
  SET
    avatar_url = v_clean_url,
    avatar_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{avatar_url}',
    to_jsonb(v_clean_url)
  )
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'avatar_url', v_clean_url,
    'avatar_updated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_profile_cooldown(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_banner(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_display_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_avatar(TEXT) TO authenticated;

-- ==============================================================================
-- 25. DUNIA NUENIME RPG DATABASE (KOTA, KLAN, MEMBER, BOS, TRANSAKSI EXP)
-- ==============================================================================
DROP TABLE IF EXISTS public.rpg_exp_transactions CASCADE;
DROP TABLE IF EXISTS public.rpg_user_profiles CASCADE;
DROP TABLE IF EXISTS public.rpg_clan_members CASCADE;
DROP TABLE IF EXISTS public.rpg_clans CASCADE;
DROP TABLE IF EXISTS public.rpg_city_bosses CASCADE;
DROP TABLE IF EXISTS public.rpg_cities CASCADE;

CREATE TABLE IF NOT EXISTS public.rpg_cities (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  epithet TEXT,
  description TEXT NOT NULL,
  full_lore TEXT,
  element VARCHAR(64) DEFAULT 'Aether',
  region VARCHAR(64) DEFAULT 'Nuenime Realm',
  world_x_percent NUMERIC DEFAULT 50 NOT NULL,
  world_y_percent NUMERIC DEFAULT 50 NOT NULL,
  focus_y_percent NUMERIC DEFAULT 50 NOT NULL,
  material VARCHAR(64) DEFAULT 'silver-ice',
  accent_hex VARCHAR(32) DEFAULT '#38BDF8',
  secondary_hex VARCHAR(32) DEFAULT '#E0F2FE',
  thumbnail_asset TEXT,
  emblem_asset TEXT,
  districts JSONB DEFAULT '[]'::jsonb,
  level INTEGER DEFAULT 1 NOT NULL,
  tier INTEGER DEFAULT 1 NOT NULL,
  tier_name VARCHAR(64) DEFAULT 'Perunggu I',
  total_exp BIGINT DEFAULT 0 NOT NULL,
  current_hp INTEGER DEFAULT 10000 NOT NULL,
  max_hp INTEGER DEFAULT 10000 NOT NULL,
  status VARCHAR(64) DEFAULT 'Damai',
  weather VARCHAR(64) DEFAULT 'Cerah Cerah Berangin',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rpg_city_bosses (
  id VARCHAR(64) PRIMARY KEY,
  city_id VARCHAR(64) NOT NULL REFERENCES public.rpg_cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  species_type TEXT DEFAULT 'Entitas Kosmik',
  element TEXT DEFAULT 'Elemental',
  description TEXT,
  characteristic TEXT,
  avatar_url TEXT,
  level INTEGER DEFAULT 0 NOT NULL,
  current_hp BIGINT DEFAULT 10000 NOT NULL,
  max_hp BIGINT DEFAULT 10000 NOT NULL,
  status VARCHAR(64) DEFAULT 'ACTIVE' NOT NULL,
  weakness TEXT DEFAULT 'Sihir Elemental',
  defense_break NUMERIC DEFAULT 0 NOT NULL,
  accent_color VARCHAR(32) DEFAULT '#38BDF8',
  secondary_color VARCHAR(32) DEFAULT '#E0F2FE',
  world_x_percent NUMERIC DEFAULT 50 NOT NULL,
  world_y_percent NUMERIC DEFAULT 50 NOT NULL,
  last_attacked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_rpg_city_boss UNIQUE (city_id)
);

CREATE TABLE IF NOT EXISTS public.rpg_clans (
  id VARCHAR(64) PRIMARY KEY,
  city_id VARCHAR(64) NOT NULL REFERENCES public.rpg_cities(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL UNIQUE,
  tag VARCHAR(16) NOT NULL UNIQUE,
  slogan TEXT DEFAULT 'Bersatu dalam kejayaan Nuenime',
  description TEXT DEFAULT 'Klan petualang aktif di Dunia Nuenime.',
  logo_url TEXT,
  leader_id TEXT NOT NULL,
  leader_name TEXT NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  total_exp BIGINT DEFAULT 0 NOT NULL,
  member_count INTEGER DEFAULT 1 NOT NULL,
  max_members INTEGER DEFAULT 100 NOT NULL,
  verified BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rpg_clan_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id VARCHAR(64) NOT NULL REFERENCES public.rpg_clans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  border_url TEXT,
  role VARCHAR(64) DEFAULT 'Anggota' NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  contribution_score BIGINT DEFAULT 0 NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_clan_member UNIQUE (clan_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.rpg_user_profiles (
  user_id TEXT PRIMARY KEY,
  current_city_id VARCHAR(64) REFERENCES public.rpg_cities(id) DEFAULT 'aetheria',
  clan_id VARCHAR(64) REFERENCES public.rpg_clans(id) ON DELETE SET NULL,
  character_title TEXT DEFAULT 'Petualang Nuenime',
  total_exp BIGINT DEFAULT 0 NOT NULL,
  energy INTEGER DEFAULT 100 NOT NULL,
  max_energy INTEGER DEFAULT 100 NOT NULL,
  reputation BIGINT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rpg_exp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  clan_id VARCHAR(64) REFERENCES public.rpg_clans(id) ON DELETE CASCADE,
  city_id VARCHAR(64) REFERENCES public.rpg_cities(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  source_type VARCHAR(64) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- INDEKS PERFORMA
CREATE INDEX IF NOT EXISTS idx_rpg_clans_city_id ON public.rpg_clans(city_id);
CREATE INDEX IF NOT EXISTS idx_rpg_clans_total_exp ON public.rpg_clans(total_exp DESC);
CREATE INDEX IF NOT EXISTS idx_rpg_clan_members_clan_id ON public.rpg_clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_rpg_clan_members_user_id ON public.rpg_clan_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rpg_exp_tx_clan_id ON public.rpg_exp_transactions(clan_id);
CREATE INDEX IF NOT EXISTS idx_rpg_exp_tx_city_id ON public.rpg_exp_transactions(city_id);

-- TRIGGER REKONSILIASI EXP OTOMATIS
CREATE OR REPLACE FUNCTION public.fn_sync_clan_stats_from_members()
RETURNS TRIGGER AS $$
DECLARE
  target_clan_id VARCHAR(64);
  calc_total_exp BIGINT;
  calc_member_count INT;
  calc_level INT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_clan_id := OLD.clan_id;
  ELSE
    target_clan_id := NEW.clan_id;
  END IF;

  SELECT COALESCE(SUM(contribution_score), 0), COUNT(*)
  INTO calc_total_exp, calc_member_count
  FROM public.rpg_clan_members
  WHERE clan_id = target_clan_id;

  calc_level := GREATEST(1, FLOOR(calc_total_exp / 1500) + 1);

  UPDATE public.rpg_clans
  SET total_exp = calc_total_exp,
      member_count = calc_member_count,
      level = calc_level,
      updated_at = NOW()
  WHERE id = target_clan_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_clan_stats ON public.rpg_clan_members;
CREATE TRIGGER trg_sync_clan_stats
AFTER INSERT OR UPDATE OR DELETE ON public.rpg_clan_members
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_clan_stats_from_members();

CREATE OR REPLACE FUNCTION public.fn_sync_city_stats_from_clans()
RETURNS TRIGGER AS $$
DECLARE
  target_city_id VARCHAR(64);
  calc_city_exp BIGINT;
  calc_city_level INT;
  calc_city_tier INT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_city_id := OLD.city_id;
  ELSE
    target_city_id := NEW.city_id;
  END IF;

  SELECT COALESCE(SUM(total_exp), 0)
  INTO calc_city_exp
  FROM public.rpg_clans
  WHERE city_id = target_city_id;

  calc_city_level := GREATEST(1, FLOOR(calc_city_exp / 5000) + 1);
  calc_city_tier := LEAST(5, GREATEST(1, FLOOR(calc_city_level / 5) + 1));

  UPDATE public.rpg_cities
  SET total_exp = calc_city_exp,
      level = calc_city_level,
      tier = calc_city_tier,
      updated_at = NOW()
  WHERE id = target_city_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_city_stats ON public.rpg_clans;
CREATE TRIGGER trg_sync_city_stats
AFTER INSERT OR UPDATE OR DELETE ON public.rpg_clans
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_city_stats_from_clans();

-- RLS
ALTER TABLE public.rpg_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_city_bosses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_exp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view rpg_cities" ON public.rpg_cities;
CREATE POLICY "Public can view rpg_cities" ON public.rpg_cities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_city_bosses" ON public.rpg_city_bosses;
CREATE POLICY "Public can view rpg_city_bosses" ON public.rpg_city_bosses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_clans" ON public.rpg_clans;
CREATE POLICY "Public can view rpg_clans" ON public.rpg_clans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_clan_members" ON public.rpg_clan_members;
CREATE POLICY "Public can view rpg_clan_members" ON public.rpg_clan_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_user_profiles" ON public.rpg_user_profiles;
CREATE POLICY "Public can view rpg_user_profiles" ON public.rpg_user_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_exp_transactions" ON public.rpg_exp_transactions;
CREATE POLICY "Public can view rpg_exp_transactions" ON public.rpg_exp_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert rpg_clans" ON public.rpg_clans;
CREATE POLICY "Users can insert rpg_clans" ON public.rpg_clans FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Leaders can update rpg_clans" ON public.rpg_clans;
CREATE POLICY "Leaders can update rpg_clans" ON public.rpg_clans FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can manage rpg_clan_members" ON public.rpg_clan_members;
CREATE POLICY "Users can manage rpg_clan_members" ON public.rpg_clan_members FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can manage rpg_user_profiles" ON public.rpg_user_profiles;
CREATE POLICY "Users can manage rpg_user_profiles" ON public.rpg_user_profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can insert rpg_exp_transactions" ON public.rpg_exp_transactions;
CREATE POLICY "Users can insert rpg_exp_transactions" ON public.rpg_exp_transactions FOR INSERT WITH CHECK (true);

-- INITIAL SEED: 7 KOTA CANON NUENIME DENGAN DATA GEOGRAFIS (EXP 0)
INSERT INTO public.rpg_cities (
  id, name, title, epithet, description, full_lore, element, region,
  world_x_percent, world_y_percent, focus_y_percent, material,
  accent_hex, secondary_hex, thumbnail_asset, emblem_asset, districts,
  level, tier, tier_name, total_exp, current_hp, max_hp, status, weather
) VALUES
(
  'aetheria', 'Aetheria', 'Kota Terapung Langit Biru', 'Benteng Suci Puncak Salju Abadi',
  'Kota suci yang dijaga oleh cahaya dan harapan. Pusat kekuatan para ksatria dan pelindung dunia.',
  'Didirikan di atas puncak tertinggi Pegunungan Celestia yang tak pernah mencair, Aetheria adalah mercusuar pertama yang menyala.',
  'Cahaya & Es Suci', 'Pegunungan Utara Celestia',
  20.5, 22.8, 18.0, 'silver-ice', '#38BDF8', '#E0F2FE',
  '/assets/nuenime/city_aetheria.png', '/assets/nuenime/emblem_aetheria.svg',
  '[{"id":"aeth-1","name":"Katedral Aurora","category":"Pusat Pemerintahan","description":"Aula suci tempat para pemimpin klan Aetheria bersumpah menjaga perdamaian benua.","xPercent":48,"yPercent":30},{"id":"aeth-2","name":"Benteng Perisai Perak","category":"Distrik Pertahanan","description":"Garrison utama tempat ksatria pelindung berlatih formasi tombak cahaya.","xPercent":24,"yPercent":54},{"id":"aeth-3","name":"Menara Observatorium Es","category":"Distrik Akademi","description":"Menara pengamat arus mana langit dan pergerakan badai di lautan utara.","xPercent":72,"yPercent":48}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Cerah Berangin'
),
(
  'lunaris', 'Lunaris', 'Lembah Malam Abadi', 'Sanctuary Pulau Pasang Rembulan',
  'Kota kepulauan suci yang dikelilingi cincin pusaran air bercahaya dan menara perak pengatur pasang samudra.',
  'Lunaris berdiri di atas pulau karang putih yang dikelilingi oleh cincin air sihir yang berputar mengikuti fase bulan.',
  'Air Rembulan & Ilusi Pasang', 'Kepulauan Samudra Timur Laut',
  54.5, 34.5, 30.5, 'lunar-cyan', '#22D3EE', '#CFFAFE',
  '/assets/nuenime/city_lunaris.png', '/assets/nuenime/emblem_lunaris.svg',
  '[{"id":"lun-1","name":"Kuil Cermin Rembulan","category":"Pusat Spiritual","description":"Kolam suci di puncak pulau yang memantulkan konstelasi bintang bahkan di siang hari.","xPercent":48,"yPercent":35},{"id":"lun-2","name":"Dermaga Cincin Turquoise","category":"Pelabuhan Armada","description":"Pangkalan kapal cepat klan-klan penjaga samudra Nuenime.","xPercent":65,"yPercent":62},{"id":"lun-3","name":"Menara Suar Karang Barat","category":"Pos Pertahanan Laut","description":"Menara kristal cyan yang memandu kapal melintasi terumbu karang di malam berkabut.","xPercent":24,"yPercent":52}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Malam Berbintang'
),
(
  'velmora', 'Velmora', 'Benteng Karang Pasang Surut', 'Suaka Hutan Zamrud Abadi',
  'Kota hutan zamrud tempat arsitektur kuno menyatu dengan pohon-pohon raksasa dan pusaran mana kehidupan.',
  'Tersembunyi di jantung Rimba Sylvanis, Velmora dibangun tanpa menebang satu pun pohon purba.',
  'Alam, Angin & Kehidupan', 'Rimba Barat Sylvanis',
  16.0, 41.2, 37.0, 'emerald-bronze', '#34D399', '#D1FAE5',
  '/assets/nuenime/city_velmora.png', '/assets/nuenime/emblem_velmora.svg',
  '[{"id":"vel-1","name":"Inti Pohon Sylvan","category":"Suaka Alam","description":"Jantung kota Velmora tempat mata air mana zamrud mengalir ke seluruh benua barat.","xPercent":45,"yPercent":45},{"id":"vel-2","name":"Anjungan Pemanah Angin","category":"Distrik Penjaga","description":"Pos pengawas di puncak kanopi pohon raksasa yang memantau batas barat Nuenime.","xPercent":64,"yPercent":34},{"id":"vel-3","name":"Gerbang Lembah Rusa Perak","category":"Pos Perbatasan Rimba","description":"Jembatan akar kuno yang menjaga jalur masuk selatan menuju hutan dalam Velmora.","xPercent":26,"yPercent":65}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Angin Laut Sejuk'
),
(
  'eldoria', 'Eldoria', 'Hutan Purba Roh Alam', 'Ibu Kota Kekaisaran Mahkota Emas',
  'Pusat peradaban Dunia Nuenime yang megah dengan menara istana emas dan cincin sihir pelindung kedaulatan.',
  'Berdiri tepat di jantung benua Nuenime, Eldoria adalah titik temu seluruh jalur perdagangan dan diplomasi.',
  'Cahaya Kekaisaran & Tata Ruang', 'Dataran Tengah Heartlands',
  46.5, 52.8, 48.0, 'imperial-gold', '#FBBF24', '#FEF3C7',
  '/assets/nuenime/city_eldoria.png', '/assets/nuenime/emblem_eldoria.svg',
  '[{"id":"eld-1","name":"Istana Mahkota Surya","category":"Pusat Kekaisaran","description":"Menara tertinggi di Eldoria tempat Piagam Klan Dunia Nuenime disimpan.","xPercent":48,"yPercent":30},{"id":"eld-2","name":"Plaza Pertemuan Agung","category":"Distrik Diplomasi","description":"Alun-alun marmer emas tempat utusan dari ketujuh kota berkumpul.","xPercent":48,"yPercent":64},{"id":"eld-3","name":"Benteng Sungai Kembar","category":"Gerbang Perdagangan","description":"Pelabuhan sungai dan gerbang utama yang menghubungkan jalur darat dari utara ke selatan.","xPercent":22,"yPercent":50},{"id":"eld-4","name":"Menara Garnisun Sovereign","category":"Markas Militer Timur","description":"Kompleks pelatihan ksatria kekaisaran dan gudang persenjataan emas Eldoria.","xPercent":68,"yPercent":46}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Embun Pagi Sejuk'
),
(
  'drakonia', 'Drakonia', 'Puncak Lahar Naga Api', 'Benteng Obsidian Kawah Petir',
  'Kota benteng vulkanik dari batu obsidian hitam yang ditempa oleh api naga purba dan badai petir ungu.',
  'Dibangun di atas kaldera gunung berapi aktif yang menghadap ke Pusaran Badai Ungu di pantai timur.',
  'Magma Merah & Petir Abyssal', 'Tebing Vulkanik Timur',
  75.5, 45.8, 42.0, 'crimson-obsidian', '#F87171', '#FECACA',
  '/assets/nuenime/city_drakonia.png', '/assets/nuenime/emblem_drakonia.svg',
  '[{"id":"drk-1","name":"Tungku Jantung Naga","category":"Pusat Penempaan","description":"Kawah magma tempat senjata obsidian dan baja naga ditempa oleh para master.","xPercent":46,"yPercent":35},{"id":"drk-2","name":"Menara Penangkap Petir","category":"Benteng Pesisir","description":"Menara besi hitam yang menyerap sambaran petir ungu dari pusaran laut timur.","xPercent":66,"yPercent":54},{"id":"drk-3","name":"Benteng Kaldera Barat","category":"Gerbang Obsidian","description":"Dinding pertahanan berlapis baja hitam yang menjaga jembatan lava menuju Drakonia.","xPercent":24,"yPercent":60}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Hawa Panas Vulkanik'
),
(
  'nivara', 'Nivara', 'Gurun Emas Badai Pasir', 'Permata Oasis Gurun Surya',
  'Kota istana batu pasir keemasan yang berdiri megah di tepi oasis suci dan teluk pirus selatan.',
  'Nivara tumbuh dari peradaban matahari kuno di Semenanjung Gurun Barat Daya.',
  'Pasir Emas & Api Matahari', 'Semenanjung Gurun Barat Daya',
  24.5, 68.2, 64.0, 'sun-amber', '#F59E0B', '#FDE68A',
  '/assets/nuenime/city_nivara.png', '/assets/nuenime/emblem_nivara.svg',
  '[{"id":"niv-1","name":"Ziggurat Obelisk Surya","category":"Kuil Agung","description":"Bangunan puncak emas yang mengumpulkan energi matahari untuk menyinari Nivara di malam hari.","xPercent":48,"yPercent":33},{"id":"niv-2","name":"Bazar Kafilah Emas","category":"Pusat Niaga","description":"Pasar rempah, permata mana, dan relik gurun terbesar di belahan selatan Nuenime.","xPercent":24,"yPercent":56},{"id":"niv-3","name":"Pelabuhan Teluk Pirus","category":"Dermaga Oasis Selatan","description":"Dermaga marmer keemasan tempat kapal dagang selatan berlabuh di tepi gurun.","xPercent":64,"yPercent":62}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Terik Badai Pasir'
),
(
  'astralis', 'Astralis', 'Piramida Bintang Galaksi', 'Sanctuary Kristal Bintang Selatan',
  'Kota menara kristal ungu yang berpendar oleh energi bintang jatuh dan aliran sihir dimensi di laut selatan.',
  'Astralis terbentuk di sekitar kawah meteorit kristal raksasa yang jatuh ke perairan tenggara Nuenime.',
  'Kosmik, Kristal & Gravitasi Astral', 'Kepulauan Arcane Tenggara',
  60.5, 76.5, 72.0, 'astral-violet', '#C084FC', '#F3E8FF',
  '/assets/nuenime/city_astralis.png', '/assets/nuenime/emblem_astralis.svg',
  '[{"id":"ast-1","name":"Menara Nexus Kosmik","category":"Pusat Sihir Agung","description":"Puncak kristal utama tempat aliran energi astral difokuskan untuk menjaga keseimbangan dimensi.","xPercent":48,"yPercent":32},{"id":"ast-2","name":"Akademi Prisma Ungu","category":"Distrik Riset","description":"Kompleks perpustakaan melayang tempat para penyihir mempelajari mantra bintang kuno.","xPercent":22,"yPercent":54},{"id":"ast-3","name":"Pelabuhan Bintang Jatuh","category":"Dermaga Selatan","description":"Titik berlabuh kapal-kapal sihir yang melintasi terumbu pirus selatan.","xPercent":64,"yPercent":63}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Hujan Meteor Ringan'
)
ON CONFLICT (id) DO UPDATE SET
  total_exp = 0,
  level = 1,
  tier = 1,
  current_hp = 10000,
  max_hp = 10000,
  updated_at = NOW();

-- INITIAL SEED: 7 BOS KOTA CANON NUENIME (LEVEL 0, HP 10.000)
INSERT INTO public.rpg_city_bosses (
  id, city_id, name, title, species_type, element, description, characteristic,
  level, current_hp, max_hp, status, weakness, accent_color, secondary_color,
  world_x_percent, world_y_percent
) VALUES
(
  'boss-aetheria', 'aetheria', 'Guardian Seraph', 'Penjaga Sayap Cahaya Celestia',
  'Entitas Konstruk Langit', 'Cahaya Murni & Kristal Es',
  'Monster penjaga bersayap enam yang melayang di atas puncak glasial Aetheria.',
  'Memancarkan halo cahaya suci dan badai kristal beku.',
  0, 10000, 10000, 'ACTIVE', 'Petir & Api', '#38BDF8', '#E0F2FE', 12.5, 15.8
),
(
  'boss-lunaris', 'lunaris', 'Moonfang', 'Serigala Pasang Purnama',
  'Beast Astral Samudra', 'Air Pasang & Ilusi Rembulan',
  'Monster serigala raksasa berbulu perak-cyan yang berlari di atas permukaan laut.',
  'Muncul bersama kabut purnama dan menciptakan pusaran air bercahaya.',
  0, 10000, 10000, 'ACTIVE', 'Cahaya Suci', '#22D3EE', '#CFFAFE', 69.5, 27.5
),
(
  'boss-velmora', 'velmora', 'Verdant Colossus', 'Raksasa Akar Rimba Abadi',
  'Behemoth Flora Purba', 'Alam, Akar & Angin Zamrud',
  'Monster penjaga hutan raksasa yang terbentuk dari jalinan akar pohon purba.',
  'Kulit kayunya sekeras baja dan memanggil spora pelindung.',
  0, 10000, 10000, 'ACTIVE', 'Listrik Petir', '#34D399', '#D1FAE5', 9.5, 34.5
),
(
  'boss-eldoria', 'eldoria', 'Aureon', 'Singa Agung Mahkota Surya',
  'Chimera Kekaisaran Emas', 'Cahaya Emas & Perisai Sovereign',
  'Monster bertema emas dan cahaya berbentuk singa bersayap mahkota surya.',
  'Raungannya menggetarkan cincin leyline benua.',
  0, 10000, 10000, 'ACTIVE', 'Api Lahar', '#FBBF24', '#FEF3C7', 38.0, 46.5
),
(
  'boss-drakonia', 'drakonia', 'Infernal Wyrm', 'Naga Magma Kaldera Hitam',
  'Naga Vulkanik Purba', 'Api Magma & Lava Obsidian',
  'Naga raksasa bertema api dan lava yang bersarang di kawah vulkanik timur Drakonia.',
  'Sayapnya menyebarkan bara api vulkanik.',
  0, 10000, 10000, 'ACTIVE', 'Es & Air Murni', '#F87171', '#FECACA', 88.5, 38.5
),
(
  'boss-nivara', 'nivara', 'Frostmaw', 'Behemoth Es & Kuarsa Malam Gurun',
  'Leviathan Anomali Termal', 'Es Absolut & Badai Kuarsa',
  'Monster es purba yang bangkit dari palung bawah tanah dingin di bawah oasis Nivara.',
  'Memiliki rahang kristal es raksasa.',
  0, 10000, 10000, 'ACTIVE', 'Banjir Aether', '#F59E0B', '#FDE68A', 15.5, 61.5
),
(
  'boss-astralis', 'astralis', 'Astral Leviathan', 'Penguasa Dimensi Bintang Jatuh',
  'Entitas Kosmik Abyssal', 'Energi Kosmik & Gravitasi Bintang',
  'Monster naga samudra kosmik yang berenang melintasi anomali gravitasi.',
  'Tubuhnya tersusun dari konstelasi bintang hidup.',
  0, 10000, 10000, 'ACTIVE', 'Kekosongan Hampa', '#C084FC', '#F3E8FF', 76.5, 69.5
)
ON CONFLICT (city_id) DO UPDATE SET
  level = 0,
  current_hp = 10000,
  max_hp = 10000,
  updated_at = NOW();

-- ==============================================================================
-- SELESAI: Skrip Database Supabase Nuenime Siap Digunakan!
-- ==============================================================================


