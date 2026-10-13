# PANDUAN SISTEM AVATAR, BANNER, DAN COOLDOWN PROFIL — NUENIME

Dokumen ini berisi rangkuman cara kerja sistem profil saat ini dan panduan langkah demi langkah jika nanti Anda ingin menerapkan sistem cooldown di level database Supabase.

---

## 1. Status Sistem Saat Ini (Mode Tanpa Perlu Ubah Database)

Saat ini aplikasi **Nuenime** sudah berjalan normal tanpa memerlukan penambahan tabel atau kolom apa pun di Supabase Anda:

1. **Avatar Default dari Akun Google:**
   - Saat pengguna login via Google, aplikasi otomatis mengambil foto profil Google dari `user.user_metadata.avatar_url` atau `user.user_metadata.picture`.
   - Foto Google tersebut langsung dijadikan foto profil utama/default di menu **Profil** dan **Pengaturan**.
   - Jika pengguna belum mengubah avatar secara manual, foto akun Google akan selalu tampil.

2. **Pengaturan Banner Profil:**
   - Pengguna dapat mengganti banner menggunakan URL gambar langsung (mendukung GIF animasi, PNG, JPG, JPEG).
   - Memiliki fitur validasi URL, tombol tempel dari clipboard, dan pratinjau langsung.

3. **Sistem Cooldown (Batas Waktu Perubahan):**
   - **Banner:** Maksimal 1 kali ganti per 7 hari (604.800 detik).
   - **Nama Tampilan:** Maksimal 1 kali ganti per 24 jam (86.400 detik).
   - **Avatar:** Maksimal 1 kali ganti per 24 jam (86.400 detik).
   - *Status saat ini:* Waktu cooldown tersimpan di memori perangkat masing-masing (`AsyncStorage`). Sangat praktis untuk tahap pengembangan karena tidak perlu utak-atik database Supabase dan **konsol browser bersih dari error 400 / 404**.

---

## 2. Kapan Harus Meng-upload (Migrasi) ke Database Supabase?

Anda **hanya perlu** meng-upload ke database Supabase jika:
* Aplikasi sudah siap dirilis ke pengguna umum (Production).
* Anda ingin aturan batas waktu (cooldown) **terkunci permanen di akun pengguna**, sehingga pengguna tidak bisa mengakali cooldown dengan cara menghapus cache browser (*clear cache*) atau ganti HP.

---

## 3. Cara Meng-upgrade ke Database Supabase (Jika Nanti Diperlukan)

Jika Anda sudah siap dan ingin menerapkan aturan cooldown di level database server, ikuti langkah berikut:

