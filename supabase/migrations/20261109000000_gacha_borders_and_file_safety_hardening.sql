-- ==============================================================================
-- MIGRASI KEAMANAN: HARDENING GACHA, BORDER AVATAR, DAN PENCEGAHAN FILE BERBAHAYA
-- File: supabase/migrations/20261109000000_gacha_borders_and_file_safety_hardening.sql
--
-- FOKUS KEAMANAN:
-- 1. Menutup izin longgar (allow_all) pada gacha_banners & user_banner_inventory
-- 2. Menutup izin longgar pada avatar_borders_config & user_border_purchases
-- 3. Membuat fungsi atomik 'execute_border_purchase' untuk pembelian border aman
-- 4. Mengunci system_configs & system_gifts agar hanya bisa diubah oleh Admin sah
-- 5. Pencegahan Injeksi File / Script Berbahaya (Anti-Malware / Anti-Infiltrasi)
-- CATATAN: Idempotent - Semua kebijakan didrop terlebih dahulu sebelum dibuat ulang
-- ==============================================================================

-- ==============================================================================
-- 1. PENGUATAN KEAMANAN GACHA
-- ==============================================================================

ALTER TABLE public.gacha_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_banner_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_transactions ENABLE ROW LEVEL SECURITY;

-- Cabut semua variasi policy pada gacha_banners
DROP POLICY IF EXISTS "allow_all_manage_gacha_banners" ON public.gacha_banners;
DROP POLICY IF EXISTS "anyone_can_read_banners" ON public.gacha_banners;
DROP POLICY IF EXISTS "authenticated_manage_banners" ON public.gacha_banners;
DROP POLICY IF EXISTS "only_admin_manage_gacha_banners" ON public.gacha_banners;

-- Semua orang boleh membaca banner aktif
CREATE POLICY "anyone_can_read_banners"
  ON public.gacha_banners
  FOR SELECT
  USING (true);

-- HANYA Admin yang boleh menambah, mengubah, atau menghapus banner
CREATE POLICY "only_admin_manage_gacha_banners"
  ON public.gacha_banners
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin')
    )
  );

-- Kunci user_banner_inventory: Pengguna HANYA boleh membaca inventory miliknya sendiri
DROP POLICY IF EXISTS "allow_all_manage_user_banner_inventory" ON public.user_banner_inventory;
DROP POLICY IF EXISTS "users_select_own_banners" ON public.user_banner_inventory;
DROP POLICY IF EXISTS "users_insert_own_banners" ON public.user_banner_inventory;

CREATE POLICY "users_select_own_banners"
  ON public.user_banner_inventory
  FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id::text);

-- Kunci gacha_transactions
DROP POLICY IF EXISTS "allow_all_manage_gacha_transactions" ON public.gacha_transactions;
DROP POLICY IF EXISTS "users_select_own_gacha_tx" ON public.gacha_transactions;
DROP POLICY IF EXISTS "users_insert_own_gacha_tx" ON public.gacha_transactions;

CREATE POLICY "users_select_own_gacha_tx"
  ON public.gacha_transactions
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid())::text = user_id::text OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin')
    )
  );

CREATE POLICY "users_insert_own_gacha_tx"
  ON public.gacha_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id::text);


-- ==============================================================================
-- 2. PENGUATAN KEAMANAN BORDER AVATAR
-- ==============================================================================

ALTER TABLE public.avatar_borders_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_border_purchases ENABLE ROW LEVEL SECURITY;

-- Cabut semua variasi policy pada avatar_borders_config
DROP POLICY IF EXISTS "allow_all_manage_avatar_borders" ON public.avatar_borders_config;
DROP POLICY IF EXISTS "allow_public_read_avatar_borders" ON public.avatar_borders_config;
DROP POLICY IF EXISTS "allow_auth_manage_avatar_borders" ON public.avatar_borders_config;
DROP POLICY IF EXISTS "only_admin_manage_avatar_borders" ON public.avatar_borders_config;

-- Publik hanya berhak membaca katalog border avatar
CREATE POLICY "allow_public_read_avatar_borders"
  ON public.avatar_borders_config
  FOR SELECT
  USING (true);

-- HANYA Admin yang boleh menambah atau mengedit border avatar
CREATE POLICY "only_admin_manage_avatar_borders"
  ON public.avatar_borders_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin')
    )
  );

-- Kunci user_border_purchases: Pengguna hanya boleh melihat border miliknya
DROP POLICY IF EXISTS "allow_all_manage_user_border_purchases" ON public.user_border_purchases;
DROP POLICY IF EXISTS "users_select_own_border_purchases" ON public.user_border_purchases;
DROP POLICY IF EXISTS "users_select_own_borders" ON public.user_border_purchases;

CREATE POLICY "users_select_own_border_purchases"
  ON public.user_border_purchases
  FOR SELECT
  TO authenticated
  USING ((auth.uid())::text = user_id::text);

