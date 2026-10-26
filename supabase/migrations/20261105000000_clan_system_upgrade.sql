-- ==============================================================================
-- NUENIME - SISTEM KLAN LENGKAP: DATABASE, SQL, ATURAN KEANGGOTAAN & TRANSAKSI
-- File: 20261105000000_clan_system_upgrade.sql
-- ==============================================================================
-- Menjamin:
-- 1. Satu pengguna hanya boleh menjadi anggota aktif dari satu klan (Enforced by partial unique index).
-- 2. Sistem Permintaan Bergabung (pending, approved, rejected, cancelled) dengan konfirmasi Pemimpin.
-- 3. Fitur Keluar Klan aman tanpa menghapus akun/EXP/Crystal.
-- 4. Fitur Pembubaran / Hapus Klan aman yang otomatis mengakhiri keanggotaan semua anggota.
-- 5. Fitur Transfer Kepemimpinan klan.
-- 6. Kompatibilitas 100% dengan data lama (tanpa DROP TABLE atau penghapusan data pengguna).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PENYESUAIAN SKEMA TABEL rpg_clans
-- ------------------------------------------------------------------------------
ALTER TABLE public.rpg_clans
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active' NOT NULL,
  ADD COLUMN IF NOT EXISTS disbanded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disbanded_by TEXT;

CREATE INDEX IF NOT EXISTS idx_rpg_clans_status ON public.rpg_clans(status);

-- ------------------------------------------------------------------------------
-- 2. PENYESUAIAN SKEMA TABEL rpg_clan_members
-- ------------------------------------------------------------------------------
ALTER TABLE public.rpg_clan_members
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'active' NOT NULL,
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

-- Rekonsiliasi Data Lama: Pastikan seluruh baris yang ada berstatus 'active' jika belum diset
UPDATE public.rpg_clan_members
SET status = 'active'
WHERE status IS NULL OR status = '';

-- Tangani jika ada anomali user_id yang terdaftar aktif di lebih dari satu klan (data testing lama)
-- Mempertahankan baris dengan contribution_score tertinggi atau joined_at terbaru sebagai 'active',
-- dan menandai duplikat lainnya sebagai 'left' agar tidak melanggar unique constraint.
WITH ranked_members AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id 
           ORDER BY contribution_score DESC, joined_at DESC
         ) as rn
  FROM public.rpg_clan_members
  WHERE status = 'active'
)
UPDATE public.rpg_clan_members
SET status = 'left', left_at = NOW()
WHERE id IN (
  SELECT id FROM ranked_members WHERE rn > 1
);

