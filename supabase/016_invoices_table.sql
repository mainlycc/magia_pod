-- 016: Tabela faktur
-- Utworzenie tabeli do zarządzania fakturami powiązanymi z rezerwacjami

-- 1. Utworzenie tabeli invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE,
  amount_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'wystawiona' CHECK (status IN ('wystawiona', 'wysłana', 'opłacona')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indeksy
CREATE INDEX IF NOT EXISTS invoices_booking_id_idx ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS invoices_invoice_number_idx ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices(status);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON public.invoices(created_at);

-- 3. Włączenie RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies - tylko admini mają dostęp
DROP POLICY IF EXISTS invoices_admin_all ON public.invoices;
CREATE POLICY invoices_admin_all
ON public.invoices
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. Funkcja do generowania numeru faktury w formacie FV/YYYY/NNN
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
  -- Pobierz aktualny rok
  current_year := to_char(now(), 'YYYY');
  
  -- Znajdź ostatni numer faktury dla danego roku
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(invoice_number FROM '/(\d+)$') AS integer
    )
  ), 0)
  INTO last_number
  FROM public.invoices
  WHERE invoice_number LIKE 'FV/' || current_year || '/%';
  
  -- Zwiększ numer o 1
  new_number := last_number + 1;
  
  -- Utwórz numer faktury w formacie FV/YYYY/NNN
  invoice_num := 'FV/' || current_year || '/' || LPAD(new_number::text, 3, '0');
  
  RETURN invoice_num;
END;
$$;

-- 6. Funkcja do automatycznego generowania numeru faktury przy wstawianiu
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Jeśli numer faktury nie jest ustawiony, wygeneruj go automatycznie
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := public.generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Trigger do automatycznego generowania numeru faktury
DROP TRIGGER IF EXISTS invoices_set_invoice_number_trigger ON public.invoices;
CREATE TRIGGER invoices_set_invoice_number_trigger
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_invoice_number();

-- 8. Funkcja do automatycznej aktualizacji updated_at
CREATE OR REPLACE FUNCTION public.update_invoices_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 9. Trigger do aktualizacji updated_at
DROP TRIGGER IF EXISTS invoices_updated_at_trigger ON public.invoices;
CREATE TRIGGER invoices_updated_at_trigger
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_invoices_updated_at();

