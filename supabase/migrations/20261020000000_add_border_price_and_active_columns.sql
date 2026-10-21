-- Migration: Add price_crystal and is_active columns to avatar_borders_config
ALTER TABLE public.avatar_borders_config 
  ADD COLUMN IF NOT EXISTS price_crystal NUMERIC DEFAULT NULL;

ALTER TABLE public.avatar_borders_config 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Ensure RLS allows select for all and management for authenticated
ALTER TABLE public.avatar_borders_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_public_read_avatar_borders" ON public.avatar_borders_config;
CREATE POLICY "allow_public_read_avatar_borders"
  ON public.avatar_borders_config
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "allow_auth_manage_avatar_borders" ON public.avatar_borders_config;
DROP POLICY IF EXISTS "allow_all_manage_avatar_borders" ON public.avatar_borders_config;
CREATE POLICY "allow_all_manage_avatar_borders"
  ON public.avatar_borders_config
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Ensure user_border_purchases can also be managed/cleaned up when a border is deleted
DROP POLICY IF EXISTS "allow_all_manage_user_border_purchases" ON public.user_border_purchases;
CREATE POLICY "allow_all_manage_user_border_purchases"
  ON public.user_border_purchases
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
