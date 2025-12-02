-- 010: Źródło rezerwacji (publiczna strona vs panel admina)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bookings'
      AND column_name = 'source'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN source text NOT NULL DEFAULT 'admin_panel';
  END IF;
END $$;


