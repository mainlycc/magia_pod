-- 052: Komunikat wyświetlany po rezerwacji / po płatności (per wycieczka)
-- Dodaje pola do tabeli `trips`, aby dało się zarządzać komunikatem końcowym z panelu wycieczki.
--
-- Uwaga: `reservation_success_title` zostało wycofane — komunikat ma być bez tytułu.
-- Jeśli ta kolumna istnieje w bazie, może pozostać; aplikacja jej już nie używa.

-- Treść komunikatu końcowego (HTML / tekst)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'reservation_success_message'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN reservation_success_message text;
  END IF;
END $$;

