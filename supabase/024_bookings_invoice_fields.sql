-- 024: Pola do danych fakturowych w tabeli bookings
-- - invoice_type: z jakich danych wystawiać fakturę
-- - invoice_name / invoice_nip / invoice_address: dane nabywcy faktury
--
-- invoice_type:
-- - 'contact'  -> dane osoby zgłaszającej (kontakt)
-- - 'company'  -> dane firmy z formularza firmy
-- - 'custom'   -> osobno podane dane do faktury (podformularz "faktura na inne dane")

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'invoice_type'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN invoice_type text CHECK (invoice_type IN ('contact', 'company', 'custom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'invoice_name'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN invoice_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'invoice_nip'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN invoice_nip text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'invoice_address'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN invoice_address jsonb;
  END IF;
END $$;



