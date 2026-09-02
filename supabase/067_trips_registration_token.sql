-- 067: Prywatny token rejestracji dla wycieczek
-- Link klienta: /trip/{slug}?token={registration_token}

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'registration_token'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN registration_token uuid UNIQUE DEFAULT gen_random_uuid();
  END IF;
END $$;

UPDATE public.trips
SET registration_token = gen_random_uuid()
WHERE registration_token IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'registration_token'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.trips
      ALTER COLUMN registration_token SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS trips_registration_token_idx
  ON public.trips(registration_token);
