-- ==============================================================================
-- MIGRASI: SYSTEM CONFIGS, POP-UP ANNOUNCEMENT, REALTIME & BROADCASTS
-- File: supabase/migrations/20261015020000_system_configs_and_announcements.sql
-- ==============================================================================

-- 1. Pastikan tabel system_configs ada dan memiliki struktur yang benar
CREATE TABLE IF NOT EXISTS public.system_configs (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Pastikan tabel broadcast_notifications ada dan admin_id bersifat opsional/nullable
CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  type TEXT DEFAULT 'system' NOT NULL,
  recipients_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Jika tabel broadcast_notifications sudah ada sebelumnya dengan kolom NOT NULL, ubah agar nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'broadcast_notifications' AND column_name = 'admin_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.broadcast_notifications ALTER COLUMN admin_id DROP NOT NULL;
  END IF;
END $$;

-- 3. Inisialisasi default konfig: Pop-up Awal Pengumuman (app_announcement)
INSERT INTO public.system_configs (key, value, updated_at)
VALUES (
  'app_announcement',
  '{
    "is_active": true,
    "title": "[ INFO ]",
    "content": "Gabung ke komunitas AnibiPlay di Discord! ✨\n\n• Ngobrol bareng komunitas\n• Dapatkan info & update terbaru\n• Laporkan bug atau masalah\n• Berikan saran untuk AnibiPlay\n\nJangan sampai ketinggalan info terbaru!\nTekan tombol di bawah untuk bergabung. 👇",
    "button_text": "JOIN DISCORD",
    "button_url": "https://discord.gg/nuenime",
    "secondary_button_text": "DETAIL INFO",
    "secondary_button_url": "",
    "version_tag": "Versi terbaru: 1.4.9",
    "dismissible": true
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value
WHERE (system_configs.value->>'secondary_button_text') IS NULL;

-- 4. Inisialisasi default konfig: Maintenance Mode jika belum ada
INSERT INTO public.system_configs (key, value, updated_at)
VALUES (
  'maintenance_mode',
  '{
    "is_active": false,
    "message": "Nuenime sedang dalam pemeliharaan sistem berkala. Mohon kembali beberapa saat lagi.",
    "ends_at": null
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 5. Inisialisasi default konfig: Rilis APK jika belum ada
INSERT INTO public.system_configs (key, value, updated_at)
VALUES (
  'app_release',
  '{
    "version": "1.0.0",
    "build_number": 1,
    "apk_url": "https://github.com/nuenimegrup-png/NuenimeApp.git",
    "changelog": "Pembaruan perdana Nuenime dengan fitur Avatar Borders, Dylan Crystal Store, dan Gacha Banner.",
    "force_update": false,
    "min_version": "1.0.0"
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- 6. Daftarkan tabel ke Supabase Realtime Publication agar perubahan instan terbaca websocket client
DO $$
BEGIN
  -- Daftarkan system_configs ke publikasi realtime jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_configs;
  END IF;

  -- Daftarkan broadcast_notifications ke publikasi realtime jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'broadcast_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_notifications;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- Abaikan jika publikasi supabase_realtime belum dibuat di database lokal
    NULL;
END $$;
