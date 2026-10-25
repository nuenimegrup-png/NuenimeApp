-- ==============================================================================
-- MIGRASI: PEMBERSIHAN KLAN TESTING DI DUNIA NUENIME
-- ==============================================================================

-- 1. Tambahkan policy DELETE agar klan dapat dihapus
DROP POLICY IF EXISTS "Users can delete rpg_clans" ON public.rpg_clans;
CREATE POLICY "Users can delete rpg_clans" ON public.rpg_clans FOR DELETE USING (true);

DROP POLICY IF EXISTS "Users can delete rpg_clan_members" ON public.rpg_clan_members;
CREATE POLICY "Users can delete rpg_clan_members" ON public.rpg_clan_members FOR DELETE USING (true);

-- 2. Hapus seluruh klan uji coba / testing beserta anggotanya (ON DELETE CASCADE)
DELETE FROM public.rpg_clans
WHERE id IN (
  'clan-test-1792940048860',
  'clan-aetheria-1792940077437',
  'clan-aetheria-1792942140417'
)
OR LOWER(name) LIKE '%uji coba%'
OR LOWER(name) LIKE '%test%'
OR tag IN ('TEST1', 'KSIM', 'AA')
OR name = 'ADKNASDSADSD';

-- 3. Reset status profil pengguna yang sebelumnya terhubung ke klan testing
UPDATE public.rpg_user_profiles
SET clan_id = NULL
WHERE clan_id IN (
  'clan-test-1792940048860',
  'clan-aetheria-1792940077437',
  'clan-aetheria-1792942140417'
);
