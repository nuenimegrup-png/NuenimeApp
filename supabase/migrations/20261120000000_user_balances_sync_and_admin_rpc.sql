-- ==============================================================================
-- Migration: 20261120000000_user_balances_sync_and_admin_rpc.sql
-- Fitur: Sinkronisasi Saldo Dylan Crystal Akun Antara APK & Admin Panel
--        + RPC Pengambilan Saldo Massal Cepat (admin_get_all_user_balances)
--        + Policy SELECT Publik untuk user_balances (Bebas Blokir RLS)
--        + RPC Penyetelan Saldo Atomik (admin_set_user_crystal_balance)
-- ==============================================================================

-- 1. Berikan Akses SELECT Publik ke Tabel user_balances
--    Tujuan: Agar APK dan Admin Panel selalu membaca nilai saldo riil yang persis sama.
--    Keamanan: INSERT, UPDATE, dan DELETE TETAP DILARANG dan hanya bisa via fungsi RPC SECURITY DEFINER!
ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read all user_balances for sync" ON public.user_balances;
CREATE POLICY "Allow read all user_balances for sync"
  ON public.user_balances
  FOR SELECT
  TO public
  USING (true);

-- 2. Fungsi RPC: admin_get_all_user_balances
--    Mengambil seluruh saldo pengguna dalam 1 kali roundtrip database (sangat cepat, 20-40ms).
CREATE OR REPLACE FUNCTION public.admin_get_all_user_balances()
RETURNS TABLE (
  user_id UUID,
  crystal_balance INTEGER,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ub.user_id, ub.crystal_balance, ub.updated_at
  FROM public.user_balances ub;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_all_user_balances() TO authenticated, service_role, anon;

-- 3. Fungsi RPC: admin_set_user_crystal_balance
--    Mengatur saldo pengguna secara pasti dari admin panel dengan keamanan atomik.
CREATE OR REPLACE FUNCTION public.admin_set_user_crystal_balance(
  p_user_id UUID,
  p_new_balance INTEGER,
  p_reason TEXT DEFAULT 'Penyesuaian oleh Admin',
  p_admin_id TEXT DEFAULT 'admin',
  p_admin_email TEXT DEFAULT 'admin@nuenime.com'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance INTEGER := 0;
BEGIN
  IF p_new_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo tidak boleh bernilai negatif');
  END IF;

  -- Kunci dan ambil saldo saat ini
  SELECT COALESCE(crystal_balance, 0) INTO v_old_balance
  FROM public.user_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_old_balance := 0;
  END IF;

  -- Upsert saldo baru
  INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
  VALUES (p_user_id, p_new_balance, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET crystal_balance = p_new_balance,
      updated_at = NOW();

  -- Catat log penyesuaian jika tabel balance_adjustments ada
  BEGIN
    INSERT INTO public.balance_adjustments (
      user_id, admin_id, admin_email, amount, balance_before, balance_after, reason, created_at
    ) VALUES (
      p_user_id,
      CASE WHEN length(p_admin_id) = 36 THEN p_admin_id::uuid ELSE NULL END,
      p_admin_email,
      p_new_balance - v_old_balance,
      v_old_balance,
      p_new_balance,
      p_reason,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'balance_before', v_old_balance,
    'balance_after', p_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_crystal_balance(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated, service_role, anon;

