-- 066: Druga lokalizacja wycieczki

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'territorial_scope_2'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN territorial_scope_2 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'country_2'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN country_2 text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'locality_2'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN locality_2 text;
  END IF;
END $$;
