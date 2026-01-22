-- 037: Tabela komunikatów sukcesu płatności
-- Utworzenie tabeli do zarządzania edytowalnym komunikatem wyświetlanym po pomyślnej płatności

-- 1. Utworzenie tabeli payment_success_messages
CREATE TABLE IF NOT EXISTS public.payment_success_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indeksy
CREATE INDEX IF NOT EXISTS payment_success_messages_is_active_idx ON public.payment_success_messages(is_active);
CREATE INDEX IF NOT EXISTS payment_success_messages_created_at_idx ON public.payment_success_messages(created_at);
CREATE INDEX IF NOT EXISTS payment_success_messages_updated_at_idx ON public.payment_success_messages(updated_at);

-- 3. Włączenie RLS
ALTER TABLE public.payment_success_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies - tylko admini mogą edytować, wszyscy mogą czytać aktywny komunikat
DROP POLICY IF EXISTS payment_success_messages_admin_all ON public.payment_success_messages;
CREATE POLICY payment_success_messages_admin_all
ON public.payment_success_messages
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy dla publicznego odczytu aktywnego komunikatu
DROP POLICY IF EXISTS payment_success_messages_public_read ON public.payment_success_messages;
CREATE POLICY payment_success_messages_public_read
ON public.payment_success_messages
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 5. Funkcja do automatycznej aktualizacji updated_at
CREATE OR REPLACE FUNCTION public.update_payment_success_messages_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 6. Trigger do aktualizacji updated_at
DROP TRIGGER IF EXISTS payment_success_messages_updated_at_trigger ON public.payment_success_messages;
CREATE TRIGGER payment_success_messages_updated_at_trigger
BEFORE UPDATE ON public.payment_success_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_success_messages_updated_at();

-- 7. Wstawienie domyślnego komunikatu
INSERT INTO public.payment_success_messages (title, message, is_active)
VALUES (
  'Rezerwacja i płatność zakończone pomyślnie!',
  '<p class="mb-2">Dziękujemy za rezerwację i płatność! Twoja rezerwacja została potwierdzona, a płatność została zaksięgowana.</p><p class="mt-2 text-sm">Wszystkie dokumenty (umowa, potwierdzenie płatności) zostały wysłane na Twój adres e-mail.</p><p class="mt-2 text-sm">Nie musisz ręcznie wgrywać podpisanej umowy - wszystko zostało automatycznie przetworzone.</p>',
  true
)
ON CONFLICT DO NOTHING;
