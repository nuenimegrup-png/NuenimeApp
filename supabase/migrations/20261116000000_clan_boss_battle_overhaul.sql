-- ==============================================================================
-- MIGRATION: 20261116000000_clan_boss_battle_overhaul.sql
-- DESKRIPSI: OVERHAUL LENGKAP SISTEM CLAN BOSS BATTLE NUENIME
-- 1. Cooldown serangan per klan 60 menit (kebal ganti target / refresh / logout).
-- 2. Hak akses pembelian senjata & serangan HANYA untuk Pemimpin Klan (Leader).
-- 3. Semua klan di kota yang sama / kota lain bersaing pada Boss yang sama.
-- 4. Sistem ronde boss (current_round) & penentuan juara berdasarkan TOTAL DAMAGE TERTINGGI.
-- 5. Formula hadiah koin klan: 10.000 x Level Boss khusus kas klan pemenang.
-- 6. Reset otomatis HP boss ke penuh untuk ronde baru saat boss dikalahkan.
-- 7. Audit trail serangan resmi & RPC leaderboard real-time dari backend.
-- ==============================================================================

-- 1. TABEL: COOLDOWN SERANGAN BOS PER KLAN (60 MENIT)
CREATE TABLE IF NOT EXISTS public.rpg_clan_boss_cooldowns (
  clan_id VARCHAR(64) NOT NULL REFERENCES public.rpg_clans(id) ON DELETE CASCADE,
  boss_id TEXT NOT NULL,
  last_attack_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_attack_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (clan_id, boss_id)
);

CREATE INDEX IF NOT EXISTS idx_rpg_clan_boss_cd ON public.rpg_clan_boss_cooldowns(clan_id, boss_id);
CREATE INDEX IF NOT EXISTS idx_rpg_clan_boss_cd_clan ON public.rpg_clan_boss_cooldowns(clan_id, next_attack_at DESC);
ALTER TABLE public.rpg_clan_boss_cooldowns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view clan boss cooldowns" ON public.rpg_clan_boss_cooldowns;
CREATE POLICY "Public can view clan boss cooldowns" ON public.rpg_clan_boss_cooldowns FOR SELECT USING (true);

-- 2. UPDATE TABEL RPG_CITY_BOSSES: CURRENT_ROUND & MINIMAL LEVEL 1
ALTER TABLE public.rpg_city_bosses
  ADD COLUMN IF NOT EXISTS current_round INT DEFAULT 1 NOT NULL;

UPDATE public.rpg_city_bosses
SET level = GREATEST(1, COALESCE(level, 1))
WHERE level IS NULL OR level < 1;

-- 3. UPDATE TABEL RPG_BOSS_BATTLE_LOGS: ROUND_ID
ALTER TABLE public.rpg_boss_battle_logs
  ADD COLUMN IF NOT EXISTS round_id INT DEFAULT 1 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rpg_boss_battle_logs_round ON public.rpg_boss_battle_logs(boss_id, round_id, created_at DESC);

