-- Migracja: Rozszerzenie funkcjonalności rezerwacji
-- Dodanie: internal_notes, payment_history, agreements, rozszerzenie statusów

-- 1. Dodanie pola internal_notes do bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bookings' 
    AND column_name = 'internal_notes'
  ) THEN
    ALTER TABLE public.bookings 
    ADD COLUMN internal_notes jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 2. Rozszerzenie statusu rezerwacji o 'cancelled'
-- Najpierw usuń stary constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'bookings' 
    AND constraint_name = 'bookings_status_check'
  ) THEN
    ALTER TABLE public.bookings DROP CONSTRAINT bookings_status_check;
  END IF;
END $$;

-- Dodaj nowy constraint z rozszerzonymi statusami
ALTER TABLE public.bookings 
ADD CONSTRAINT bookings_status_check 
CHECK (status IN ('pending', 'confirmed', 'cancelled'));

-- 3. Utworzenie tabeli payment_history
CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS payment_history_booking_id_idx ON public.payment_history(booking_id);
CREATE INDEX IF NOT EXISTS payment_history_payment_date_idx ON public.payment_history(payment_date);
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- RLS dla payment_history
DROP POLICY IF EXISTS payment_history_admin_all ON public.payment_history;
CREATE POLICY payment_history_admin_all
ON public.payment_history
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS payment_history_coordinator_read ON public.payment_history;
CREATE POLICY payment_history_coordinator_read
ON public.payment_history
FOR SELECT
TO authenticated
USING (
  public.is_coordinator()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.trips t ON t.id = b.trip_id
    JOIN public.profiles pr ON pr.id = auth.uid()
    WHERE payment_history.booking_id = b.id
      AND pr.role = 'coordinator'
      AND pr.allowed_trip_ids IS NOT NULL
      AND t.id = ANY(pr.allowed_trip_ids)
  )
);

-- 4. Utworzenie tabeli agreements
CREATE TABLE IF NOT EXISTS public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  template_id text,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'signed')),
  pdf_url text,
  sent_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agreements_booking_id_idx ON public.agreements(booking_id);
CREATE INDEX IF NOT EXISTS agreements_status_idx ON public.agreements(status);
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- RLS dla agreements
DROP POLICY IF EXISTS agreements_admin_all ON public.agreements;
CREATE POLICY agreements_admin_all
ON public.agreements
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS agreements_coordinator_read ON public.agreements;
CREATE POLICY agreements_coordinator_read
ON public.agreements
FOR SELECT
TO authenticated
USING (
  public.is_coordinator()
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.trips t ON t.id = b.trip_id
    JOIN public.profiles pr ON pr.id = auth.uid()
    WHERE agreements.booking_id = b.id
      AND pr.role = 'coordinator'
      AND pr.allowed_trip_ids IS NOT NULL
      AND t.id = ANY(pr.allowed_trip_ids)
  )
);

-- Funkcja do automatycznej aktualizacji updated_at w agreements
CREATE OR REPLACE FUNCTION public.update_agreements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agreements_updated_at_trigger ON public.agreements;
CREATE TRIGGER agreements_updated_at_trigger
BEFORE UPDATE ON public.agreements
FOR EACH ROW
EXECUTE FUNCTION public.update_agreements_updated_at();

