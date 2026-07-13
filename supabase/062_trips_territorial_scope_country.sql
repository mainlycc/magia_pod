-- 062: Zakres terytorialny i kraj wycieczki

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'territorial_scope'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN territorial_scope text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'country'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN country text;
  END IF;
END $$;
