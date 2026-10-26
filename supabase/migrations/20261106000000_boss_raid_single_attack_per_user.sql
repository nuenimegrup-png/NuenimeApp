-- ==============================================================================
-- MIGRATION: 20261106000000_boss_raid_single_attack_per_user.sql
-- DESKRIPSI: Perubahan logika penyerangan bos kota musuh:
-- 1. Satu user HANYA bisa menyerang bos sebanyak 1x per siklus bos.
-- 2. Seluruh anggota aktif klan dapat melancarkan serangan (bukan hanya ketua).
-- ==============================================================================

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
  v_already_attacked BOOLEAN := FALSE;
BEGIN
  -- 1. Validasi Klan
  SELECT * INTO v_clan FROM public.rpg_clans WHERE id = p_clan_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan Anda tidak ditemukan.');
  END IF;

  -- 2. Validasi Keanggotaan Klan Aktif (Ketua atau Anggota Aktif dapat berpartisipasi)
  SELECT role INTO v_user_role FROM public.rpg_clan_members 
  WHERE clan_id = p_clan_id AND user_id = p_user_id AND status = 'active';

  IF v_clan.leader_id != p_user_id AND v_user_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Aksi ditolak: Anda harus menjadi anggota aktif klan untuk menyerang Bos Kota Musuh.');
  END IF;

  -- 3. Validasi Bos Target dengan Kunci Baris (Pencegahan Race Condition)
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

  -- 6. ATURAN BARU: Satu User Hanya Bisa Menyerang Bos 1x per Siklus Bos
  SELECT EXISTS (
    SELECT 1 FROM public.rpg_boss_battle_logs
    WHERE boss_id = v_boss.id
      AND attacker_user_id = p_user_id
      AND created_at >= COALESCE(
        (SELECT MAX(created_at) FROM public.rpg_boss_battle_logs WHERE boss_id = v_boss.id AND boss_defeated = TRUE),
        v_boss.created_at,
        '2000-01-01'::timestamptz
      )
  ) INTO v_already_attacked;

  IF v_already_attacked THEN
    RETURN jsonb_build_object(
      'ok', false, 
      'message', 'Anda sudah pernah menyerang Bos ' || v_boss.name || '! Setiap petualang hanya memiliki kesempatan menyerang 1x per putaran bos.'
    );
  END IF;

  -- 7. Ambil Level Kota Asal Penyerang untuk Base Damage
  SELECT * INTO v_origin_city FROM public.rpg_cities WHERE id = v_clan.city_id;
  v_base_damage := 100 + (GREATEST(1, COALESCE(v_origin_city.level, 1)) - 1) * 25;

  -- 8. Validasi & Konsumsi Senjata Sekali Pakai (Jika dipilih)
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

  -- 9. Hitung Total Damage
  v_total_damage := v_base_damage + v_weapon_damage;
  v_boss_hp_before := v_boss.current_hp;
  v_boss_hp_after := GREATEST(0, v_boss_hp_before - v_total_damage);

  -- 10. Periksa apakah Bos Kalah
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

  -- 11. Catat Riwayat Serangan (Audit Trail)
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
