-- 049: Migracja z Saldeo na Fakturownia
-- Zmiana nazw kolumn w tabeli invoices: saldeo_* → fakturownia_* / invoice_provider_*

-- 1. Zmiana nazwy: saldeo_invoice_id → fakturownia_invoice_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'saldeo_invoice_id'
  ) THEN
    ALTER TABLE public.invoices RENAME COLUMN saldeo_invoice_id TO fakturownia_invoice_id;
    RAISE NOTICE 'Zmieniono nazwę kolumny saldeo_invoice_id → fakturownia_invoice_id';
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name = 'fakturownia_invoice_id'
    ) THEN
      ALTER TABLE public.invoices ADD COLUMN fakturownia_invoice_id text;
      RAISE NOTICE 'Dodano kolumnę fakturownia_invoice_id (brak saldeo_invoice_id do przemianowania)';
    ELSE
      RAISE NOTICE 'Kolumna fakturownia_invoice_id już istnieje';
    END IF;
  END IF;
END $$;

-- 2. Zmiana nazwy: saldeo_error → invoice_provider_error
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'saldeo_error'
  ) THEN
    ALTER TABLE public.invoices RENAME COLUMN saldeo_error TO invoice_provider_error;
    RAISE NOTICE 'Zmieniono nazwę kolumny saldeo_error → invoice_provider_error';
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoices'
        AND column_name = 'invoice_provider_error'
    ) THEN
      ALTER TABLE public.invoices ADD COLUMN invoice_provider_error text;
      RAISE NOTICE 'Dodano kolumnę invoice_provider_error (brak saldeo_error do przemianowania)';
    ELSE
      RAISE NOTICE 'Kolumna invoice_provider_error już istnieje';
    END IF;
  END IF;
END $$;

-- 3. Wyczyść stare dane Saldeo (stare ID nie mają znaczenia w nowym systemie)
UPDATE public.invoices
SET fakturownia_invoice_id = NULL,
    invoice_provider_error = NULL
WHERE fakturownia_invoice_id IS NOT NULL
   OR invoice_provider_error IS NOT NULL;
