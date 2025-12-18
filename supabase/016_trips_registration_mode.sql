-- 016: Dostępne ścieżki zgłoszenia (registration_mode)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'registration_mode'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN registration_mode text DEFAULT 'both';
  END IF;
END $$;


