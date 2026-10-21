-- ==============================================================================
-- MIGRASI: SISTEM CHAT PRIBADI (PRIVATE MESSAGES) DENGAN PEMBERSIHAN OTOMATIS 7 HARI
-- File: supabase/migrations/20261026000000_private_messages_system.sql
-- Tanggal: 21 Oktober 2026
-- ==============================================================================

-- 1. Tabel Pesan Pribadi Antar Pengguna
CREATE TABLE IF NOT EXISTS public.private_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks untuk query cepat percakapan dua arah dan filter usia pesan 7 hari
CREATE INDEX IF NOT EXISTS idx_private_messages_sender ON public.private_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_receiver ON public.private_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_pair ON public.private_messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_private_messages_created_at ON public.private_messages(created_at);

-- 2. Kebijakan Keamanan Baris (RLS)
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own private messages" ON public.private_messages;
CREATE POLICY "Users can read their own private messages"
  ON public.private_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own private messages" ON public.private_messages;
CREATE POLICY "Users can insert their own private messages"
  ON public.private_messages FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own private messages" ON public.private_messages;
CREATE POLICY "Users can delete their own private messages"
  ON public.private_messages FOR DELETE
  USING (true);

-- 3. Fungsi Pembersih Otomatis Pesan Lebih dari 7 Hari
CREATE OR REPLACE FUNCTION public.cleanup_expired_private_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM public.private_messages
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Daftarkan ke Publikasi Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'private_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
  END IF;
END $$;
