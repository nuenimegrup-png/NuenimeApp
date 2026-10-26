-- ==============================================================================
-- MIGRASI KEAMANAN: PERTAHANAN DISKUSI, CHAT GLOBAL, CHAT PRIBADI, DAN AUTO-BAN
-- File: supabase/migrations/20261107000000_discussion_chat_security_and_auto_ban.sql
-- 1. Anti-Injeksi XSS / SQL
-- 2. Jeda Waktu Pengiriman (1 menit untuk diskusi, 2 detik untuk chat)
-- 3. Deteksi Spam Pesan Sama 4x -> Auto-Ban Akun Otomatis
-- CATATAN: Menggunakan explicit type cast (::text) agar kebal error 'uuid = text'
-- ==============================================================================

-- 1. Fungsi Sanitasi Teks Sederhana di Level Database
CREATE OR REPLACE FUNCTION public.fn_sanitize_security_text(p_text TEXT)
RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
BEGIN
  IF p_text IS NULL THEN
    RETURN '';
  END IF;

  v_result := p_text;
  -- Hapus karakter null byte (\0)
  v_result := replace(v_result, chr(0), '');

  -- Hapus tag script, iframe, object, embed
  v_result := regexp_replace(v_result, '(?i)<\s*(script|iframe|object|embed|svg|style|link|meta|base|form|input)[^>]*>.*?<\s*/\s*\1\s*>', '', 'g');
  v_result := regexp_replace(v_result, '(?i)<\s*(script|iframe|object|embed|svg|style|link|meta|base|form|input)[^>]*/?>', '', 'g');

  -- Hapus javascript: / data: pseudo protocol
  v_result := regexp_replace(v_result, '(?i)javascript\s*:', 'no-js:', 'g');
  v_result := regexp_replace(v_result, '(?i)data\s*:\s*text/html', 'no-data:', 'g');

  -- Netralkan tag HTML umum
  v_result := replace(v_result, '<', '&lt;');
  v_result := replace(v_result, '>', '&gt;');

  RETURN trim(v_result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ==============================================================================
-- 2. TRIGGER KEAMANAN KOMENTAR & DISKUSI
-- - Cek akun terblokir
-- - Jeda minimal 60 detik (1 menit) antar komentar
-- - Auto-ban jika mengirim pesan yang sama 4x berturut-turut
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_security_check_comments()
RETURNS TRIGGER AS $$
DECLARE
  v_is_banned BOOLEAN := FALSE;
  v_last_created TIMESTAMPTZ;
  v_same_count INT := 0;
  v_clean_content TEXT;
BEGIN
  -- A. Cek Status Blokir Akun
  SELECT is_banned INTO v_is_banned 
  FROM public.profiles 
  WHERE id::text = NEW.user_id::text;

  IF v_is_banned THEN
    RAISE EXCEPTION 'Aksi ditolak: Akun Anda sedang diblokir oleh sistem.';
  END IF;

  -- B. Sanitasi Pesan
  NEW.content := public.fn_sanitize_security_text(NEW.content);
  IF length(NEW.content) = 0 THEN
    RAISE EXCEPTION 'Komentar tidak boleh kosong.';
  END IF;
  IF length(NEW.content) > 1000 THEN
    RAISE EXCEPTION 'Komentar maksimal 1000 karakter.';
  END IF;

  -- C. Jeda Waktu Pengiriman: Minimal 60 Detik (1 Menit)
  SELECT MAX(created_at) INTO v_last_created
  FROM public.comments
  WHERE user_id::text = NEW.user_id::text;

  IF v_last_created IS NOT NULL AND v_last_created > (NOW() - INTERVAL '60 seconds') THEN
    RAISE EXCEPTION 'Jeda keamanan: Harap tunggu 1 menit antar pengiriman pesan diskusi.';
  END IF;

  -- D. Cek Spam Pesan Sama: Jika sudah ada 3 pesan sama dalam 15 menit terakhir, ini adalah yang ke-4 -> BLOKIR AKUN
  v_clean_content := lower(regexp_replace(NEW.content, '[^a-zA-Z0-9]', '', 'g'));
  IF length(v_clean_content) >= 3 THEN
    SELECT COUNT(*) INTO v_same_count
    FROM (
      SELECT content 
      FROM public.comments
      WHERE user_id::text = NEW.user_id::text 
        AND created_at >= (NOW() - INTERVAL '15 minutes')
      ORDER BY created_at DESC
      LIMIT 3
    ) sub
    WHERE lower(regexp_replace(sub.content, '[^a-zA-Z0-9]', '', 'g')) = v_clean_content;

    IF v_same_count >= 3 THEN
      -- Otomatis blokir akun di tabel profiles
      UPDATE public.profiles
      SET is_banned = TRUE,
          banned_at = NOW(),
          ban_reason = 'Diblokir otomatis: Terdeteksi spam 4x pesan yang sama pada diskusi komentar.',
          banned_by = 'System Security Defense'
      WHERE id::text = NEW.user_id::text;

      RAISE EXCEPTION 'AKUN DIBLOKIR: Anda telah diblokir permanen karena mengirim pesan yang sama sebanyak 4 kali berturut-turut!';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_security_comments ON public.comments;
CREATE TRIGGER trg_security_comments
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_security_check_comments();

-- ==============================================================================
-- 3. TRIGGER KEAMANAN CHAT GLOBAL (PUBLIC DISCUSSION)
-- - Cek akun terblokir
-- - Jeda minimal 2 detik (anti-flood/DDoS)
-- - Auto-ban jika mengirim pesan sama 4x
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_security_check_global_messages()
RETURNS TRIGGER AS $$
DECLARE
  v_is_banned BOOLEAN := FALSE;
  v_last_created TIMESTAMPTZ;
  v_same_count INT := 0;
  v_clean_content TEXT;
BEGIN
  -- A. Cek Status Blokir Akun
  SELECT is_banned INTO v_is_banned 
  FROM public.profiles 
  WHERE id::text = NEW.sender_id::text;

  IF v_is_banned THEN
    RAISE EXCEPTION 'Aksi ditolak: Akun Anda sedang diblokir oleh sistem.';
  END IF;

  -- B. Sanitasi Pesan
  NEW.message := public.fn_sanitize_security_text(NEW.message);
  IF length(NEW.message) = 0 THEN
    RAISE EXCEPTION 'Pesan chat tidak boleh kosong.';
  END IF;
  IF length(NEW.message) > 500 THEN
    RAISE EXCEPTION 'Pesan chat maksimal 500 karakter.';
  END IF;

  -- C. Jeda Waktu Pengiriman: Minimal 2 Detik (Anti-Flood)
  SELECT MAX(created_at) INTO v_last_created
  FROM public.global_messages
  WHERE sender_id::text = NEW.sender_id::text;

  IF v_last_created IS NOT NULL AND v_last_created > (NOW() - INTERVAL '2 seconds') THEN
    RAISE EXCEPTION 'Harap tunggu jeda beberapa saat sebelum mengirim pesan lagi.';
  END IF;

  -- D. Cek Spam Pesan Sama: 4x berturut-turut
  v_clean_content := lower(regexp_replace(NEW.message, '[^a-zA-Z0-9]', '', 'g'));
  IF length(v_clean_content) >= 3 THEN
    SELECT COUNT(*) INTO v_same_count
    FROM (
      SELECT message 
      FROM public.global_messages
      WHERE sender_id::text = NEW.sender_id::text 
        AND created_at >= (NOW() - INTERVAL '15 minutes')
      ORDER BY created_at DESC
      LIMIT 3
    ) sub
    WHERE lower(regexp_replace(sub.message, '[^a-zA-Z0-9]', '', 'g')) = v_clean_content;

    IF v_same_count >= 3 THEN
      UPDATE public.profiles
      SET is_banned = TRUE,
          banned_at = NOW(),
          ban_reason = 'Diblokir otomatis: Terdeteksi spam 4x pesan yang sama pada Chat Global.',
          banned_by = 'System Security Defense'
      WHERE id::text = NEW.sender_id::text;

      RAISE EXCEPTION 'AKUN DIBLOKIR: Anda telah diblokir permanen karena mengirim pesan yang sama sebanyak 4 kali berturut-turut!';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_security_global_messages ON public.global_messages;
CREATE TRIGGER trg_security_global_messages
  BEFORE INSERT ON public.global_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_security_check_global_messages();

-- ==============================================================================
-- 4. TRIGGER KEAMANAN CHAT PRIBADI (DM)
-- - Cek akun terblokir
-- - Jeda minimal 1.5 detik
-- - Auto-ban jika spam 4x
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.trg_fn_security_check_private_messages()
RETURNS TRIGGER AS $$
DECLARE
  v_is_banned BOOLEAN := FALSE;
  v_last_created TIMESTAMPTZ;
  v_same_count INT := 0;
  v_clean_content TEXT;
BEGIN
  -- A. Cek Status Blokir Pengirim
  SELECT is_banned INTO v_is_banned 
  FROM public.profiles 
  WHERE id::text = NEW.sender_id::text;

  IF v_is_banned THEN
    RAISE EXCEPTION 'Aksi ditolak: Akun Anda sedang diblokir oleh sistem.';
  END IF;

  -- B. Sanitasi Pesan
  NEW.message := public.fn_sanitize_security_text(NEW.message);
  IF length(NEW.message) = 0 THEN
    RAISE EXCEPTION 'Pesan chat pribadi tidak boleh kosong.';
  END IF;
  IF length(NEW.message) > 1000 THEN
    RAISE EXCEPTION 'Pesan chat pribadi maksimal 1000 karakter.';
  END IF;

  -- C. Jeda Waktu Pengiriman: Minimal 1.5 Detik
  SELECT MAX(created_at) INTO v_last_created
  FROM public.private_messages
  WHERE sender_id::text = NEW.sender_id::text;

  IF v_last_created IS NOT NULL AND v_last_created > (NOW() - INTERVAL '1.5 seconds') THEN
    RAISE EXCEPTION 'Harap tunggu jeda sebelum mengirim pesan chat berikutnya.';
  END IF;

  -- D. Cek Spam Pesan Sama 4x
  v_clean_content := lower(regexp_replace(NEW.message, '[^a-zA-Z0-9]', '', 'g'));
  IF length(v_clean_content) >= 3 THEN
    SELECT COUNT(*) INTO v_same_count
    FROM (
      SELECT message 
      FROM public.private_messages
      WHERE sender_id::text = NEW.sender_id::text 
        AND created_at >= (NOW() - INTERVAL '15 minutes')
      ORDER BY created_at DESC
      LIMIT 3
    ) sub
    WHERE lower(regexp_replace(sub.message, '[^a-zA-Z0-9]', '', 'g')) = v_clean_content;

    IF v_same_count >= 3 THEN
      UPDATE public.profiles
      SET is_banned = TRUE,
          banned_at = NOW(),
          ban_reason = 'Diblokir otomatis: Terdeteksi spam 4x pesan yang sama pada Chat Pribadi.',
          banned_by = 'System Security Defense'
      WHERE id::text = NEW.sender_id::text;

      RAISE EXCEPTION 'AKUN DIBLOKIR: Anda telah diblokir permanen karena mengirim pesan yang sama sebanyak 4 kali berturut-turut!';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_security_private_messages ON public.private_messages;
CREATE TRIGGER trg_security_private_messages
  BEFORE INSERT ON public.private_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_security_check_private_messages();
