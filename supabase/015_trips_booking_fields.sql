-- 015: Dodanie pól dla prawej kolumny rezerwacji

-- 1. Dodanie pola show_seats_left (domyślnie false - ukryte)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'show_seats_left'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN show_seats_left boolean NOT NULL DEFAULT false;
    RAISE NOTICE 'Kolumna show_seats_left została dodana';
  ELSE
    RAISE NOTICE 'Kolumna show_seats_left już istnieje';
  END IF;
END $$;

-- 2. Dodanie pola included_in_price_text (świadczenia w cenie)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'included_in_price_text'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN included_in_price_text text;
    RAISE NOTICE 'Kolumna included_in_price_text została dodana';
  ELSE
    RAISE NOTICE 'Kolumna included_in_price_text już istnieje';
  END IF;
END $$;

-- 3. Dodanie pola additional_costs_text (dodatkowe koszty)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'additional_costs_text'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN additional_costs_text text;
    RAISE NOTICE 'Kolumna additional_costs_text została dodana';
  ELSE
    RAISE NOTICE 'Kolumna additional_costs_text już istnieje';
  END IF;
END $$;

-- 4. Dodanie pola additional_service_text (dodatkowe świadczenie)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'additional_service_text'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN additional_service_text text;
    RAISE NOTICE 'Kolumna additional_service_text została dodana';
  ELSE
    RAISE NOTICE 'Kolumna additional_service_text już istnieje';
  END IF;
END $$;

