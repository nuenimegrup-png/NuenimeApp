-- ==============================================================================
-- NUENIME - ADMIN DASHBOARD COMPLETE DATABASE SCHEMA
-- ==============================================================================
-- Migration untuk mendukung 13 modul lengkap Admin Dashboard Nuenime:
-- 1. Finance & Top Up Crystal (Transactions, Gateway Config, Package CRUD)
-- 2. User Management (Balances, Adjustments, Sanctions, Cooldowns)
-- 3. Inventory & Border Avatar (45 borders, isReleased, innerRatio 0.74)
-- 4. Gacha & Crystal Store (Banners, Rates, Mass Gifts)
-- 5. Gamification & EXP (Rules, Leaderboard)
-- 6. Community & Moderation (Comment Moderation, Word Blacklist, Reports)
-- 7. Anime CMS & Streaming (Spotlight, Broken Stream Reports)
-- 8. System & APK Update (App Releases, Maintenance Mode, Broadcasts)
-- 9. Support & Customer Service (Tickets & Messages)
-- 10. Admin Roles & Audit Trail (RBAC, Audit Logs)
-- ==============================================================================

-- 1. TABEL: SYSTEM_CONFIGS (Konfigurasi Dinamis Aplikasi & Admin)
CREATE TABLE IF NOT EXISTS public.system_configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by UUID REFERENCES auth.users(id)
);

-- Inisialisasi konfigurasi dasar jika belum ada
INSERT INTO public.system_configs (key, value) VALUES
('payment_gateways', '{
  "admin_whatsapp": "",
  "qris_url": "",
  "shopeepay_number": "",
  "shopeepay_name": "Nuenime Admin",
  "shopeepay_active": true,
  "gopay_number": "",
  "gopay_name": "Nuenime Admin",
  "gopay_active": true,
  "dana_number": "",
  "dana_name": "Nuenime Admin",
  "dana_active": true,
  "qris_active": true
}'::jsonb),
('crystal_packages', '[
  {"id": "starter", "name": "Starter", "amount": 300, "amountFormatted": "300", "price": 300, "priceFormatted": "Rp300", "active": true, "sort_order": 1},
  {"id": "basic", "name": "Basic", "amount": 500, "amountFormatted": "500", "price": 500, "priceFormatted": "Rp500", "active": true, "sort_order": 2},
  {"id": "standard", "name": "Standard", "amount": 1000, "amountFormatted": "1.000", "price": 1000, "priceFormatted": "Rp1.000", "tag": "POPULER", "tag_color": "#38BDF8", "active": true, "sort_order": 3},
  {"id": "advanced", "name": "Advanced", "amount": 2500, "amountFormatted": "2.500", "price": 2500, "priceFormatted": "Rp2.500", "active": true, "sort_order": 4},
  {"id": "premium", "name": "Premium", "amount": 25000, "amountFormatted": "25.000", "price": 25000, "priceFormatted": "Rp25.000", "tag": "HEMAT", "tag_color": "#F59E0B", "active": true, "sort_order": 5},
  {"id": "ultimate", "name": "Ultimate", "amount": 50000, "amountFormatted": "50.000", "price": 50000, "priceFormatted": "Rp50.000", "tag": "TERBAIK", "tag_color": "#A855F7", "active": true, "sort_order": 6}
]'::jsonb),
('app_release', '{
  "version": "0.0.1",
  "build_number": 1,
  "apk_url": "https://github.com/nuenimegrup-png/NuenimeApp.git",
  "changelog": "Rilis awal Nuenime dengan fitur Avatar Borders & Dylan Crystal Store.",
  "force_update": false,
  "min_version": "0.0.1"
}'::jsonb),
('maintenance_mode', '{
  "is_active": false,
  "message": "Nuenime sedang dalam pemeliharaan sistem berkala. Mohon kembali beberapa saat lagi.",
  "ends_at": null
}'::jsonb),
('gacha_config', '{
  "cost_single": 1000,
  "cost_multi": 9000,
  "banner_title": "Bintang Istana Malam",
  "banner_desc": "Wallpaper edisi terbatas & bingkai mistis malam purnama.",
  "rates": {
    "mythic": 2.0,
    "legends": 8.0,
    "epic": 20.0,
    "rare": 30.0,
    "normal": 40.0
  }
}'::jsonb),
('exp_rules', '{
  "watch_episode": 20,
  "comment": 5,
  "daily_login": 10
}'::jsonb),
('word_blacklist', '["judi", "slot", "gacor", "bokep", "porn", "kontol", "memek", "anjing", "bangsat", "tolol"]'::jsonb),
('support_config', '{
  "saweriaUrl": "https://saweria.co/Nuenime",
  "saweriaActive": true,
  "heroGifUrl": "https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUyNjlyNmhqaWgzaHBvYXA0cXEzZ3BuaDV4cTFxdHl0dTRod3JzMTcxdSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/Al9XitEIwGgLU9yMfS/giphy.gif",
  "thankYouGifUrl": "https://media2.giphy.com/media/v1.Y2lkPTZjMDliOTUydG11ZWV3OXNkdzYzdjV6bXdmNTk2ZWNmcW9ydjRjczZ5dDNrOGF2YiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/UJuLfuG78YTDslaBcK/giphy.gif",
  "headlineBadge": "🎌 NUENIME",
  "headlineTitle": "Jaga Nuenime Tetap Hidup",
  "headlineSubtitle": "Setiap dukungan kamu sangat berarti untuk kami terus berkembang!",
  "saweriaTitle": "Saweria",
  "saweriaDescription": "Dukung Nuenime lewat Saweria — sekali bayar, nominal bebas, tidak perlu akun premium.",
  "perks": [
    {"icon": "play-circle", "text": "Server & hosting aplikasi Nuenime"},
    {"icon": "bell", "text": "Update konten & fitur baru"},
    {"icon": "account-group", "text": "Komunitas anime Indonesia"},
    {"icon": "heart", "text": "Semangat tim pengembang"}
  ],
  "footnote": "Dukungan bersifat sukarela dan tidak mempengaruhi akses ke fitur Nuenime."
}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- 2. TABEL: TOPUP_TRANSACTIONS (Transaksi Top Up Crystal)
CREATE TABLE IF NOT EXISTS public.topup_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  crystal_amount INTEGER NOT NULL,
  price INTEGER NOT NULL,
  additional_fee INTEGER DEFAULT 0 NOT NULL,
  total_payment INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'menunggu_konfirmasi',
  status_note TEXT,
  proof_image_url TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  crystals_granted BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_topup_status ON public.topup_transactions(status);
