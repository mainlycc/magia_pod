-- 032: Dodanie pola additional_fields do tabeli trips
-- Pole JSONB do przechowywania pól dodatkowych (tytuł + wartość)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'additional_fields'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN additional_fields jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Kolumna additional_fields została dodana';
  ELSE
    RAISE NOTICE 'Kolumna additional_fields już istnieje';
  END IF;
END $$;

