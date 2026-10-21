-- ==============================================================================
-- NUENIME - MASTER SQL LENGKAP: IZIN AKSES GACHA & REALTIME BROADCAST
-- File: supabase/migrations/20261022000000_allow_public_manage_gacha_banners_and_realtime.sql
-- ==============================================================================

-- 1. TABEL GACHA_BANNERS (Izin Simpan, Edit, Toggle Aktif, & Hapus dari Admin Dashboard)
ALTER TABLE public.gacha_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_banners" ON public.gacha_banners;
DROP POLICY IF EXISTS "authenticated_manage_banners" ON public.gacha_banners;
DROP POLICY IF EXISTS "allow_all_manage_gacha_banners" ON public.gacha_banners;

CREATE POLICY "allow_all_manage_gacha_banners"
  ON public.gacha_banners
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 2. TABEL USER_BANNER_INVENTORY (Izin Simpan Kepemilikan & Bersihkan saat Banner Dihapus)
ALTER TABLE public.user_banner_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_banners" ON public.user_banner_inventory;
DROP POLICY IF EXISTS "users_insert_own_banners" ON public.user_banner_inventory;
DROP POLICY IF EXISTS "allow_all_manage_user_banner_inventory" ON public.user_banner_inventory;

CREATE POLICY "allow_all_manage_user_banner_inventory"
  ON public.user_banner_inventory
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 3. TABEL GACHA_TRANSACTIONS (Izin Catat Riwayat Transaksi Gacha)
ALTER TABLE public.gacha_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_gacha_tx" ON public.gacha_transactions;
DROP POLICY IF EXISTS "users_insert_own_gacha_tx" ON public.gacha_transactions;
DROP POLICY IF EXISTS "allow_all_manage_gacha_transactions" ON public.gacha_transactions;

CREATE POLICY "allow_all_manage_gacha_transactions"
  ON public.gacha_transactions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 4. TABEL SYSTEM_CONFIGS (Izin Update Harga Spin 1x & 10x, Drop Rates, dan Promo Banner)
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_manage_system_configs" ON public.system_configs;

CREATE POLICY "allow_all_manage_system_configs"
  ON public.system_configs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 5. TABEL SYSTEM_GIFTS (Izin Kirim Hadiah Kompensasi Refund Crystal ke Mailbox User)
ALTER TABLE public.system_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_active_gifts" ON public.system_gifts;
DROP POLICY IF EXISTS "authenticated_manage_gifts" ON public.system_gifts;
DROP POLICY IF EXISTS "all_manage_system_gifts" ON public.system_gifts;

CREATE POLICY "all_manage_system_gifts"
  ON public.system_gifts
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 6. ATUR REPLICA IDENTITY FULL (Agar payload UPDATE & DELETE terbaca utuh oleh Realtime)
ALTER TABLE public.gacha_banners REPLICA IDENTITY FULL;
ALTER TABLE public.system_configs REPLICA IDENTITY FULL;

-- 7. DAFTARKAN TABEL KE SUPABASE REALTIME PUBLICATION
--    Agar setiap perubahan dari Admin langsung di-broadcast secara instan ke APK
DO $$
BEGIN
  -- Daftarkan gacha_banners
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'gacha_banners'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gacha_banners;
  END IF;

  -- Daftarkan system_configs
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;
  END IF;

  -- Daftarkan user_balances
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_balances'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_balances;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
