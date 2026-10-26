-- ==============================================================================
-- NUENIME - ROLLBACK SISTEM KLAN LENGKAP
-- File: 20261105000000_clan_system_upgrade_rollback.sql
-- ==============================================================================
-- PENTING: Script ini membatalkan fungsi RPC, trigger baru, dan tabel permintaan bergabung
-- TANPA menghapus data pengguna, data klan utama, profil, EXP, ataupun saldo Crystal.
-- ==============================================================================

-- 1. DROP RPC FUNCTIONS
DROP FUNCTION IF EXISTS public.rpc_cancel_clan_join_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.rpc_transfer_clan_leadership(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_disband_clan(UUID, TEXT);
DROP FUNCTION IF EXISTS public.rpc_leave_clan(UUID, TEXT);
DROP FUNCTION IF EXISTS public.rpc_respond_clan_join_request(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_request_join_clan(UUID, TEXT);

-- 2. DROP PERMINTAAN BERGABUNG TABEL & POLICIES
DROP POLICY IF EXISTS "clan_join_requests_public_read" ON public.rpg_clan_join_requests;
DROP POLICY IF EXISTS "clan_join_requests_insert_own" ON public.rpg_clan_join_requests;
DROP POLICY IF EXISTS "clan_join_requests_update_leader" ON public.rpg_clan_join_requests;
DROP POLICY IF EXISTS "clan_join_requests_service_role" ON public.rpg_clan_join_requests;

DROP TABLE IF EXISTS public.rpg_clan_join_requests CASCADE;

-- 3. DROP INDICES TAMBAHAN
DROP INDEX IF EXISTS public.uq_rpg_clan_members_single_active_user;
DROP INDEX IF EXISTS public.idx_rpg_clan_members_clan_status;
DROP INDEX IF EXISTS public.idx_rpg_clan_members_user_status;
DROP INDEX IF EXISTS public.idx_rpg_clans_status;

-- 4. KEMBALIKAN CONSTRAINT LAMA JIKA DIBUTUHKAN (Opsional)
-- ALTER TABLE public.rpg_clan_members DROP CONSTRAINT IF EXISTS chk_rpg_clan_members_status;
-- ALTER TABLE public.rpg_clans DROP CONSTRAINT IF EXISTS chk_rpg_clans_status;

-- CATATAN: Kolom status, left_at, disbanded_at pada tabel rpg_clans dan rpg_clan_members
-- sengaja dibiarkan atau di-nullable agar tidak merusak data yang telah dimasukkan selama fitur berjalan.
-- Jika ingin menghapus kolom tersebut, jalankan secara manual:
-- ALTER TABLE public.rpg_clans DROP COLUMN IF EXISTS status;
-- ALTER TABLE public.rpg_clans DROP COLUMN IF EXISTS disbanded_at;
-- ALTER TABLE public.rpg_clans DROP COLUMN IF EXISTS disbanded_by;
-- ALTER TABLE public.rpg_clan_members DROP COLUMN IF EXISTS status;
-- ALTER TABLE public.rpg_clan_members DROP COLUMN IF EXISTS left_at;
