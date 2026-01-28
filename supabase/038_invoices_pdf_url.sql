-- 038: Dodanie pola pdf_url do tabeli invoices
-- Przechowuje URL do wygenerowanego PDF faktury w systemie Saldeo

DO $$
BEGIN
  -- Dodanie pola pdf_url
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN pdf_url text;
    RAISE NOTICE 'Kolumna pdf_url została dodana';
  ELSE
    RAISE NOTICE 'Kolumna pdf_url już istnieje';
  END IF;
END $$;
