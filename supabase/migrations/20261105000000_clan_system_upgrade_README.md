# PANDUAN PENERAPAN MIGRASI SISTEM KLAN NUENIME

Dokumen ini menjelaskan langkah-langkah penerapan dan verifikasi migrasi skema database, constraint, dan stored procedures (RPC) untuk sistem Klan Nuenime.

---

## 1. Ringkasan File SQL

| File | Deskripsi |
|---|---|
| `20261105000000_clan_system_upgrade.sql` | **Migrasi Utama**: Menambahkan kolom status, index unik 1 anggota 1 klan aktif, tabel permintaan bergabung (`rpg_clan_join_requests`), RLS, trigger rekonsiliasi, dan 6 fungsi RPC atomic. |
| `20261105000000_clan_system_upgrade_rollback.sql` | **Rollback Aman**: Membatalkan RPC, trigger, index baru, dan tabel join requests tanpa merusak akun pengguna, data EXP, ataupun saldo Crystal. |

---

## 2. Fitur & Keamanan yang Dijamin di Level SQL

1. **Single Active Clan Constraint**:
   - Partial unique index `uq_rpg_clan_members_single_active_user` pada `(user_id) WHERE status = 'active'` mencegah seorang user aktif di 2 klan secara bersamaan sekalipun terdapat race condition / concurrent requests.
2. **Atomic Join Request (`rpc_request_join_clan`)**:
   - Memeriksa kapasitas klan (< 100 anggota).
   - Memeriksa apakah user sedang aktif di klan lain (menolak jika masih aktif).
   - Mencegah permintaan ganda berstatus `pending` untuk klan yang sama.
3. **Konfirmasi Pemimpin (`rpc_respond_clan_join_request`)**:
   - Hanya pemimpin (`role = 'Pemimpin Klan'`) atau wakil pemimpin (`role = 'Wakil Pemimpin'`) yang berhak menyetujui/menolak.
   - Menggunakan row-level locking (`FOR UPDATE`) pada request dan clan.
   - Begitu diapprove, permintaan pending user di klan lain otomatis dibatalkan (`status = 'cancelled'`).
4. **Keluar Klan Aman (`rpc_leave_clan`)**:
   - Menandai status keanggotaan menjadi `left` dan mencatat `left_at`.
   - Tidak menghapus profil, EXP, saldo Crystal, atau akun pengguna.
   - Jika pemimpin klan adalah satu-satunya anggota klan, klan otomatis dibubarkan (`disbanded`).
   - Jika ada anggota lain, pemimpin wajib mengalihkan kepemimpinan terlebih dahulu sebelum dapat keluar klan.
5. **Pembubaran / Hapus Klan Aman (`rpc_disband_clan`)**:
   - Khusus dijalankan oleh pemimpin klan yang sah.
   - Menandai klan sebagai `disbanded` (bukan DROP TABLE permanen), mengakhiri keanggotaan semua anggota aktif (`status = 'removed'`), dan membatalkan seluruh permintaan pending.
6. **Transfer Kepemimpinan (`rpc_transfer_clan_leadership`)**:
   - Mengalihkan gelar 'Pemimpin Klan' kepada anggota aktif yang ditunjuk, dan menurunkan pemimpin lama menjadi 'Anggota'.

---

## 3. Langkah Menjalankan Migrasi di Supabase

### Melalui Supabase SQL Editor (Dashboard):
1. Buka [Supabase Dashboard](https://supabase.com/dashboard).
2. Pilih proyek Nuenime Anda.
3. Klik menu **SQL Editor** pada navigasi kiri.
4. Klik **New Query**.
5. Salin dan tempel seluruh isi file:
   `supabase/migrations/20261105000000_clan_system_upgrade.sql`
6. Klik tombol **Run** (atau tekan `Ctrl + Enter`).
7. Pastikan pesan sukses muncul: `Success. No rows returned`.

### Melalui Supabase CLI (Jika terhubung ke remote):
```bash
npx supabase db push
```
atau
```bash
psql -h <SUPABASE_DB_HOST> -U postgres -d postgres -f supabase/migrations/20261105000000_clan_system_upgrade.sql
```

---

## 4. Langkah Verifikasi Hasil Migrasi

Jalankan query verifikasi berikut di Supabase SQL Editor untuk memastikan skema dan RPC terpasang dengan benar:

```sql
-- 1. Periksa kolom baru pada tabel rpg_clans dan rpg_clan_members
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('rpg_clans', 'rpg_clan_members', 'rpg_clan_join_requests')
ORDER BY table_name, ordinal_position;

-- 2. Periksa index partial unique
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE indexname = 'uq_rpg_clan_members_single_active_user';

-- 3. Periksa daftar fungsi RPC klan yang telah dibuat
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE 'rpc_%clan%';
```

---

## 5. Prosedur Rollback Aman

Jika karena suatu alasan migrasi perlu dibatalkan:
1. Buka **SQL Editor** di Supabase Dashboard.
2. Buka dan jalankan script:
   `supabase/migrations/20261105000000_clan_system_upgrade_rollback.sql`
3. Seluruh tabel klan dan keanggotaan pengguna tetap aman dan tidak mengalami kehilangan data.
