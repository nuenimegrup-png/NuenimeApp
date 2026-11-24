-- Migration: 20261125010000_profile_equipped_gift.sql
-- Tambah kolom equipped_gift_id pada tabel profiles untuk memilih gift yang ditampilkan di profil

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipped_gift_id TEXT DEFAULT NULL;

