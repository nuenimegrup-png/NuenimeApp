-- ==============================================================================
-- NUENIME: SINKRONISASI EXP NYATA DARI APLIKASI (APK) KE DUNIA RPG NUENIME
-- ==============================================================================
-- Menghubungkan sistem perolehan EXP nyata dari aktivitas menonton anime,
-- komentar, rating, dan login harian di aplikasi Nuenime (tabel profiles & user_xp_transactions)
-- langsung ke sistem Klan & Kota Dunia Nuenime (rpg_clan_members, rpg_clans, rpg_cities).
--
-- Alur Nyata 100% Otomatis:
-- User nonton anime di APK -> profiles.exp bertambah -> Trigger otomatis update
-- rpg_clan_members.contribution_score -> Trigger otomatis update rpg_clans.total_exp
-- -> Trigger otomatis update rpg_cities.total_exp & level/tier kota!
-- ==============================================================================

-- 1. TRIGGER: KETIKA EXP/LEVEL DI PROFILES APK BERUBAH -> UPDATE KE DUNIA NUENIME
CREATE OR REPLACE FUNCTION public.fn_sync_profile_exp_to_rpg()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Update skor kontribusi klan pengguna sesuai EXP asli pengguna di APK
  UPDATE public.rpg_clan_members
  SET contribution_score = COALESCE(NEW.exp, 0),
      level = GREATEST(1, COALESCE(NEW.level, 1)),
      last_active_at = NOW()
  WHERE user_id = NEW.id::text;

  -- 2. Update tabel profil RPG jika ada
  UPDATE public.rpg_user_profiles
  SET total_exp = COALESCE(NEW.exp, 0),
      updated_at = NOW()
  WHERE user_id = NEW.id::text;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_exp_to_rpg ON public.profiles;
CREATE TRIGGER trg_sync_profile_exp_to_rpg
AFTER UPDATE OF exp, level ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_profile_exp_to_rpg();


-- 2. TRIGGER: KETIKA USER BERGABUNG/MENDIRIKAN KLAN -> AMBIL EXP NYATA DARI PROFILES
CREATE OR REPLACE FUNCTION public.fn_init_clan_member_exp_from_profile()
RETURNS TRIGGER AS $$
DECLARE
  real_exp BIGINT;
  real_lvl INT;
BEGIN
  -- Ambil nilai EXP dan Level asli dari tabel profiles
  SELECT COALESCE(exp, 0), COALESCE(level, 1)
  INTO real_exp, real_lvl
  FROM public.profiles
  WHERE id::text = NEW.user_id;

  IF FOUND THEN
    NEW.contribution_score := GREATEST(COALESCE(NEW.contribution_score, 0), real_exp);
    NEW.level := GREATEST(COALESCE(NEW.level, 1), real_lvl);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_clan_member_exp ON public.rpg_clan_members;
CREATE TRIGGER trg_init_clan_member_exp
BEFORE INSERT ON public.rpg_clan_members
FOR EACH ROW EXECUTE FUNCTION public.fn_init_clan_member_exp_from_profile();


-- 3. TRIGGER: KETIKA TRANSAKSI EXP DARI APK TERCATAT -> SALIN LOG KE RPG TRANSAKSI
CREATE OR REPLACE FUNCTION public.fn_sync_user_xp_tx_to_rpg()
RETURNS TRIGGER AS $$
DECLARE
  member_record RECORD;
BEGIN
  -- Periksa apakah user terdaftar sebagai anggota klan
  SELECT m.clan_id, c.city_id
  INTO member_record
  FROM public.rpg_clan_members m
  JOIN public.rpg_clans c ON c.id = m.clan_id
  WHERE m.user_id = NEW.user_id::text
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.rpg_exp_transactions (
      user_id,
      clan_id,
      city_id,
      amount,
      source_type,
      description,
      created_at
    ) VALUES (
      NEW.user_id::text,
      member_record.clan_id,
      member_record.city_id,
      COALESCE(NEW.total_xp, NEW.base_xp, 0),
      COALESCE(NEW.activity_type, 'apk_activity'),
      'Aktivitas APK: ' || COALESCE(NEW.activity_type, 'Menonton/Interaksi'),
      COALESCE(NEW.created_at, NOW())
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_user_xp_tx_to_rpg ON public.user_xp_transactions;
CREATE TRIGGER trg_sync_user_xp_tx_to_rpg
AFTER INSERT ON public.user_xp_transactions
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_user_xp_tx_to_rpg();


-- 4. RPC FUNCTION: SINKRONISASI MANUAL EXP AKUN KE KLAN (DAPAT DIPANGGIL FRONTEND)
CREATE OR REPLACE FUNCTION public.rpc_sync_user_real_exp(p_user_id TEXT)
RETURNS JSONB AS $$
DECLARE
  real_exp BIGINT;
  real_lvl INT;
  target_clan_id VARCHAR(64);
  target_city_id VARCHAR(64);
BEGIN
  -- Ambil data EXP asli user
  SELECT COALESCE(exp, 0), COALESCE(level, 1)
  INTO real_exp, real_lvl
  FROM public.profiles
  WHERE id::text = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Profil user tidak ditemukan di database profiles');
  END IF;

  -- Ambil klan user
  SELECT m.clan_id, c.city_id
  INTO target_clan_id, target_city_id
  FROM public.rpg_clan_members m
  JOIN public.rpg_clans c ON c.id = m.clan_id
  WHERE m.user_id = p_user_id
  LIMIT 1;

  IF target_clan_id IS NOT NULL THEN
    -- Update anggota klan
    UPDATE public.rpg_clan_members
    SET contribution_score = real_exp,
        level = real_lvl,
        last_active_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'ok', true,
      'user_id', p_user_id,
      'real_exp', real_exp,
      'real_level', real_lvl,
      'clan_id', target_clan_id,
      'city_id', target_city_id,
      'message', 'EXP akun berhasil disinkronkan ke klan dan kota'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'real_exp', real_exp,
    'real_level', real_lvl,
    'clan_id', null,
    'message', 'User belum bergabung ke klan, EXP profil valid'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. SINKRONISASI AWAL (BACKFILL DATA PROFILES YANG SUDAH ADA KE RPG CLAN MEMBERS)
UPDATE public.rpg_clan_members m
SET contribution_score = p.exp,
    level = GREATEST(1, COALESCE(p.level, 1)),
    last_active_at = NOW()
FROM public.profiles p
WHERE m.user_id = p.id::text;
