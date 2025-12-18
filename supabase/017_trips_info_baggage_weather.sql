-- 017: Dodanie pól trip_info_text, baggage_text, weather_text

-- 1. Dodanie pola trip_info_text do trips (informacje o wyjeździe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'trip_info_text'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN trip_info_text text;
    RAISE NOTICE 'Kolumna trip_info_text została dodana';
  ELSE
    RAISE NOTICE 'Kolumna trip_info_text już istnieje';
  END IF;
END $$;

-- 2. Dodanie pola baggage_text do trips (informacje o bagażu)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'baggage_text'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN baggage_text text;
    RAISE NOTICE 'Kolumna baggage_text została dodana';
  ELSE
    RAISE NOTICE 'Kolumna baggage_text już istnieje';
  END IF;
END $$;

-- 3. Dodanie pola weather_text do trips (informacje o pogodzie)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'weather_text'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN weather_text text;
    RAISE NOTICE 'Kolumna weather_text została dodana';
  ELSE
    RAISE NOTICE 'Kolumna weather_text już istnieje';
  END IF;
END $$;

