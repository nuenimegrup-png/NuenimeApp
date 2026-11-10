-- ==============================================================================
-- NUENIME - SISTEM LELANG & BIDDING REAL-TIME LENGKAP
-- Menghubungkan lelang dengan katalog avatar_borders_config & gacha_banners
-- Mendukung penawaran real-time, reservasi Crystal aman, pemenang, dan klaim hadiah.
-- ==============================================================================

-- 1. TABEL: LELANG_ITEMS (Koleksi Lelang Aktif / Terjadwal / Selesai)
CREATE TABLE IF NOT EXISTS public.lelang_items (
  id                   TEXT PRIMARY KEY,
  title                TEXT NOT NULL,
  item_type            TEXT NOT NULL CHECK (item_type IN ('banner', 'border')),
  source_id            TEXT NOT NULL, -- ID dari avatar_borders_config atau gacha_banners
  rarity               TEXT NOT NULL,
  start_price          INTEGER NOT NULL DEFAULT 500 CHECK (start_price >= 0),
  current_bid          INTEGER NOT NULL DEFAULT 500 CHECK (current_bid >= start_price),
  min_increment        INTEGER NOT NULL DEFAULT 100 CHECK (min_increment > 0),
  duration_hours       INTEGER NOT NULL DEFAULT 4 CHECK (duration_hours > 0),
  starts_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  ends_at              TIMESTAMPTZ NOT NULL,
  highest_bidder_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  highest_bidder_name  TEXT,
  total_bidders        INTEGER NOT NULL DEFAULT 0 CHECK (total_bidders >= 0),
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'scheduled', 'ended', 'cancelled')),
  description          TEXT DEFAULT '',
  accent_color         TEXT NOT NULL DEFAULT '#EF4444',
  glow_color           TEXT NOT NULL DEFAULT 'rgba(239, 68, 68, 0.4)',
  image_url            TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lelang_items_status ON public.lelang_items(status);
CREATE INDEX IF NOT EXISTS idx_lelang_items_ends_at ON public.lelang_items(ends_at);
CREATE INDEX IF NOT EXISTS idx_lelang_items_source ON public.lelang_items(source_id);

-- 2. TABEL: LELANG_BIDS (Riwayat Semua Penawaran Real-Time)
CREATE TABLE IF NOT EXISTS public.lelang_bids (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     TEXT NOT NULL REFERENCES public.lelang_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name   TEXT NOT NULL,
  bid_amount  INTEGER NOT NULL CHECK (bid_amount > 0),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lelang_bids_item ON public.lelang_bids(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lelang_bids_user ON public.lelang_bids(user_id);

-- 3. TABEL: LELANG_WINNERS (Pemenang Resmi Lelang & Status Pembayaran / Klaim Hadiah)
CREATE TABLE IF NOT EXISTS public.lelang_winners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         TEXT NOT NULL REFERENCES public.lelang_items(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  winner_name     TEXT NOT NULL,
  final_price     INTEGER NOT NULL CHECK (final_price > 0),
  is_claimed      BOOLEAN NOT NULL DEFAULT FALSE,
  claim_deadline  TIMESTAMPTZ NOT NULL,
  claimed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lelang_winners_user ON public.lelang_winners(user_id);
CREATE INDEX IF NOT EXISTS idx_lelang_winners_claimed ON public.lelang_winners(is_claimed);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.lelang_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lelang_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lelang_winners ENABLE ROW LEVEL SECURITY;

-- lelang_items: Siapapun dapat membaca (SELECT), hanya authenticated/admin yang bisa insert/update
DROP POLICY IF EXISTS "allow_public_read_lelang_items" ON public.lelang_items;
CREATE POLICY "allow_public_read_lelang_items"
  ON public.lelang_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "allow_all_manage_lelang_items" ON public.lelang_items;
CREATE POLICY "allow_all_manage_lelang_items"
  ON public.lelang_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- lelang_bids: Siapapun dapat melihat riwayat tawaran, pengguna terautentikasi dapat menawar
DROP POLICY IF EXISTS "allow_public_read_lelang_bids" ON public.lelang_bids;
CREATE POLICY "allow_public_read_lelang_bids"
  ON public.lelang_bids
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "allow_user_insert_lelang_bids" ON public.lelang_bids;
CREATE POLICY "allow_user_insert_lelang_bids"
  ON public.lelang_bids
  FOR INSERT
  WITH CHECK (true);

-- lelang_winners: Siapapun dapat melihat pemenang lelang
DROP POLICY IF EXISTS "allow_public_read_lelang_winners" ON public.lelang_winners;
CREATE POLICY "allow_public_read_lelang_winners"
  ON public.lelang_winners
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "allow_manage_lelang_winners" ON public.lelang_winners;
CREATE POLICY "allow_manage_lelang_winners"
  ON public.lelang_winners
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- STORED PROCEDURES & RPC FUNCTIONS
-- ==============================================================================

-- 1. RPC: place_lelang_bid (Memasang tawaran lelang dengan verifikasi saldo Crystal)
CREATE OR REPLACE FUNCTION public.place_lelang_bid(
  p_item_id    TEXT,
  p_bid_amount INTEGER,
  p_user_id    UUID,
  p_user_name  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_user_balance INTEGER;
  v_new_bidders INTEGER;
BEGIN
  -- 1. Kunci dan ambil data item lelang
  PERFORM 1
  FROM public.lelang_items
  WHERE id = p_item_id
  FOR UPDATE;

  SELECT * INTO v_item
  FROM public.lelang_items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item lelang tidak ditemukan.');
  END IF;

  IF v_item.status <> 'active' OR v_item.ends_at <= NOW() THEN
    -- Otomatis update status ke ended bila sudah lewat waktu
    UPDATE public.lelang_items SET status = 'ended' WHERE id = p_item_id;
    RETURN jsonb_build_object('success', false, 'error', 'Sesi lelang untuk item ini telah berakhir.');
  END IF;

  -- Anti Double-Bidding: Pengguna yang sudah memegang tawaran tertinggi tidak boleh menawar lagi sampai ada penawar lain
  IF (v_item.highest_bidder_id IS NOT NULL AND v_item.highest_bidder_id = p_user_id)
     OR (v_item.highest_bidder_name IS NOT NULL AND LOWER(TRIM(v_item.highest_bidder_name)) = LOWER(TRIM(p_user_name))) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Anda saat ini sudah memegang penawaran tertinggi! Anda tidak dapat menawar lagi sampai ada peserta lain yang menaikkan harga lelang.'
    );
  END IF;

  IF p_bid_amount < (v_item.current_bid + v_item.min_increment) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Penawaran harus minimal ' || (v_item.current_bid + v_item.min_increment) || ' Crystal.'
    );
  END IF;

  -- 2. Cek saldo Crystal pengguna di user_balances (menggunakan assignment langsung yang aman)
  v_user_balance := (
    SELECT crystal_balance
    FROM public.user_balances
    WHERE user_id = p_user_id
    LIMIT 1
  );

  IF v_user_balance IS NULL OR v_user_balance < p_bid_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Saldo Crystal tidak mencukupi (' || COALESCE(v_user_balance, 0) || ' Crystal). Dibutuhkan ' || p_bid_amount || ' Crystal.'
    );
  END IF;

  -- 3. Catat bid baru ke lelang_bids
  INSERT INTO public.lelang_bids (item_id, user_id, user_name, bid_amount)
  VALUES (p_item_id, p_user_id, p_user_name, p_bid_amount);

  -- Hitung total penawar unik
  SELECT COUNT(DISTINCT user_id) INTO v_new_bidders
  FROM public.lelang_bids
  WHERE item_id = p_item_id;

  -- 4. Update data item lelang
  UPDATE public.lelang_items
  SET
    current_bid = p_bid_amount,
    highest_bidder_id = p_user_id,
    highest_bidder_name = p_user_name,
    total_bidders = v_new_bidders,
    updated_at = NOW()
  WHERE id = p_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Tawaran sebesar ' || p_bid_amount || ' Crystal berhasil dipasang!',
    'current_bid', p_bid_amount
  );
