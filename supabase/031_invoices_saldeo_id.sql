-- 031: Dodanie pól Saldeo do tabeli invoices
-- Dodanie pól do przechowywania ID faktury z Saldeo oraz błędów

DO $$
BEGIN
  -- Dodanie pola saldeo_invoice_id
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'saldeo_invoice_id'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN saldeo_invoice_id text;
    RAISE NOTICE 'Kolumna saldeo_invoice_id została dodana';
  ELSE
    RAISE NOTICE 'Kolumna saldeo_invoice_id już istnieje';
  END IF;

  -- Dodanie pola saldeo_error
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'saldeo_error'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN saldeo_error text;
    RAISE NOTICE 'Kolumna saldeo_error została dodana';
  ELSE
    RAISE NOTICE 'Kolumna saldeo_error już istnieje';
  END IF;
END $$;

-- Indeks dla saldeo_invoice_id (jeśli będzie potrzebny do wyszukiwania)
CREATE INDEX IF NOT EXISTS invoices_saldeo_invoice_id_idx ON public.invoices(saldeo_invoice_id) WHERE saldeo_invoice_id IS NOT NULL;