-- 4. TABEL: RIWAYAT RONDE & PEMENANG BOS KOTA
CREATE TABLE IF NOT EXISTS public.rpg_boss_round_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_id TEXT NOT NULL,
  city_id VARCHAR(64) NOT NULL,
  round_number INT NOT NULL,
  boss_name TEXT NOT NULL,
  boss_level INT NOT NULL,
  winner_clan_id VARCHAR(64) NOT NULL REFERENCES public.rpg_clans(id) ON DELETE CASCADE,
  winner_clan_name TEXT NOT NULL,
  winner_damage BIGINT NOT NULL,
  total_raid_damage BIGINT NOT NULL,
  reward_coins BIGINT NOT NULL,
  last_striker_clan_id VARCHAR(64) REFERENCES public.rpg_clans(id) ON DELETE SET NULL,
  last_striker_clan_name TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_boss_round UNIQUE (boss_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_rpg_boss_round_history ON public.rpg_boss_round_history(boss_id, round_number DESC);
ALTER TABLE public.rpg_boss_round_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view boss round history" ON public.rpg_boss_round_history;
CREATE POLICY "Public can view boss round history" ON public.rpg_boss_round_history FOR SELECT USING (true);

-- 5. RPC FUNCTION: PEMBELIAN SENJATA GUDANG KLAN OLEH PEMIMPIN KLAN
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

  -- 1. Validasi Klan & Lock
  SELECT * INTO v_clan FROM public.rpg_clans WHERE id = p_clan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan tidak ditemukan.');
  END IF;

  -- 2. Validasi Hak Akses Pemimpin Klan (Leader Only)
  SELECT role INTO v_user_role FROM public.rpg_clan_members 
  WHERE clan_id = p_clan_id AND user_id = p_user_id;

  IF v_clan.leader_id != p_user_id AND COALESCE(v_user_role, '') NOT IN ('Pemimpin Klan', 'Ketua', 'Founder') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Hanya Ketua/Pemimpin Klan yang berhak membeli senjata menggunakan saldo koin klan.');
  END IF;

  -- 3. Validasi Senjata dari Katalog Resmi
  SELECT * INTO v_weapon FROM public.rpg_weapons_catalog WHERE id = p_weapon_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Senjata tidak ditemukan dalam katalog aktif.');
  END IF;

  -- 4. Validasi Saldo Koin Klan (Saldo tidak boleh negatif)
  v_total_cost := v_weapon.price_coin * p_quantity;
  IF v_clan.coins < v_total_cost THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'message', 'Saldo koin klan tidak mencukupi (Dibutuhkan: ' || v_total_cost || ', Saldo: ' || v_clan.coins || ' Koin).'
    );
  END IF;

  -- 5. Potong Saldo Koin Klan
  v_new_coins := v_clan.coins - v_total_cost;
  UPDATE public.rpg_clans SET coins = v_new_coins, updated_at = NOW() WHERE id = p_clan_id;

  -- 6. Tambah Stok Senjata di Inventaris Gudang Klan Ini
  INSERT INTO public.rpg_clan_inventory (clan_id, weapon_id, quantity, updated_at)
  VALUES (p_clan_id, p_weapon_id, p_quantity, NOW())
  ON CONFLICT (clan_id, weapon_id) DO UPDATE
  SET quantity = public.rpg_clan_inventory.quantity + EXCLUDED.quantity,
      updated_at = NOW()
  RETURNING quantity INTO v_new_qty;

  -- 7. Catat Riwayat Transaksi Mutasi Kas Klan
  INSERT INTO public.rpg_clan_coin_transactions (
    clan_id, amount, balance_after, transaction_type, description, actor_user_id, actor_name
  ) VALUES (
    p_clan_id,
    -v_total_cost,
    v_new_coins,
    'WEAPON_PURCHASE',
    'Pembelian ' || p_quantity || 'x ' || v_weapon.name || ' (-' || v_total_cost || ' Koin)',
    p_user_id,
    COALESCE(v_clan.leader_name, 'Pemimpin Klan')
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

-- 6. RPC FUNCTION: SERANGAN BOS KOTA OLEH PEMIMPIN KLAN
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
  v_effective_damage BIGINT;
  v_boss_hp_before BIGINT;
  v_boss_hp_after BIGINT;
  v_boss_defeated BOOLEAN := FALSE;
  v_round_id INT;
  v_cooldown_until TIMESTAMPTZ;
  v_cooldown_seconds INT := 0;
  v_weapon_qty INT := 0;
  v_boss_level INT;
  v_reward_coins BIGINT := 0;
  v_winner_clan_id VARCHAR(64);
  v_winner_clan_name TEXT;
  v_winner_damage BIGINT := 0;
  v_winner_first_strike TIMESTAMPTZ;
  v_winner_balance_after BIGINT;
BEGIN
  -- 1. Validasi Klan
  SELECT * INTO v_clan FROM public.rpg_clans WHERE id = p_clan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan Anda tidak ditemukan.');
  END IF;

  -- 2. Validasi Hak Akses: HANYA Pemimpin Klan (Leader) yang Boleh Menyerang Boss
  SELECT role INTO v_user_role FROM public.rpg_clan_members 
  WHERE clan_id = p_clan_id AND user_id = p_user_id AND status = 'active';

  IF v_clan.leader_id != p_user_id AND COALESCE(v_user_role, '') NOT IN ('Pemimpin Klan', 'Ketua', 'Founder') THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'message', 'Aksi ditolak: Hanya Pemimpin Klan yang berhak memulai serangan ke Bos Kota.'
    );
  END IF;

  -- 3. Validasi Bos Target dengan Kunci Baris (Pencegahan Race Condition)
  SELECT * INTO v_boss FROM public.rpg_city_bosses 
  WHERE id = p_boss_id OR city_id = p_boss_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Bos target tidak ditemukan.');
  END IF;

  -- 4. Validasi Status Bos
  IF v_boss.current_hp <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'message', 'Bos kota saat ini sedang dalam pemulihan untuk ronde berikutnya.'
    );
  END IF;

  -- 5. Validasi Cooldown Serangan Klan (60 Menit per Klan, kebal ganti target / API bypass)
  SELECT next_attack_at INTO v_cooldown_until
  FROM public.rpg_clan_boss_cooldowns
  WHERE clan_id = p_clan_id
  ORDER BY next_attack_at DESC
  LIMIT 1;

  IF v_cooldown_until IS NOT NULL AND v_cooldown_until > NOW() THEN
    v_cooldown_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_cooldown_until - NOW()))::INT);
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'Klan Anda sedang dalam masa cooldown serangan (60 menit). Serangan berikutnya dapat dilakukan pada ' || to_char(v_cooldown_until, 'HH24:MI:SS') || '.',
      'cooldown_seconds', v_cooldown_seconds,
      'next_attack_at', v_cooldown_until
    );
  END IF;

  -- 6. Ambil Level Kota Asal Penyerang untuk Base Damage
  SELECT * INTO v_origin_city FROM public.rpg_cities WHERE id = v_clan.city_id;
  v_base_damage := 100 + (GREATEST(1, COALESCE(v_origin_city.level, 1)) - 1) * 25;

  -- 7. Validasi & Konsumsi Senjata Sekali Pakai Milik Klan (Jika dipilih)
  IF p_weapon_id IS NOT NULL AND TRIM(p_weapon_id) != '' THEN
    SELECT * INTO v_weapon FROM public.rpg_weapons_catalog WHERE id = p_weapon_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Senjata yang dipilih tidak terdaftar di katalog.');
    END IF;

    -- Periksa stok di inventory klan (khusus klan penyerang)
    SELECT quantity INTO v_weapon_qty FROM public.rpg_clan_inventory 
    WHERE clan_id = p_clan_id AND weapon_id = p_weapon_id FOR UPDATE;

    IF COALESCE(v_weapon_qty, 0) <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Stok senjata ' || v_weapon.name || ' di gudang klan Anda sudah habis.');
    END IF;

    -- Konsumsi 1 senjata sekali pakai
    UPDATE public.rpg_clan_inventory 
    SET quantity = quantity - 1, updated_at = NOW() 
    WHERE clan_id = p_clan_id AND weapon_id = p_weapon_id;

    v_weapon_damage := v_weapon.damage;
    v_weapon_name := v_weapon.name;
  END IF;

  -- 8. Hitung Total Damage & Cap Efektif ke Sisa HP Bos
  v_total_damage := v_base_damage + v_weapon_damage;
  v_boss_hp_before := v_boss.current_hp;
  v_effective_damage := LEAST(v_total_damage, v_boss_hp_before);
  v_boss_hp_after := GREATEST(0, v_boss_hp_before - v_effective_damage);
  v_round_id := COALESCE(v_boss.current_round, 1);

  -- 9. Catat Riwayat Serangan ke Audit Trail (dengan damage aktual yang adil)
  INSERT INTO public.rpg_boss_battle_logs (
    boss_id, round_id, target_city_id, attacker_user_id, attacker_name,
    attacker_clan_id, attacker_clan_name, origin_city_id,
    weapon_id, weapon_name, base_damage, weapon_damage, total_damage,
    boss_hp_before, boss_hp_after, boss_defeated, reward_coins, reward_exp
  ) VALUES (
    v_boss.id, v_round_id, v_boss.city_id, p_user_id, p_user_name,
    p_clan_id, v_clan.name, v_clan.city_id,
    p_weapon_id, v_weapon_name, v_base_damage, v_weapon_damage, v_effective_damage,
    v_boss_hp_before, v_boss_hp_after, (v_boss_hp_after = 0), 0, 0
  );

  -- 10. Terapkan Cooldown Serangan 60 Menit untuk Seluruh Target Bos
  INSERT INTO public.rpg_clan_boss_cooldowns (
    clan_id, boss_id, last_attack_at, next_attack_at, updated_at
  ) VALUES (
    p_clan_id, v_boss.id, NOW(), NOW() + INTERVAL '60 minutes', NOW()
  ) ON CONFLICT (clan_id, boss_id) DO UPDATE SET
    last_attack_at = NOW(),
    next_attack_at = NOW() + INTERVAL '60 minutes',
    updated_at = NOW();

  -- 11. Logika Selesai Ronde & Penentuan Juara Berdasarkan TOTAL DAMAGE TERTINGGI
  IF v_boss_hp_after = 0 AND v_boss_hp_before > 0 THEN
    v_boss_defeated := TRUE;

    -- Cari klan dengan TOTAL DAMAGE TERTINGGI dalam ronde ini
    -- Jika seri, klan yang pertama kali melancarkan serangan menang (first_strike ASC)
    SELECT 
      attacker_clan_id, 
      attacker_clan_name, 
      SUM(total_damage) AS clan_damage, 
      MIN(created_at) AS first_strike
    INTO 
      v_winner_clan_id, 
      v_winner_clan_name, 
      v_winner_damage, 
      v_winner_first_strike
    FROM public.rpg_boss_battle_logs
    WHERE boss_id = v_boss.id AND round_id = v_round_id
    GROUP BY attacker_clan_id, attacker_clan_name
    ORDER BY clan_damage DESC, first_strike ASC
    LIMIT 1;

    -- Hitung Hadiah Koin: 10.000 x Level Boss (minimal level 1)
    v_boss_level := GREATEST(1, COALESCE(v_boss.level, 1));
    v_reward_coins := v_boss_level * 10000;

    -- Tambah koin ke saldo kas klan pemenang (Hanya klan pemenang yang dapat hadiah)
    UPDATE public.rpg_clans 
    SET coins = coins + v_reward_coins,
        updated_at = NOW()
    WHERE id = v_winner_clan_id;

    SELECT coins INTO v_winner_balance_after FROM public.rpg_clans WHERE id = v_winner_clan_id;

    -- Catat transaksi mutasi kas klan pemenang
    INSERT INTO public.rpg_clan_coin_transactions (
      clan_id, amount, balance_after, transaction_type, description, actor_user_id, actor_name
    ) VALUES (
      v_winner_clan_id,
      v_reward_coins,
      COALESCE(v_winner_balance_after, v_reward_coins),
      'BOSS_REWARD',
      'Juara 1 Ronde ' || v_round_id || ' Bos ' || v_boss.name || ' (Damage Tertinggi: ' || v_winner_damage || ' DMG)',
      p_user_id,
      p_user_name
    );

    -- Simpan riwayat penaklukan ronde ke rpg_boss_round_history (idempotent / unique)
    INSERT INTO public.rpg_boss_round_history (
      boss_id, city_id, round_number, boss_name, boss_level,
      winner_clan_id, winner_clan_name, winner_damage,
      total_raid_damage, reward_coins, last_striker_clan_id, last_striker_clan_name
    ) VALUES (
      v_boss.id, v_boss.city_id, v_round_id, v_boss.name, v_boss_level,
      v_winner_clan_id, v_winner_clan_name, v_winner_damage,
      v_boss.max_hp, v_reward_coins, p_clan_id, v_clan.name
    ) ON CONFLICT (boss_id, round_number) DO NOTHING;

    -- Reset HP Bos ke Maksimum untuk Ronde Baru (current_round bertambah)
    UPDATE public.rpg_city_bosses
    SET current_hp = max_hp,
        status = 'ACTIVE',
        current_round = current_round + 1,
        defeated_count = COALESCE(defeated_count, 0) + 1,
        last_attacked_at = NOW(),
        updated_at = NOW()
    WHERE id = v_boss.id;

  ELSE
    -- Update sisa HP Bos
    UPDATE public.rpg_city_bosses
    SET current_hp = v_boss_hp_after,
        status = CASE WHEN v_boss_hp_after <= (v_boss.max_hp * 0.3) THEN 'ENRAGED' ELSE 'ACTIVE' END,
        last_attacked_at = NOW(),
        updated_at = NOW()
    WHERE id = v_boss.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Serangan ke ' || v_boss.name || ' berhasil! Total damage: -' || v_effective_damage || ' HP.',
    'boss_id', v_boss.id,
    'boss_name', v_boss.name,
    'round_id', v_round_id,
    'base_damage', v_base_damage,
    'weapon_damage', v_weapon_damage,
    'total_damage', v_effective_damage,
    'weapon_consumed', v_weapon_name,
    'boss_hp_before', v_boss_hp_before,
    'boss_hp_after', v_boss_hp_after,
    'boss_defeated', v_boss_defeated,
    'winner_clan_id', v_winner_clan_id,
    'winner_clan_name', v_winner_clan_name,
    'winner_damage', v_winner_damage,
    'reward_coins', v_reward_coins,
    'cooldown_seconds', 3600,
    'next_attack_at', (NOW() + INTERVAL '60 minutes')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC FUNCTION: GET BOSS RAID LEADERBOARD & COOLDOWN STATUS
