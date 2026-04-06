-- 048: Pola pod raporty TFG — numer umowy, data generowania, data anulacji rezerwacji

-- 1. agreements.agreement_seq — kolejny numer umowy w ramach wycieczki (jak w PDF)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agreements' AND column_name = 'agreement_seq'
  ) THEN
    ALTER TABLE public.agreements ADD COLUMN agreement_seq integer;
    COMMENT ON COLUMN public.agreements.agreement_seq IS 'Numer kolejny umowy w ramach wycieczki (np. 001 w numerze PDF)';
  END IF;
END $$;

-- 2. agreements.generated_at — dzień/czas ostatniego wygenerowania PDF umowy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agreements' AND column_name = 'generated_at'
  ) THEN
    ALTER TABLE public.agreements ADD COLUMN generated_at timestamptz;
    COMMENT ON COLUMN public.agreements.generated_at IS 'Data/czas wygenerowania umowy (PDF); filtr raportów TFG';
  END IF;
END $$;

-- Backfill: generated_at z created_at
UPDATE public.agreements SET generated_at = created_at WHERE generated_at IS NULL;

ALTER TABLE public.agreements
  ALTER COLUMN generated_at SET DEFAULT now();

ALTER TABLE public.agreements
  ALTER COLUMN generated_at SET NOT NULL;

-- Backfill agreement_seq: numeracja po dacie utworzenia umowy w obrębie trip_id
WITH ordered AS (
  SELECT a.id,
    ROW_NUMBER() OVER (
      PARTITION BY b.trip_id ORDER BY a.created_at ASC NULLS LAST, a.id ASC
    ) AS rn
  FROM public.agreements a
  INNER JOIN public.bookings b ON b.id = a.booking_id
)
UPDATE public.agreements a
SET agreement_seq = o.rn
FROM ordered o
WHERE a.id = o.id AND (a.agreement_seq IS NULL OR a.agreement_seq <= 0);

-- 3. bookings.cancelled_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN cancelled_at timestamptz;
    COMMENT ON COLUMN public.bookings.cancelled_at IS 'Data/czas ustawienia statusu anulowanej rezerwacji (raporty rezygnacji TFG)';
  END IF;
END $$;

-- Backfill: bookings często nie ma updated_at — wtedy używamy created_at (przybliżenie dla starych anulacji).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'updated_at'
  ) THEN
    UPDATE public.bookings
    SET cancelled_at = updated_at
    WHERE status = 'cancelled' AND cancelled_at IS NULL;
  ELSE
    UPDATE public.bookings
    SET cancelled_at = created_at
    WHERE status = 'cancelled' AND cancelled_at IS NULL;
  END IF;
END $$;
