-- ==============================================================================
-- MIGRATION: ADD SEQUENTIAL MEMBER NUMBER TAG (#1, #2, dst.)
-- ==============================================================================
-- Penomoran tag akun berurutan berdasarkan waktu pendaftaran user:
-- - User pertama yang sudah terdaftar mendapatkan tag #1
-- - User berikutnya yang login/daftar otomatis mendapat #2, #3, dst.
-- ==============================================================================

-- 1. Buat sequence nomor urut member jika belum ada
CREATE SEQUENCE IF NOT EXISTS public.profile_member_seq START WITH 1 INCREMENT BY 1;

-- 2. Tambah kolom member_number ke tabel profiles dengan default dari sequence
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS member_number BIGINT UNIQUE DEFAULT nextval('public.profile_member_seq');

-- 3. Urutkan akun yang SUDAH terdaftar saat ini berdasarkan created_at ASC
--    Akun yang pertama kali mendaftar / login akan mendapatkan nomor 1 (#1)
WITH numbered_existing AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM public.profiles
)
UPDATE public.profiles p
SET member_number = n.rn
FROM numbered_existing n
WHERE p.id = n.id AND (p.member_number IS NULL OR p.member_number = 0);

-- 4. Set nilai sequence berikutnya agar melanjutkan dari nomor member tertinggi yang sudah ada
SELECT setval(
  'public.profile_member_seq',
  COALESCE((SELECT MAX(member_number) FROM public.profiles), 1)
);

-- 5. Perbarui fungsi trigger handle_new_user agar aman saat user baru mendaftar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  extracted_username TEXT;
  extracted_display_name TEXT;
  extracted_avatar_url TEXT;
BEGIN
  -- Ekstrak display name dari metadata Google OAuth / Auth
  extracted_display_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    SPLIT_PART(new.email, '@', 1),
    'Nuenime Member'
  );

  -- Ekstrak atau generate username unik
  extracted_username := LOWER(REGEXP_REPLACE(
    COALESCE(
      new.raw_user_meta_data->>'user_name',
      SPLIT_PART(new.email, '@', 1),
      'user_' || SUBSTRING(new.id::text, 1, 6)
    ),
    '[^a-zA-Z0-9_]', '_', 'g'
  ));

  -- Pastikan panjang username 3-20 karakter
  IF LENGTH(extracted_username) < 3 THEN
    extracted_username := extracted_username || '_' || SUBSTRING(new.id::text, 1, 4);
  ELSIF LENGTH(extracted_username) > 20 THEN
    extracted_username := SUBSTRING(extracted_username, 1, 20);
  END IF;

  -- Ekstrak avatar URL dari Google
  extracted_avatar_url := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    NULL
  );

  -- Masukkan profil baru dengan nomor urut berurutan otomatis dari sequence
  INSERT INTO public.profiles (id, username, display_name, avatar_url, member_number)
  VALUES (
    new.id,
    extracted_username,
    extracted_display_name,
    extracted_avatar_url,
    nextval('public.profile_member_seq')
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$;
