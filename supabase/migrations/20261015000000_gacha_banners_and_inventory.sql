-- ==============================================================================
-- NUENIME - GACHA BANNERS, USER INVENTORY & TRANSACTION SCHEMA
-- Mendukung manajemen banner admin, drop pool dinamis, inventory profil per akun,
-- integrasi Dylan Crystal utama, dan audit riwayat transaksi gacha.
-- ==============================================================================

-- 1. TABEL: GACHA_BANNERS (Koleksi Banner Profil & Pool Hadiah Gacha)
CREATE TABLE IF NOT EXISTS public.gacha_banners (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  anime       TEXT DEFAULT '' NOT NULL,
  rarity      TEXT NOT NULL CHECK (rarity IN ('Mythic', 'Legendary', 'Epic', 'Rare', 'Normal')),
  category    TEXT DEFAULT 'Standard' NOT NULL CHECK (category IN ('Basic', 'Standard', 'Premium')),
  exp_bonus   INTEGER DEFAULT 5 NOT NULL CHECK (exp_bonus >= 0),
  image       TEXT NOT NULL,
  color       TEXT DEFAULT '#94A3B8' NOT NULL,
  is_active   BOOLEAN DEFAULT true NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gacha_banners_active ON public.gacha_banners(is_active);
CREATE INDEX IF NOT EXISTS idx_gacha_banners_rarity ON public.gacha_banners(rarity);

-- 2. TABEL: USER_BANNER_INVENTORY (Koleksi Banner Profil Pengguna per Akun)
CREATE TABLE IF NOT EXISTS public.user_banner_inventory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banner_id   TEXT NOT NULL REFERENCES public.gacha_banners(id) ON DELETE CASCADE,
  obtained_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, banner_id)
);

CREATE INDEX IF NOT EXISTS idx_user_banner_inv_user ON public.user_banner_inventory(user_id);

-- 3. TABEL: GACHA_TRANSACTIONS (Riwayat Transaksi Gacha untuk Audit)
CREATE TABLE IF NOT EXISTS public.gacha_transactions (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summon_type TEXT NOT NULL CHECK (summon_type IN ('single', 'multi')),
  cost        INTEGER NOT NULL CHECK (cost >= 0),
  results     JSONB NOT NULL DEFAULT '[]'::jsonb,
  status      TEXT NOT NULL DEFAULT 'success',
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gacha_tx_user ON public.gacha_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_gacha_tx_created ON public.gacha_transactions(created_at DESC);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.gacha_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_banner_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_transactions ENABLE ROW LEVEL SECURITY;

-- Policies untuk gacha_banners (semua orang bisa baca, authenticated/admin bisa modifikasi)
DROP POLICY IF EXISTS "anyone_can_read_banners" ON public.gacha_banners;
CREATE POLICY "anyone_can_read_banners"
  ON public.gacha_banners
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "authenticated_manage_banners" ON public.gacha_banners;
CREATE POLICY "authenticated_manage_banners"
  ON public.gacha_banners
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies untuk user_banner_inventory (hanya pemilik akun yang dapat mengakses miliknya)
DROP POLICY IF EXISTS "users_select_own_banners" ON public.user_banner_inventory;
CREATE POLICY "users_select_own_banners"
  ON public.user_banner_inventory
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_banners" ON public.user_banner_inventory;
CREATE POLICY "users_insert_own_banners"
  ON public.user_banner_inventory
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies untuk gacha_transactions (hanya pemilik akun yang dapat mengakses catatannya)
DROP POLICY IF EXISTS "users_select_own_gacha_tx" ON public.gacha_transactions;
CREATE POLICY "users_select_own_gacha_tx"
  ON public.gacha_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_gacha_tx" ON public.gacha_transactions;
CREATE POLICY "users_insert_own_gacha_tx"
  ON public.gacha_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. FUNCTION: execute_gacha_pull (Transaksi Database Aman & Atomik)
CREATE OR REPLACE FUNCTION public.execute_gacha_pull(
  p_user_id UUID,
  p_type TEXT,
  p_cost INTEGER,
  p_banner_ids TEXT[],
  p_results JSONB,
  p_tx_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_bid TEXT;
BEGIN
  -- 1. Kunci baris saldo pengguna untuk menghindari race condition
  SELECT crystal_balance INTO v_current_balance
  FROM public.user_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  -- 2. Validasi kecukupan saldo Crystal
  IF v_current_balance < p_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_CRYSTAL',
      'current_balance', v_current_balance,
      'required_cost', p_cost
    );
  END IF;

  -- 3. Potong saldo Crystal
  v_new_balance := v_current_balance - p_cost;
  UPDATE public.user_balances
  SET crystal_balance = v_new_balance,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 4. Masukkan banner yang diperoleh ke inventory pengguna (idempotent / ignore duplicates)
  FOREACH v_bid IN ARRAY p_banner_ids LOOP
    INSERT INTO public.user_banner_inventory (user_id, banner_id, obtained_at)
    VALUES (p_user_id, v_bid, NOW())
    ON CONFLICT (user_id, banner_id) DO NOTHING;
  END LOOP;

  -- 5. Catat riwayat transaksi gacha
  INSERT INTO public.gacha_transactions (id, user_id, summon_type, cost, results, status, created_at)
  VALUES (p_tx_id, p_user_id, p_type, p_cost, p_results, 'success', NOW())
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'cost', p_cost,
    'tx_id', p_tx_id
  );
