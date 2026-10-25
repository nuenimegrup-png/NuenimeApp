-- ==============================================================================
-- NUENIME: SISTEM COMBAT, BOS KOTA MUSUH, SENJATA SEKALI PAKAI & INVENTORY KLAN
-- ==============================================================================
-- 1. Penghapusan seluruh sistem HP Kota (HP hanya ada pada Bos dan Monster).
-- 2. Sistem Tingkatan (Tier) dan Scaling HP Bos mengikuti Level Kota.
-- 3. Sistem Serangan Bos Kota Musuh khusus Ketua Klan (Base Damage + Weapon Damage).
-- 4. Sistem Senjata Sekali Pakai (Consumable Weapons).
-- 5. Sistem Clan Coin & Transaksi Pembelian Senjata.
-- 6. Inventory Global & Stok Senjata per Klan.
-- 7. Riwayat Pertempuran Bos & Audit Log.
-- ==============================================================================

-- 1. UPDATE TABEL RPG_CITIES: HAPUS HP KOTA
ALTER TABLE public.rpg_cities DROP COLUMN IF EXISTS current_hp;
ALTER TABLE public.rpg_cities DROP COLUMN IF EXISTS max_hp;

-- 2. UPDATE TABEL RPG_CLANS: TAMBAH SALDO COIN KLAN
ALTER TABLE public.rpg_clans ADD COLUMN IF NOT EXISTS coins BIGINT DEFAULT 1000 NOT NULL;

