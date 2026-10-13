-- ==============================================================================
-- MIGRATION: PERBAIKAN SISTEM HAPUS KOMENTAR & SISTEM LEVEL / EXP PER AKUN
-- ==============================================================================
-- 1. Memperbaiki cascade foreign key & RLS saat menghapus komentar agar tidak error
--    bila komentar memiliki likes (comment_likes) atau balasan (replies).
-- 2. Menambahkan stored function delete_comment() SECURITY DEFINER untuk admin & user.
-- 3. Menambahkan kolom exp, level, dan is_vip pada public.profiles.
-- 4. Menambahkan tabel riwayat transaksi EXP (user_xp_transactions) dengan constraint
--    anti-duplikasi per aktivitas & target_id (anti-abuse & anti-farming).
-- 5. Menambahkan fungsi kalkulasi level (calculate_user_level) dan fungsi pemberian EXP
--    otomatis terpercaya di database (grant_user_xp).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERBAIKAN TABEL PROFILES: TAMBAH EXP, LEVEL, IS_VIP
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS exp BIGINT DEFAULT 0 NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1 NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT FALSE NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. TABEL RIWAYAT TRANSAKSI EXP (USER_XP_TRANSACTIONS)
-- ------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_user_xp_transactions_type_target
  ON public.user_xp_transactions(user_id, activity_type, target_id);

-- RLS untuk user_xp_transactions
ALTER TABLE public.user_xp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own xp transactions" ON public.user_xp_transactions;
CREATE POLICY "Users can view own xp transactions"
  ON public.user_xp_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 3. FUNGSI PERHITUNGAN LEVEL BERDASARKAN TOTAL EXP
-- Biaya EXP per level: Level 1 -> 2 butuh 50 EXP. Tiap level berikutnya +15 EXP.
-- Level 1: 0 - 49
-- Level 2: 50 - 114
-- Level 3: 115 - 194
-- dst.
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
-- 4. FUNGSI SECURITY DEFINER: GRANT USER XP DENGAN VALIDASI & ANTI-ABUSE
-- ------------------------------------------------------------------------------
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
  -- 1. Verifikasi User Login
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pengguna belum terautentikasi (login diperlukan)'
    );
  END IF;

  -- 2. Cek apakah transaksi sudah pernah ada (Anti-Duplikasi / Sekali per aktivitas unik)
  IF EXISTS (
    SELECT 1 FROM public.user_xp_transactions
    WHERE user_id = v_user_id AND activity_type = p_activity_type AND target_id = p_target_id
  ) THEN
    -- Ambil data saat ini tanpa mengubah apapun
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

  -- 3. Proteksi Spam Komentar: Maksimal 5 komentar per hari yang mendapatkan EXP
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
        'message', 'Batas harian EXP untuk komentar (maksimal 5 kali per hari) telah tercapai.',
        'current_exp', v_old_exp,
        'current_level', v_old_level
      );
    END IF;
  END IF;

  -- 4. Ambil profil user saat ini (dengan lock baris untuk konsistensi)
  SELECT COALESCE(exp, 0), COALESCE(level, 1), COALESCE(is_vip, false)
  INTO v_old_exp, v_old_level, v_is_vip
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  -- Jika profil belum terbuat di tabel profiles, buat baris fallback
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, exp, level, is_vip)
    VALUES (v_user_id, 0, 1, false)
    ON CONFLICT (id) DO NOTHING;
    v_old_exp := 0;
    v_old_level := 1;
    v_is_vip := false;
  END IF;

  -- 5. Hitung Bonus VIP / Premium (+50%)
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

  -- 6. Simpan transaksi EXP
  INSERT INTO public.user_xp_transactions (
    user_id,
    activity_type,
    target_id,
    base_xp,
    bonus_xp,
    total_xp,
    multiplier,
    description,
    metadata
  )
  VALUES (
    v_user_id,
    p_activity_type,
    p_target_id,
    p_base_xp,
    v_bonus_xp,
    v_total_xp,
    v_multiplier,
    p_description,
    p_metadata
  );

  -- 7. Perbarui total EXP dan Level di profiles
  UPDATE public.profiles
  SET exp = v_new_exp,
      level = v_new_level,
      updated_at = NOW()
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

