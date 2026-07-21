-- 065: Miejscowość wycieczki

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'locality'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN locality text;
  END IF;
END $$;
