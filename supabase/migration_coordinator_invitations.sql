-- Migracja: Zmiana token_hash na token w coordinator_invitations

-- 1. Sprawdź czy kolumna token_hash istnieje i usuń ją jeśli tak
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'coordinator_invitations' 
    AND column_name = 'token_hash'
  ) THEN
    -- Usuń starą kolumnę token_hash
    ALTER TABLE public.coordinator_invitations DROP COLUMN IF EXISTS token_hash;
  END IF;
END $$;

-- 2. Dodaj kolumnę token jeśli nie istnieje
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'coordinator_invitations' 
    AND column_name = 'token'
  ) THEN
    -- Dodaj kolumnę token z wartością domyślną
    ALTER TABLE public.coordinator_invitations 
    ADD COLUMN token uuid UNIQUE DEFAULT gen_random_uuid();
    
    -- Ustaw token dla istniejących rekordów (jeśli są)
    UPDATE public.coordinator_invitations 
    SET token = gen_random_uuid() 
    WHERE token IS NULL;
    
    -- Ustaw NOT NULL po wypełnieniu wartości
    ALTER TABLE public.coordinator_invitations 
    ALTER COLUMN token SET NOT NULL;
  END IF;
END $$;

-- 3. Utwórz indeks na token jeśli nie istnieje
CREATE INDEX IF NOT EXISTS coordinator_invitations_token_idx 
ON public.coordinator_invitations(token);

-- 4. Utwórz funkcję do automatycznego wygaszania starych zaproszeń
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.coordinator_invitations
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;

-- 5. Utwórz funkcję do akceptacji zaproszenia przez token
CREATE OR REPLACE FUNCTION public.accept_invitation_by_token(invitation_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.coordinator_invitations
  SET status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  WHERE token = invitation_token
    AND status = 'pending'
    AND expires_at >= now();
END;
$$;

-- 6. Nadaj uprawnienia do funkcji
GRANT EXECUTE ON FUNCTION public.expire_old_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation_by_token(uuid) TO anon, authenticated;

