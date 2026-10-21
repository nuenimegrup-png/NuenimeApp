CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'finance_admin', 'moderator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_accounts_email ON public.admin_accounts(email);
CREATE INDEX IF NOT EXISTS idx_admin_accounts_role ON public.admin_accounts(role);
CREATE INDEX IF NOT EXISTS idx_admin_accounts_status ON public.admin_accounts(status);

ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_accounts' AND policyname = 'Allow public read admin accounts'
  ) THEN
    CREATE POLICY "Allow public read admin accounts" 
      ON public.admin_accounts FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_accounts' AND policyname = 'Allow admin write admin accounts'
  ) THEN
    CREATE POLICY "Allow admin write admin accounts" 
      ON public.admin_accounts FOR ALL USING (true);
  END IF;
END $$;

INSERT INTO public.admin_accounts (id, username, email, password_hash, role, status, notes)
VALUES
  (
    'admin-super-01',
    'Super Admin Nuenime',
    'admin@nuenime.com',
    'admin123',
    'super_admin',
    'active',
    'Akun Utama Super Admin (Akses Penuh Semua Modul)'
  ),
  (
    'admin-finance-01',
    'Staff Keuangan',
    'finance@nuenime.com',
    'finance123',
    'finance_admin',
    'active',
    'Staff Verifikasi Transaksi Top Up & Tiket CS'
  ),
  (
    'admin-mod-01',
    'Staff Moderator',
    'mod@nuenime.com',
    'mod123',
    'moderator',
    'active',
    'Staff Moderasi Komunitas & Komentar Anime'
  )
ON CONFLICT (email) DO NOTHING;
