-- 014: Dodatkowe pola tekstowe dla edycji treści strony wycieczki

-- Opis pod tytułem
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
  END IF;
END $$;

-- Nagłówek sekcji "Poznaj wycieczkę"
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
  END IF;
END $$;

-- Opis sekcji "Poznaj wycieczkę"
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
  END IF;
END $$;

-- Tekst w karcie rezerwacji (informacje o rezerwacji)
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
  END IF;
END $$;

