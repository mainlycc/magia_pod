-- 013: Pola treści wycieczek - program_atrakcje i dodatkowe_swiadczenia

-- 1. Dodanie pola program_atrakcje do trips (rich text HTML dla sekcji "Program i atrakcje")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'program_atrakcje'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN program_atrakcje text;
  END IF;
END $$;

-- 2. Dodanie pola dodatkowe_swiadczenia do trips (rich text HTML dla sekcji "Dodatkowe świadczenia")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'dodatkowe_swiadczenia'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN dodatkowe_swiadczenia text;
  END IF;
END $$;