-- Constraint Parsial Unik: Satu pengguna HANYA boleh memiliki satu keanggotaan 'active' di seluruh klan
DROP INDEX IF EXISTS public.uq_rpg_clan_members_single_active_user;
CREATE UNIQUE INDEX uq_rpg_clan_members_single_active_user
  ON public.rpg_clan_members (user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_rpg_clan_members_clan_status
  ON public.rpg_clan_members (clan_id, status);

-- ------------------------------------------------------------------------------
-- 3. TABEL BARU: rpg_clan_join_requests (Sistem Permintaan Bergabung)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rpg_clan_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id VARCHAR(64) NOT NULL REFERENCES public.rpg_clans(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  border_url TEXT,
  level INTEGER DEFAULT 1 NOT NULL,
  status VARCHAR(32) DEFAULT 'pending' NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_rpg_clan_join_request_status 
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

-- Indeks Performa & Cegah Permintaan Ganda (Hanya 1 permintaan pending per user per klan)
DROP INDEX IF EXISTS public.uq_rpg_clan_join_requests_user_clan_pending;
CREATE UNIQUE INDEX uq_rpg_clan_join_requests_user_clan_pending
  ON public.rpg_clan_join_requests (clan_id, user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_rpg_clan_join_requests_clan_status 
  ON public.rpg_clan_join_requests(clan_id, status);

CREATE INDEX IF NOT EXISTS idx_rpg_clan_join_requests_user_status 
  ON public.rpg_clan_join_requests(user_id, status);

-- Enable RLS
ALTER TABLE public.rpg_clan_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read clan join requests" ON public.rpg_clan_join_requests;
CREATE POLICY "Anyone can read clan join requests" 
  ON public.rpg_clan_join_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own join requests" ON public.rpg_clan_join_requests;
CREATE POLICY "Users can insert their own join requests" 
  ON public.rpg_clan_join_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Leaders can update join requests" ON public.rpg_clan_join_requests;
CREATE POLICY "Leaders can update join requests" 
  ON public.rpg_clan_join_requests FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete or cancel join requests" ON public.rpg_clan_join_requests;
CREATE POLICY "Users can delete or cancel join requests" 
  ON public.rpg_clan_join_requests FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 4. UPDATE TRIGGER REKONSILIASI JUMLAH ANGGOTA (Hanya Anggota 'active')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_clan_stats_from_members()
RETURNS TRIGGER AS $$
DECLARE
  target_clan_id VARCHAR(64);
  calc_total_exp BIGINT;
  calc_member_count INT;
  calc_level INT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    target_clan_id := OLD.clan_id;
  ELSE
    target_clan_id := NEW.clan_id;
  END IF;

  SELECT COALESCE(SUM(contribution_score), 0), COUNT(*)
  INTO calc_total_exp, calc_member_count
  FROM public.rpg_clan_members
  WHERE clan_id = target_clan_id
    AND status = 'active';

  calc_level := GREATEST(1, FLOOR(calc_total_exp / 1500) + 1);

  UPDATE public.rpg_clans
  SET total_exp = calc_total_exp,
      member_count = calc_member_count,
      level = calc_level,
      updated_at = NOW()
  WHERE id = target_clan_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_clan_stats ON public.rpg_clan_members;
CREATE TRIGGER trg_sync_clan_stats
AFTER INSERT OR UPDATE OR DELETE ON public.rpg_clan_members
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_clan_stats_from_members();

-- ------------------------------------------------------------------------------
-- 5. RPC 1: rpc_request_join_clan (Pengajuan Permintaan Bergabung)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_request_join_clan(
  p_clan_id VARCHAR(64),
  p_user_id TEXT,
  p_display_name TEXT,
  p_avatar_url TEXT DEFAULT NULL,
  p_border_url TEXT DEFAULT NULL,
  p_level INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clan RECORD;
  v_active_membership RECORD;
  v_pending_request RECORD;
  v_new_req_id UUID;
BEGIN
  -- 1. Validasi keberadaan klan tujuan
  SELECT id, name, status, member_count, max_members
  INTO v_clan
  FROM public.rpg_clans
  WHERE id = p_clan_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan tujuan tidak ditemukan.');
  END IF;

  IF v_clan.status = 'disbanded' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan ini telah dibubarkan dan tidak menerima anggota.');
  END IF;

  IF v_clan.member_count >= v_clan.max_members THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Kapasitas klan telah penuh (100/100 anggota).');
  END IF;

  -- 2. Validasi apakah pengguna saat ini sudah aktif di klan lain
  SELECT m.clan_id, c.name AS clan_name
  INTO v_active_membership
  FROM public.rpg_clan_members m
  JOIN public.rpg_clans c ON c.id = m.clan_id
  WHERE m.user_id = p_user_id
    AND m.status = 'active'
    AND c.status = 'active';

  IF FOUND THEN
    IF v_active_membership.clan_id = p_clan_id THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Anda sudah menjadi anggota aktif di klan ini.');
    ELSE
      RETURN jsonb_build_object(
        'ok', false, 
        'requires_leave_first', true,
        'current_clan_id', v_active_membership.clan_id,
        'current_clan_name', v_active_membership.clan_name,
        'message', format('Anda masih tergabung dalam klan %s. Anda harus keluar dari klan saat ini terlebih dahulu.', v_active_membership.clan_name)
      );
    END IF;
  END IF;

  -- 3. Periksa apakah sudah ada permintaan pending di klan yang sama
  SELECT id INTO v_pending_request
  FROM public.rpg_clan_join_requests
  WHERE clan_id = p_clan_id
    AND user_id = p_user_id
    AND status = 'pending';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'is_pending', true,
      'request_id', v_pending_request.id,
      'message', 'Permintaan Anda sudah terkirim dan sedang menunggu konfirmasi pemimpin klan.'
    );
  END IF;

  -- 4. Buat permintaan bergabung baru (Pending)
  INSERT INTO public.rpg_clan_join_requests (
    clan_id,
    user_id,
    display_name,
    avatar_url,
    border_url,
    level,
    status
  ) VALUES (
    p_clan_id,
    p_user_id,
    COALESCE(NULLIF(p_display_name, ''), 'Petualang'),
    p_avatar_url,
    p_border_url,
    GREATEST(1, COALESCE(p_level, 1)),
    'pending'
  )
  RETURNING id INTO v_new_req_id;

  RETURN jsonb_build_object(
    'ok', true,
    'request_id', v_new_req_id,
    'message', format('Permintaan bergabung ke klan %s berhasil diajukan. Menunggu konfirmasi pemimpin klan.', v_clan.name)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC 2: rpc_respond_clan_join_request (Pemimpin Terima / Tolak Permintaan)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_respond_clan_join_request(
  p_request_id UUID,
  p_action TEXT, -- 'approve' | 'reject'
  p_actor_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req RECORD;
  v_clan RECORD;
  v_existing_membership RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Validasi request
  SELECT * INTO v_req
  FROM public.rpg_clan_join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Permintaan bergabung tidak ditemukan.');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'message', format('Permintaan ini sudah diproses sebelumnya (Status: %s).', v_req.status));
  END IF;

  -- 2. Validasi otorisasi pemimpin klan
  SELECT * INTO v_clan
  FROM public.rpg_clans
  WHERE id = v_req.clan_id
  FOR UPDATE;

  IF NOT FOUND OR v_clan.status = 'disbanded' THEN
    UPDATE public.rpg_clan_join_requests
    SET status = 'cancelled', updated_at = v_now
    WHERE id = p_request_id;
    RETURN jsonb_build_object('ok', false, 'message', 'Klan sudah tidak aktif atau telah dibubarkan.');
  END IF;

  IF v_clan.leader_id <> p_actor_user_id THEN
    -- Periksa apakah user memiliki role 'Wakil Pemimpin'
    IF NOT EXISTS (
      SELECT 1 FROM public.rpg_clan_members
      WHERE clan_id = v_req.clan_id
        AND user_id = p_actor_user_id
        AND role IN ('Pemimpin Klan', 'Wakil Pemimpin')
        AND status = 'active'
    ) THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Hanya Pemimpin atau Wakil Pemimpin klan yang berhak memproses permintaan ini.');
    END IF;
  END IF;

  -- 3. Eksekusi Tindakan: Tolak (Reject)
  IF LOWER(p_action) = 'reject' THEN
    UPDATE public.rpg_clan_join_requests
    SET status = 'rejected',
        reviewed_by = p_actor_user_id,
        reviewed_at = v_now,
        updated_at = v_now
    WHERE id = p_request_id;

    RETURN jsonb_build_object('ok', true, 'message', format('Permintaan dari %s telah ditolak.', v_req.display_name));
  END IF;

  -- 4. Eksekusi Tindakan: Terima (Approve)
  IF LOWER(p_action) = 'approve' THEN
    -- Cek kapasitas klan
    IF v_clan.member_count >= v_clan.max_members THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Kapasitas klan telah penuh (maksimal 100 anggota).');
    END IF;

    -- Cek apakah pemohon sudah terlanjur bergabung di klan lain
    SELECT clan_id INTO v_existing_membership
    FROM public.rpg_clan_members
    WHERE user_id = v_req.user_id
      AND status = 'active';

    IF FOUND THEN
      -- Batalkan permintaan karena pemohon sudah aktif di klan lain
      UPDATE public.rpg_clan_join_requests
      SET status = 'cancelled',
          reviewed_by = p_actor_user_id,
          reviewed_at = v_now,
          updated_at = v_now
      WHERE id = p_request_id;

      RETURN jsonb_build_object(
        'ok', false, 
        'message', format('Pengguna %s sudah tergabung di klan lain. Permintaan ini dibatalkan.', v_req.display_name)
      );
    END IF;

    -- Masukkan pengguna ke dalam rpg_clan_members sebagai anggota aktif
    INSERT INTO public.rpg_clan_members (
      clan_id,
      user_id,
      display_name,
      avatar_url,
      border_url,
      role,
      level,
      status,
      joined_at,
      last_active_at
    ) VALUES (
      v_req.clan_id,
      v_req.user_id,
      v_req.display_name,
      v_req.avatar_url,
      v_req.border_url,
      'Anggota',
      v_req.level,
      'active',
      v_now,
      v_now
    )
    ON CONFLICT (clan_id, user_id) DO UPDATE SET
      status = 'active',
      role = 'Anggota',
      left_at = NULL,
      last_active_at = v_now;

    -- Update status profil pengguna
    UPDATE public.rpg_user_profiles
    SET clan_id = v_req.clan_id,
        updated_at = v_now
    WHERE user_id = v_req.user_id;

    -- Tandai request ini sebagai 'approved'
    UPDATE public.rpg_clan_join_requests
    SET status = 'approved',
        reviewed_by = p_actor_user_id,
        reviewed_at = v_now,
        updated_at = v_now
    WHERE id = p_request_id;

    -- Batalkan semua permintaan pending lainnya dari user ini di klan lain
    UPDATE public.rpg_clan_join_requests
    SET status = 'cancelled',
        updated_at = v_now
    WHERE user_id = v_req.user_id
      AND id <> p_request_id
      AND status = 'pending';

    RETURN jsonb_build_object(
      'ok', true, 
      'message', format('%s resmi menjadi anggota klan %s!', v_req.display_name, v_clan.name)
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'message', 'Tindakan tidak valid. Gunakan approve atau reject.');
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. RPC 3: rpc_leave_clan (Anggota Keluar dari Klan)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_leave_clan(
  p_clan_id VARCHAR(64),
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clan RECORD;
  v_member RECORD;
  v_active_member_count INT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Validasi keanggotaan aktif
  SELECT * INTO v_member
  FROM public.rpg_clan_members
  WHERE clan_id = p_clan_id
    AND user_id = p_user_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Anda bukan anggota aktif di klan ini.');
  END IF;

  SELECT * INTO v_clan
  FROM public.rpg_clans
  WHERE id = p_clan_id
  FOR UPDATE;

  -- 2. Jika user adalah pemimpin klan
  IF v_clan.leader_id = p_user_id THEN
    -- Hitung anggota aktif lain
    SELECT COUNT(*) INTO v_active_member_count
    FROM public.rpg_clan_members
    WHERE clan_id = p_clan_id
      AND user_id <> p_user_id
      AND status = 'active';

    IF v_active_member_count > 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'is_leader', true,
        'has_other_members', true,
        'message', 'Sebagai Pemimpin Klan, Anda harus mengalihkan kepemimpinan terlebih dahulu sebelum keluar, atau bubarkan klan jika ingin mengakhiri klan.'
      );
    ELSE
      -- Pemimpin adalah satu-satunya anggota klan -> Jalankan pembubaran klan otomatis
      UPDATE public.rpg_clans
      SET status = 'disbanded',
          disbanded_at = v_now,
          disbanded_by = p_user_id,
          member_count = 0,
          updated_at = v_now
      WHERE id = p_clan_id;

      UPDATE public.rpg_clan_members
      SET status = 'left',
          left_at = v_now
      WHERE id = v_member.id;

      UPDATE public.rpg_user_profiles
      SET clan_id = NULL,
          updated_at = v_now
      WHERE user_id = p_user_id;

      -- Batalkan seluruh request pending untuk klan ini
      UPDATE public.rpg_clan_join_requests
      SET status = 'cancelled', updated_at = v_now
      WHERE clan_id = p_clan_id AND status = 'pending';

      RETURN jsonb_build_object(
        'ok', true,
        'disbanded', true,
        'message', format('Anda telah keluar dan klan %s berhasil dibubarkan karena tidak memiliki anggota lain.', v_clan.name)
      );
    END IF;
  END IF;

  -- 3. Anggota biasa keluar dari klan
  UPDATE public.rpg_clan_members
  SET status = 'left',
      left_at = v_now
  WHERE id = v_member.id;

  UPDATE public.rpg_user_profiles
  SET clan_id = NULL,
      updated_at = v_now
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', format('Anda berhasil keluar dari klan %s. Sekarang Anda dapat mengajukan bergabung ke klan lain.', v_clan.name)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. RPC 4: rpc_disband_clan (Pembubaran / Penghapusan Klan oleh Pemimpin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_disband_clan(
  p_clan_id VARCHAR(64),
  p_actor_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clan RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_affected_members INT;
BEGIN
  -- 1. Validasi klan dan hak akses pemimpin
  SELECT * INTO v_clan
  FROM public.rpg_clans
  WHERE id = p_clan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan tidak ditemukan.');
  END IF;

  IF v_clan.status = 'disbanded' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan ini sudah dibubarkan sebelumnya.');
  END IF;

  IF v_clan.leader_id <> p_actor_user_id THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Hanya Pemimpin Klan yang sah yang berhak membubarkan klan ini.');
  END IF;

  -- 2. Nonaktifkan seluruh keanggotaan aktif klan ini secara aman
  WITH updated AS (
    UPDATE public.rpg_clan_members
    SET status = 'removed',
        left_at = v_now
    WHERE clan_id = p_clan_id
      AND status = 'active'
    RETURNING id, user_id
  )
  SELECT COUNT(*) INTO v_affected_members FROM updated;

  -- 3. Lepaskan asosiasi klan di profil pengguna
  UPDATE public.rpg_user_profiles
  SET clan_id = NULL,
      updated_at = v_now
  WHERE clan_id = p_clan_id;

  -- 4. Batalkan semua permintaan bergabung yang masih pending
  UPDATE public.rpg_clan_join_requests
  SET status = 'cancelled',
      reviewed_by = p_actor_user_id,
      reviewed_at = v_now,
      updated_at = v_now
  WHERE clan_id = p_clan_id
    AND status = 'pending';

  -- 5. Tandai status klan sebagai 'disbanded'
  UPDATE public.rpg_clans
  SET status = 'disbanded',
      disbanded_at = v_now,
      disbanded_by = p_actor_user_id,
      member_count = 0,
      updated_at = v_now
  WHERE id = p_clan_id;

  RETURN jsonb_build_object(
    'ok', true,
    'affected_members', v_affected_members,
    'message', format('Klan %s berhasil dibubarkan. Semua %s anggota telah dinonaktifkan dan bebas bergabung ke klan lain.', v_clan.name, v_affected_members)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. RPC 5: rpc_transfer_clan_leadership (Alihkan Kepemimpinan Klan)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_transfer_clan_leadership(
  p_clan_id VARCHAR(64),
  p_current_leader_id TEXT,
  p_new_leader_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clan RECORD;
  v_new_leader RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_current_leader_id = p_new_leader_id THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Pemimpin baru tidak boleh sama dengan pemimpin saat ini.');
  END IF;

  -- Validasi klan dan pemimpin saat ini
  SELECT * INTO v_clan
  FROM public.rpg_clans
  WHERE id = p_clan_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Klan tidak ditemukan atau tidak aktif.');
  END IF;

  IF v_clan.leader_id <> p_current_leader_id THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Hanya Pemimpin Klan saat ini yang berhak mengalihkan kepemimpinan.');
  END IF;

  -- Validasi calon pemimpin baru harus anggota aktif di klan ini
  SELECT * INTO v_new_leader
  FROM public.rpg_clan_members
  WHERE clan_id = p_clan_id
    AND user_id = p_new_leader_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Calon pemimpin baru harus merupakan anggota aktif di klan ini.');
  END IF;

  -- Update tabel rpg_clans
  UPDATE public.rpg_clans
  SET leader_id = p_new_leader_id,
      leader_name = v_new_leader.display_name,
      updated_at = v_now
  WHERE id = p_clan_id;

  -- Update role pemimpin lama menjadi 'Anggota'
  UPDATE public.rpg_clan_members
  SET role = 'Anggota',
      last_active_at = v_now
  WHERE clan_id = p_clan_id
    AND user_id = p_current_leader_id
    AND status = 'active';

  -- Update role pemimpin baru menjadi 'Pemimpin Klan'
  UPDATE public.rpg_clan_members
  SET role = 'Pemimpin Klan',
      last_active_at = v_now
  WHERE clan_id = p_clan_id
    AND user_id = p_new_leader_id
    AND status = 'active';

  RETURN jsonb_build_object(
    'ok', true,
    'message', format('Kepemimpinan klan %s berhasil dialihkan kepada %s.', v_clan.name, v_new_leader.display_name)
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. RPC 6: rpc_cancel_clan_join_request (Pengguna Membatalkan Permintaan Sendiri)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_cancel_clan_join_request(
  p_clan_id VARCHAR(64),
  p_user_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.rpg_clan_join_requests
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE clan_id = p_clan_id
    AND user_id = p_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Tidak ada permintaan pending yang dapat dibatalkan.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'message', 'Permintaan bergabung berhasil dibatalkan.');
END;
$$;