CREATE OR REPLACE FUNCTION public.rpc_get_boss_raid_leaderboard(
  p_boss_id TEXT,
  p_clan_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_boss RECORD;
  v_leaderboard JSONB := '[]'::jsonb;
  v_round_history JSONB := '[]'::jsonb;
  v_clan_cooldown RECORD;
  v_clan_total_damage BIGINT := 0;
  v_round_id INT;
BEGIN
  SELECT * INTO v_boss FROM public.rpg_city_bosses 
  WHERE id = p_boss_id OR city_id = p_boss_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Bos tidak ditemukan.');
  END IF;

  v_round_id := COALESCE(v_boss.current_round, 1);

  -- Leaderboard damage klan dalam ronde ini
  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_leaderboard
  FROM (
    SELECT 
      attacker_clan_id AS clan_id,
      attacker_clan_name AS clan_name,
      SUM(total_damage) AS total_damage,
      COUNT(id) AS total_attacks,
      MIN(created_at) AS first_strike_at,
      MAX(created_at) AS last_strike_at
    FROM public.rpg_boss_battle_logs
    WHERE boss_id = v_boss.id AND round_id = v_round_id
    GROUP BY attacker_clan_id, attacker_clan_name
    ORDER BY total_damage DESC, first_strike_at ASC
  ) sub;

  -- Riwayat ronde sebelumnya
  SELECT COALESCE(jsonb_agg(h), '[]'::jsonb) INTO v_round_history
  FROM (
    SELECT *
    FROM public.rpg_boss_round_history
    WHERE boss_id = v_boss.id
    ORDER BY round_number DESC
    LIMIT 10
  ) h;

  -- Status Cooldown klan penyerang (Cek global agar tidak bisa bypass dengan ganti kota)
  IF p_clan_id IS NOT NULL THEN
    SELECT * INTO v_clan_cooldown
    FROM public.rpg_clan_boss_cooldowns
    WHERE clan_id = p_clan_id
    ORDER BY next_attack_at DESC
    LIMIT 1;

    SELECT COALESCE(SUM(total_damage), 0) INTO v_clan_total_damage
    FROM public.rpg_boss_battle_logs
    WHERE boss_id = v_boss.id AND round_id = v_round_id AND attacker_clan_id = p_clan_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'boss_id', v_boss.id,
    'boss_name', v_boss.name,
    'boss_level', GREATEST(1, COALESCE(v_boss.level, 1)),
    'current_round', v_round_id,
    'current_hp', v_boss.current_hp,
    'max_hp', v_boss.max_hp,
    'status', v_boss.status,
    'leaderboard', v_leaderboard,
    'round_history', v_round_history,
    'clan_total_damage', v_clan_total_damage,
    'cooldown', CASE 
      WHEN v_clan_cooldown.next_attack_at IS NOT NULL AND v_clan_cooldown.next_attack_at > NOW() THEN
        jsonb_build_object(
          'is_on_cooldown', true,
          'cooldown_seconds', GREATEST(0, EXTRACT(EPOCH FROM (v_clan_cooldown.next_attack_at - NOW()))::INT),
          'next_attack_at', v_clan_cooldown.next_attack_at
        )
      ELSE
        jsonb_build_object(
          'is_on_cooldown', false,
          'cooldown_seconds', 0,
          'next_attack_at', NULL
        )
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. GRANT AKSES KE PERAN PUBLIC & AUTHENTICATED
GRANT EXECUTE ON FUNCTION public.rpc_buy_clan_weapon(TEXT, TEXT, TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_attack_enemy_city_boss(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_boss_raid_leaderboard(TEXT, TEXT) TO anon, authenticated, service_role;
