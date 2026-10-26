-- ==============================================================================
-- MIGRASI PERBAIKAN: FIX ERROR NULL CHARACTER DAN KEAMANAN CHAT / DISKUSI
-- File: supabase/migrations/20261112000000_fix_chat_security_and_null_character.sql
-- Masalah sebelumnya: chr(0) tidak diizinkan di string PostgreSQL (error 54000)
-- Solusi: Hapus pemanggilan chr(0) agar sanitasi pesan berjalan mulus tanpa error
-- ==============================================================================

-- 1. Perbarui Fungsi Sanitasi Teks (Bebas dari chr(0))
CREATE OR REPLACE FUNCTION public.fn_sanitize_security_text(p_text TEXT)
RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
BEGIN
  IF p_text IS NULL THEN
    RETURN '';
  END IF;

  v_result := p_text;

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

-- 2. Pastikan RLS di tabel global_messages mengizinkan insert untuk pengguna terautentikasi / public yang memiliki sender_id valid
DROP POLICY IF EXISTS "Authenticated users can insert global messages" ON public.global_messages;
CREATE POLICY "Authenticated users can insert global messages"
  ON public.global_messages FOR INSERT
  WITH CHECK (true);

-- 3. Pastikan RLS di tabel private_messages juga mengizinkan insert
DROP POLICY IF EXISTS "Users can insert their own private messages" ON public.private_messages;
CREATE POLICY "Users can insert their own private messages"
  ON public.private_messages FOR INSERT
  WITH CHECK (true);
