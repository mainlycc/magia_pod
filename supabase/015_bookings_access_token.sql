-- Migracja: Dodanie access_token do tabeli bookings
-- Token umożliwia publiczny dostęp do rezerwacji bez logowania

-- 1. Dodanie kolumny access_token do bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'access_token'
  ) THEN
    ALTER TABLE public.bookings 
    ADD COLUMN access_token uuid UNIQUE DEFAULT gen_random_uuid();
  END IF;
END $$;

-- 2. Ustawienie tokena dla istniejących rekordów (jeśli są)
DO $$
BEGIN
  UPDATE public.bookings 
  SET access_token = gen_random_uuid() 
  WHERE access_token IS NULL;
END $$;

-- 3. Ustawienie NOT NULL constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'access_token'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.bookings 
    ALTER COLUMN access_token SET NOT NULL;
  END IF;
END $$;

-- 4. Utworzenie indeksu na access_token
CREATE INDEX IF NOT EXISTS bookings_access_token_idx ON public.bookings(access_token);

-- 5. Funkcja do pobierania rezerwacji po tokenie (omija RLS dla publicznego dostępu)
CREATE OR REPLACE FUNCTION public.get_booking_by_token(booking_token uuid)
RETURNS TABLE (
  id uuid,
  booking_ref text,
  contact_email text,
  contact_phone text,
  address jsonb,
  status text,
  payment_status text,
  agreement_pdf_url text,
  created_at timestamptz,
  trip_id uuid,
  trip_title text,
  trip_start_date date,
  trip_end_date date,
  trip_price_cents integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.booking_ref,
    b.contact_email,
    b.contact_phone,
    b.address,
    b.status,
    b.payment_status,
    b.agreement_pdf_url,
    b.created_at,
    b.trip_id,
    t.title::text as trip_title,
    t.start_date::date as trip_start_date,
    t.end_date::date as trip_end_date,
    t.price_cents::integer as trip_price_cents
  FROM public.bookings b
  JOIN public.trips t ON t.id = b.trip_id
  WHERE b.access_token = booking_token;
END;
$$;

-- 6. Nadanie uprawnień do funkcji
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid) TO anon, authenticated;

