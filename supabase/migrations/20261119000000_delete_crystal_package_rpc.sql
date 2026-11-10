-- ==============================================================================
-- Migration: 20261119000000_delete_crystal_package_rpc.sql
-- Fitur: Prosedur RPC & Query untuk Hapus Paket Dylan Crystal dari system_configs
-- ==============================================================================

-- 1. Buat / Perbarui Fungsi RPC: admin_delete_crystal_package
CREATE OR REPLACE FUNCTION public.admin_delete_crystal_package(p_package_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_value JSONB;
  v_new_value JSONB;
  v_found BOOLEAN := false;
  v_remaining_count INT := 0;
BEGIN
  -- Ambil data konfigurasi paket crystal yang tersimpan saat ini
  SELECT value INTO v_old_value
  FROM public.system_configs
  WHERE key = 'crystal_packages';

  -- Jika konfigurasi belum ada
  IF v_old_value IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Konfigurasi crystal_packages tidak ditemukan di tabel system_configs'
    );
  END IF;

  -- Pastikan format berupa JSON Array
  IF jsonb_typeof(v_old_value) <> 'array' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Format data konfigurasi crystal_packages tidak valid (bukan JSON array)'
    );
  END IF;

  -- Cek apakah packageId yang dituju benar-benar ada
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_old_value) elem
    WHERE elem->>'id' = p_package_id
  ) INTO v_found;

  IF NOT v_found THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Paket dengan ID "%s" tidak ditemukan', p_package_id),
      'packages', v_old_value
    );
  END IF;

  -- Filter keluar elemen paket yang memiliki id = p_package_id
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  INTO v_new_value
  FROM jsonb_array_elements(v_old_value) elem
  WHERE elem->>'id' <> p_package_id;

  v_remaining_count := jsonb_array_length(v_new_value);

  -- Perbarui row konfigurasi di system_configs
  UPDATE public.system_configs
  SET 
    value = v_new_value,
    updated_at = NOW()
  WHERE key = 'crystal_packages';

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_package_id,
    'remaining_count', v_remaining_count,
    'packages', v_new_value
  );
END;
$$;

-- Berikan izin eksekusi ke role yang relevan
GRANT EXECUTE ON FUNCTION public.admin_delete_crystal_package(TEXT) TO authenticated, service_role, anon;

-- ==============================================================================
-- 2. QUERY CONTOH CARA PENGGUNAAN LANGSUNG VIA SQL EDITOR SUPABASE:
-- ==============================================================================
--
-- A. CARA 1: Memanggil fungsi RPC (Sangat Direkomendasikan)
-- SELECT public.admin_delete_crystal_package('starter');
--
-- B. CARA 2: Query UPDATE Langsung ke tabel system_configs tanpa RPC:
-- UPDATE public.system_configs
-- SET 
--   value = (
--     SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
--     FROM jsonb_array_elements(value) elem
--     WHERE elem->>'id' <> 'TARGET_PACKAGE_ID' -- Ganti dengan ID paket yang ingin dihapus
--   ),
--   updated_at = NOW()
-- WHERE key = 'crystal_packages';
--
-- C. CARA 3: Melihat daftar seluruh paket crystal saat ini:
-- SELECT jsonb_pretty(value) FROM public.system_configs WHERE key = 'crystal_packages';
-- ==============================================================================

