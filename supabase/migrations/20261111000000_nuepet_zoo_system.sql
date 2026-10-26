-- ==============================================================================
-- SISTEM DATABASE NUEPET ZOO: SINKRONISASI AKUN, RATE KOIN, KONVERSI CRYSTAL & GACHA
-- File: supabase/migrations/20261111000000_nuepet_zoo_system.sql
-- ==============================================================================

-- 1. TABEL STATE GAME PENGGUNA (Saldo Koin, Pulau, Langit & Timestamp Klaim)
CREATE TABLE IF NOT EXISTS public.nuepet_user_states (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  coins BIGINT NOT NULL DEFAULT 0 CHECK (coins >= 0),
  active_island_id TEXT NOT NULL DEFAULT 'dc_island_1',
  active_sky_id TEXT NOT NULL DEFAULT 'siang_cerah',
  unlocked_island_ids JSONB NOT NULL DEFAULT '["dc_island_1"]'::jsonb,
  unlocked_sky_ids JSONB NOT NULL DEFAULT '["siang_cerah"]'::jsonb,
  last_claim_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_chest_claim_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABEL KOLEKSI PET PENGGUNA (Setiap Akun Punya Data Pet Sendiri)
CREATE TABLE IF NOT EXISTS public.nuepet_user_pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  species_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  star INT NOT NULL DEFAULT 1 CHECK (star >= 1),
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  is_deployed BOOLEAN NOT NULL DEFAULT true,
  obtained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_nuepet_user_instance UNIQUE (user_id, instance_id)
);

-- Indeks untuk performa query
CREATE INDEX IF NOT EXISTS idx_nuepet_pets_user ON public.nuepet_user_pets (user_id);
CREATE INDEX IF NOT EXISTS idx_nuepet_pets_deployed ON public.nuepet_user_pets (user_id, is_deployed);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.nuepet_user_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nuepet_user_pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_nuepet_state" ON public.nuepet_user_states;
CREATE POLICY "users_read_own_nuepet_state"
  ON public.nuepet_user_states
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_nuepet_state" ON public.nuepet_user_states;
CREATE POLICY "users_update_own_nuepet_state"
  ON public.nuepet_user_states
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_read_own_nuepet_pets" ON public.nuepet_user_pets;
CREATE POLICY "users_read_own_nuepet_pets"
  ON public.nuepet_user_pets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_manage_own_nuepet_pets" ON public.nuepet_user_pets;
CREATE POLICY "users_manage_own_nuepet_pets"
  ON public.nuepet_user_pets
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. RPC: SINKRONISASI AKUN & INITIAL STATE
CREATE OR REPLACE FUNCTION public.nuepet_sync_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_state RECORD;
  v_pets JSONB;
  v_crystals BIGINT := 0;
BEGIN
  -- Validasi keberadaan user di profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Akun pengguna tidak ditemukan';
  END IF;

  -- 1. Inisialisasi state jika belum ada (Koin mulai dari 0 murni)
  INSERT INTO public.nuepet_user_states (
    user_id,
    coins,
    active_island_id,
    active_sky_id,
    unlocked_island_ids,
    unlocked_sky_ids,
    last_claim_at
  ) VALUES (
    p_user_id,
    0,
    'dc_island_1',
    'siang_cerah',
    '["dc_island_1"]'::jsonb,
    '["siang_cerah"]'::jsonb,
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Bersihkan pet dummy awal (pet_init_%) agar koleksi mulai murni dari 0 pet (hanya didapat dari gacha)
  DELETE FROM public.nuepet_user_pets
  WHERE user_id = p_user_id AND instance_id LIKE 'pet_init_%';

  -- 3. Ambil data state
  SELECT * INTO v_state FROM public.nuepet_user_states WHERE user_id = p_user_id;

  -- 4. Ambil daftar pet milik user
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'instanceId', instance_id,
        'speciesId', species_id,
        'nickname', nickname,
        'star', star,
        'level', level,
        'isDeployed', is_deployed,
        'obtainedAt', EXTRACT(EPOCH FROM obtained_at) * 1000
      ) ORDER BY obtained_at ASC
    ),
    '[]'::jsonb
  ) INTO v_pets
  FROM public.nuepet_user_pets
  WHERE user_id = p_user_id;

  -- 5. Ambil saldo Crystal resmi dari user_balances / profiles
  SELECT COALESCE(crystal_balance, 0) INTO v_crystals
  FROM public.user_balances
  WHERE user_id = p_user_id;

  IF v_crystals IS NULL OR v_crystals = 0 THEN
    SELECT COALESCE(crystals, 0) INTO v_crystals
    FROM public.profiles
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'coins', COALESCE(v_state.coins, 0),
    'crystals', COALESCE(v_crystals, 0),
    'activeIslandId', v_state.active_island_id,
    'activeSkyId', v_state.active_sky_id,
    'unlockedIslandIds', v_state.unlocked_island_ids,
    'unlockedSkyIds', v_state.unlocked_sky_ids,
    'lastClaimAt', EXTRACT(EPOCH FROM v_state.last_claim_at) * 1000,
    'lastChestClaimAt', CASE WHEN v_state.last_chest_claim_at IS NOT NULL THEN EXTRACT(EPOCH FROM v_state.last_chest_claim_at) * 1000 ELSE NULL END,
    'pets', v_pets
  );
