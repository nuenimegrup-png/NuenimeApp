-- ==============================================================================
-- NUENIME - MASS GIFTS & MAILBOX CLAIM SCHEMA
-- Mendukung siaran hadiah massal dari admin (Crystal / Border),
-- pencatatan klaim per user (anti-double claim), dan notifikasi otomatis.
-- ==============================================================================

-- 1. TABEL: SYSTEM_GIFTS (Daftar Hadiah Siaran Massal dari Admin)
CREATE TABLE IF NOT EXISTS public.system_gifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  gift_type   TEXT NOT NULL CHECK (gift_type IN ('crystal', 'border')),
  gift_value  TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_gifts_active ON public.system_gifts(is_active, created_at DESC);

-- 2. TABEL: USER_GIFT_CLAIMS (Riwayat Klaim Hadiah Pengguna - Anti Double Claim)
CREATE TABLE IF NOT EXISTS public.user_gift_claims (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id     UUID NOT NULL REFERENCES public.system_gifts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(gift_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_gift_claims_user ON public.user_gift_claims(user_id);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.system_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gift_claims ENABLE ROW LEVEL SECURITY;

-- Policies untuk system_gifts
DROP POLICY IF EXISTS "anyone_can_read_active_gifts" ON public.system_gifts;
CREATE POLICY "anyone_can_read_active_gifts"
  ON public.system_gifts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "authenticated_manage_gifts" ON public.system_gifts;
CREATE POLICY "authenticated_manage_gifts"
  ON public.system_gifts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies untuk user_gift_claims
DROP POLICY IF EXISTS "users_select_own_claims" ON public.user_gift_claims;
CREATE POLICY "users_select_own_claims"
  ON public.user_gift_claims
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_claims" ON public.user_gift_claims;
CREATE POLICY "users_insert_own_claims"
  ON public.user_gift_claims
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. FUNCTION ATOMIK: CLAIM_SYSTEM_GIFT (Klaim Hadiah Sekali Pakai & Tambah Saldo/Border)
CREATE OR REPLACE FUNCTION public.claim_system_gift(
  p_gift_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gift RECORD;
  v_already_claimed BOOLEAN;
  v_amount INTEGER;
  v_current_bal INTEGER;
  v_new_bal INTEGER;
BEGIN
  -- 1. Ambil data hadiah
  SELECT * INTO v_gift
  FROM public.system_gifts
  WHERE id = p_gift_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'GIFT_NOT_FOUND_OR_INACTIVE');
  END IF;

  -- 2. Cek apakah sudah pernah diklaim sebelumnya
  SELECT EXISTS(
    SELECT 1 FROM public.user_gift_claims
    WHERE gift_id = p_gift_id AND user_id = p_user_id
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  -- 3. Proses hadiah berdasarkan tipe
  IF v_gift.gift_type = 'crystal' THEN
    v_amount := NULLIF(REGEXP_REPLACE(v_gift.gift_value, '[^0-9]', '', 'g'), '')::INTEGER;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      v_amount := 100;
    END IF;

    -- Kunci dan tambah saldo pengguna di user_balances
    SELECT crystal_balance INTO v_current_bal
    FROM public.user_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_bal IS NULL THEN
      v_current_bal := 0;
    END IF;

    v_new_bal := v_current_bal + v_amount;

    INSERT INTO public.user_balances (user_id, crystal_balance, updated_at)
    VALUES (p_user_id, v_new_bal, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET crystal_balance = v_new_bal,
        updated_at = NOW();

  ELSIF v_gift.gift_type = 'border' THEN
    -- Masukkan border ke tabel user_border_purchases
    INSERT INTO public.user_border_purchases (user_id, border_id, border_name, rarity, price_paid, purchased_at)
    VALUES (p_user_id, v_gift.gift_value, v_gift.title, 'Rare', 0, NOW())
    ON CONFLICT (user_id, border_id) DO NOTHING;
  END IF;

  -- 4. Catat klaim ke user_gift_claims
  INSERT INTO public.user_gift_claims (gift_id, user_id, claimed_at)
  VALUES (p_gift_id, p_user_id, NOW())
  ON CONFLICT (gift_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'gift_type', v_gift.gift_type,
    'gift_value', v_gift.gift_value,
    'new_balance', v_new_bal
  );
END;
$$;

-- 5. TRIGGER OTOMATIS: SEBARKAN NOTIFIKASI KE SEMUA PENGGUNA SAAT HADIAH DIBUAT
CREATE OR REPLACE FUNCTION public.broadcast_gift_to_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, created_at)
  SELECT 
    id, 
    '🎁 ' || NEW.title, 
    NEW.message || ' (' || CASE WHEN NEW.gift_type = 'crystal' THEN '+' || NEW.gift_value || ' Dylan Crystal' ELSE 'Border Avatar' END || ')',
    'gift', 
    NOW()
  FROM public.profiles;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_broadcast_gift ON public.system_gifts;
CREATE TRIGGER trigger_broadcast_gift
  AFTER INSERT ON public.system_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.broadcast_gift_to_users();