END;
$$;

-- 6. SEED DATA AWAL: Koleksi Banner HD Anime (19 Banner Catalog)
INSERT INTO public.gacha_banners (id, name, anime, rarity, category, exp_bonus, image, color, is_active)
VALUES
  ('saitama_22', 'Saitama 22', 'One Punch Man', 'Legendary', 'Premium', 20, 'https://images.alphacoders.com/657/thumb-1920-657155.jpg', '#EAB308', true),
  ('gojo_infinite_void', 'Satoru Gojo Void', 'Jujutsu Kaisen', 'Mythic', 'Premium', 25, 'https://images.alphacoders.com/133/thumb-1920-1337446.png', '#EC4899', true),
  ('jinwoo_monarch', 'Sung Jinwoo Arise', 'Solo Leveling', 'Mythic', 'Premium', 25, 'https://images.alphacoders.com/134/thumb-1920-1348002.png', '#EC4899', true),
  ('frieren_stargazing', 'Frieren Stargazing', 'Sousou no Frieren', 'Legendary', 'Premium', 20, 'https://images.alphacoders.com/134/thumb-1920-1340156.jpeg', '#EAB308', true),
  ('luffy_gear_5', 'Monkey D. Luffy G5', 'One Piece', 'Legendary', 'Premium', 20, 'https://images.alphacoders.com/132/thumb-1920-1327704.jpeg', '#EAB308', true),
  ('anya_forger_18', 'Anya Forger 18', 'Spy x Family', 'Epic', 'Standard', 15, 'https://images.alphacoders.com/123/thumb-1920-1237691.jpg', '#A855F7', true),
  ('midoriya_16', 'Izuku Midoriya 16', 'My Hero Academia', 'Epic', 'Standard', 15, 'https://images.alphacoders.com/743/thumb-1920-743126.png', '#A855F7', true),
  ('yor_forger_17', 'Yor Forger 17', 'Spy x Family', 'Epic', 'Standard', 15, 'https://images.alphacoders.com/124/thumb-1920-1246337.jpg', '#A855F7', true),
  ('zoro_king_hell', 'Roronoa Zoro Enma', 'One Piece', 'Epic', 'Standard', 15, 'https://images.alphacoders.com/131/thumb-1920-1317529.jpeg', '#A855F7', true),
  ('megumin_explosion', 'Megumin Explosion', 'KonoSuba', 'Epic', 'Standard', 15, 'https://images.alphacoders.com/805/thumb-1920-805177.png', '#A855F7', true),
  ('anya_forger_15', 'Anya Forger 15', 'Spy x Family', 'Rare', 'Standard', 10, 'https://images.alphacoders.com/124/thumb-1920-1243763.jpg', '#38BDF8', true),
  ('fern_7', 'Fern 7', 'Sousou no Frieren', 'Rare', 'Standard', 10, 'https://images.alphacoders.com/134/thumb-1920-1340157.png', '#38BDF8', true),
  ('gojo_9', 'Satoru Gojo 9', 'Jujutsu Kaisen', 'Rare', 'Standard', 10, 'https://images.alphacoders.com/112/thumb-1920-1127027.jpg', '#38BDF8', true),
  ('shinobu_5', 'Shinobu Kocho 5', 'Demon Slayer', 'Rare', 'Standard', 10, 'https://images.alphacoders.com/104/thumb-1920-1044431.jpg', '#38BDF8', true),
  ('tanjirou_sun', 'Tanjiro Hinokami', 'Demon Slayer', 'Rare', 'Standard', 10, 'https://images.alphacoders.com/105/thumb-1920-1051939.jpg', '#38BDF8', true),
  ('naruto_ramen', 'Naruto Ichiraku', 'Naruto Shippuden', 'Normal', 'Basic', 5, 'https://images.alphacoders.com/131/thumb-1920-1313797.png', '#94A3B8', true),
  ('deku_training', 'Deku Training Ground', 'My Hero Academia', 'Normal', 'Basic', 5, 'https://images.alphacoders.com/949/thumb-1920-949430.jpg', '#94A3B8', true),
  ('chopper_sakura', 'Chopper Sakura Island', 'One Piece', 'Normal', 'Basic', 5, 'https://images.alphacoders.com/129/thumb-1920-1296684.png', '#94A3B8', true),
  ('zenitsu_thunder', 'Zenitsu Thunder Clap', 'Demon Slayer', 'Normal', 'Basic', 5, 'https://images.alphacoders.com/108/thumb-1920-1082531.jpg', '#94A3B8', true)
ON CONFLICT (id) DO NOTHING;
