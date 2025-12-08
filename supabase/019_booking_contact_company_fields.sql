-- Migracja: Dodanie pól imię, nazwisko osoby kontaktowej oraz danych firmy do tabeli bookings
-- Dodanie: contact_first_name, contact_last_name, company_name, company_nip, company_address

-- 1. Dodanie pola contact_first_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'contact_first_name'
  ) THEN
    ALTER TABLE public.bookings 
    ADD COLUMN contact_first_name text;
    
    -- Dodaj komentarz do kolumny (wymusza odświeżenie cache PostgREST)
    COMMENT ON COLUMN public.bookings.contact_first_name IS 'Imię osoby kontaktowej';
  END IF;
END $$;

-- 2. Dodanie pola contact_last_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'contact_last_name'
  ) THEN
    ALTER TABLE public.bookings 
    ADD COLUMN contact_last_name text;
    
    -- Dodaj komentarz do kolumny (wymusza odświeżenie cache PostgREST)
    COMMENT ON COLUMN public.bookings.contact_last_name IS 'Nazwisko osoby kontaktowej';
  END IF;
END $$;

-- 3. Dodanie pola company_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'company_name'
  ) THEN
    ALTER TABLE public.bookings 
    ADD COLUMN company_name text;
    
    -- Dodaj komentarz do kolumny (wymusza odświeżenie cache PostgREST)
    COMMENT ON COLUMN public.bookings.company_name IS 'Nazwa firmy';
  END IF;
END $$;

-- 4. Dodanie pola company_nip (NIP - Numer Identyfikacji Podatkowej)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'company_nip'
  ) THEN
    ALTER TABLE public.bookings 
    ADD COLUMN company_nip text;
    
    -- Dodaj komentarz do kolumny (wymusza odświeżenie cache PostgREST)
    COMMENT ON COLUMN public.bookings.company_nip IS 'NIP firmy (Numer Identyfikacji Podatkowej)';
  END IF;
END $$;

-- 5. Dodanie pola company_address (jsonb podobnie jak address)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'company_address'
  ) THEN
    ALTER TABLE public.bookings 
    ADD COLUMN company_address jsonb;
    
    -- Dodaj komentarz do kolumny (wymusza odświeżenie cache PostgREST)
    COMMENT ON COLUMN public.bookings.company_address IS 'Adres firmy w formacie JSON';
  END IF;
END $$;