-- 3. TABEL: KATALOG SENJATA SEKALI PAKAI (GLOBAL WEAPONS CATALOG)
CREATE TABLE IF NOT EXISTS public.rpg_weapons_catalog (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rarity VARCHAR(32) NOT NULL, -- 'Basic', 'Advanced', 'Epic', 'Legendary', 'Mythic'
  damage BIGINT NOT NULL,
  price_coin BIGINT NOT NULL,
  icon_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- SEED 5 KATALOG SENJATA STANDAR NUENIME
INSERT INTO public.rpg_weapons_catalog (id, name, rarity, damage, price_coin, description, sort_order)
VALUES
  ('weapon-basic', 'Pedang Dasar (Basic Sword)', 'Basic', 100, 100, 'Pedang baja standar tempaan pandai besi kota. Memberikan tambahan +100 damage sekali pakai.', 1),
  ('weapon-advanced', 'Belati Melengkung (Advanced Dagger)', 'Advanced', 500, 400, 'Senjata tajam berkilau dengan bilah beracun. Memberikan tambahan +500 damage sekali pakai.', 2),
  ('weapon-epic', 'Tombak Halberd Astral (Epic Halberd)', 'Epic', 1000, 800, 'Tombak bertuah kristal aether. Memberikan tambahan +1.000 damage sekali pakai.', 3),
  ('weapon-legendary', 'Lembing Naga Obsidian (Legendary Lance)', 'Legendary', 2000, 1500, 'Senjata kuno yang ditempa dari taring naga purba. Memberikan tambahan +2.000 damage sekali pakai.', 4),
  ('weapon-mythic', 'Pedang Bintang Celestial (Mythic Greatsword)', 'Mythic', 5000, 3500, 'Pusaka tertinggi yang dialiri inti galaksi. Menghantam bos dengan dahsyat +5.000 damage sekali pakai.', 5)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  rarity = EXCLUDED.rarity,
  damage = EXCLUDED.damage,
  price_coin = EXCLUDED.price_coin,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- 4. TABEL: INVENTORY SENJATA KLAN (STOK TERSIMPAN PER KLAN)
CREATE TABLE IF NOT EXISTS public.rpg_clan_inventory (
  clan_id VARCHAR(64) NOT NULL REFERENCES public.rpg_clans(id) ON DELETE CASCADE,
  weapon_id VARCHAR(64) NOT NULL REFERENCES public.rpg_weapons_catalog(id) ON DELETE CASCADE,
  quantity INT DEFAULT 0 NOT NULL CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (clan_id, weapon_id)
);

-- 5. TABEL: RIWAYAT TRANSAKSI COIN KLAN
CREATE TABLE IF NOT EXISTS public.rpg_clan_coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id VARCHAR(64) NOT NULL REFERENCES public.rpg_clans(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL, -- Positif = pemasukan, negatif = pengeluaran
  balance_after BIGINT NOT NULL,
  transaction_type VARCHAR(64) NOT NULL, -- 'WEAPON_PURCHASE', 'BOSS_REWARD', 'INITIAL_GRANT'
  description TEXT,
  actor_user_id TEXT NOT NULL,
  actor_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. UPDATE TABEL RPG_CITY_BOSSES: TIER & SCALING
ALTER TABLE public.rpg_city_bosses 
  ADD COLUMN IF NOT EXISTS tier VARCHAR(32) DEFAULT 'Normal' NOT NULL,
  ADD COLUMN IF NOT EXISTS respawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS defeated_count INT DEFAULT 0 NOT NULL;

-- 7. TABEL: RIWAYAT SERANGAN & PERTEMPURAN BOS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.rpg_boss_battle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id TEXT NOT NULL,
  target_city_id VARCHAR(64) NOT NULL REFERENCES public.rpg_cities(id),
  attacker_user_id TEXT NOT NULL,
  attacker_name TEXT NOT NULL,
  attacker_clan_id VARCHAR(64) NOT NULL REFERENCES public.rpg_clans(id),
  attacker_clan_name TEXT NOT NULL,
  origin_city_id VARCHAR(64) NOT NULL,
  weapon_id VARCHAR(64) REFERENCES public.rpg_weapons_catalog(id),
  weapon_name TEXT,
  base_damage BIGINT NOT NULL,
  weapon_damage BIGINT DEFAULT 0 NOT NULL,
  total_damage BIGINT NOT NULL,
  boss_hp_before BIGINT NOT NULL,
  boss_hp_after BIGINT NOT NULL,
  boss_defeated BOOLEAN DEFAULT FALSE NOT NULL,
  reward_coins BIGINT DEFAULT 0 NOT NULL,
  reward_exp BIGINT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- INDEKS PERFORMA
CREATE INDEX IF NOT EXISTS idx_rpg_clan_inv_clan ON public.rpg_clan_inventory(clan_id);
CREATE INDEX IF NOT EXISTS idx_rpg_clan_coins_tx ON public.rpg_clan_coin_transactions(clan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rpg_boss_battle_logs ON public.rpg_boss_battle_logs(target_city_id, created_at DESC);

-- 8. TRIGGER: SCALING LEVEL & HP MAKSIMUM BOS OTOMATIS SAAT KOTA NAIK LEVEL
CREATE OR REPLACE FUNCTION public.fn_scale_city_boss_on_city_level_change()
RETURNS TRIGGER AS $$
DECLARE
  v_new_max_hp BIGINT;
  v_new_tier VARCHAR(32);
  v_lv INT;
BEGIN
  v_lv := GREATEST(1, COALESCE(NEW.level, 1));

  -- Rumus scaling tier & max hp bos
  IF v_lv < 5 THEN
    v_new_tier := 'Normal';
    v_new_max_hp := 10000 + (v_lv - 1) * 2500;
  ELSIF v_lv < 10 THEN
    v_new_tier := 'Elite';
    v_new_max_hp := 20000 + (v_lv - 5) * 5000;
  ELSIF v_lv < 15 THEN
    v_new_tier := 'Epic';
    v_new_max_hp := 50000 + (v_lv - 10) * 10000;
  ELSIF v_lv < 20 THEN
    v_new_tier := 'Legendary';
    v_new_max_hp := 100000 + (v_lv - 15) * 20000;
  ELSE
    v_new_tier := 'Mythic';
    v_new_max_hp := 200000 + (v_lv - 20) * 50000;
  END IF;

  UPDATE public.rpg_city_bosses
  SET level = v_lv,
      tier = v_new_tier,
      max_hp = v_new_max_hp,
      -- HP saat ini tidak boleh di-reset sembarangan; sesuaikan batas jika melebihi max_hp
      current_hp = LEAST(current_hp, v_new_max_hp),
      updated_at = NOW()
  WHERE city_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scale_city_boss ON public.rpg_cities;
CREATE TRIGGER trg_scale_city_boss
AFTER UPDATE OF level ON public.rpg_cities
FOR EACH ROW EXECUTE FUNCTION public.fn_scale_city_boss_on_city_level_change();

-- 9. RPC FUNCTION: PEMBELIAN SENJATA KLAN MENGGUNAKAN COIN KLAN
CREATE OR REPLACE FUNCTION public.rpc_buy_clan_weapon(
  p_clan_id TEXT,
  p_weapon_id TEXT,
  p_user_id TEXT,
  p_quantity INT DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  v_clan RECORD;
  v_weapon RECORD;
  v_user_role TEXT;
  v_total_cost BIGINT;
  v_new_coins BIGINT;
  v_new_qty INT;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Jumlah pembelian minimal 1 item.');
  END IF;

  -- 1. Validasi Klan
  SELECT * INTO v_clan FROM public.rpg_clans WHERE id = p_clan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan tidak ditemukan.');
  END IF;

  -- 2. Validasi Hak Akses Ketua Klan
  SELECT role INTO v_user_role FROM public.rpg_clan_members 
  WHERE clan_id = p_clan_id AND user_id = p_user_id;

  IF v_clan.leader_id != p_user_id AND COALESCE(v_user_role, '') NOT IN ('Pemimpin Klan', 'Ketua') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Hanya Ketua Klan yang berhak membeli senjata menggunakan Coin klan.');
  END IF;

  -- 3. Validasi Senjata
  SELECT * INTO v_weapon FROM public.rpg_weapons_catalog WHERE id = p_weapon_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Senjata tidak ditemukan dalam katalog aktif.');
  END IF;

  -- 4. Validasi Saldo Coin
  v_total_cost := v_weapon.price_coin * p_quantity;
  IF v_clan.coins < v_total_cost THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'message', 'Saldo Coin klan tidak mencukupi (Dibutuhkan: ' || v_total_cost || ', Saldo: ' || v_clan.coins || ' Coin).'
    );
  END IF;

  -- 5. Kurangi Coin klan
  v_new_coins := v_clan.coins - v_total_cost;
  UPDATE public.rpg_clans SET coins = v_new_coins, updated_at = NOW() WHERE id = p_clan_id;

  -- 6. Tambah Stok Senjata di Inventory Klan
  INSERT INTO public.rpg_clan_inventory (clan_id, weapon_id, quantity, updated_at)
  VALUES (p_clan_id, p_weapon_id, p_quantity, NOW())
  ON CONFLICT (clan_id, weapon_id) DO UPDATE
  SET quantity = public.rpg_clan_inventory.quantity + EXCLUDED.quantity,
      updated_at = NOW()
  RETURNING quantity INTO v_new_qty;

  -- 7. Catat Transaksi Coin
  INSERT INTO public.rpg_clan_coin_transactions (
    clan_id, amount, balance_after, transaction_type, description, actor_user_id, actor_name
  ) VALUES (
    p_clan_id,
    -v_total_cost,
    v_new_coins,
    'WEAPON_PURCHASE',
    'Pembelian ' || p_quantity || 'x ' || v_weapon.name || ' (-' || v_total_cost || ' Coin)',
    p_user_id,
    v_clan.leader_name
  );

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Berhasil membeli ' || p_quantity || 'x ' || v_weapon.name || '!',
    'clan_id', p_clan_id,
    'weapon_id', p_weapon_id,
    'weapon_name', v_weapon.name,
    'quantity_added', p_quantity,
    'total_stock', v_new_qty,
    'total_cost', v_total_cost,
    'remaining_coins', v_new_coins
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC FUNCTION: SERANGAN KE BOS KOTA MUSUH KHUSUS KETUA KLAN
CREATE OR REPLACE FUNCTION public.rpc_attack_enemy_city_boss(
  p_boss_id TEXT,
  p_clan_id TEXT,
  p_user_id TEXT,
  p_user_name TEXT,
  p_weapon_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_clan RECORD;
  v_origin_city RECORD;
  v_boss RECORD;
  v_weapon RECORD;
  v_user_role TEXT;
  v_base_damage BIGINT;
  v_weapon_damage BIGINT := 0;
  v_weapon_name TEXT := NULL;
  v_total_damage BIGINT;
  v_boss_hp_before BIGINT;
  v_boss_hp_after BIGINT;
  v_boss_defeated BOOLEAN := FALSE;
  v_reward_coins BIGINT := 0;
  v_reward_exp BIGINT := 0;
  v_weapon_qty INT := 0;
BEGIN
  -- 1. Validasi Klan
  SELECT * INTO v_clan FROM public.rpg_clans WHERE id = p_clan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan Anda tidak ditemukan.');
  END IF;

  -- 2. Validasi Hak Akses Ketua Klan
  SELECT role INTO v_user_role FROM public.rpg_clan_members 
  WHERE clan_id = p_clan_id AND user_id = p_user_id;

  IF v_clan.leader_id != p_user_id AND COALESCE(v_user_role, '') NOT IN ('Pemimpin Klan', 'Ketua') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Aksi ditolak: Hanya Ketua Klan yang berhak melancarkan serangan ke Bos Kota Musuh.');
  END IF;

  -- 3. Validasi Bos Target
  SELECT * INTO v_boss FROM public.rpg_city_bosses 
  WHERE id = p_boss_id OR city_id = p_boss_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Bos target tidak ditemukan.');
  END IF;

  -- 4. Validasi KOTA MUSUH (Tidak boleh menyerang bos kota domisili klan sendiri)
  IF v_clan.city_id = v_boss.city_id THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Anda tidak dapat menyerang Bos di kota domisili klan Anda sendiri. Serangan hanya dapat ditargetkan ke Bos Kota Musuh!');
  END IF;

  -- 5. Validasi Status Bos
  IF v_boss.current_hp <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Bos kota musuh saat ini telah dikalahkan dan sedang dalam masa pemulihan.');
  END IF;

  -- 6. Ambil Level Kota Asal Penyerang untuk Base Damage
  SELECT * INTO v_origin_city FROM public.rpg_cities WHERE id = v_clan.city_id;
  v_base_damage := 100 + (GREATEST(1, COALESCE(v_origin_city.level, 1)) - 1) * 25;

  -- 7. Validasi & Konsumsi Senjata Sekali Pakai (Jika dipilih)
  IF p_weapon_id IS NOT NULL AND TRIM(p_weapon_id) != '' THEN
    SELECT * INTO v_weapon FROM public.rpg_weapons_catalog WHERE id = p_weapon_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Senjata yang dipilih tidak terdaftar di katalog.');
    END IF;

    -- Periksa stok di inventory klan
    SELECT quantity INTO v_weapon_qty FROM public.rpg_clan_inventory 
    WHERE clan_id = p_clan_id AND weapon_id = p_weapon_id FOR UPDATE;

    IF COALESCE(v_weapon_qty, 0) <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Stok senjata ' || v_weapon.name || ' di inventory klan Anda sudah habis.');
    END IF;

    -- Konsumsi 1 senjata sekali pakai
    UPDATE public.rpg_clan_inventory 
    SET quantity = quantity - 1, updated_at = NOW() 
    WHERE clan_id = p_clan_id AND weapon_id = p_weapon_id;

    v_weapon_damage := v_weapon.damage;
    v_weapon_name := v_weapon.name;
  END IF;

  -- 8. Hitung Total Damage
  v_total_damage := v_base_damage + v_weapon_damage;
  v_boss_hp_before := v_boss.current_hp;
  v_boss_hp_after := GREATEST(0, v_boss_hp_before - v_total_damage);

  -- 9. Periksa apakah Bos Kalah
  IF v_boss_hp_after = 0 AND v_boss_hp_before > 0 THEN
    v_boss_defeated := TRUE;
    -- Reward Coin & EXP berdasarkan Tier Bos
    CASE COALESCE(v_boss.tier, 'Normal')
      WHEN 'Mythic' THEN v_reward_coins := 5000; v_reward_exp := 1000;
      WHEN 'Legendary' THEN v_reward_coins := 2500; v_reward_exp := 500;
      WHEN 'Epic' THEN v_reward_coins := 1200; v_reward_exp := 300;
      WHEN 'Elite' THEN v_reward_coins := 600; v_reward_exp := 150;
      ELSE v_reward_coins := 300; v_reward_exp := 100;
    END CASE;

    -- Tambah saldo Coin ke klan pemenang
    UPDATE public.rpg_clans 
    SET coins = coins + v_reward_coins,
        updated_at = NOW()
    WHERE id = p_clan_id;

    -- Catat pemasukan Coin reward bos
    INSERT INTO public.rpg_clan_coin_transactions (
      clan_id, amount, balance_after, transaction_type, description, actor_user_id, actor_name
    ) VALUES (
      p_clan_id,
      v_reward_coins,
      v_clan.coins + v_reward_coins,
      'BOSS_REWARD',
      'Reward penaklukan Bos ' || v_boss.name || ' (' || COALESCE(v_boss.tier, 'Normal') || ')',
      p_user_id,
      p_user_name
    );

    -- Update Bos: status DORMANT, defeated_count + 1, set respawn timer 1 jam ke depan
    UPDATE public.rpg_city_bosses
    SET current_hp = 0,
        status = 'DORMANT',
        defeated_count = COALESCE(defeated_count, 0) + 1,
        respawn_at = NOW() + INTERVAL '1 hour',
        last_attacked_at = NOW(),
        updated_at = NOW()
    WHERE id = v_boss.id;
  ELSE
    -- Update sisa HP Bos
    UPDATE public.rpg_city_bosses
    SET current_hp = v_boss_hp_after,
        status = CASE WHEN v_boss_hp_after <= (v_boss.max_hp * 0.3) THEN 'ENRANGED' ELSE 'ACTIVE' END,
        last_attacked_at = NOW(),
        updated_at = NOW()
    WHERE id = v_boss.id;
  END IF;

  -- 10. Catat Riwayat Serangan (Audit Trail)
  INSERT INTO public.rpg_boss_battle_logs (
    boss_id, target_city_id, attacker_user_id, attacker_name,
    attacker_clan_id, attacker_clan_name, origin_city_id,
    weapon_id, weapon_name, base_damage, weapon_damage, total_damage,
    boss_hp_before, boss_hp_after, boss_defeated, reward_coins, reward_exp
  ) VALUES (
    v_boss.id, v_boss.city_id, p_user_id, p_user_name,
    p_clan_id, v_clan.name, v_clan.city_id,
    p_weapon_id, v_weapon_name, v_base_damage, v_weapon_damage, v_total_damage,
    v_boss_hp_before, v_boss_hp_after, v_boss_defeated, v_reward_coins, v_reward_exp
  );

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Serangan ke ' || v_boss.name || ' berhasil! Total damage: -' || v_total_damage || ' HP.',
    'boss_id', v_boss.id,
    'boss_name', v_boss.name,
    'boss_tier', COALESCE(v_boss.tier, 'Normal'),
    'base_damage', v_base_damage,
    'weapon_damage', v_weapon_damage,
    'total_damage', v_total_damage,
    'weapon_consumed', v_weapon_name,
    'boss_hp_before', v_boss_hp_before,
    'boss_hp_after', v_boss_hp_after,
    'boss_defeated', v_boss_defeated,
    'reward_coins', v_reward_coins,
    'reward_exp', v_reward_exp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. RLS POLICIES UNTUK TABEL BARU
ALTER TABLE public.rpg_weapons_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view weapons catalog" ON public.rpg_weapons_catalog;
CREATE POLICY "Public can view weapons catalog" ON public.rpg_weapons_catalog FOR SELECT USING (true);

ALTER TABLE public.rpg_clan_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view clan inventory" ON public.rpg_clan_inventory;
CREATE POLICY "Public can view clan inventory" ON public.rpg_clan_inventory FOR SELECT USING (true);

ALTER TABLE public.rpg_clan_coin_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view clan coin transactions" ON public.rpg_clan_coin_transactions;
CREATE POLICY "Public can view clan coin transactions" ON public.rpg_clan_coin_transactions FOR SELECT USING (true);

ALTER TABLE public.rpg_boss_battle_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view boss battle logs" ON public.rpg_boss_battle_logs;
CREATE POLICY "Public can view boss battle logs" ON public.rpg_boss_battle_logs FOR SELECT USING (true);