-- 3. Fungsi Atomik Aman: Pembelian Border Avatar (Anti-Bypass Saldo)
-- Menjamin saldo divalidasi dan dipotong di sisi server secara atomik
CREATE OR REPLACE FUNCTION public.execute_border_purchase(
  p_user_id TEXT,
  p_border_id TEXT,
  p_border_name TEXT,
  p_rarity TEXT,
  p_cost INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER := 0;
  v_new_balance INTEGER := 0;
  v_is_banned BOOLEAN := FALSE;
BEGIN
  -- 1. Cek status akun
  SELECT is_banned INTO v_is_banned
  FROM public.profiles
  WHERE id::text = p_user_id::text;

  IF COALESCE(v_is_banned, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_BANNED');
  END IF;

  -- 2. Kunci baris saldo pengguna
  SELECT crystal_balance INTO v_current_balance
  FROM public.user_balances
  WHERE user_id::text = p_user_id::text
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  -- 3. Validasi kecukupan saldo
  IF v_current_balance < p_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_CRYSTAL',
      'current_balance', v_current_balance,
      'required_cost', p_cost
    );
  END IF;

  -- 4. Cek jika border sudah pernah dibeli (idempotent)
  IF EXISTS (
    SELECT 1 FROM public.user_border_purchases
    WHERE user_id::text = p_user_id::text AND border_id = p_border_id
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_owned', true,
      'new_balance', v_current_balance
    );
  END IF;

  -- 5. Potong saldo Crystal
  v_new_balance := v_current_balance - p_cost;
  UPDATE public.user_balances
  SET crystal_balance = v_new_balance,
      updated_at = NOW()
  WHERE user_id::text = p_user_id::text;

  -- 6. Masukkan border ke tabel kepemilikan pengguna
  INSERT INTO public.user_border_purchases (
    user_id, border_id, border_name, rarity, price_paid, purchased_at
  ) VALUES (
    p_user_id::uuid, p_border_id, p_border_name, p_rarity, p_cost, NOW()
  )
  ON CONFLICT (user_id, border_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'border_id', p_border_id,
    'new_balance', v_new_balance
  );
END;
$$;


-- ==============================================================================
-- 3. PENGUATAN SYSTEM CONFIGS & SYSTEM GIFTS (ANTI-MANIPULASI SETTING)
-- ==============================================================================

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_manage_system_configs" ON public.system_configs;
DROP POLICY IF EXISTS "all_manage_system_gifts" ON public.system_gifts;
DROP POLICY IF EXISTS "allow_read_system_configs" ON public.system_configs;
DROP POLICY IF EXISTS "only_admin_manage_system_configs" ON public.system_configs;

CREATE POLICY "allow_read_system_configs"
  ON public.system_configs
  FOR SELECT
  USING (true);

CREATE POLICY "only_admin_manage_system_configs"
  ON public.system_configs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin')
    )
  );

-- HANYA Admin yang boleh membuat hadiah sistem/kompensasi (Mencegah free crystal hack)
DROP POLICY IF EXISTS "only_admin_manage_system_gifts" ON public.system_gifts;
CREATE POLICY "only_admin_manage_system_gifts"
  ON public.system_gifts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id::text = (auth.uid())::text AND role IN ('Owner', 'Admin')
    )
  );


-- ==============================================================================
-- 4. PENCEGAHAN FILE BERBAHAYA & INJEKSI URL (ANTI-MALWARE / ANTI-INFILTRASI)
-- Memeriksa avatar_url, banner_url, poster_url, dan link media
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_validate_media_url_security(p_url TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_url IS NULL OR length(trim(p_url)) = 0 THEN
    RETURN TRUE;
  END IF;

  -- 1. Blokir script jahat dan HTML injection di dalam URL
  IF p_url ~* '(?i)<script|javascript:|data:text/html|vbscript:|onload=|onerror=' THEN
    RETURN FALSE;
  END IF;

  -- 2. Blokir ekstensi file executable / kode berbahaya (Penyusup File)
  IF p_url ~* '(?i)\.(php[0-9]?|phtml|exe|sh|bat|cmd|vbs|jar|jsp|asp|aspx|cgi|pl|py|cgi)$' THEN
    RETURN FALSE;
  END IF;

  -- 3. Blokir karakter null byte (\0) yang digunakan hacker untuk bypass ekstensi
  IF p_url ~ E'\\x00' THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger pada profiles untuk mencegah URL berbahaya di avatar_url dan banner_url
CREATE OR REPLACE FUNCTION public.trg_fn_security_check_profile_media()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.fn_validate_media_url_security(NEW.avatar_url) THEN
    RAISE EXCEPTION 'SECURITY_ALERT: avatar_url mengandung ekstensi atau skrip berbahaya.';
  END IF;

  IF NOT public.fn_validate_media_url_security(NEW.banner_url) THEN
    RAISE EXCEPTION 'SECURITY_ALERT: banner_url mengandung ekstensi atau skrip berbahaya.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_media_safety ON public.profiles;
CREATE TRIGGER trg_profiles_media_safety
  BEFORE INSERT OR UPDATE OF avatar_url, banner_url ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_security_check_profile_media();


-- ==============================================================================
-- 5. STORAGE BUCKET RLS (JIKA MENGGUNAKAN SUPABASE STORAGE)
-- Menolak upload file selain gambar (jpg, jpeg, png, webp)
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    -- Pastikan file executable tidak dapat diunggah ke storage
    CREATE OR REPLACE FUNCTION public.trg_fn_security_storage_check()
    RETURNS TRIGGER AS $s$
    BEGIN
      IF NEW.name ~* '(?i)\.(php[0-9]?|phtml|exe|sh|bat|cmd|vbs|jar|jsp|asp|aspx|py|js|html|htm)$' THEN
        RAISE EXCEPTION 'FILE_TYPE_PROHIBITED: Tipe file ini dilarang demi keamanan sistem.';
      END IF;
      RETURN NEW;
    END;
    $s$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_storage_prohibit_executables ON storage.objects;
    CREATE TRIGGER trg_storage_prohibit_executables
      BEFORE INSERT ON storage.objects
      FOR EACH ROW
      EXECUTE FUNCTION public.trg_fn_security_storage_check();
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Abaikan jika tabel storage.objects dikelola internal oleh Supabase Cloud
  NULL;
END $$;
