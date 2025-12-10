-- Migracja: Zmiana foreign key constraints z restrict na cascade dla usuwania wycieczek
-- Umożliwia kaskadowe usuwanie rezerwacji i powiązanych danych przy usuwaniu wycieczki

-- 1. Zmiana foreign key dla bookings.trip_id z restrict na cascade
DO $$
DECLARE
  fk_constraint_name text;
BEGIN
  -- Znajdź nazwę constraintu foreign key dla bookings.trip_id
  SELECT conname INTO fk_constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.bookings'::regclass
    AND c.confrelid = 'public.trips'::regclass
    AND c.contype = 'f'
    AND a.attname = 'trip_id';

  IF fk_constraint_name IS NOT NULL THEN
    -- Usuń stary constraint
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', fk_constraint_name);
  END IF;
  
  -- Dodaj nowy constraint z cascade (jeśli nie istnieje)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_trip_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_trip_id_fkey
      FOREIGN KEY (trip_id) 
      REFERENCES public.trips(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Zmiana foreign key dla insurance_submissions.trip_id z restrict na cascade
DO $$
DECLARE
  fk_constraint_name text;
BEGIN
  -- Znajdź nazwę constraintu foreign key dla insurance_submissions.trip_id
  SELECT conname INTO fk_constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.insurance_submissions'::regclass
    AND c.confrelid = 'public.trips'::regclass
    AND c.contype = 'f'
    AND a.attname = 'trip_id';

  IF fk_constraint_name IS NOT NULL THEN
    -- Usuń stary constraint
    EXECUTE format('ALTER TABLE public.insurance_submissions DROP CONSTRAINT %I', fk_constraint_name);
  END IF;
  
  -- Dodaj nowy constraint z cascade (jeśli nie istnieje)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.insurance_submissions'::regclass
      AND conname = 'insurance_submissions_trip_id_fkey'
  ) THEN
    ALTER TABLE public.insurance_submissions
      ADD CONSTRAINT insurance_submissions_trip_id_fkey
      FOREIGN KEY (trip_id) 
      REFERENCES public.trips(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

