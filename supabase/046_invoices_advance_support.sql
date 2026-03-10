-- 046: Wsparcie dla faktur zaliczkowych (Procedura Marży)
-- Umożliwia wiele faktur per rezerwacja, łańcuch faktur zaliczkowych,
-- powiązanie z payment_history oraz zapis PDF w Storage.

-- 1. Usunięcie UNIQUE constraint na booking_id (pozwala wiele faktur per rezerwację)
DO $$
BEGIN
  -- Sprawdź czy constraint istnieje i usuń go
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'invoices_booking_id_key'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_booking_id_key;
    RAISE NOTICE 'Usunięto UNIQUE constraint na booking_id';
  ELSE
    RAISE NOTICE 'UNIQUE constraint na booking_id nie istnieje (już usunięty?)';
  END IF;
END $$;

-- 2. Dodanie kolumny invoice_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'invoice_type'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN invoice_type text NOT NULL DEFAULT 'advance'
      CHECK (invoice_type IN ('advance', 'advance_to_advance', 'final'));
    RAISE NOTICE 'Kolumna invoice_type została dodana';
  ELSE
    RAISE NOTICE 'Kolumna invoice_type już istnieje';
  END IF;
END $$;

-- 3. Dodanie kolumny parent_invoice_id (łańcuch faktur zaliczkowych)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'parent_invoice_id'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN parent_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;
    RAISE NOTICE 'Kolumna parent_invoice_id została dodana';
  ELSE
    RAISE NOTICE 'Kolumna parent_invoice_id już istnieje';
  END IF;
END $$;

-- 4. Dodanie kolumny payment_history_id (powiązanie z konkretną wpłatą)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'payment_history_id'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN payment_history_id uuid REFERENCES public.payment_history(id) ON DELETE SET NULL;
    RAISE NOTICE 'Kolumna payment_history_id została dodana';
  ELSE
    RAISE NOTICE 'Kolumna payment_history_id już istnieje';
  END IF;
END $$;

-- 5. Dodanie kolumny pdf_storage_path (ścieżka w Supabase Storage bucket 'invoices')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'pdf_storage_path'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN pdf_storage_path text;
    RAISE NOTICE 'Kolumna pdf_storage_path została dodana';
  ELSE
    RAISE NOTICE 'Kolumna pdf_storage_path już istnieje';
  END IF;
END $$;

-- 6. Indeksy
CREATE INDEX IF NOT EXISTS invoices_payment_history_id_idx ON public.invoices(payment_history_id) WHERE payment_history_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_parent_invoice_id_idx ON public.invoices(parent_invoice_id) WHERE parent_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_invoice_type_idx ON public.invoices(invoice_type);

-- 7. Aktualizacja funkcji generowania numeru faktury
-- Faktury zaliczkowe: FZal/YYYY/NNN, zaliczkowe do zaliczkowej: FZal/YYYY/NNN
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  current_year text;
  last_number integer;
  new_number integer;
  invoice_num text;
BEGIN
  current_year := to_char(now(), 'YYYY');

  -- Szukaj ostatniego numeru wśród faktur zaliczkowych (FZal/) i zwykłych (FV/)
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(invoice_number FROM '/(\d+)$') AS integer
    )
  ), 0)
  INTO last_number
  FROM public.invoices
  WHERE (invoice_number LIKE 'FZal/' || current_year || '/%'
     OR invoice_number LIKE 'FV/' || current_year || '/%');

  new_number := last_number + 1;

  -- Domyślnie generuj numer zaliczkowy
  invoice_num := 'FZal/' || current_year || '/' || LPAD(new_number::text, 3, '0');

  RETURN invoice_num;
END;
$$;
