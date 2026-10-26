-- Migration: Perbaikan RLS Policy & Penguncian Status Pending Top Up
-- Memastikan pengguna dapat membuat dan memperbarui transaksi dengan status 'menunggu_konfirmasi' & 'menunggu_verifikasi'

ALTER TABLE public.topup_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own topup transaction" ON public.topup_transactions;
CREATE POLICY "Users can insert own topup transaction"
  ON public.topup_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid())::text = user_id::text AND
    status IN ('menunggu_pembayaran', 'menunggu_verifikasi', 'menunggu_konfirmasi') AND
    crystals_granted = FALSE
  );

DROP POLICY IF EXISTS "Users can update own topup pending status" ON public.topup_transactions;
CREATE POLICY "Users can update own topup pending status"
  ON public.topup_transactions
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid())::text = user_id::text OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin', 'Finance')
    )
  )
  WITH CHECK (
    (
      (auth.uid())::text = user_id::text AND
      status IN ('menunggu_pembayaran', 'menunggu_verifikasi', 'menunggu_konfirmasi', 'dibatalkan') AND
      crystals_granted = FALSE
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin', 'Finance')
    )
  );