-- ------------------------------------------------------------------------------
-- 5. FUNGSI SECURITY DEFINER: HAPUS KOMENTAR SECARA BERSIH & AMAN
-- Menyelesaikan kendala RLS pada foreign key comment_likes & cascade replies,
-- serta melakukan reversal EXP komentar agar tidak bisa dieksploitasi.
-- ------------------------------------------------------------------------------
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

  -- Cari komentar
  SELECT user_id INTO v_comment_owner
  FROM public.comments
  WHERE id = comment_id_input;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Komentar tidak ditemukan atau sudah dihapus');
  END IF;

  -- Cek apakah admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id AND role IN ('admin', 'superadmin', 'owner')
  ) INTO v_is_admin;

  -- Validasi kepemilikan / hak akses
  IF v_comment_owner != v_user_id AND NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tidak memiliki izin untuk menghapus komentar ini');
  END IF;

  -- Reversal EXP jika komentar pernah memberikan EXP
  FOR v_exp_row IN
    SELECT id, total_xp FROM public.user_xp_transactions
    WHERE user_id = v_comment_owner
      AND activity_type = 'comment'
      AND target_id = comment_id_input::text
  LOOP
    -- Potong EXP dari pemilik komentar
    SELECT COALESCE(exp, 0) INTO v_current_exp
    FROM public.profiles WHERE id = v_comment_owner FOR UPDATE;

    v_new_exp := GREATEST(0, v_current_exp - v_exp_row.total_xp);
    v_new_level := public.calculate_user_level(v_new_exp);

    UPDATE public.profiles
    SET exp = v_new_exp, level = v_new_level, updated_at = NOW()
    WHERE id = v_comment_owner;

    -- Catat reversal di transaksi audit
    INSERT INTO public.user_xp_transactions (
      user_id,
      activity_type,
      target_id,
      base_xp,
      bonus_xp,
      total_xp,
      multiplier,
      description,
      metadata
    )
    VALUES (
      v_comment_owner,
      'comment_reversal',
      'reversal:' || comment_id_input::text,
      -v_exp_row.total_xp,
      0,
      -v_exp_row.total_xp,
      1.0,
      'Pengurangan EXP: Komentar dihapus',
      jsonb_build_object('original_transaction_id', v_exp_row.id)
    )
    ON CONFLICT (user_id, activity_type, target_id) DO NOTHING;
  END LOOP;

  -- Hapus like pada balasan di dalam komentar ini (jika ada)
  DELETE FROM public.comment_likes
  WHERE comment_id IN (
    SELECT id FROM public.comments WHERE parent_id = comment_id_input
  );

  -- Hapus balasan di dalam komentar ini
  DELETE FROM public.comments
  WHERE parent_id = comment_id_input;

  -- Hapus like pada komentar ini sendiri
  DELETE FROM public.comment_likes
  WHERE comment_id = comment_id_input;

  -- Hapus komentar utama
  DELETE FROM public.comments
  WHERE id = comment_id_input;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', comment_id_input
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. PERBARUI RLS POLICIES PADA COMMENTS & COMMENT_LIKES
-- Memberikan hak akses penghapusan bagi pemilik komentar & admin
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Users can remove own likes" ON public.comment_likes;
CREATE POLICY "Users and owners can remove comment likes"
  ON public.comment_likes FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.comments
      WHERE id = comment_likes.comment_id AND user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin', 'owner')
    )
  );

-- ------------------------------------------------------------------------------
-- SELESAI: Skrip migrasi siap dieksekusi di Supabase Dashboard / SQL Editor!
-- ------------------------------------------------------------------------------