### Langkah 1: Buka Supabase Dashboard
1. Buka browser dan login ke [supabase.com](https://supabase.com).
2. Pilih project database Nuenime Anda (`liqekmhmsanihjbyzjvm`).
3. Pada menu sidebar sebelah kiri, klik **SQL Editor**.

### Langkah 2: Masukkan Script SQL
1. Klik tombol **New Query**.
2. Salin seluruh isi dari file migrasi yang sudah disediakan di folder proyek Anda:
   📁 Path file: `supabase/migrations/20261013020000_profile_cooldowns_and_avatar_system.sql`
   
   *(Atau salin query di bawah ini):*

```sql
-- 1. Tambah kolom cooldown ke tabel profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS name_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

-- 2. Fungsi periksa cooldown profil
CREATE OR REPLACE FUNCTION public.check_profile_cooldown(p_user_id UUID, p_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_banner_at TIMESTAMPTZ;
  v_name_at TIMESTAMPTZ;
  v_avatar_at TIMESTAMPTZ;
  v_last_at TIMESTAMPTZ;
  v_cooldown_interval INTERVAL;
  v_seconds_remaining BIGINT := 0;
  v_can_change BOOLEAN := TRUE;
BEGIN
  SELECT banner_updated_at, name_updated_at, avatar_updated_at
  INTO v_banner_at, v_name_at, v_avatar_at
  FROM public.profiles
  WHERE id = p_user_id;

  IF p_type = 'banner' THEN
    v_last_at := v_banner_at;
    v_cooldown_interval := INTERVAL '7 days';
  ELSIF p_type = 'name' THEN
    v_last_at := v_name_at;
    v_cooldown_interval := INTERVAL '24 hours';
  ELSIF p_type = 'avatar' THEN
    v_last_at := v_avatar_at;
    v_cooldown_interval := INTERVAL '24 hours';
  ELSE
    RAISE EXCEPTION 'Unknown cooldown type: %', p_type;
  END IF;

  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - v_cooldown_interval) THEN
    v_can_change := FALSE;
    v_seconds_remaining := GREATEST(0, EXTRACT(EPOCH FROM (v_last_at + v_cooldown_interval - NOW()))::BIGINT);
  END IF;

  RETURN jsonb_build_object(
    'can_change', v_can_change,
    'seconds_remaining', v_seconds_remaining,
    'last_updated_at', v_last_at
  );
END;
$$;

-- 3. RPC: Pembaruan Banner Profil dengan Validasi Cooldown 7 Hari
CREATE OR REPLACE FUNCTION public.update_profile_banner(p_banner_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_at TIMESTAMPTZ;
  v_remaining BIGINT;
  v_clean_url TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Harus login untuk mengubah banner.';
  END IF;

  v_clean_url := NULLIF(TRIM(p_banner_url), '');

  IF v_clean_url IS NOT NULL THEN
    IF LENGTH(v_clean_url) > 2048 THEN
      RAISE EXCEPTION 'INVALID_URL: Panjang URL banner melebihi batas 2048 karakter.';
    END IF;
    IF v_clean_url !~* '^https?://.+' THEN
      RAISE EXCEPTION 'INVALID_URL: URL banner harus diawali dengan http:// atau https://';
    END IF;
  END IF;

  SELECT banner_updated_at INTO v_last_at FROM public.profiles WHERE id = v_uid;
  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - INTERVAL '7 days') THEN
    v_remaining := EXTRACT(EPOCH FROM (v_last_at + INTERVAL '7 days' - NOW()))::BIGINT;
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:BANNER:%', v_remaining;
  END IF;

  UPDATE public.profiles
  SET
    banner_url = v_clean_url,
    banner_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'banner_url', v_clean_url,
    'banner_updated_at', NOW()
  );
END;
$$;

-- 4. RPC: Pembaruan Nama Tampilan dengan Validasi Cooldown 24 Jam
CREATE OR REPLACE FUNCTION public.update_profile_display_name(p_display_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_at TIMESTAMPTZ;
  v_remaining BIGINT;
  v_clean_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Harus login untuk mengubah nama.';
  END IF;

  v_clean_name := TRIM(p_display_name);

  IF v_clean_name IS NULL OR LENGTH(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME: Nama tampilan minimal 2 karakter.';
  END IF;
  IF LENGTH(v_clean_name) > 30 THEN
    RAISE EXCEPTION 'INVALID_NAME: Nama tampilan maksimal 30 karakter.';
  END IF;

  SELECT name_updated_at INTO v_last_at FROM public.profiles WHERE id = v_uid;
  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - INTERVAL '24 hours') THEN
    v_remaining := EXTRACT(EPOCH FROM (v_last_at + INTERVAL '24 hours' - NOW()))::BIGINT;
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:NAME:%', v_remaining;
  END IF;

  UPDATE public.profiles
  SET
    display_name = v_clean_name,
    name_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'display_name', v_clean_name,
    'name_updated_at', NOW()
  );
END;
$$;

-- 5. RPC: Pembaruan Avatar Profil dengan Validasi Cooldown 24 Jam
CREATE OR REPLACE FUNCTION public.update_profile_avatar(p_avatar_url TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_at TIMESTAMPTZ;
  v_remaining BIGINT;
  v_clean_url TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Harus login untuk mengubah avatar.';
  END IF;

  v_clean_url := TRIM(p_avatar_url);

  IF v_clean_url IS NULL OR v_clean_url = '' THEN
    RAISE EXCEPTION 'INVALID_URL: Tautan avatar tidak boleh kosong.';
  END IF;
  IF LENGTH(v_clean_url) > 2048 THEN
    RAISE EXCEPTION 'INVALID_URL: Panjang URL avatar melebihi batas 2048 karakter.';
  END IF;
  IF v_clean_url !~* '^https?://.+' THEN
    RAISE EXCEPTION 'INVALID_URL: URL avatar harus diawali dengan http:// atau https://';
  END IF;

  SELECT avatar_updated_at INTO v_last_at FROM public.profiles WHERE id = v_uid;
  IF v_last_at IS NOT NULL AND v_last_at > (NOW() - INTERVAL '24 hours') THEN
    v_remaining := EXTRACT(EPOCH FROM (v_last_at + INTERVAL '24 hours' - NOW()))::BIGINT;
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:AVATAR:%', v_remaining;
  END IF;

  UPDATE public.profiles
  SET
    avatar_url = v_clean_url,
    avatar_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', TRUE,
    'avatar_url', v_clean_url,
    'avatar_updated_at', NOW()
  );
END;
$$;

-- Grant hak akses eksekusi ke authenticated users
GRANT EXECUTE ON FUNCTION public.check_profile_cooldown(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_banner(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_display_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_avatar(TEXT) TO authenticated;
```

### Langkah 3: Eksekusi Query
1. Klik tombol hijau **RUN** di pojok kanan bawah SQL Editor Supabase.
2. Tunggu hingga muncul tulisan **`Success. No rows returned`**.

### Langkah 4: Aktifkan di Kode Frontend
Setelah SQL di atas sukses dijalankan di Supabase Dashboard, Anda cukup memberi tahu asisten AI:
> *"Saya sudah jalankan SQL di Supabase, tolong aktifkan sinkronisasi cooldown database-nya."*

Maka asisten AI akan menghubungkan kolom `banner_updated_at`, `name_updated_at`, dan `avatar_updated_at` ke query Supabase secara otomatis.

---
*Dibuat untuk dokumentasi proyek Nuenime.*
