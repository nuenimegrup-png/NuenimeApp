-- ==============================================================================
-- MIGRASI: KOLOM PUSH_TOKEN PADA TABEL PROFILES UNTUK NOTIFIKASI REALTIME SAAT APK TUTUP
-- File: supabase/migrations/20261029000000_add_push_token_to_profiles.sql
-- ==============================================================================

-- 1. Tambahkan kolom push_token ke tabel profiles jika belum ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2. Buat indeks untuk mempercepat pencarian token pengguna
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON public.profiles(push_token) WHERE push_token IS NOT NULL;
