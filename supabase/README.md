# Panduan Konfigurasi Database Supabase & Google OAuth - Nuenime

Dokumentasi ini menjelaskan langkah-langkah lengkap untuk menghubungkan aplikasi **Nuenime** ke proyek **Supabase**, menjalankan skrip migrasi database, dan mengaktifkan login Google OAuth.

---

## 1. Menjalankan Migrasi SQL ke Supabase

Seluruh skrip migrasi telah dipersiapkan di file [`supabase/schema.sql`](./schema.sql).

### Langkah-langkah:
1. Buka dashboard proyek Supabase Anda: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Masuk ke proyek Anda, lalu klik menu **SQL Editor** pada sidebar kiri.
3. Klik tombol **New query**.
4. Salin seluruh isi dari file [`supabase/schema.sql`](./schema.sql) dan tempel (*paste*) ke dalam editor SQL.
5. Klik tombol **Run** (atau tekan `Ctrl + Enter`).
6. Supabase akan secara otomatis membuat:
   - Tabel `profiles` (profil pengguna)
   - Tabel `bookmarks` (anime favorit / langganan)
   - Tabel `watch_history` (riwayat tontonan dan progress durasi)
   - Tabel `episode_ratings` (skor rating per episode 1-10)
   - Tabel `notifications` (notifikasi sistem dan episode baru)
   - Tabel `comments` dan `comment_likes` (diskusi & balasan)
   - Tabel `user_settings` dan `user_roles`
   - **RLS (Row Level Security)** pada setiap tabel agar data aman per user
   - **Trigger Otomatis `on_auth_user_created`**: saat user login pertama kali dengan Google, data avatar, nama, dan username otomatis dibuat di tabel `profiles`.

---

## 2. Mengaktifkan Login Google di Supabase Dashboard

Aplikasi sekarang secara eksklusif hanya menggunakan **Google Sign-In** (tanpa email/password).

### Langkah-langkah di Google Cloud Console:
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat proyek baru atau pilih proyek yang ada.
3. Masuk ke menu **APIs & Services** > **Credentials**.
4. Buat **OAuth 2.0 Client ID** bertipe **Web Application**.
5. Di bagian **Authorized redirect URIs**, tambahkan URL callback dari Supabase:
   ```
   https://<PROJECT-REF>.supabase.co/auth/v1/callback
   ```
   *(Ganti `<PROJECT-REF>` dengan ID proyek Supabase Anda)*.
6. Simpan, lalu catat **Client ID** dan **Client Secret**.

### Langkah-langkah di Supabase Dashboard:
1. Masuk ke dashboard Supabase > **Authentication** > **Providers**.
2. Cari dan klik **Google**.
3. Aktifkan toggle **Enable Google provider**.
4. Masukkan **Client ID** dan **Client Secret** yang Anda dapatkan dari Google Cloud Console.
5. Klik **Save**.

---

## 3. Konfigurasi Environment Variables (`.env`)

Buka file `.env` di root proyek Nuenime, lalu pastikan variabel berikut terisi dengan kredensial proyek Supabase Anda:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT-REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON-PUBLIC-KEY-ANDA>
EXPO_PUBLIC_API_BASE_URL=https://api.aniraku.tech
```

### Cara Mendapatkan Supabase URL & Anon Key:
1. Di dashboard Supabase, buka menu **Project Settings** (ikon gear di pojok kiri bawah).
2. Klik tab **API**.
3. Salin nilai:
   - **Project URL** -> masukkan ke `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public key** -> masukkan ke `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## 4. Struktur Tabel Database

| Nama Tabel | Deskripsi | RLS / Akses |
|---|---|---|
| `profiles` | Profil akun pengguna (avatar, nama, bio) | Publik bisa membaca, hanya pemilik yang bisa update |
| `bookmarks` | Anime yang disubscribe / disimpan | Privat per `user_id` |
| `watch_history` | Riwayat tontonan episode & resume durasi | Privat per `user_id` |
| `episode_ratings` | Rating skor episode (1–10) | Publik bisa membaca skor, manajemen per `user_id` |
| `notifications` | Notifikasi & pemberitahuan akun | Privat per `user_id` |
| `comments` | Diskusi episode anime & thread | Publik bisa membaca, insert/delete per `user_id` |
| `comment_likes` | Status like pada komentar | Publik bisa membaca, insert/delete per `user_id` |
