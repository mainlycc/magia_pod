-- 025: Konfiguracja wymagalności PESEL i komunikatu dla ścieżki Firma
-- - require_pesel: czy PESEL uczestników jest wymagany w tej wycieczce
-- - company_participants_info: komunikat wyświetlany zamiast formularza uczestników dla zgłoszeń firmowych

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'require_pesel'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN require_pesel boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'company_participants_info'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN company_participants_info text;
  END IF;
END $$;



