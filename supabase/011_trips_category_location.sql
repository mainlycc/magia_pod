-- 011: Dodanie kolumn category i location do trips (jeśli nie istnieją)

-- 1. Dodanie pola category do trips
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN category text;
  END IF;
END $$;

-- 2. Dodanie pola location do trips
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'location'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN location text;
  END IF;
END $$;

