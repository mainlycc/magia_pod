-- Skrypt do dodania brakujących kolumn do tabeli trips
-- Wykonaj ten skrypt w Supabase Dashboard -> SQL Editor

-- 1. Dodanie pola program_atrakcje
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
    RAISE NOTICE 'Kolumna program_atrakcje została dodana';
  ELSE
    RAISE NOTICE 'Kolumna program_atrakcje już istnieje';
  END IF;
END $$;

-- 2. Dodanie pola dodatkowe_swiadczenia
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
    RAISE NOTICE 'Kolumna dodatkowe_swiadczenia została dodana';
  ELSE
    RAISE NOTICE 'Kolumna dodatkowe_swiadczenia już istnieje';
  END IF;
END $$;

-- 3. Dodanie pola intro_text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'intro_text'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN intro_text text;
    RAISE NOTICE 'Kolumna intro_text została dodana';
  ELSE
    RAISE NOTICE 'Kolumna intro_text już istnieje';
  END IF;
END $$;

-- 4. Dodanie pola section_poznaj_title
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'section_poznaj_title'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN section_poznaj_title text;
    RAISE NOTICE 'Kolumna section_poznaj_title została dodana';
  ELSE
    RAISE NOTICE 'Kolumna section_poznaj_title już istnieje';
  END IF;
END $$;

-- 5. Dodanie pola section_poznaj_description
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'section_poznaj_description'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN section_poznaj_description text;
    RAISE NOTICE 'Kolumna section_poznaj_description została dodana';
  ELSE
    RAISE NOTICE 'Kolumna section_poznaj_description już istnieje';
  END IF;
END $$;

-- 6. Dodanie pola reservation_info_text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'reservation_info_text'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN reservation_info_text text;
    RAISE NOTICE 'Kolumna reservation_info_text została dodana';
  ELSE
    RAISE NOTICE 'Kolumna reservation_info_text już istnieje';
  END IF;
END $$;

-- Sprawdzenie, które kolumny zostały dodane
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'trips'
  AND column_name IN (
    'program_atrakcje',
    'dodatkowe_swiadczenia',
    'intro_text',
    'section_poznaj_title',
    'section_poznaj_description',
    'reservation_info_text'
  )
ORDER BY column_name;

