-- ==============================================================================
-- MIGRASI SISTEM LAPORAN KENDALA VIDEO / STREAMING (BROKEN STREAM REPORTS)
-- ==============================================================================

-- 1. TABEL UTAMA: BROKEN_STREAM_REPORTS
CREATE TABLE IF NOT EXISTS public.broken_stream_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anime_id INTEGER NOT NULL,
  anime_title TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  server_name TEXT,
  issue_description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'investigating', 'fixed', 'invalid')),
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. INDEXING UNTUK PERFORMA QUERY CEPAT
CREATE INDEX IF NOT EXISTS idx_broken_stream_reports_status 
  ON public.broken_stream_reports (status);

CREATE INDEX IF NOT EXISTS idx_broken_stream_reports_created_at 
  ON public.broken_stream_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broken_stream_reports_anime_id 
  ON public.broken_stream_reports (anime_id);

CREATE INDEX IF NOT EXISTS idx_broken_stream_reports_user_id 
  ON public.broken_stream_reports (user_id);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.broken_stream_reports ENABLE ROW LEVEL SECURITY;

-- Izinkan pelapor (baik login maupun anonim/guest) mengirim laporan kendala
DROP POLICY IF EXISTS "Anyone can insert stream report" ON public.broken_stream_reports;
CREATE POLICY "Anyone can insert stream report"
  ON public.broken_stream_reports
  FOR INSERT
  WITH CHECK (true);

-- Izinkan pembacaan laporan (untuk admin portal & pemantauan)
DROP POLICY IF EXISTS "Public or admin can read stream reports" ON public.broken_stream_reports;
CREATE POLICY "Public or admin can read stream reports"
  ON public.broken_stream_reports
  FOR SELECT
  USING (true);

-- Izinkan admin mengubah status laporan (investigating, fixed, invalid)
DROP POLICY IF EXISTS "Admin can update stream reports status" ON public.broken_stream_reports;
CREATE POLICY "Admin can update stream reports status"
  ON public.broken_stream_reports
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Izinkan admin menghapus riwayat laporan
DROP POLICY IF EXISTS "Admin can delete stream reports" ON public.broken_stream_reports;
CREATE POLICY "Admin can delete stream reports"
  ON public.broken_stream_reports
  FOR DELETE
  USING (true);

-- 4. REALTIME PUBLICATION (Agar Admin Portal dapat live update saat laporan baru masuk)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'broken_stream_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.broken_stream_reports;
  END IF;
END $$;

