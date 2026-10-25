-- ==============================================================================
-- NUENIME DUNIA RPG - DATABASE MIGRATION SCRIPT (100% PURE DATABASE)
-- ==============================================================================
-- Seluruh data Kota, Bos, Klan, dan Anggota murni disimpan dan diambil dari
-- Database Supabase tanpa bergantung pada data default atau data dummy lokal.
-- Kota dimulai dari EXP 0, Level 1, HP 10.000, dan seluruh Bos dimulai dari Level 0.
-- ==============================================================================

-- 0. BERSIHKAN / RESET TABEL RPG LAMA (MEMASTIKAN SKEMA 100% BARU TANPA KONFLIK KOLOM)
DROP TABLE IF EXISTS public.rpg_exp_transactions CASCADE;
DROP TABLE IF EXISTS public.rpg_user_profiles CASCADE;
DROP TABLE IF EXISTS public.rpg_clan_members CASCADE;
DROP TABLE IF EXISTS public.rpg_clans CASCADE;
DROP TABLE IF EXISTS public.rpg_city_bosses CASCADE;
DROP TABLE IF EXISTS public.rpg_cities CASCADE;

-- 1. TABEL: RPG CITIES (7 Kota Dunia Nuenime)
CREATE TABLE public.rpg_cities (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  epithet TEXT,
  description TEXT NOT NULL,
  full_lore TEXT,
  element VARCHAR(64) DEFAULT 'Aether',
  region VARCHAR(64) DEFAULT 'Nuenime Realm',
  world_x_percent NUMERIC DEFAULT 50 NOT NULL,
  world_y_percent NUMERIC DEFAULT 50 NOT NULL,
  focus_y_percent NUMERIC DEFAULT 50 NOT NULL,
  material VARCHAR(64) DEFAULT 'silver-ice',
  accent_hex VARCHAR(32) DEFAULT '#38BDF8',
  secondary_hex VARCHAR(32) DEFAULT '#E0F2FE',
  thumbnail_asset TEXT,
  emblem_asset TEXT,
  districts JSONB DEFAULT '[]'::jsonb,
  level INTEGER DEFAULT 1 NOT NULL,
  tier INTEGER DEFAULT 1 NOT NULL,
  tier_name VARCHAR(64) DEFAULT 'Perunggu I',
  total_exp BIGINT DEFAULT 0 NOT NULL,
  current_hp INTEGER DEFAULT 10000 NOT NULL,
  max_hp INTEGER DEFAULT 10000 NOT NULL,
  status VARCHAR(64) DEFAULT 'Damai',
  weather VARCHAR(64) DEFAULT 'Cerah Cerah Berangin',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. TABEL: RPG CITY BOSSES (7 Bos Penjaga Kota)
CREATE TABLE IF NOT EXISTS public.rpg_city_bosses (
  id VARCHAR(64) PRIMARY KEY,
  city_id VARCHAR(64) NOT NULL REFERENCES public.rpg_cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  species_type TEXT DEFAULT 'Entitas Kosmik',
  element TEXT DEFAULT 'Elemental',
  description TEXT,
  characteristic TEXT,
  avatar_url TEXT,
  level INTEGER DEFAULT 0 NOT NULL,
  current_hp BIGINT DEFAULT 10000 NOT NULL,
  max_hp BIGINT DEFAULT 10000 NOT NULL,
  status VARCHAR(64) DEFAULT 'ACTIVE' NOT NULL,
  weakness TEXT DEFAULT 'Sihir Elemental',
  defense_break NUMERIC DEFAULT 0 NOT NULL,
  accent_color VARCHAR(32) DEFAULT '#38BDF8',
  secondary_color VARCHAR(32) DEFAULT '#E0F2FE',
  world_x_percent NUMERIC DEFAULT 50 NOT NULL,
  world_y_percent NUMERIC DEFAULT 50 NOT NULL,
  last_attacked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_rpg_city_boss UNIQUE (city_id)
);

-- 3. TABEL: RPG CLANS (Klan Petualang Nuenime)
CREATE TABLE IF NOT EXISTS public.rpg_clans (
  id VARCHAR(64) PRIMARY KEY,
  city_id VARCHAR(64) NOT NULL REFERENCES public.rpg_cities(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL UNIQUE,
  tag VARCHAR(16) NOT NULL UNIQUE,
  slogan TEXT DEFAULT 'Bersatu dalam kejayaan Nuenime',
  description TEXT DEFAULT 'Klan petualang aktif di Dunia Nuenime.',
  logo_url TEXT,
  leader_id TEXT NOT NULL,
  leader_name TEXT NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  total_exp BIGINT DEFAULT 0 NOT NULL,
  member_count INTEGER DEFAULT 1 NOT NULL,
  max_members INTEGER DEFAULT 100 NOT NULL,
  verified BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. TABEL: RPG CLAN MEMBERS (Anggota & Jabatan Klan)
CREATE TABLE IF NOT EXISTS public.rpg_clan_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id VARCHAR(64) NOT NULL REFERENCES public.rpg_clans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  border_url TEXT,
  role VARCHAR(64) DEFAULT 'Anggota' NOT NULL,
  level INTEGER DEFAULT 1 NOT NULL,
  contribution_score BIGINT DEFAULT 0 NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_active_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT uq_clan_member UNIQUE (clan_id, user_id)
);

-- 5. TABEL: RPG USER PROFILES (Karakter Pengguna)
CREATE TABLE IF NOT EXISTS public.rpg_user_profiles (
  user_id TEXT PRIMARY KEY,
  current_city_id VARCHAR(64) REFERENCES public.rpg_cities(id) DEFAULT 'aetheria',
  clan_id VARCHAR(64) REFERENCES public.rpg_clans(id) ON DELETE SET NULL,
  character_title TEXT DEFAULT 'Petualang Nuenime',
  total_exp BIGINT DEFAULT 0 NOT NULL,
  energy INTEGER DEFAULT 100 NOT NULL,
  max_energy INTEGER DEFAULT 100 NOT NULL,
  reputation BIGINT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. TABEL: RPG EXP TRANSACTIONS (Buku Besar EXP)
CREATE TABLE IF NOT EXISTS public.rpg_exp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  clan_id VARCHAR(64) REFERENCES public.rpg_clans(id) ON DELETE CASCADE,
  city_id VARCHAR(64) REFERENCES public.rpg_cities(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  source_type VARCHAR(64) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- INDEKS PERFORMA
CREATE INDEX IF NOT EXISTS idx_rpg_clans_city_id ON public.rpg_clans(city_id);
CREATE INDEX IF NOT EXISTS idx_rpg_clans_total_exp ON public.rpg_clans(total_exp DESC);
CREATE INDEX IF NOT EXISTS idx_rpg_clan_members_clan_id ON public.rpg_clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_rpg_clan_members_user_id ON public.rpg_clan_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rpg_exp_tx_clan_id ON public.rpg_exp_transactions(clan_id);
CREATE INDEX IF NOT EXISTS idx_rpg_exp_tx_city_id ON public.rpg_exp_transactions(city_id);

-- TRIGGER REKONSILIASI EXP OTOMATIS
CREATE OR REPLACE FUNCTION public.fn_sync_clan_stats_from_members()
RETURNS TRIGGER AS $$
DECLARE
  target_clan_id VARCHAR(64);
  calc_total_exp BIGINT;
  calc_member_count INT;
  calc_level INT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_clan_id := OLD.clan_id;
  ELSE
    target_clan_id := NEW.clan_id;
  END IF;

  SELECT COALESCE(SUM(contribution_score), 0), COUNT(*)
  INTO calc_total_exp, calc_member_count
  FROM public.rpg_clan_members
  WHERE clan_id = target_clan_id;

  calc_level := GREATEST(1, FLOOR(calc_total_exp / 1500) + 1);

  UPDATE public.rpg_clans
  SET total_exp = calc_total_exp,
      member_count = calc_member_count,
      level = calc_level,
      updated_at = NOW()
  WHERE id = target_clan_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_clan_stats ON public.rpg_clan_members;
CREATE TRIGGER trg_sync_clan_stats
AFTER INSERT OR UPDATE OR DELETE ON public.rpg_clan_members
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_clan_stats_from_members();

CREATE OR REPLACE FUNCTION public.fn_sync_city_stats_from_clans()
RETURNS TRIGGER AS $$
DECLARE
  target_city_id VARCHAR(64);
  calc_city_exp BIGINT;
  calc_city_level INT;
  calc_city_tier INT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_city_id := OLD.city_id;
  ELSE
    target_city_id := NEW.city_id;
  END IF;

  SELECT COALESCE(SUM(total_exp), 0)
  INTO calc_city_exp
  FROM public.rpg_clans
  WHERE city_id = target_city_id;

  calc_city_level := GREATEST(1, FLOOR(calc_city_exp / 5000) + 1);
  calc_city_tier := LEAST(5, GREATEST(1, FLOOR(calc_city_level / 5) + 1));

  UPDATE public.rpg_cities
  SET total_exp = calc_city_exp,
      level = calc_city_level,
      tier = calc_city_tier,
      updated_at = NOW()
  WHERE id = target_city_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_city_stats ON public.rpg_clans;
CREATE TRIGGER trg_sync_city_stats
AFTER INSERT OR UPDATE OR DELETE ON public.rpg_clans
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_city_stats_from_clans();

-- RLS
ALTER TABLE public.rpg_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_city_bosses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_exp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view rpg_cities" ON public.rpg_cities;
CREATE POLICY "Public can view rpg_cities" ON public.rpg_cities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_city_bosses" ON public.rpg_city_bosses;
CREATE POLICY "Public can view rpg_city_bosses" ON public.rpg_city_bosses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_clans" ON public.rpg_clans;
CREATE POLICY "Public can view rpg_clans" ON public.rpg_clans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_clan_members" ON public.rpg_clan_members;
CREATE POLICY "Public can view rpg_clan_members" ON public.rpg_clan_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_user_profiles" ON public.rpg_user_profiles;
CREATE POLICY "Public can view rpg_user_profiles" ON public.rpg_user_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view rpg_exp_transactions" ON public.rpg_exp_transactions;
CREATE POLICY "Public can view rpg_exp_transactions" ON public.rpg_exp_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert rpg_clans" ON public.rpg_clans;
CREATE POLICY "Users can insert rpg_clans" ON public.rpg_clans FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Leaders can update rpg_clans" ON public.rpg_clans;
CREATE POLICY "Leaders can update rpg_clans" ON public.rpg_clans FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can manage rpg_clan_members" ON public.rpg_clan_members;
CREATE POLICY "Users can manage rpg_clan_members" ON public.rpg_clan_members FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can manage rpg_user_profiles" ON public.rpg_user_profiles;
CREATE POLICY "Users can manage rpg_user_profiles" ON public.rpg_user_profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can insert rpg_exp_transactions" ON public.rpg_exp_transactions;
CREATE POLICY "Users can insert rpg_exp_transactions" ON public.rpg_exp_transactions FOR INSERT WITH CHECK (true);

-- ==============================================================================
-- INITIAL SEED: 7 KOTA CANON NUENIME DENGAN DATA GEOGRAFIS (EXP 0)
-- ==============================================================================
INSERT INTO public.rpg_cities (
  id, name, title, epithet, description, full_lore, element, region,
  world_x_percent, world_y_percent, focus_y_percent, material,
  accent_hex, secondary_hex, thumbnail_asset, emblem_asset, districts,
  level, tier, tier_name, total_exp, current_hp, max_hp, status, weather
) VALUES
(
  'aetheria', 'Aetheria', 'Kota Terapung Langit Biru', 'Benteng Suci Puncak Salju Abadi',
  'Kota suci yang dijaga oleh cahaya dan harapan. Pusat kekuatan para ksatria dan pelindung dunia.',
  'Didirikan di atas puncak tertinggi Pegunungan Celestia yang tak pernah mencair, Aetheria adalah mercusuar pertama yang menyala.',
  'Cahaya & Es Suci', 'Pegunungan Utara Celestia',
  20.5, 22.8, 18.0, 'silver-ice', '#38BDF8', '#E0F2FE',
  '/assets/nuenime/city_aetheria.png', '/assets/nuenime/emblem_aetheria.svg',
  '[{"id":"aeth-1","name":"Katedral Aurora","category":"Pusat Pemerintahan","description":"Aula suci tempat para pemimpin klan Aetheria bersumpah menjaga perdamaian benua.","xPercent":48,"yPercent":30},{"id":"aeth-2","name":"Benteng Perisai Perak","category":"Distrik Pertahanan","description":"Garrison utama tempat ksatria pelindung berlatih formasi tombak cahaya.","xPercent":24,"yPercent":54},{"id":"aeth-3","name":"Menara Observatorium Es","category":"Distrik Akademi","description":"Menara pengamat arus mana langit dan pergerakan badai di lautan utara.","xPercent":72,"yPercent":48}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Cerah Berangin'
),
(
  'lunaris', 'Lunaris', 'Lembah Malam Abadi', 'Sanctuary Pulau Pasang Rembulan',
  'Kota kepulauan suci yang dikelilingi cincin pusaran air bercahaya dan menara perak pengatur pasang samudra.',
  'Lunaris berdiri di atas pulau karang putih yang dikelilingi oleh cincin air sihir yang berputar mengikuti fase bulan.',
  'Air Rembulan & Ilusi Pasang', 'Kepulauan Samudra Timur Laut',
  54.5, 34.5, 30.5, 'lunar-cyan', '#22D3EE', '#CFFAFE',
  '/assets/nuenime/city_lunaris.png', '/assets/nuenime/emblem_lunaris.svg',
  '[{"id":"lun-1","name":"Kuil Cermin Rembulan","category":"Pusat Spiritual","description":"Kolam suci di puncak pulau yang memantulkan konstelasi bintang bahkan di siang hari.","xPercent":48,"yPercent":35},{"id":"lun-2","name":"Dermaga Cincin Turquoise","category":"Pelabuhan Armada","description":"Pangkalan kapal cepat klan-klan penjaga samudra Nuenime.","xPercent":65,"yPercent":62},{"id":"lun-3","name":"Menara Suar Karang Barat","category":"Pos Pertahanan Laut","description":"Menara kristal cyan yang memandu kapal melintasi terumbu karang di malam berkabut.","xPercent":24,"yPercent":52}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Malam Berbintang'
),
(
  'velmora', 'Velmora', 'Benteng Karang Pasang Surut', 'Suaka Hutan Zamrud Abadi',
  'Kota hutan zamrud tempat arsitektur kuno menyatu dengan pohon-pohon raksasa dan pusaran mana kehidupan.',
  'Tersembunyi di jantung Rimba Sylvanis, Velmora dibangun tanpa menebang satu pun pohon purba.',
  'Alam, Angin & Kehidupan', 'Rimba Barat Sylvanis',
  16.0, 41.2, 37.0, 'emerald-bronze', '#34D399', '#D1FAE5',
  '/assets/nuenime/city_velmora.png', '/assets/nuenime/emblem_velmora.svg',
  '[{"id":"vel-1","name":"Inti Pohon Sylvan","category":"Suaka Alam","description":"Jantung kota Velmora tempat mata air mana zamrud mengalir ke seluruh benua barat.","xPercent":45,"yPercent":45},{"id":"vel-2","name":"Anjungan Pemanah Angin","category":"Distrik Penjaga","description":"Pos pengawas di puncak kanopi pohon raksasa yang memantau batas barat Nuenime.","xPercent":64,"yPercent":34},{"id":"vel-3","name":"Gerbang Lembah Rusa Perak","category":"Pos Perbatasan Rimba","description":"Jembatan akar kuno yang menjaga jalur masuk selatan menuju hutan dalam Velmora.","xPercent":26,"yPercent":65}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Angin Laut Sejuk'
),
(
  'eldoria', 'Eldoria', 'Hutan Purba Roh Alam', 'Ibu Kota Kekaisaran Mahkota Emas',
  'Pusat peradaban Dunia Nuenime yang megah dengan menara istana emas dan cincin sihir pelindung kedaulatan.',
  'Berdiri tepat di jantung benua Nuenime, Eldoria adalah titik temu seluruh jalur perdagangan dan diplomasi.',
  'Cahaya Kekaisaran & Tata Ruang', 'Dataran Tengah Heartlands',
  46.5, 52.8, 48.0, 'imperial-gold', '#FBBF24', '#FEF3C7',
  '/assets/nuenime/city_eldoria.png', '/assets/nuenime/emblem_eldoria.svg',
  '[{"id":"eld-1","name":"Istana Mahkota Surya","category":"Pusat Kekaisaran","description":"Menara tertinggi di Eldoria tempat Piagam Klan Dunia Nuenime disimpan.","xPercent":48,"yPercent":30},{"id":"eld-2","name":"Plaza Pertemuan Agung","category":"Distrik Diplomasi","description":"Alun-alun marmer emas tempat utusan dari ketujuh kota berkumpul.","xPercent":48,"yPercent":64},{"id":"eld-3","name":"Benteng Sungai Kembar","category":"Gerbang Perdagangan","description":"Pelabuhan sungai dan gerbang utama yang menghubungkan jalur darat dari utara ke selatan.","xPercent":22,"yPercent":50},{"id":"eld-4","name":"Menara Garnisun Sovereign","category":"Markas Militer Timur","description":"Kompleks pelatihan ksatria kekaisaran dan gudang persenjataan emas Eldoria.","xPercent":68,"yPercent":46}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Embun Pagi Sejuk'
),
(
  'drakonia', 'Drakonia', 'Puncak Lahar Naga Api', 'Benteng Obsidian Kawah Petir',
  'Kota benteng vulkanik dari batu obsidian hitam yang ditempa oleh api naga purba dan badai petir ungu.',
  'Dibangun di atas kaldera gunung berapi aktif yang menghadap ke Pusaran Badai Ungu di pantai timur.',
  'Magma Merah & Petir Abyssal', 'Tebing Vulkanik Timur',
  75.5, 45.8, 42.0, 'crimson-obsidian', '#F87171', '#FECACA',
  '/assets/nuenime/city_drakonia.png', '/assets/nuenime/emblem_drakonia.svg',
  '[{"id":"drk-1","name":"Tungku Jantung Naga","category":"Pusat Penempaan","description":"Kawah magma tempat senjata obsidian dan baja naga ditempa oleh para master.","xPercent":46,"yPercent":35},{"id":"drk-2","name":"Menara Penangkap Petir","category":"Benteng Pesisir","description":"Menara besi hitam yang menyerap sambaran petir ungu dari pusaran laut timur.","xPercent":66,"yPercent":54},{"id":"drk-3","name":"Benteng Kaldera Barat","category":"Gerbang Obsidian","description":"Dinding pertahanan berlapis baja hitam yang menjaga jembatan lava menuju Drakonia.","xPercent":24,"yPercent":60}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Hawa Panas Vulkanik'
),
(
  'nivara', 'Nivara', 'Gurun Emas Badai Pasir', 'Permata Oasis Gurun Surya',
  'Kota istana batu pasir keemasan yang berdiri megah di tepi oasis suci dan teluk pirus selatan.',
  'Nivara tumbuh dari peradaban matahari kuno di Semenanjung Gurun Barat Daya.',
  'Pasir Emas & Api Matahari', 'Semenanjung Gurun Barat Daya',
  24.5, 68.2, 64.0, 'sun-amber', '#F59E0B', '#FDE68A',
  '/assets/nuenime/city_nivara.png', '/assets/nuenime/emblem_nivara.svg',
  '[{"id":"niv-1","name":"Ziggurat Obelisk Surya","category":"Kuil Agung","description":"Bangunan puncak emas yang mengumpulkan energi matahari untuk menyinari Nivara di malam hari.","xPercent":48,"yPercent":33},{"id":"niv-2","name":"Bazar Kafilah Emas","category":"Pusat Niaga","description":"Pasar rempah, permata mana, dan relik gurun terbesar di belahan selatan Nuenime.","xPercent":24,"yPercent":56},{"id":"niv-3","name":"Pelabuhan Teluk Pirus","category":"Dermaga Oasis Selatan","description":"Dermaga marmer keemasan tempat kapal dagang selatan berlabuh di tepi gurun.","xPercent":64,"yPercent":62}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Terik Badai Pasir'
),
(
  'astralis', 'Astralis', 'Piramida Bintang Galaksi', 'Sanctuary Kristal Bintang Selatan',
  'Kota menara kristal ungu yang berpendar oleh energi bintang jatuh dan aliran sihir dimensi di laut selatan.',
  'Astralis terbentuk di sekitar kawah meteorit kristal raksasa yang jatuh ke perairan tenggara Nuenime.',
  'Kosmik, Kristal & Gravitasi Astral', 'Kepulauan Arcane Tenggara',
  60.5, 76.5, 72.0, 'astral-violet', '#C084FC', '#F3E8FF',
  '/assets/nuenime/city_astralis.png', '/assets/nuenime/emblem_astralis.svg',
  '[{"id":"ast-1","name":"Menara Nexus Kosmik","category":"Pusat Sihir Agung","description":"Puncak kristal utama tempat aliran energi astral difokuskan untuk menjaga keseimbangan dimensi.","xPercent":48,"yPercent":32},{"id":"ast-2","name":"Akademi Prisma Ungu","category":"Distrik Riset","description":"Kompleks perpustakaan melayang tempat para penyihir mempelajari mantra bintang kuno.","xPercent":22,"yPercent":54},{"id":"ast-3","name":"Pelabuhan Bintang Jatuh","category":"Dermaga Selatan","description":"Titik berlabuh kapal-kapal sihir yang melintasi terumbu pirus selatan.","xPercent":64,"yPercent":63}]'::jsonb,
  1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Hujan Meteor Ringan'
)
ON CONFLICT (id) DO UPDATE SET
  total_exp = 0,
  level = 1,
  tier = 1,
  current_hp = 10000,
  max_hp = 10000,
  updated_at = NOW();

-- ==============================================================================
-- INITIAL SEED: 7 BOS KOTA CANON NUENIME (LEVEL 0, HP 10.000)
-- ==============================================================================
INSERT INTO public.rpg_city_bosses (
  id, city_id, name, title, species_type, element, description, characteristic,
  level, current_hp, max_hp, status, weakness, accent_color, secondary_color,
  world_x_percent, world_y_percent
) VALUES
(
  'boss-aetheria', 'aetheria', 'Guardian Seraph', 'Penjaga Sayap Cahaya Celestia',
  'Entitas Konstruk Langit', 'Cahaya Murni & Kristal Es',
  'Monster penjaga bersayap enam yang melayang di atas puncak glasial Aetheria.',
  'Memancarkan halo cahaya suci dan badai kristal beku.',
  0, 10000, 10000, 'ACTIVE', 'Petir & Api', '#38BDF8', '#E0F2FE', 12.5, 15.8
),
(
  'boss-lunaris', 'lunaris', 'Moonfang', 'Serigala Pasang Purnama',
  'Beast Astral Samudra', 'Air Pasang & Ilusi Rembulan',
  'Monster serigala raksasa berbulu perak-cyan yang berlari di atas permukaan laut.',
  'Muncul bersama kabut purnama dan menciptakan pusaran air bercahaya.',
  0, 10000, 10000, 'ACTIVE', 'Cahaya Suci', '#22D3EE', '#CFFAFE', 69.5, 27.5
),
(
  'boss-velmora', 'velmora', 'Verdant Colossus', 'Raksasa Akar Rimba Abadi',
  'Behemoth Flora Purba', 'Alam, Akar & Angin Zamrud',
  'Monster penjaga hutan raksasa yang terbentuk dari jalinan akar pohon purba.',
  'Kulit kayunya sekeras baja dan memanggil spora pelindung.',
  0, 10000, 10000, 'ACTIVE', 'Listrik Petir', '#34D399', '#D1FAE5', 9.5, 34.5
),
(
  'boss-eldoria', 'eldoria', 'Aureon', 'Singa Agung Mahkota Surya',
  'Chimera Kekaisaran Emas', 'Cahaya Emas & Perisai Sovereign',
  'Monster bertema emas dan cahaya berbentuk singa bersayap mahkota surya.',
  'Raungannya menggetarkan cincin leyline benua.',
  0, 10000, 10000, 'ACTIVE', 'Api Lahar', '#FBBF24', '#FEF3C7', 38.0, 46.5
),
(
  'boss-drakonia', 'drakonia', 'Infernal Wyrm', 'Naga Magma Kaldera Hitam',
  'Naga Vulkanik Purba', 'Api Magma & Lava Obsidian',
  'Naga raksasa bertema api dan lava yang bersarang di kawah vulkanik timur Drakonia.',
  'Sayapnya menyebarkan bara api vulkanik.',
  0, 10000, 10000, 'ACTIVE', 'Es & Air Murni', '#F87171', '#FECACA', 88.5, 38.5
),
(
  'boss-nivara', 'nivara', 'Frostmaw', 'Behemoth Es & Kuarsa Malam Gurun',
  'Leviathan Anomali Termal', 'Es Absolut & Badai Kuarsa',
  'Monster es purba yang bangkit dari palung bawah tanah dingin di bawah oasis Nivara.',
  'Memiliki rahang kristal es raksasa.',
  0, 10000, 10000, 'ACTIVE', 'Banjir Aether', '#F59E0B', '#FDE68A', 15.5, 61.5
),
(
  'boss-astralis', 'astralis', 'Astral Leviathan', 'Penguasa Dimensi Bintang Jatuh',
  'Entitas Kosmik Abyssal', 'Energi Kosmik & Gravitasi Bintang',
  'Monster naga samudra kosmik yang berenang melintasi anomali gravitasi.',
  'Tubuhnya tersusun dari konstelasi bintang hidup.',
  0, 10000, 10000, 'ACTIVE', 'Kekosongan Hampa', '#C084FC', '#F3E8FF', 76.5, 69.5
)
ON CONFLICT (city_id) DO UPDATE SET
  level = 0,
  current_hp = 10000,
  max_hp = 10000,
  updated_at = NOW();
