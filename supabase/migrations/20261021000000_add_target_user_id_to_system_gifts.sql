-- ==============================================================================
-- NUENIME - MIGRATION: TARGET USER ID UNTUK KOMPENSASI BORDER & NOTIFIKASI KLAIM
-- ==============================================================================

-- 1. Tambahkan kolom target_user_id pada tabel system_gifts
--    Jika NULL = Hadiah massal (semua user)
--    Jika terisi = Hadiah khusus user tertentu (misal: pengembalian crystal saat border dihapus)
ALTER TABLE public.system_gifts
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_system_gifts_target_user 
  ON public.system_gifts(target_user_id, is_active, created_at DESC);

-- 2. Kebijakan RLS: Pastikan Admin dan User dapat membaca dan mengelola
DROP POLICY IF EXISTS "anyone_can_read_active_gifts" ON public.system_gifts;
CREATE POLICY "anyone_can_read_active_gifts"
  ON public.system_gifts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "authenticated_manage_gifts" ON public.system_gifts;
DROP POLICY IF EXISTS "all_manage_system_gifts" ON public.system_gifts;
CREATE POLICY "all_manage_system_gifts"
  ON public.system_gifts
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 3. Kebijakan RLS untuk notifications dan klaim hadiah
DROP POLICY IF EXISTS "all_manage_notifications" ON public.notifications;
CREATE POLICY "all_manage_notifications"
  ON public.notifications
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "all_manage_user_gift_claims" ON public.user_gift_claims;
CREATE POLICY "all_manage_user_gift_claims"
  ON public.user_gift_claims
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