CREATE INDEX IF NOT EXISTS idx_topup_user ON public.topup_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_topup_created ON public.topup_transactions(created_at DESC);


-- 3. TABEL: USER_BALANCES (Saldo Dylan Crystal Akun Pengguna)
CREATE TABLE IF NOT EXISTS public.user_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  crystal_balance INTEGER DEFAULT 0 NOT NULL CHECK (crystal_balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- 4. TABEL: BALANCE_ADJUSTMENTS (Audit Log Penyesuaian Saldo Manual oleh Admin)
CREATE TABLE IF NOT EXISTS public.balance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  admin_email TEXT,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- 5. TABEL: USER_SANCTIONS (Sanksi: Ban Akun, Suspend, Mute Komentar)
CREATE TABLE IF NOT EXISTS public.user_sanctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  admin_email TEXT,
  type TEXT NOT NULL CHECK (type IN ('ban', 'suspend', 'mute_comment')),
  reason TEXT NOT NULL,
  starts_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ends_at TIMESTAMPTZ, -- NULL berarti permanen
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sanctions_active ON public.user_sanctions(user_id, is_active);


-- 6. TABEL: AVATAR_BORDERS_CONFIG (Pengaturan 45 Border Avatar & Custom Scale)
CREATE TABLE IF NOT EXISTS public.avatar_borders_config (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('Mythic', 'Legends', 'Epic', 'Rare', 'Normal')),
  asset_url TEXT,
  inner_ratio NUMERIC DEFAULT 0.74 NOT NULL,
  offset_x NUMERIC DEFAULT 0.0 NOT NULL,
  offset_y NUMERIC DEFAULT 0.0 NOT NULL,
  scale NUMERIC DEFAULT 1.0 NOT NULL,
  is_released BOOLEAN DEFAULT FALSE NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- 7. TABEL: SUPPORT_TICKETS & SUPPORT_TICKET_MESSAGES (Customer Service)
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  username TEXT,
  category TEXT NOT NULL CHECK (category IN ('account', 'video', 'payment', 'gacha', 'bug', 'other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  sender_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages ON public.support_ticket_messages(ticket_id, created_at ASC);


-- 8. TABEL: ADMIN_AUDIT_LOGS (Audit Trail Operasional Admin)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  admin_email TEXT,
  admin_role TEXT DEFAULT 'admin' NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_logs(created_at DESC);


-- 9. TABEL: MASS_GIFTS (Pengiriman Hadiah Massal / Mailbox)
CREATE TABLE IF NOT EXISTS public.mass_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  admin_email TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  gift_type TEXT NOT NULL CHECK (gift_type IN ('crystal', 'border')),
  gift_value TEXT NOT NULL,
  target_segment TEXT DEFAULT 'all' NOT NULL,
  recipients_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- 10. TABEL: BROKEN_STREAM_REPORTS (Laporan Link Streaming Rusak)
CREATE TABLE IF NOT EXISTS public.broken_stream_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anime_id INTEGER NOT NULL,
  anime_title TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  server_name TEXT,
  issue_description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'investigating', 'fixed', 'invalid')),
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- 11. TABEL: HOME_SPOTLIGHT_ITEMS (CMS Carousel Beranda & Featured Anime)
CREATE TABLE IF NOT EXISTS public.home_spotlight_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anime_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  poster_url TEXT,
  banner_url TEXT,
  synopsis TEXT,
  category TEXT DEFAULT 'spotlight' NOT NULL CHECK (category IN ('spotlight', 'featured', 'editors_choice', 'trending')),
  sort_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- 12. TABEL: BROADCAST_NOTIFICATIONS (Notifikasi Siaran ke Seluruh Pengguna)
CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  type TEXT DEFAULT 'system' NOT NULL,
  recipients_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- ==============================================================================
-- 13. FUNGSI DATABASE ATOMIK: VERIFIKASI TOP UP SINGLE-GRANT
-- Menjamin saldo Dylan Crystal HANYA bertambah tepat 1 kali saat transaksi disetujui.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_approve_topup_transaction(
  p_transaction_id TEXT,
  p_admin_id UUID,
  p_admin_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tx RECORD;
  v_new_balance INTEGER;
BEGIN
  -- Kunci baris transaksi agar aman dari race-condition / persetujuan ganda
  SELECT * INTO v_tx
  FROM public.topup_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan');
  END IF;

  IF v_tx.status = 'berhasil' AND v_tx.crystals_granted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaksi sudah pernah disetujui sebelumnya (saldo sudah diberikan)');
  END IF;

  -- 1. Tambah saldo ke user_balances
  INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
  VALUES (v_tx.user_id, v_tx.crystal_amount, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET crystal_balance = public.user_balances.crystal_balance + v_tx.crystal_amount,
      updated_at = NOW()
  RETURNING crystal_balance INTO v_new_balance;

  -- 2. Perbarui status transaksi
  UPDATE public.topup_transactions
  SET status = 'berhasil',
      crystals_granted = true,
      verified_at = NOW(),
      verified_by = p_admin_id
  WHERE id = p_transaction_id;

  -- 3. Catat ke audit log
  INSERT INTO public.admin_audit_logs (
    admin_id, admin_email, action, target_type, target_id, details
  ) VALUES (
    p_admin_id,
    p_admin_email,
    'APPROVE_TOPUP',
    'transaction',
    p_transaction_id,
    jsonb_build_object(
      'crystal_amount', v_tx.crystal_amount,
      'total_payment', v_tx.total_payment,
      'user_id', v_tx.user_id,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'crystal_amount', v_tx.crystal_amount,
    'new_balance', v_new_balance
  );
END;
$$;


-- ==============================================================================
-- 14. FUNGSI DATABASE ATOMIK: PENYESUAIAN SALDO MANUAL (ADJUSTMENT)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_adjust_user_balance(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_admin_id UUID,
  p_admin_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance INTEGER := 0;
  v_new_balance INTEGER := 0;
BEGIN
  -- Ambil saldo saat ini
  SELECT crystal_balance INTO v_current_balance
  FROM public.user_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_current_balance := 0;
  END IF;

  v_new_balance := v_current_balance + p_amount;
  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo tidak mencukupi (tidak boleh negatif)');
  END IF;

  -- Update / insert saldo
  INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
  VALUES (p_user_id, v_new_balance, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET crystal_balance = v_new_balance,
      updated_at = NOW();

  -- Catat riwayat perubahan saldo
  INSERT INTO public.balance_adjustments (
    user_id, admin_id, admin_email, amount, balance_before, balance_after, reason
  ) VALUES (
    p_user_id, p_admin_id, p_admin_email, p_amount, v_current_balance, v_new_balance, p_reason
  );

  -- Catat ke audit log
  INSERT INTO public.admin_audit_logs (
    admin_id, admin_email, action, target_type, target_id, details
  ) VALUES (
    p_admin_id,
    p_admin_email,
    'ADJUST_BALANCE',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'amount', p_amount,
      'before', v_current_balance,
      'after', v_new_balance,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance
  );
END;
$$;
