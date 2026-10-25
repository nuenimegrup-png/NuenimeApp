-- ==============================================================================
-- NUENIME DUNIA RPG - DATABASE MIGRATION SCRIPT
-- ==============================================================================
-- Menyiapkan tabel, indeks, RLS, trigger, dan relasi data permanen untuk
-- Dunia Nuenime RPG (Kota, Klan, Anggota Klan, Bos Kota, Transaksi EXP).
-- Menggantikan sistem data dummy/mock dengan database Supabase PostgreSQL nyata.
-- ==============================================================================

-- 1. TABEL: RPG CITIES (7 Kota Dunia Nuenime)
CREATE TABLE IF NOT EXISTS public.rpg_cities (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  element VARCHAR(64) DEFAULT 'Aether',
  region VARCHAR(64) DEFAULT 'Nuenime Realm',
  level INTEGER DEFAULT 1 NOT NULL,
  tier INTEGER DEFAULT 1 NOT NULL,
  tier_name VARCHAR(64) DEFAULT 'Perunggu I',
  total_exp BIGINT DEFAULT 0 NOT NULL,
  current_hp INTEGER DEFAULT 10000 NOT NULL,
  max_hp INTEGER DEFAULT 10000 NOT NULL,
  status VARCHAR(64) DEFAULT 'Damai',
  weather VARCHAR(64) DEFAULT 'Cerah Cerah Berangin',
  cover_url TEXT,
  emblem_url TEXT,
  bg_gradient TEXT,
  accent_color VARCHAR(32) DEFAULT '#38bdf8',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. TABEL: RPG CITY BOSSES (Bos Unik Setiap Kota)
CREATE TABLE IF NOT EXISTS public.rpg_city_bosses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id VARCHAR(64) NOT NULL REFERENCES public.rpg_cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  avatar_url TEXT,
  level INTEGER DEFAULT 10 NOT NULL,
  current_hp BIGINT DEFAULT 50000 NOT NULL,
  max_hp BIGINT DEFAULT 50000 NOT NULL,
  status VARCHAR(64) DEFAULT 'Waspada' NOT NULL,
  weakness TEXT DEFAULT 'Sihir Elemental',
  defense_break NUMERIC DEFAULT 0 NOT NULL,
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

-- 5. TABEL: RPG USER PROFILES (Karakter & Status Pengguna di Dunia Nuenime)
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

-- 6. TABEL: RPG EXP TRANSACTIONS (Riwayat & Aliran EXP Terpusat)
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

-- ==============================================================================
-- INDEKS PERFORMA
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_rpg_clans_city_id ON public.rpg_clans(city_id);
CREATE INDEX IF NOT EXISTS idx_rpg_clans_total_exp ON public.rpg_clans(total_exp DESC);
CREATE INDEX IF NOT EXISTS idx_rpg_clan_members_clan_id ON public.rpg_clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_rpg_clan_members_user_id ON public.rpg_clan_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rpg_clan_members_role ON public.rpg_clan_members(role);
CREATE INDEX IF NOT EXISTS idx_rpg_exp_tx_clan_id ON public.rpg_exp_transactions(clan_id);
CREATE INDEX IF NOT EXISTS idx_rpg_exp_tx_city_id ON public.rpg_exp_transactions(city_id);

-- ==============================================================================
-- FUNGSI & TRIGGER PERHITUNGAN OTOMATIS
-- ==============================================================================

-- 1. Trigger update total_exp & member_count klan ketika ada perubahan di anggota
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

-- 2. Trigger update total_exp kota ketika ada klan yang berubah total_exp-nya
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

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.rpg_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_city_bosses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_clan_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rpg_exp_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Publik / Semua user dapat membaca data dunia RPG
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

-- Policy: Modifikasi data klan & member (Izinkan user terautentikasi / public anon insert & update)
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
-- INITIAL SEED: 7 KOTA DUNIA NUENIME & BOS KOTA CANON
-- ==============================================================================
INSERT INTO public.rpg_cities (id, name, title, description, element, region, level, tier, tier_name, total_exp, current_hp, max_hp, status, weather, cover_url, emblem_url, accent_color)
VALUES
('aetheria', 'Aetheria', 'Kota Terapung Langit Biru', 'Ibukota peradaban tinggi di atas awan, pusat para penjaga langit dan teknologi aether kuno.', 'Aether / Angin', 'Skyward Reach', 1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Cerah Berangin', '/assets/nuenime/city_aetheria.svg', '/assets/nuenime/emblem_aetheria.svg', '#38bdf8'),
('lunaris', 'Lunaris', 'Lembah Malam Abadi', 'Kota mistis bercahaya rembulan perak yang dinaungi kabut sihir kuno dan bunga bercahaya.', 'Bayangan / Bulan', 'Twilight Hollow', 1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Malam Berbintang', '/assets/nuenime/city_lunaris.svg', '/assets/nuenime/emblem_lunaris.svg', '#a855f7'),
('velmora', 'Velmora', 'Benteng Karang Pasang Surut', 'Kota pelabuhan megah di atas karang laut samudra luas, pusat perdagangan maritim dan armada ksatria bahari.', 'Air / Laut', 'Azure Coast', 1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Angin Laut Sejuk', '/assets/nuenime/city_velmora.svg', '/assets/nuenime/emblem_velmora.svg', '#06b6d4'),
('eldoria', 'Eldoria', 'Hutan Purba Roh Alam', 'Kawasan suci pohon kehidupan raksasa di mana para pemanah dan druid hidup selaras dengan alam liar.', 'Tanah / Alam', 'Verdant Vale', 1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Embun Pagi Sejuk', '/assets/nuenime/city_eldoria.svg', '/assets/nuenime/emblem_eldoria.svg', '#10b981'),
('drakonia', 'Drakonia', 'Puncak Lahar Naga Api', 'Kawah vulkanik tempat penempaan baja terkuat di dunia Nuenime yang dijaga oleh garis keturunan naga purba.', 'Api / Magma', 'Inferno Peaks', 1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Hawa Panas Vulkanik', '/assets/nuenime/city_drakonia.svg', '/assets/nuenime/emblem_drakonia.svg', '#f43f5e'),
('nivara', 'Nivara', 'Gurun Emas Badai Pasir', 'Kota oasis megah di tengah padang pasir tak berujung, menyimpan makam para raja langit dan rahasia kuno.', 'Kristal / Pasir', 'Golden Wastes', 1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Terik Badai Pasir', '/assets/nuenime/city_nivara.svg', '/assets/nuenime/emblem_nivara.svg', '#f59e0b'),
('astralis', 'Astralis', 'Piramida Bintang Galaksi', 'Observatorium langit tertinggi di ujung dunia Nuenime tempat para peramal galaksi menatap masa depan.', 'Kosmik / Astral', 'Celestial Spire', 1, 1, 'Perunggu I', 0, 10000, 10000, 'Damai', 'Hujan Meteor Ringan', '/assets/nuenime/city_astralis.svg', '/assets/nuenime/emblem_astralis.svg', '#6366f1')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  total_exp = 0,
  level = 1,
  tier = 1,
  current_hp = 10000,
  max_hp = 10000,
  updated_at = NOW();

INSERT INTO public.rpg_city_bosses (city_id, name, title, level, current_hp, max_hp, status, weakness)
VALUES
('aetheria', 'Guardian Seraph', 'Penjaga Sayap Cahaya Celestia', 0, 10000, 10000, 'Waspada', 'Petir & Api'),
('lunaris', 'Moonfang', 'Serigala Pasang Purnama', 0, 10000, 10000, 'Waspada', 'Cahaya Suci'),
('velmora', 'Verdant Colossus', 'Raksasa Akar Rimba Abadi', 0, 10000, 10000, 'Waspada', 'Listrik Petir'),
('eldoria', 'Aureon', 'Singa Agung Mahkota Surya', 0, 10000, 10000, 'Waspada', 'Api Lahar'),
('drakonia', 'Infernal Wyrm', 'Naga Magma Kaldera Hitam', 0, 10000, 10000, 'Waspada', 'Es & Air Murni'),
('nivara', 'Frostmaw', 'Behemoth Es & Kuarsa Malam Gurun', 0, 10000, 10000, 'Waspada', 'Banjir Aether'),
('astralis', 'Astral Leviathan', 'Penguasa Dimensi Bintang Jatuh', 0, 10000, 10000, 'Waspada', 'Kekosongan Hampa')
ON CONFLICT (city_id) DO UPDATE SET
  name = EXCLUDED.name,
  title = EXCLUDED.title,
  level = 0,
  current_hp = 10000,
  max_hp = 10000,
  updated_at = NOW();

