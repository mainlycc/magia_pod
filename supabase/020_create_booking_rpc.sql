-- Migracja: Utworzenie funkcji RPC do wstawiania bookings
-- Funkcja używa surowego SQL i omija problemy z cache PostgREST

CREATE OR REPLACE FUNCTION public.create_booking(
  p_trip_id uuid,
  p_booking_ref text,
  p_contact_first_name text,
  p_contact_last_name text,
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

-- Nadaj uprawnienia do wykonania funkcji
-- Używamy pełnej sygnatury funkcji z nazwami parametrów
GRANT EXECUTE ON FUNCTION public.create_booking(
  p_trip_id uuid,
  p_booking_ref text,
  p_contact_first_name text,
  p_contact_last_name text,
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

-- Odśwież cache PostgREST aby rozpoznał nową funkcję i kolumny
NOTIFY pgrst, 'reload schema';

