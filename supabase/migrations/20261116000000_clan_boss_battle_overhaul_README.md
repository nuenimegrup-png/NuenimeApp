# PANDUAN LENGKAP SISTEM CLAN BOSS BATTLE NUENIME

Dokumen ini menjelaskan implementasi teknis, aturan bisnis, dan panduan eksekusi untuk sistem **Clan Boss Battle**, **Gudang Senjata**, **Cooldown 60 Menit (Global)**, **Sistem Ronde**, dan **Hadiah Koin Klan Berdasarkan Level**.

---

## 1. Ringkasan File SQL & Fitur Utama

- **File**: `supabase/migrations/20261116000000_clan_boss_battle_overhaul.sql`
- **Fitur Utama**:
  1. **Tabel Cooldown Serangan Klan (`rpg_clan_boss_cooldowns`)**:
     - Menyimpan `clan_id`, `boss_id`, `last_attack_at`, dan `next_attack_at` (60 menit per klan).
     - **Cakupan Global**: Klan tidak dapat melewati cooldown dengan mengganti target kota atau mengirim request langsung ke API.
     - Terlindungi oleh server time (`NOW()`), kebal terhadap refresh, logout, perpindahan kota, maupun penggantian halaman.
  2. **Persaingan Semua Klan di Kota yang Sama**:
     - Semua klan di kota yang sama maupun klan penjelajah dapat bersaing melawan Bos kota tersebut.
     - Menghapus pembatasan sepihak domisili kota agar seluruh klan dapat bertarung secara adil.
  3. **Identitas Ronde Boss (`current_round`)**:
     - Kolom `current_round` pada tabel `rpg_city_bosses`.
     - Kolom `round_id` pada tabel `rpg_boss_battle_logs`.
     - Setiap serangan otomatis dikelompokkan ke dalam ronde aktif bos tersebut.
  4. **Penentuan Juara Berdasarkan TOTAL DAMAGE TERTINGGI**:
     - Bukan ditentukan oleh penyerang terakhir (*last hit*).
     - Dihitung dari akumulasi `SUM(total_damage)` seluruh klan pada ronde tersebut.
     - Damage dicap sesuai sisa HP bos aktual (`LEAST(total_damage, current_hp)`), sehingga tidak ada inflasi overkill.
     - Jika seri: klan yang lebih dahulu mencapai total damage tersebut berdasarkan waktu server (`first_strike_at ASC`) yang menang.
  5. **Formula Hadiah Koin Berdasarkan Level**:
     - `Hadiah Dasar = 10.000 Koin × Level Boss` (Level 1 = 10.000 Koin, Level 2 = 20.000 Koin, Level 10 = 100.000 Koin).
     - Hadiah **HANYA** masuk ke saldo kas klan pemenang (`rpg_clans.coins`), bukan akun pribadi, dan dicatat di mutasi transaksi kas klan (`rpg_clan_coin_transactions`).
     - Dijamin hanya 1 kali per ronde dengan constraint unik `(boss_id, round_number)`.
  6. **Reset Otomatis HP Boss untuk Ronde Baru**:
     - Saat bos kalah (`current_hp <= 0`), HP langsung direset ke `max_hp`.
     - Status kembali `ACTIVE`, dan `current_round` bertambah 1 untuk ronde berikutnya.
     - Riwayat pemenang ronde tersimpan di tabel `rpg_boss_round_history`.
  7. **Hak Akses Pemimpin Klan (Leader Only)**:
     - Hanya pemimpin klan sah (`leader_id = p_user_id` atau role `'Pemimpin Klan'`, `'Ketua'`, `'Founder'`) yang dapat membeli senjata gudang dan melancarkan serangan bos.
     - Permintaan langsung dari anggota biasa ditolak secara tegas oleh RPC database.
  8. **Isolasi Gudang Senjata**:
     - Senjata klan hanya dapat digunakan oleh klan pemiliknya (`rpg_clan_inventory` dikunci per `clan_id` dan dikonsumsi 1 per serangan valid).
     - Harga item diambil langsung dari `rpg_weapons_catalog` di server.

---

## 2. Cara Menjalankan / Memperbarui Migrasi di Supabase Dashboard

1. Buka [Supabase Dashboard](https://supabase.com/dashboard).
2. Pilih proyek database Nuenime Anda.
3. Masuk ke menu **SQL Editor** pada navigasi sebelah kiri.
4. Klik **New Query**.
5. Salin dan tempel seluruh isi dari file:
   `supabase/migrations/20261116000000_clan_boss_battle_overhaul.sql`
6. Klik tombol **Run** (atau tekan `Ctrl + Enter`).
7. Pastikan muncul notifikasi hijau `Success. No rows returned`.

---

## 3. Komponen Frontend yang Terhubung

1. `dunia-Nuenime/src/components/EnemyBossRaidModal.tsx`:
   - Countdown timer cooldown format `HH : MM : SS` (diperbarui otomatis setiap detik dari waktu server).
   - Validasi role pemimpin (tombol dinonaktifkan untuk anggota biasa).
   - Tab 1: Serangan & Kalkulasi damage (Base + Senjata gudang klan sendiri).
   - Tab 2: Leaderboard damage klan resmi dari server via `rpc_get_boss_raid_leaderboard` (`Ronde #X`).
   - Tab 3: Riwayat juara ronde bos sebelumnya dari tabel `rpg_boss_round_history`.
   - Banner pengumuman kemenangan otomatis saat bos berhasil ditaklukkan.
2. `dunia-Nuenime/src/components/CityDetailScreen.tsx`:
   - Tombol "Serang Bos" aktif untuk seluruh klan di kota tersebut tanpa blokir `isHomeCity`.
   - Buka modal pertarungan & leaderboard langsung dari kartu bos kota.
3. `dunia-Nuenime/src/context/NuenimeRpgContext.tsx`:
   - Integrasi `rpc_attack_enemy_city_boss`, `rpc_buy_clan_weapon`, dan `rpc_get_boss_raid_leaderboard`.
   - Optimistic update untuk kas klan dan inventaris senjata.
4. `dunia-Nuenime/src/components/ClanCombatShopModal.tsx`:
   - Gudang dan koin klan terisolasi ketat per `clan_id`.
   - Hak akses pembelian hanya untuk Pemimpin Klan.

---

## 4. Hasil Pengujian End-to-End Otomatis

Pengujian dijalankan langsung terhadap database Supabase:

| No | Skenario Uji | Status |
|:--:|---|:---:|
| 1 | Anggota biasa ditolak saat membeli senjata gudang | **LULUS (100%)** |
| 2 | Anggota biasa ditolak saat mencoba menyerang Boss | **LULUS (100%)** |
| 3 | Pemimpin klan berhasil membeli senjata menggunakan kas koin klan | **LULUS (100%)** |
| 4 | Stok senjata bertambah di inventaris klan pemilik secara terisolasi | **LULUS (100%)** |
| 5 | Riwayat mutasi transaksi koin tercatat di audit trail | **LULUS (100%)** |
| 6 | Cooldown 60 menit menolak serangan beruntun dari klan yang sama | **LULUS (100%)** |
| 7 | RPC `rpc_get_boss_raid_leaderboard` mengembalikan data resmi (HP, Ronde, Leaderboard) | **LULUS (100%)** |
| 8 | Status cooldown klan terbaca otomatis dari waktu server | **LULUS (100%)** |
| 9 | Klan lain tidak terkena cooldown milik klan yang berbeda | **LULUS (100%)** |
| 10 | Formula hadiah koin klan tepat: 10.000 × Level Boss = Hadiah Kas Klan | **LULUS (100%)** |
