-- ==============================================================================
-- NUENIME - SISTEM AFINITAS (AFFINITY / SOCIAL BONDS) LENGKAP
-- File: supabase/migrations/20261123000000_affinity_system.sql
-- Mendukung:
-- 1. Pengaturan Privasi Afinitas (Publik, Teman, Privat)
-- 2. Ikatan Afinitas Aktif (Pasangan, Kepercayaan, Sahabat, Saudara)
-- 3. Undangan Ikatan (Pending, Terima, Tolak, Batal, Kedaluwarsa)
-- 4. Riwayat Ikatan & Pemutusan (Dibatalkan, Ditolak, Kedaluwarsa, Putus)
-- 5. Papan Peringkat (Top Afinitas) Berbasis Data Nyata (Real Profiles & XP)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABEL: USER_AFFINITY_SETTINGS (Pengaturan Privasi Profil Afinitas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_affinity_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  privacy TEXT NOT NULL DEFAULT 'publik' CHECK (privacy IN ('publik', 'teman', 'privat')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affinity_settings_privacy ON public.user_affinity_settings(privacy);

ALTER TABLE public.user_affinity_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read affinity settings" ON public.user_affinity_settings;
CREATE POLICY "Allow read affinity settings"
  ON public.user_affinity_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow user to update own affinity settings" ON public.user_affinity_settings;
CREATE POLICY "Allow user to update own affinity settings"
  ON public.user_affinity_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 2. TABEL: USER_AFFINITY_BONDS (Ikatan Afinitas Aktif Antar Pengguna)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_affinity_bonds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL CHECK (tier_id IN ('pasangan', 'orang_kepercayaan', 'sahabat', 'saudara')),
  slot_index INTEGER NOT NULL DEFAULT 0 CHECK (slot_index >= 0),
  xp INTEGER NOT NULL DEFAULT 150 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 30),
  streak_days INTEGER NOT NULL DEFAULT 1 CHECK (streak_days >= 1),
  paired_bond_id UUID, -- Referensi ke baris ikatan timbal balik di sisi friend_id
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_bonds_no_self CHECK (user_id <> friend_id),
  CONSTRAINT uq_user_tier_slot UNIQUE (user_id, tier_id, slot_index),
  CONSTRAINT uq_user_friend UNIQUE (user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_affinity_bonds_user ON public.user_affinity_bonds(user_id);
CREATE INDEX IF NOT EXISTS idx_affinity_bonds_friend ON public.user_affinity_bonds(friend_id);
CREATE INDEX IF NOT EXISTS idx_affinity_bonds_tier ON public.user_affinity_bonds(tier_id);
CREATE INDEX IF NOT EXISTS idx_affinity_bonds_xp ON public.user_affinity_bonds(tier_id, xp DESC);

-- Unique index simetris untuk memastikan tidak ada hubungan ganda A-B dan B-A dalam satu ikatan
CREATE UNIQUE INDEX IF NOT EXISTS uq_affinity_bonds_symmetric_pair
  ON public.user_affinity_bonds (LEAST(user_id, friend_id), GREATEST(user_id, friend_id), user_id);

ALTER TABLE public.user_affinity_bonds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read affinity bonds" ON public.user_affinity_bonds;
CREATE POLICY "Allow read affinity bonds"
  ON public.user_affinity_bonds FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow user to manage own affinity bonds" ON public.user_affinity_bonds;
CREATE POLICY "Allow user to manage own affinity bonds"
  ON public.user_affinity_bonds FOR ALL
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

-- ------------------------------------------------------------------------------
-- 3. TABEL: USER_AFFINITY_INVITES (Undangan Ikatan Afinitas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_affinity_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL CHECK (tier_id IN ('pasangan', 'orang_kepercayaan', 'sahabat', 'saudara')),
  slot_index INTEGER NOT NULL DEFAULT 0 CHECK (slot_index >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_invites_no_self CHECK (sender_id <> receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_affinity_invites_sender ON public.user_affinity_invites(sender_id);
CREATE INDEX IF NOT EXISTS idx_affinity_invites_receiver ON public.user_affinity_invites(receiver_id);
CREATE INDEX IF NOT EXISTS idx_affinity_invites_status ON public.user_affinity_invites(status);

-- Anti Duplikasi: Hanya boleh ada 1 ajakan 'pending' aktif antar pasangan pengguna yang sama
CREATE UNIQUE INDEX IF NOT EXISTS uq_affinity_pending_pair
  ON public.user_affinity_invites (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id))
  WHERE status = 'pending';

ALTER TABLE public.user_affinity_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read affinity invites" ON public.user_affinity_invites;
CREATE POLICY "Allow read affinity invites"
  ON public.user_affinity_invites FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Allow sender to insert affinity invites" ON public.user_affinity_invites;
CREATE POLICY "Allow sender to insert affinity invites"
  ON public.user_affinity_invites FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Allow parties to update affinity invites" ON public.user_affinity_invites;
CREATE POLICY "Allow parties to update affinity invites"
  ON public.user_affinity_invites FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ------------------------------------------------------------------------------
-- 4. TABEL: USER_AFFINITY_HISTORY (Riwayat Ajakan & Pemutusan Ikatan)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_affinity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL CHECK (tier_id IN ('pasangan', 'orang_kepercayaan', 'sahabat', 'saudara')),
  category TEXT NOT NULL CHECK (category IN ('dibatalkan', 'ditolak', 'kedaluwarsa', 'putus')),
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affinity_history_user ON public.user_affinity_history(user_id, created_at DESC);

ALTER TABLE public.user_affinity_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user to read own affinity history" ON public.user_affinity_history;
CREATE POLICY "Allow user to read own affinity history"
  ON public.user_affinity_history FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = target_user_id);

DROP POLICY IF EXISTS "Allow insert affinity history" ON public.user_affinity_history;
CREATE POLICY "Allow insert affinity history"
  ON public.user_affinity_history FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() = target_user_id);

-- ------------------------------------------------------------------------------
-- 5. HELPER: BATAS MAKSIMUM SLOT PER TIER AFINITAS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_affinity_tier_max_slots(p_tier_id TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tier_id
    WHEN 'pasangan' THEN 1
    WHEN 'orang_kepercayaan' THEN 5
    WHEN 'sahabat' THEN 4
    WHEN 'saudara' THEN 4
    ELSE 0
  END;
$$;

-- ------------------------------------------------------------------------------
-- 6. TRIGGERS: PENEGAKAN KEAMANAN DATABASE (SLOT LIMIT & ANTI DUPLIKASI)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_affinity_slot_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_slots INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Cegah relasi dengan diri sendiri
  IF NEW.user_id = NEW.friend_id THEN
    RAISE EXCEPTION 'Tidak dapat membuat hubungan afinitas dengan diri sendiri.';
  END IF;

  -- Ambil batas slot untuk tier tersebut
  v_max_slots := public.get_affinity_tier_max_slots(NEW.tier_id);
  
  -- Hitung ikatan aktif yang sudah dimiliki pengguna pada tier ini (kecuali baris yang sedang diupdate)
  SELECT COUNT(*) INTO v_current_count
  FROM public.user_affinity_bonds
  WHERE user_id = NEW.user_id
    AND tier_id = NEW.tier_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF v_current_count >= v_max_slots THEN
    RAISE EXCEPTION 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_affinity_bonds_slot_limit ON public.user_affinity_bonds;
CREATE TRIGGER trg_check_affinity_bonds_slot_limit
  BEFORE INSERT OR UPDATE OF slot_index, tier_id
  ON public.user_affinity_bonds
  FOR EACH ROW
  EXECUTE FUNCTION public.check_affinity_slot_limit_trigger();

CREATE OR REPLACE FUNCTION public.check_affinity_invite_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_slots INTEGER;
  v_sender_bonds INTEGER;
  v_receiver_bonds INTEGER;
BEGIN
  -- 1. Cegah invite ke diri sendiri
  IF NEW.sender_id = NEW.receiver_id THEN
    RAISE EXCEPTION 'Tidak dapat mengundang diri sendiri.';
  END IF;

  -- Hanya periksa saat status 'pending'
  IF NEW.status = 'pending' THEN
    -- 2. Cek apakah sudah ada ikatan aktif antara kedua user
    IF EXISTS (
      SELECT 1 FROM public.user_affinity_bonds
      WHERE (user_id = NEW.sender_id AND friend_id = NEW.receiver_id)
         OR (user_id = NEW.receiver_id AND friend_id = NEW.sender_id)
    ) THEN
      RAISE EXCEPTION 'Kalian sudah memiliki Afinitas Persahabatan.';
    END IF;

    -- 3. Batas slot tier
    v_max_slots := public.get_affinity_tier_max_slots(NEW.tier_id);

    -- Cek slot pengirim
    SELECT COUNT(*) INTO v_sender_bonds
    FROM public.user_affinity_bonds
    WHERE user_id = NEW.sender_id AND tier_id = NEW.tier_id;

    IF v_sender_bonds >= v_max_slots THEN
      RAISE EXCEPTION 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.';
    END IF;

    -- Cek slot penerima
    SELECT COUNT(*) INTO v_receiver_bonds
    FROM public.user_affinity_bonds
    WHERE user_id = NEW.receiver_id AND tier_id = NEW.tier_id;

    IF v_receiver_bonds >= v_max_slots THEN
      RAISE EXCEPTION 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_affinity_invites_safety ON public.user_affinity_invites;
CREATE TRIGGER trg_check_affinity_invites_safety
  BEFORE INSERT OR UPDATE OF status, tier_id
  ON public.user_affinity_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.check_affinity_invite_trigger();

-- ------------------------------------------------------------------------------
-- 7. RPC: KIRIM AJAKAN AFINITAS DENGAN VALIDASI ATOMIK & ANTI-DUPLIKASI
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_affinity_invite_atomic(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_tier_id TEXT,
  p_slot_index INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_slots INTEGER;
  v_sender_bonds INTEGER;
  v_receiver_bonds INTEGER;
  v_sender_pending_sent INTEGER;
  v_invite_id UUID;
  v_chosen_slot INTEGER;
BEGIN
  -- 1. Validasi relasi dengan diri sendiri
  IF p_sender_id = p_receiver_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SELF_RELATION',
      'message', 'Tidak dapat membuat hubungan afinitas dengan diri sendiri.'
    );
  END IF;

  -- 2. Advisory lock terurut untuk mencegah race condition dua akun sekaligus
  PERFORM pg_advisory_xact_lock(hashtext('affinity_' || LEAST(p_sender_id, p_receiver_id)::text));
  PERFORM pg_advisory_xact_lock(hashtext('affinity_' || GREATEST(p_sender_id, p_receiver_id)::text));

  -- 3. Cek apakah kedua akun sudah memiliki hubungan afinitas (Dua Arah)
  IF EXISTS (
    SELECT 1 FROM public.user_affinity_bonds
    WHERE (user_id = p_sender_id AND friend_id = p_receiver_id)
       OR (user_id = p_receiver_id AND friend_id = p_sender_id)
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ALREADY_CONNECTED',
      'message', 'Kalian sudah memiliki Afinitas Persahabatan.'
    );
  END IF;

  -- 4. Cek apakah sudah ada ajakan pending yang aktif antara kedua akun
  IF EXISTS (
    SELECT 1 FROM public.user_affinity_invites
    WHERE status = 'pending'
      AND ((sender_id = p_sender_id AND receiver_id = p_receiver_id)
        OR (sender_id = p_receiver_id AND receiver_id = p_sender_id))
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVITE_EXISTS',
      'message', 'Permintaan afinitas antar kedua akun masih menunggu respon.'
    );
  END IF;

  -- 5. Validasi batas slot tier
  v_max_slots := public.get_affinity_tier_max_slots(p_tier_id);
  IF v_max_slots <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_TIER',
      'message', 'Tier afinitas tidak valid.'
    );
  END IF;

  -- Cek slot Akun A (Pengirim): ikatan aktif + ajakan terkirim yang pending di tier ini
  SELECT COUNT(*) INTO v_sender_bonds
  FROM public.user_affinity_bonds
  WHERE user_id = p_sender_id AND tier_id = p_tier_id;

  SELECT COUNT(*) INTO v_sender_pending_sent
  FROM public.user_affinity_invites
  WHERE sender_id = p_sender_id AND tier_id = p_tier_id AND status = 'pending';

  IF (v_sender_bonds + v_sender_pending_sent) >= v_max_slots THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SLOT_FULL',
      'message', 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.'
    );
  END IF;

  -- Cek slot Akun B (Penerima): ikatan aktif di tier ini
  SELECT COUNT(*) INTO v_receiver_bonds
  FROM public.user_affinity_bonds
  WHERE user_id = p_receiver_id AND tier_id = p_tier_id;

  IF v_receiver_bonds >= v_max_slots THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SLOT_FULL',
      'message', 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.'
    );
  END IF;

  -- 6. Tentukan slot_index kosong terkecil untuk pengirim
  v_chosen_slot := COALESCE(p_slot_index, 0);
  IF EXISTS (
    SELECT 1 FROM public.user_affinity_bonds
    WHERE user_id = p_sender_id AND tier_id = p_tier_id AND slot_index = v_chosen_slot
  ) OR EXISTS (
    SELECT 1 FROM public.user_affinity_invites
    WHERE sender_id = p_sender_id AND tier_id = p_tier_id AND slot_index = v_chosen_slot AND status = 'pending'
  ) THEN
    -- Cari slot kosong pertama dari 0 .. v_max_slots - 1
    SELECT s.idx INTO v_chosen_slot
    FROM generate_series(0, v_max_slots - 1) AS s(idx)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_affinity_bonds
      WHERE user_id = p_sender_id AND tier_id = p_tier_id AND slot_index = s.idx
    ) AND NOT EXISTS (
      SELECT 1 FROM public.user_affinity_invites
      WHERE sender_id = p_sender_id AND tier_id = p_tier_id AND slot_index = s.idx AND status = 'pending'
    )
    ORDER BY s.idx ASC
    LIMIT 1;
  END IF;

  IF v_chosen_slot IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SLOT_FULL',
      'message', 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.'
    );
  END IF;

  -- 7. Insert ajakan afinitas
  INSERT INTO public.user_affinity_invites (
    sender_id,
    receiver_id,
    tier_id,
    slot_index,
    status
  ) VALUES (
    p_sender_id,
    p_receiver_id,
    p_tier_id,
    v_chosen_slot,
    'pending'
  ) RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'INVITE_SENT',
    'invite_id', v_invite_id,
    'message', 'Ajakan afinitas berhasil dikirim.'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. RPC: TERIMA AJAKAN AFINITAS DENGAN TRANSAKSI ATOMIK, VALIDASI DUA ARAH, & PESAN RESMI
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_affinity_invite_atomic(
  p_invite_id UUID,
  p_receiver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite RECORD;
  v_max_slots INTEGER;
  v_sender_bonds INTEGER;
  v_receiver_bonds INTEGER;
  v_sender_slot INTEGER;
  v_receiver_slot INTEGER;
  v_bond_a_id UUID;
  v_bond_b_id UUID;
BEGIN
  -- 1. Kunci baris ajakan agar tidak diproses ganda
  SELECT * INTO v_invite
  FROM public.user_affinity_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Ajakan afinitas tidak ditemukan.'
    );
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ALREADY_PROCESSED',
      'message', 'Ajakan afinitas sudah diproses sebelumnya.'
    );
  END IF;

  -- Pastikan hanya penerima resmi yang bisa menerima ajakan
  IF v_invite.receiver_id <> p_receiver_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHORIZED',
      'message', 'Kamu tidak berhak menerima ajakan ini.'
    );
  END IF;

  -- 2. Kunci transaksi kedua user secara terurut untuk mencegah race conditions
  PERFORM pg_advisory_xact_lock(hashtext('affinity_' || LEAST(v_invite.sender_id, v_invite.receiver_id)::text));
  PERFORM pg_advisory_xact_lock(hashtext('affinity_' || GREATEST(v_invite.sender_id, v_invite.receiver_id)::text));

  -- 3. Cek apakah kedua akun sudah memiliki hubungan afinitas
  IF EXISTS (
    SELECT 1 FROM public.user_affinity_bonds
    WHERE (user_id = v_invite.sender_id AND friend_id = v_invite.receiver_id)
       OR (user_id = v_invite.receiver_id AND friend_id = v_invite.sender_id)
  ) THEN
    -- Update status invite ke accepted agar bersih
    UPDATE public.user_affinity_invites
    SET status = 'accepted', updated_at = NOW()
    WHERE id = p_invite_id;

    RETURN jsonb_build_object(
      'success', false,
      'code', 'ALREADY_CONNECTED',
      'message', 'Kalian sudah memiliki Afinitas Persahabatan.'
    );
  END IF;

  -- 4. Validasi slot kedua akun secara ketat
  v_max_slots := public.get_affinity_tier_max_slots(v_invite.tier_id);

  -- Hitung slot aktif Akun A (Pengirim)
  SELECT COUNT(*) INTO v_sender_bonds
  FROM public.user_affinity_bonds
  WHERE user_id = v_invite.sender_id AND tier_id = v_invite.tier_id;

  IF v_sender_bonds >= v_max_slots THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SLOT_FULL',
      'message', 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.'
    );
  END IF;

  -- Hitung slot aktif Akun B (Penerima)
  SELECT COUNT(*) INTO v_receiver_bonds
  FROM public.user_affinity_bonds
  WHERE user_id = v_invite.receiver_id AND tier_id = v_invite.tier_id;

  IF v_receiver_bonds >= v_max_slots THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SLOT_FULL',
      'message', 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.'
    );
  END IF;

  -- 5. Tentukan slot_index pengirim
  v_sender_slot := v_invite.slot_index;
  IF EXISTS (
    SELECT 1 FROM public.user_affinity_bonds
    WHERE user_id = v_invite.sender_id AND tier_id = v_invite.tier_id AND slot_index = v_sender_slot
  ) THEN
    SELECT s.idx INTO v_sender_slot
    FROM generate_series(0, v_max_slots - 1) AS s(idx)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_affinity_bonds
      WHERE user_id = v_invite.sender_id AND tier_id = v_invite.tier_id AND slot_index = s.idx
    )
    ORDER BY s.idx ASC
    LIMIT 1;
  END IF;

  -- 6. Tentukan slot_index penerima
  SELECT s.idx INTO v_receiver_slot
  FROM generate_series(0, v_max_slots - 1) AS s(idx)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_affinity_bonds
    WHERE user_id = v_invite.receiver_id AND tier_id = v_invite.tier_id AND slot_index = s.idx
  )
  ORDER BY s.idx ASC
  LIMIT 1;

  IF v_sender_slot IS NULL OR v_receiver_slot IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SLOT_FULL',
      'message', 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.'
    );
  END IF;

  -- 7. Buat hubungan dua arah secara atomik dalam satu transaksi
  INSERT INTO public.user_affinity_bonds (
    user_id,
    friend_id,
    tier_id,
    slot_index,
    xp,
    level,
    streak_days
  ) VALUES (
    v_invite.sender_id,
    v_invite.receiver_id,
    v_invite.tier_id,
    v_sender_slot,
    150,
    1,
    1
  ) RETURNING id INTO v_bond_a_id;

  INSERT INTO public.user_affinity_bonds (
    user_id,
    friend_id,
    tier_id,
    slot_index,
    xp,
    level,
    streak_days,
    paired_bond_id
  ) VALUES (
    v_invite.receiver_id,
    v_invite.sender_id,
    v_invite.tier_id,
    v_receiver_slot,
    150,
    1,
    1,
    v_bond_a_id
  ) RETURNING id INTO v_bond_b_id;

  -- Tautkan balik paired_bond_id ke ikatan A
  UPDATE public.user_affinity_bonds
  SET paired_bond_id = v_bond_b_id
  WHERE id = v_bond_a_id;

  -- 8. Tandai ajakan sebagai accepted dan batalkan ajakan pending ganda lainnya antar kedua user
  UPDATE public.user_affinity_invites
  SET status = 'accepted', updated_at = NOW()
  WHERE id = p_invite_id;

  UPDATE public.user_affinity_invites
  SET status = 'cancelled', updated_at = NOW()
  WHERE status = 'pending'
    AND id <> p_invite_id
    AND ((sender_id = v_invite.sender_id AND receiver_id = v_invite.receiver_id)
      OR (sender_id = v_invite.receiver_id AND receiver_id = v_invite.sender_id));

  -- 9. Kembalikan pesan sistem resmi yang diminta
  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Tautan Afinitas Persahabatan berhasil dibuat!',
    'bond_a_id', v_bond_a_id,
    'bond_b_id', v_bond_b_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. RPC: PEMBUATAN IKATAN LANGSUNG (ATOMIC BILATERAL BOND CREATION)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_affinity_bond_atomic(
  p_user_a UUID,
  p_user_b UUID,
  p_tier_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_slots INTEGER;
  v_count_a INTEGER;
  v_count_b INTEGER;
  v_slot_a INTEGER;
  v_slot_b INTEGER;
  v_bond_a_id UUID;
  v_bond_b_id UUID;
BEGIN
  IF p_user_a = p_user_b THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SELF_RELATION',
      'message', 'Tidak dapat membuat hubungan afinitas dengan diri sendiri.'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('affinity_' || LEAST(p_user_a, p_user_b)::text));
  PERFORM pg_advisory_xact_lock(hashtext('affinity_' || GREATEST(p_user_a, p_user_b)::text));

  IF EXISTS (
    SELECT 1 FROM public.user_affinity_bonds
    WHERE (user_id = p_user_a AND friend_id = p_user_b)
       OR (user_id = p_user_b AND friend_id = p_user_a)
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ALREADY_CONNECTED',
      'message', 'Kalian sudah memiliki Afinitas Persahabatan.'
    );
  END IF;

  v_max_slots := public.get_affinity_tier_max_slots(p_tier_id);
  IF v_max_slots <= 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_TIER', 'message', 'Tier afinitas tidak valid.');
  END IF;

  SELECT COUNT(*) INTO v_count_a FROM public.user_affinity_bonds WHERE user_id = p_user_a AND tier_id = p_tier_id;
  SELECT COUNT(*) INTO v_count_b FROM public.user_affinity_bonds WHERE user_id = p_user_b AND tier_id = p_tier_id;

  IF v_count_a >= v_max_slots OR v_count_b >= v_max_slots THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SLOT_FULL',
      'message', 'Afinitas Persahabatan tidak dapat dibuat karena salah satu akun sudah mencapai batas slot.'
    );
  END IF;

  SELECT s.idx INTO v_slot_a
  FROM generate_series(0, v_max_slots - 1) AS s(idx)
  WHERE NOT EXISTS (SELECT 1 FROM public.user_affinity_bonds WHERE user_id = p_user_a AND tier_id = p_tier_id AND slot_index = s.idx)
  ORDER BY s.idx ASC LIMIT 1;

  SELECT s.idx INTO v_slot_b
  FROM generate_series(0, v_max_slots - 1) AS s(idx)
  WHERE NOT EXISTS (SELECT 1 FROM public.user_affinity_bonds WHERE user_id = p_user_b AND tier_id = p_tier_id AND slot_index = s.idx)
  ORDER BY s.idx ASC LIMIT 1;

  INSERT INTO public.user_affinity_bonds (user_id, friend_id, tier_id, slot_index, xp, level, streak_days)
  VALUES (p_user_a, p_user_b, p_tier_id, v_slot_a, 150, 1, 1) RETURNING id INTO v_bond_a_id;

  INSERT INTO public.user_affinity_bonds (user_id, friend_id, tier_id, slot_index, xp, level, streak_days, paired_bond_id)
  VALUES (p_user_b, p_user_a, p_tier_id, v_slot_b, 150, 1, 1, v_bond_a_id) RETURNING id INTO v_bond_b_id;

  UPDATE public.user_affinity_bonds SET paired_bond_id = v_bond_b_id WHERE id = v_bond_a_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Tautan Afinitas Persahabatan berhasil dibuat!'
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. FUNCTION & RPC: INTERAKSI BOOST XP IKATAN (TIMBAL BALIK KEDUA BELAH PIHAK)
-- Aturan: 1 hari hanya 1x untuk satu akun, sapaan memberikan +200 XP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boost_affinity_bond_xp(
  p_bond_id UUID,
  p_xp_gain INTEGER DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_new_streak INTEGER;
  v_paired_id UUID;
  v_gain INTEGER;
BEGIN
  v_gain := COALESCE(p_xp_gain, 200);

  -- Ambil data bond
  SELECT * INTO v_bond
  FROM public.user_affinity_bonds
  WHERE id = p_bond_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NOT_FOUND',
      'message', 'Ikatan afinitas tidak ditemukan.'
    );
  END IF;

  -- 1 HARI HANYA 1X UNTUK SATU AKUN:
  -- Cek apakah sapaan sudah dikirim hari ini (Asia/Jakarta / WIB)
  IF v_bond.last_interaction_at IS NOT NULL AND 
     (v_bond.last_interaction_at AT TIME ZONE 'Asia/Jakarta')::DATE = (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ALREADY_GREETED_TODAY',
      'message', 'Sapaan sudah dikirim hari ini. Kamu hanya dapat menyapa 1x sehari untuk akun ini.'
    );
  END IF;

  -- Hitung level baru (clamp 1-30)
  v_new_xp := v_bond.xp + v_gain;
  v_new_level := LEAST(30, FLOOR(v_new_xp / 800) + 1);
  v_new_streak := v_bond.streak_days + 1;
  v_paired_id := v_bond.paired_bond_id;

  -- Update bond pengguna
  UPDATE public.user_affinity_bonds
  SET xp = v_new_xp,
      level = v_new_level,
      streak_days = v_new_streak,
      last_interaction_at = NOW(),
      updated_at = NOW()
  WHERE id = p_bond_id;

  -- Update juga bond timbal balik pasangannya jika ada
  IF v_paired_id IS NOT NULL THEN
    UPDATE public.user_affinity_bonds
    SET xp = v_new_xp,
        level = v_new_level,
        streak_days = v_new_streak,
        last_interaction_at = NOW(),
        updated_at = NOW()
    WHERE id = v_paired_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'SUCCESS',
    'message', 'Sapaan berhasil dikirim! (+200 XP)',
    'xp', v_new_xp,
    'level', v_new_level,
    'streak', v_new_streak
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. FUNCTION & RPC: PUTUS IKATAN AFINITAS (MENGHAPUS DUA ARAH & CATAT RIWAYAT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.break_affinity_bond(
  p_bond_id UUID,
  p_reason TEXT DEFAULT 'Ikatan diakhiri.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bond RECORD;
  v_paired_id UUID;
BEGIN
  SELECT * INTO v_bond
  FROM public.user_affinity_bonds
  WHERE id = p_bond_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ikatan afinitas tidak ditemukan.');
  END IF;

  v_paired_id := v_bond.paired_bond_id;

  -- Catat riwayat putus untuk kedua belah pihak
  INSERT INTO public.user_affinity_history (user_id, target_user_id, tier_id, category, reason)
  VALUES
    (v_bond.user_id, v_bond.friend_id, v_bond.tier_id, 'putus', p_reason),
    (v_bond.friend_id, v_bond.user_id, v_bond.tier_id, 'putus', p_reason);

  -- Hapus ikatan dari kedua belah pihak
  DELETE FROM public.user_affinity_bonds WHERE id = p_bond_id;
  IF v_paired_id IS NOT NULL THEN
    DELETE FROM public.user_affinity_bonds WHERE id = v_paired_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. FUNCTION & RPC: GET TOP AFINITAS LEADERBOARD BERBASIS DATA PROFIL NYATA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_affinity_leaderboard(
  p_tier_id TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  bond_id UUID,
  tier_id TEXT,
  user_a_id UUID,
  user_a_name TEXT,
  user_a_avatar TEXT,
  user_a_border TEXT,
  user_a_initial TEXT,
  user_b_id UUID,
  user_b_name TEXT,
  user_b_avatar TEXT,
  user_b_border TEXT,
  user_b_initial TEXT,
  duo_title TEXT,
  level INTEGER,
  xp INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH paired_bonds AS (
    -- Ambil pasangan unik berdasarkan LEAST & GREATEST agar tidak duplikat A-B dan B-A
    SELECT DISTINCT ON (LEAST(b.user_id, b.friend_id), GREATEST(b.user_id, b.friend_id), b.tier_id)
      b.id AS b_id,
      b.tier_id AS b_tier,
      LEAST(b.user_id, b.friend_id) AS u_a,
      GREATEST(b.user_id, b.friend_id) AS u_b,
      b.level AS b_level,
      b.xp AS b_xp
    FROM public.user_affinity_bonds b
    LEFT JOIN public.user_affinity_settings s_a ON s_a.user_id = LEAST(b.user_id, b.friend_id)
    LEFT JOIN public.user_affinity_settings s_b ON s_b.user_id = GREATEST(b.user_id, b.friend_id)
    WHERE b.tier_id = p_tier_id
      AND COALESCE(s_a.privacy, 'publik') = 'publik'
      AND COALESCE(s_b.privacy, 'publik') = 'publik'
    ORDER BY LEAST(b.user_id, b.friend_id), GREATEST(b.user_id, b.friend_id), b.tier_id, b.xp DESC
  )
  SELECT
    cte.b_id AS bond_id,
    cte.b_tier AS tier_id,
    cte.u_a AS user_a_id,
    COALESCE(prof_a.display_name, prof_a.username, 'Pengguna')::TEXT AS user_a_name,
    COALESCE(prof_a.avatar_url, '')::TEXT AS user_a_avatar,
    COALESCE(prof_a.equipped_border, '')::TEXT AS user_a_border,
    UPPER(LEFT(COALESCE(prof_a.display_name, prof_a.username, 'A'), 1))::TEXT AS user_a_initial,
    cte.u_b AS user_b_id,
    COALESCE(prof_b.display_name, prof_b.username, 'Pengguna')::TEXT AS user_b_name,
    COALESCE(prof_b.avatar_url, '')::TEXT AS user_b_avatar,
    COALESCE(prof_b.equipped_border, '')::TEXT AS user_b_border,
    UPPER(LEFT(COALESCE(prof_b.display_name, prof_b.username, 'B'), 1))::TEXT AS user_b_initial,
    (COALESCE(prof_a.display_name, prof_a.username, 'Pengguna') || ' & ' || COALESCE(prof_b.display_name, prof_b.username, 'Pengguna'))::TEXT AS duo_title,
    cte.b_level AS level,
    cte.b_xp AS xp
  FROM paired_bonds cte
  LEFT JOIN public.profiles prof_a ON prof_a.id = cte.u_a
  LEFT JOIN public.profiles prof_b ON prof_b.id = cte.u_b
  ORDER BY cte.b_xp DESC, cte.b_level DESC
  LIMIT p_limit;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. PERMISSIONS & GRANTS
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_top_affinity_leaderboard(TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.send_affinity_invite_atomic(UUID, UUID, TEXT, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_affinity_invite_atomic(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_affinity_bond_atomic(UUID, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.boost_affinity_bond_xp(UUID, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.break_affinity_bond(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_affinity_tier_max_slots(TEXT) TO anon, authenticated, service_role;

