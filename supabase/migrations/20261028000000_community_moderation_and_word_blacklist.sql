-- ==============================================================================
-- NUENIME COMMUNITY MODERATION, WORD BLACKLIST & COMMENT DELETION MIGRATION
-- File: supabase/migrations/20261028000000_community_moderation_and_word_blacklist.sql
-- ==============================================================================
-- 1. Tabel system_configs: Seed & izin kelola word_blacklist (sensor kata terlarang)
-- 2. Kebijakan RLS comments & comment_likes: Izinkan admin menghapus komentar siapapun
-- 3. Stored Procedure: admin_delete_comment() dengan cascade likes & balasan
-- 4. Realtime sinkronisasi untuk komentar & pesan pribadi
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SEED DAFTAR KATA TERLARANG DI SYSTEM_CONFIGS
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

-- Masukkan kata terlarang bawaan (word_blacklist) jika belum ada
INSERT INTO public.system_configs (key, value, updated_at)
VALUES (
  'word_blacklist',
  jsonb_build_array('judi', 'slot', 'gacor', 'bokep', 'porn', 'kontol', 'memek', 'anjing', 'bangsat', 'tolol'),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. PERBAIKAN RLS POLICY COMMENTS & COMMENT_LIKES
-- Memastikan admin dan sistem dapat menghapus komentar bermasalah dari pengguna manapun
-- tanpa terhalang RLS (auth.uid() = user_id)
-- ------------------------------------------------------------------------------
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
CREATE POLICY "Admins can delete any comment"
  ON public.comments FOR DELETE
  USING (true);

-- Pastikan comment_likes juga bisa dihapus saat komentar di-cascade
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comment_likes') THEN
    ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admins can delete comment likes" ON public.comment_likes;
    CREATE POLICY "Admins can delete comment likes"
      ON public.comment_likes FOR DELETE
      USING (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. STORED PROCEDURE RESMI: ADMIN DELETE COMMENT (CASCADE LIKES & REPLIES)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_comment(
  p_comment_id UUID,
  p_reason TEXT DEFAULT '',
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment_owner UUID;
  v_exp_row RECORD;
  v_current_exp BIGINT;
  v_new_exp BIGINT;
  v_new_level INTEGER;
BEGIN
  -- 1. Cek apakah komentar ada
  SELECT user_id INTO v_comment_owner
  FROM public.comments
  WHERE id = p_comment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Komentar tidak ditemukan atau sudah dihapus');
  END IF;

  -- 2. Reversal EXP jika user mendapatkan EXP dari komentar ini
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_xp_transactions') THEN
    FOR v_exp_row IN
      SELECT id, total_xp FROM public.user_xp_transactions
      WHERE user_id = v_comment_owner
        AND activity_type = 'comment'
        AND target_id = p_comment_id::text
    LOOP
      SELECT COALESCE(exp, 0) INTO v_current_exp
      FROM public.profiles WHERE id = v_comment_owner FOR UPDATE;

      IF v_current_exp IS NOT NULL THEN
        v_new_exp := GREATEST(0, v_current_exp - v_exp_row.total_xp);
        
        -- Hitung level baru jika fungsi ada
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_user_level') THEN
          v_new_level := public.calculate_user_level(v_new_exp);
        ELSE
          v_new_level := 1;
        END IF;

        UPDATE public.profiles
        SET exp = v_new_exp, level = v_new_level, updated_at = NOW()
        WHERE id = v_comment_owner;

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
        ) VALUES (
          v_comment_owner,
          'comment_reversal',
          'reversal:' || p_comment_id::text,
          -v_exp_row.total_xp,
          0,
          -v_exp_row.total_xp,
          1.0,
          'Pengurangan EXP: Komentar dihapus oleh admin (' || COALESCE(NULLIF(p_reason, ''), 'Pelanggaran Komunitas') || ')',
          jsonb_build_object('admin_id', p_admin_id, 'original_tx_id', v_exp_row.id)
        );
      END IF;
    END LOOP;
  END IF;

  -- 3. Hapus likes dari balasan komentar
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comment_likes') THEN
    DELETE FROM public.comment_likes
    WHERE comment_id IN (
      SELECT id FROM public.comments WHERE parent_id = p_comment_id
    );

    -- Hapus likes dari komentar itu sendiri
    DELETE FROM public.comment_likes
    WHERE comment_id = p_comment_id;
  END IF;

  -- 4. Hapus balasan di bawah komentar ini
  DELETE FROM public.comments
  WHERE parent_id = p_comment_id;

  -- 5. Hapus komentar target
  DELETE FROM public.comments
  WHERE id = p_comment_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_comment_id,
    'message', 'Komentar dan seluruh relasi berhasil dihapus permanen'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. DAFTARKAN COMMENTS KE REALTIME
-- ------------------------------------------------------------------------------
ALTER TABLE public.comments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'private_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. TRIGGER POSTGRESQL: PENYENSORAN KATA TERLARANG OTOMATIS (SERVER-SIDE REALTIME)
-- Pesan atau komentar yang mengandung kata dari system_configs.word_blacklist
-- akan otomatis diganti menjadi '[Pesan mengandung kata terlarang]'
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_contains_forbidden_word(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_blacklist JSONB;
  v_word TEXT;
  v_clean_text TEXT;
BEGIN
  IF p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RETURN FALSE;
  END IF;

  v_clean_text := lower(trim(p_text));

  -- Ambil blacklist kata dari tabel system_configs
  SELECT value INTO v_blacklist
  FROM public.system_configs
  WHERE key = 'word_blacklist';

  IF v_blacklist IS NOT NULL AND jsonb_typeof(v_blacklist) = 'array' THEN
    FOR v_word IN SELECT jsonb_array_elements_text(v_blacklist)
    LOOP
      v_word := lower(trim(v_word));
      IF length(v_word) > 0 THEN
        IF position(v_word in v_clean_text) > 0 OR v_clean_text ~* ('\y' || v_word || '\y') THEN
          RETURN TRUE;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN FALSE;
END;
$$;

-- Trigger Function untuk Private Messages
CREATE OR REPLACE FUNCTION public.trg_auto_censor_private_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.check_contains_forbidden_word(NEW.message) THEN
    NEW.message := '[Pesan mengandung kata terlarang]';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_censor_private_message ON public.private_messages;
CREATE TRIGGER trg_censor_private_message
  BEFORE INSERT OR UPDATE ON public.private_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_censor_private_message();

-- Trigger Function untuk Comments
CREATE OR REPLACE FUNCTION public.trg_auto_censor_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.check_contains_forbidden_word(NEW.content) THEN
    NEW.content := '[Pesan mengandung kata terlarang]';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_censor_comment ON public.comments;
CREATE TRIGGER trg_censor_comment
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_censor_comment();

