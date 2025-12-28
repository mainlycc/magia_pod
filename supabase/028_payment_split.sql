-- 028: Podział płatności na zaliczkę i resztę

-- Dodanie kolumn do tabeli trips
DO $$
BEGIN
  -- payment_split_enabled - czy płatność jest podzielona
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'payment_split_enabled'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN payment_split_enabled boolean NOT NULL DEFAULT true;
  END IF;

  -- payment_split_first_percent - procent pierwszej płatności (zaliczki)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'payment_split_first_percent'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN payment_split_first_percent integer NOT NULL DEFAULT 30;
  END IF;

  -- payment_split_second_percent - procent drugiej płatności (reszty)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'payment_split_second_percent'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN payment_split_second_percent integer NOT NULL DEFAULT 70;
  END IF;

  -- payment_reminder_enabled - czy automatycznie wysyłać przypomnienia
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'payment_reminder_enabled'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN payment_reminder_enabled boolean NOT NULL DEFAULT false;
  END IF;

  -- payment_reminder_days_before - ile dni przed wycieczką wysłać mail
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'payment_reminder_days_before'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN payment_reminder_days_before integer;
  END IF;
END $$;

-- Dodanie kolumn do tabeli bookings
DO $$
BEGIN
  -- first_payment_amount_cents - kwota pierwszej płatności (zaliczki)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'first_payment_amount_cents'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN first_payment_amount_cents integer;
  END IF;

  -- second_payment_amount_cents - kwota drugiej płatności (reszty)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'second_payment_amount_cents'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN second_payment_amount_cents integer;
  END IF;

  -- first_payment_status - status zaliczki
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'first_payment_status'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN first_payment_status text NOT NULL DEFAULT 'unpaid' 
      CHECK (first_payment_status IN ('unpaid', 'paid'));
  END IF;

  -- second_payment_status - status reszty
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'second_payment_status'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN second_payment_status text NOT NULL DEFAULT 'unpaid' 
      CHECK (second_payment_status IN ('unpaid', 'paid'));
  END IF;

  -- reminder_sent_at - kiedy wysłano przypomnienie o reszcie
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'reminder_sent_at'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN reminder_sent_at timestamptz;
  END IF;
END $$;

-- Dodanie constraint dla sumy procentów (opcjonalnie, można też walidować w aplikacji)
-- Nie dodajemy constraint w bazie, bo może być problem z istniejącymi danymi
-- Walidacja będzie w aplikacji