END;
$$;

-- 5. RPC: KLAIM KOIN PASIF BERDASARKAN HITUNGAN REAL-TIME
CREATE OR REPLACE FUNCTION public.nuepet_claim_coins(p_user_id UUID, p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_coins BIGINT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Jumlah koin yang diklaim harus lebih dari 0';
  END IF;

  UPDATE public.nuepet_user_states
  SET coins = coins + p_amount,
      last_claim_at = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING coins INTO v_new_coins;

  RETURN jsonb_build_object(
    'success', true,
    'claimedAmount', p_amount,
    'newTotalCoins', v_new_coins,
    'lastClaimAt', EXTRACT(EPOCH FROM NOW()) * 1000
  );
END;
$$;

-- 6. RPC: TUKAR KOIN KE CRYSTAL (Aturan Resmi: 50.000 Koin = 5.000 Crystal -> Rasio 10:1)
CREATE OR REPLACE FUNCTION public.nuepet_convert_coins_to_crystals(p_user_id UUID, p_coins BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_coins BIGINT;
  v_crystal_gain BIGINT;
  v_coins_deducted BIGINT;
  v_new_coins BIGINT;
  v_new_crystals BIGINT;
BEGIN
  -- Validasi minimal tukar 10 koin
  IF p_coins < 10 THEN
    RAISE EXCEPTION 'Minimal penukaran adalah 10 Koin (1 Crystal)';
  END IF;

  -- Cek saldo koin pengguna
  SELECT coins INTO v_current_coins
  FROM public.nuepet_user_states
  WHERE user_id = p_user_id;

  IF v_current_coins IS NULL OR v_current_coins < p_coins THEN
    RAISE EXCEPTION 'Saldo Koin tidak mencukupi untuk penukaran. Koin saat ini: %, Dibutuhkan: %', COALESCE(v_current_coins, 0), p_coins;
  END IF;

  -- Hitung perolehan Crystal dengan rasio 10 Koin = 1 Crystal (Contoh: 50.000 Koin = 5.000 Crystal)
  v_crystal_gain := FLOOR(p_coins / 10);
  v_coins_deducted := v_crystal_gain * 10;

  -- 1. Kurangi koin pengguna di nuepet_user_states
  UPDATE public.nuepet_user_states
  SET coins = coins - v_coins_deducted,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING coins INTO v_new_coins;

  -- 2. Tambahkan Crystal ke user_balances
  INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
  VALUES (p_user_id, v_crystal_gain, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET crystal_balance = COALESCE(public.user_balances.crystal_balance, 0) + v_crystal_gain,
      updated_at = NOW()
  RETURNING crystal_balance INTO v_new_crystals;

  -- 3. Sinkronkan ke tabel profiles jika kolom crystals ada
  BEGIN
    UPDATE public.profiles
    SET crystals = COALESCE(crystals, 0) + v_crystal_gain
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Kolom crystals optional di profiles jika menggunakan user_balances
  END;

  RETURN jsonb_build_object(
    'success', true,
    'coinsConverted', v_coins_deducted,
    'crystalsGained', v_crystal_gain,
    'newTotalCoins', v_new_coins,
    'newTotalCrystals', v_new_crystals
  );
END;
$$;

-- 7. RPC: GACHA DRAW MENGGUNAKAN SALDO CRYSTAL AKUN (1x = 500 Crystal, 10x = 5.000 Crystal)
CREATE OR REPLACE FUNCTION public.nuepet_gacha_draw(
  p_user_id UUID,
  p_draw_count INT,
  p_rolled_pets JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cost BIGINT;
  v_current_crystals BIGINT := 0;
  v_new_crystals BIGINT;
  v_pet JSONB;
BEGIN
  -- Validasi jumlah draw
  IF p_draw_count = 1 THEN
    v_cost := 500;
  ELSIF p_draw_count = 10 THEN
    v_cost := 5000;
  ELSE
    RAISE EXCEPTION 'Jumlah draw hanya boleh 1x (500 Crystal) atau 10x (5.000 Crystal)';
  END IF;

  -- Cek saldo crystal di user_balances
  SELECT COALESCE(crystal_balance, 0) INTO v_current_crystals
  FROM public.user_balances
  WHERE user_id = p_user_id;

  -- Fallback cek di profiles
  IF v_current_crystals IS NULL OR v_current_crystals < v_cost THEN
    SELECT COALESCE(crystals, 0) INTO v_current_crystals
    FROM public.profiles
    WHERE id = p_user_id;
  END IF;

  IF v_current_crystals IS NULL OR v_current_crystals < v_cost THEN
    RAISE EXCEPTION 'Saldo Crystal tidak mencukupi untuk Gacha. Dibutuhkan: % Crystal, Saldo Anda: % Crystal', v_cost, COALESCE(v_current_crystals, 0);
  END IF;

  -- 1. Potong saldo Crystal di user_balances
  UPDATE public.user_balances
  SET crystal_balance = GREATEST(0, crystal_balance - v_cost),
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING crystal_balance INTO v_new_crystals;

  -- Jika user_balances belum pernah ada barisnya
  IF v_new_crystals IS NULL THEN
    v_new_crystals := GREATEST(0, v_current_crystals - v_cost);
    INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
    VALUES (p_user_id, v_new_crystals, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET crystal_balance = EXCLUDED.crystal_balance, updated_at = NOW();
  END IF;

  -- 2. Potong saldo Crystal di profiles jika kolom crystals ada
  BEGIN
    UPDATE public.profiles
    SET crystals = GREATEST(0, COALESCE(crystals, 0) - v_cost)
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
  END;

  -- 3. Masukkan pet baru yang didapat ke nuepet_user_pets
  FOR v_pet IN SELECT * FROM jsonb_array_elements(p_rolled_pets) LOOP
    INSERT INTO public.nuepet_user_pets (
      user_id,
      instance_id,
      species_id,
      nickname,
      star,
      level,
      is_deployed,
      obtained_at
    ) VALUES (
      p_user_id,
      v_pet->>'instanceId',
      v_pet->>'speciesId',
      v_pet->>'nickname',
      COALESCE((v_pet->>'star')::INT, 1),
      COALESCE((v_pet->>'level')::INT, 1),
      COALESCE((v_pet->>'isDeployed')::BOOLEAN, false),
      NOW()
    )
    ON CONFLICT (user_id, instance_id) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'drawCount', p_draw_count,
    'cost', v_cost,
    'newTotalCrystals', v_new_crystals
  );
END;
$$;

-- 8. RPC: SIMPAN PERUBAHAN STATE PET (Deploy, Merge, Beli Pulau/Langit)
CREATE OR REPLACE FUNCTION public.nuepet_save_state(
  p_user_id UUID,
  p_coins BIGINT,
  p_active_island TEXT,
  p_active_sky TEXT,
  p_unlocked_islands JSONB,
  p_unlocked_skies JSONB,
  p_pets JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pet JSONB;
  v_instance_ids TEXT[];
BEGIN
  -- 1. Update status pulau & langit
  UPDATE public.nuepet_user_states
  SET coins = GREATEST(0, p_coins),
      active_island_id = COALESCE(p_active_island, active_island_id),
      active_sky_id = COALESCE(p_active_sky, active_sky_id),
      unlocked_island_ids = COALESCE(p_unlocked_islands, unlocked_island_ids),
      unlocked_sky_ids = COALESCE(p_unlocked_skies, unlocked_sky_ids),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 2. Sinkronkan seluruh pet yang ada
  SELECT array_agg(v->>'instanceId') INTO v_instance_ids
  FROM jsonb_array_elements(p_pets) v;

  -- Hapus pet yang sudah di-merge (dikonsumsi) jika ada
  IF v_instance_ids IS NOT NULL THEN
    DELETE FROM public.nuepet_user_pets
    WHERE user_id = p_user_id
      AND instance_id != ALL(v_instance_ids);
  END IF;

  -- Upsert status setiap pet (star, level, is_deployed)
  FOR v_pet IN SELECT * FROM jsonb_array_elements(p_pets) LOOP
    INSERT INTO public.nuepet_user_pets (
      user_id,
      instance_id,
      species_id,
      nickname,
      star,
      level,
      is_deployed
    ) VALUES (
      p_user_id,
      v_pet->>'instanceId',
      v_pet->>'speciesId',
      v_pet->>'nickname',
      COALESCE((v_pet->>'star')::INT, 1),
      COALESCE((v_pet->>'level')::INT, 1),
      COALESCE((v_pet->>'isDeployed')::BOOLEAN, false)
    )
    ON CONFLICT (user_id, instance_id) DO UPDATE
    SET star = EXCLUDED.star,
        level = EXCLUDED.level,
        is_deployed = EXCLUDED.is_deployed;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. RPC: KLAIM HADIAH PETI HARTA KARUN (CRYSTAL + KOIN SUNGGUHAN MASUK KE AKUN)
CREATE OR REPLACE FUNCTION public.nuepet_claim_chest_reward(
  p_user_id UUID,
  p_crystals BIGINT,
  p_coins BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_coins BIGINT;
  v_new_crystals BIGINT;
BEGIN
  -- 1. Tambah Koin di nuepet_user_states dan perbarui last_chest_claim_at
  UPDATE public.nuepet_user_states
  SET coins = COALESCE(coins, 0) + GREATEST(0, p_coins),
      last_chest_claim_at = NOW(),
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING coins INTO v_new_coins;

  IF v_new_coins IS NULL THEN
    INSERT INTO public.nuepet_user_states (
      user_id,
      coins,
      last_chest_claim_at,
      updated_at
    ) VALUES (
      p_user_id,
      GREATEST(0, p_coins),
      NOW(),
      NOW()
    )
    RETURNING coins INTO v_new_coins;
  END IF;

  -- 2. Tambah Crystal ke user_balances secara riil
  INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
  VALUES (p_user_id, GREATEST(0, p_crystals), NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET crystal_balance = COALESCE(public.user_balances.crystal_balance, 0) + GREATEST(0, p_crystals),
      updated_at = NOW()
  RETURNING crystal_balance INTO v_new_crystals;

  -- 3. Sinkronkan juga ke tabel profiles jika kolom crystals ada
  BEGIN
    UPDATE public.profiles
    SET crystals = COALESCE(crystals, 0) + GREATEST(0, p_crystals)
    WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
  END;

  RETURN jsonb_build_object(
    'success', true,
    'addedCoins', p_coins,
    'addedCrystals', p_crystals,
    'newTotalCoins', v_new_coins,
    'newTotalCrystals', v_new_crystals,
    'nextClaimAt', EXTRACT(EPOCH FROM (NOW() + interval '7 hours')) * 1000
  );
END;
$$;

-- Reset cooldown peti saat ini agar pengguna bisa langsung membuka dan mengklaim hadiah
UPDATE public.nuepet_user_states
SET last_chest_claim_at = NULL;

-- Berikan izin eksekusi ke authenticated dan anon
GRANT EXECUTE ON FUNCTION public.nuepet_sync_account(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.nuepet_claim_coins(UUID, BIGINT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.nuepet_convert_coins_to_crystals(UUID, BIGINT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.nuepet_gacha_draw(UUID, INT, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.nuepet_save_state(UUID, BIGINT, TEXT, TEXT, JSONB, JSONB, JSONB) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.nuepet_claim_chest_reward(UUID, BIGINT, BIGINT) TO authenticated, anon;
