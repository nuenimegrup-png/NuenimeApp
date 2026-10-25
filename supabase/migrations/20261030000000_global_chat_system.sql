-- ==============================================================================
-- MIGRASI: SISTEM CHAT GLOBAL NUENIME (GLOBAL CHAT MULTI-ROOM)
-- File: supabase/migrations/20261030000000_global_chat_system.sql
-- ==============================================================================

-- 1. Tabel Pesan Chat Global Multi-Room
CREATE TABLE IF NOT EXISTS public.global_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room TEXT NOT NULL DEFAULT 'ngobrol_1',
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.global_messages(id) ON DELETE SET NULL,
  reply_to_sender_name TEXT,
  reply_to_text TEXT,
  reply_to_member_number TEXT,
  clan_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indeks untuk pengambilan pesan cepat berdasarkan room dan urutan waktu
CREATE INDEX IF NOT EXISTS idx_global_messages_room_time ON public.global_messages(room, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_messages_sender ON public.global_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_global_messages_created_at ON public.global_messages(created_at);

-- 2. Kebijakan Keamanan Baris (Row Level Security)
ALTER TABLE public.global_messages ENABLE ROW LEVEL SECURITY;

-- Siapa pun (termasuk anonim/tamu) dapat membaca pesan publik
DROP POLICY IF EXISTS "Public can read global messages" ON public.global_messages;
CREATE POLICY "Public can read global messages"
  ON public.global_messages FOR SELECT
  USING (true);

-- Pengguna terautentikasi dapat mengirim pesan chat global
DROP POLICY IF EXISTS "Authenticated users can insert global messages" ON public.global_messages;
CREATE POLICY "Authenticated users can insert global messages"
  ON public.global_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Pengirim atau admin dapat menghapus pesan jika diperlukan
DROP POLICY IF EXISTS "Users can delete own global messages" ON public.global_messages;
CREATE POLICY "Users can delete own global messages"
  ON public.global_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- 3. Fungsi Pembersih Otomatis Pesan Kedaluwarsa (> 30 hari untuk menjaga performa)
CREATE OR REPLACE FUNCTION public.cleanup_expired_global_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM public.global_messages
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Daftarkan tabel ke publikasi Realtime Supabase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'global_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.global_messages;
  END IF;
END $$;
