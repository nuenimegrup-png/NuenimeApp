-- ==============================================================================
-- MIGRASI: PEMBATASAN SATU USER HANYA BISA MEMBUAT DAN TERGABUNG DALAM SATU KLAN
-- ==============================================================================

-- 1. Tambahkan fungsi validasi ketat sebelum INSERT klan baru
CREATE OR REPLACE FUNCTION public.fn_validate_single_clan_per_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Cek apakah user sudah memimpin klan lain
  IF EXISTS (
    SELECT 1 FROM public.rpg_clans 
    WHERE leader_id = NEW.leader_id 
      AND id <> COALESCE(NEW.id, '')
  ) THEN
    RAISE EXCEPTION 'User (%) sudah mendirikan klan lain! Setiap user hanya dapat membuat 1 klan di Dunia Nuenime.', NEW.leader_id;
  END IF;

  -- Cek apakah user sudah menjadi anggota di klan lain
  IF EXISTS (
    SELECT 1 FROM public.rpg_clan_members
    WHERE user_id = NEW.leader_id
      AND clan_id <> COALESCE(NEW.id, '')
  ) THEN
    RAISE EXCEPTION 'User (%) sudah terdaftar di klan lain! Tinggalkan klan saat ini terlebih dahulu sebelum membuat klan baru.', NEW.leader_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_single_clan_per_user ON public.rpg_clans;
CREATE TRIGGER trg_validate_single_clan_per_user
BEFORE INSERT ON public.rpg_clans
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_single_clan_per_user();

-- 2. Tambahkan fungsi validasi saat user bergabung ke klan anggota
CREATE OR REPLACE FUNCTION public.fn_validate_single_clan_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.rpg_clan_members
    WHERE user_id = NEW.user_id
      AND clan_id <> NEW.clan_id
  ) THEN
    RAISE EXCEPTION 'User (%) sudah bergabung di klan lain! Setiap user hanya dapat bergabung dalam 1 klan.', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_single_clan_membership ON public.rpg_clan_members;
CREATE TRIGGER trg_validate_single_clan_membership
BEFORE INSERT ON public.rpg_clan_members
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_single_clan_membership();
