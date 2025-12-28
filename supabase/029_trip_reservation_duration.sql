-- 029: Dodanie pól reservation_number i duration_text do trips

-- 1. Dodanie pola reservation_number (numer rezerwacji)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'reservation_number'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN reservation_number text;
    RAISE NOTICE 'Kolumna reservation_number została dodana';
  ELSE
    RAISE NOTICE 'Kolumna reservation_number już istnieje';
  END IF;
END $$;

-- 2. Dodanie pola duration_text (czas trwania - ręczne wypełnianie)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'duration_text'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN duration_text text;
    RAISE NOTICE 'Kolumna duration_text została dodana';
  ELSE
    RAISE NOTICE 'Kolumna duration_text już istnieje';
  END IF;
END $$;

