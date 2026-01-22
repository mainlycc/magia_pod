-- Migracja: Dodanie pola contact_pesel do tabeli bookings i aktualizacja funkcji RPC create_booking

-- 1. Dodanie pola contact_pesel do tabeli bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'contact_pesel'
  ) THEN
    ALTER TABLE public.bookings 
    ADD COLUMN contact_pesel text;
    
    -- Dodaj komentarz do kolumny (wymusza odświeżenie cache PostgREST)
    COMMENT ON COLUMN public.bookings.contact_pesel IS 'PESEL zgłaszającego (wymagany)';
  END IF;
END $$;

-- 2. Aktualizacja funkcji RPC create_booking, aby obsługiwała p_contact_pesel
CREATE OR REPLACE FUNCTION public.create_booking(
  p_trip_id uuid,
  p_booking_ref text,
  p_contact_first_name text,
  p_contact_last_name text,
  p_contact_pesel text,
  p_contact_email text,
  p_contact_phone text,
  p_address jsonb,
  p_company_name text,
  p_company_nip text,
  p_company_address jsonb,
  p_consents jsonb,
  p_status text DEFAULT 'confirmed',
  p_payment_status text DEFAULT 'unpaid',
  p_source text DEFAULT 'public_page'
)
RETURNS TABLE (
  id uuid,
  booking_ref text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking_id uuid;
  v_booking_ref text;
BEGIN
  -- Wstaw booking używając surowego SQL (omija cache PostgREST)
  INSERT INTO public.bookings (
    trip_id,
    booking_ref,
    contact_first_name,
    contact_last_name,
    contact_pesel,
    contact_email,
    contact_phone,
    address,
    company_name,
    company_nip,
    company_address,
    consents,
    status,
    payment_status,
    source
  ) VALUES (
    p_trip_id,
    p_booking_ref,
    p_contact_first_name,
    p_contact_last_name,
    p_contact_pesel,
    p_contact_email,
    p_contact_phone,
    p_address,
    p_company_name,
    p_company_nip,
    p_company_address,
    p_consents,
    p_status,
    p_payment_status,
    p_source
  )
  RETURNING bookings.id, bookings.booking_ref INTO v_booking_id, v_booking_ref;
  
  -- Zwróć utworzony booking
  RETURN QUERY
  SELECT v_booking_id, v_booking_ref;
END;
$$;

-- 3. Aktualizacja uprawnień do wykonania funkcji z nową sygnaturą
GRANT EXECUTE ON FUNCTION public.create_booking(
  p_trip_id uuid,
  p_booking_ref text,
  p_contact_first_name text,
  p_contact_last_name text,
  p_contact_pesel text,
  p_contact_email text,
  p_contact_phone text,
  p_address jsonb,
  p_company_name text,
  p_company_nip text,
  p_company_address jsonb,
  p_consents jsonb,
  p_status text,
  p_payment_status text,
  p_source text
) TO anon, authenticated;

-- 4. Odśwież cache PostgREST aby rozpoznał nową funkcję i kolumny
NOTIFY pgrst, 'reload schema';
