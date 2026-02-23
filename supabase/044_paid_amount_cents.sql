-- 044: Kolumna paid_amount_cents w bookings - faktycznie wpłacona kwota

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'paid_amount_cents'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN paid_amount_cents integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Konwersja istniejących danych: jeśli first_payment_status = paid, ustaw paid_amount_cents na first_payment_amount_cents
-- Jeśli second_payment_status = paid, dodaj second_payment_amount_cents
UPDATE public.bookings
SET paid_amount_cents = 
  COALESCE(CASE WHEN first_payment_status = 'paid' THEN first_payment_amount_cents ELSE 0 END, 0) +
  COALESCE(CASE WHEN second_payment_status = 'paid' THEN second_payment_amount_cents ELSE 0 END, 0)
WHERE paid_amount_cents = 0
  AND (first_payment_status = 'paid' OR second_payment_status = 'paid');