END;
$$;

-- 2. RPC: claim_lelang_winner (Bayar & Klaim Hadiah Lelang langsung masuk ke inventory)
CREATE OR REPLACE FUNCTION public.claim_lelang_winner(
  p_winner_id UUID,
  p_user_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner RECORD;
  v_item RECORD;
  v_user_balance INTEGER;
BEGIN
  -- 1. Kunci dan ambil data pemenang
  PERFORM 1
  FROM public.lelang_winners
  WHERE id = p_winner_id AND user_id = p_user_id
  FOR UPDATE;

  SELECT * INTO v_winner
  FROM public.lelang_winners
  WHERE id = p_winner_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data kemenangan lelang tidak ditemukan.');
  END IF;

  IF v_winner.is_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Hadiah lelang ini sudah berhasil diklaim sebelumnya.');
  END IF;

  -- 2. Ambil data item lelang
  SELECT * INTO v_item
  FROM public.lelang_items
  WHERE id = v_winner.item_id;

  -- 3. Cek saldo Crystal pemenang
  v_user_balance := (
    SELECT crystal_balance
    FROM public.user_balances
    WHERE user_id = p_user_id
    LIMIT 1
  );

  IF v_user_balance IS NULL OR v_user_balance < v_winner.final_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Saldo Crystal tidak mencukupi untuk melakukan pelunasan klaim (' || COALESCE(v_user_balance, 0) || ' Crystal).'
    );
  END IF;

  -- 4. Potong saldo Crystal
  UPDATE public.user_balances
  SET
    crystal_balance = crystal_balance - v_winner.final_price,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- 5. Masukkan item ke tabel kepemilikan inventori akun
  IF v_item.item_type = 'border' THEN
    INSERT INTO public.user_border_purchases (user_id, border_id, border_name, rarity, price_paid)
    VALUES (p_user_id, v_item.source_id, v_item.title, 'Mythic', v_winner.final_price)
    ON CONFLICT (user_id, border_id) DO NOTHING;
  ELSE
    INSERT INTO public.user_banner_inventory (user_id, banner_id)
    VALUES (p_user_id, v_item.source_id)
    ON CONFLICT (user_id, banner_id) DO NOTHING;
  END IF;

  -- 6. Tandai pemenang sudah klaim
  UPDATE public.lelang_winners
  SET
    is_claimed = true,
    claimed_at = NOW()
  WHERE id = p_winner_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pembayaran ' || v_winner.final_price || ' Crystal berhasil! Hadiah ' || v_item.title || ' telah masuk ke Koleksi Anda.',
    'remaining_balance', v_user_balance - v_winner.final_price
  );
END;
$$;

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lelang_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lelang_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lelang_bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lelang_bids;
  END IF;
END $$;

