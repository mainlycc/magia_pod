-- 009: Publiczna podstrona wycieczki - pola is_public i public_slug + doprecyzowanie RLS

-- 1. Dodanie pola is_public do trips (czy wycieczka ma publiczną podstronę)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'is_public'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN is_public boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Dodanie pola public_slug do trips (slug używany tylko dla publicznej strony)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'public_slug'
  ) THEN
    ALTER TABLE public.trips
      ADD COLUMN public_slug text UNIQUE;
  END IF;
END $$;

-- 3. Indeks po public_slug (na potrzeby wyszukiwania strony publicznej)
CREATE INDEX IF NOT EXISTS trips_public_slug_idx
  ON public.trips(public_slug);

-- 4. Aktualizacja polityki RLS dla publicznego odczytu trips:
--    anon może czytać tylko aktywne i publiczne wycieczki.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trips'
      AND policyname = 'trips_public_read_active'
  ) THEN
    DROP POLICY trips_public_read_active ON public.trips;
  END IF;
END $$;

CREATE POLICY trips_public_read_active
ON public.trips
FOR SELECT
TO anon, authenticated
USING (is_active = true AND is_public = true);

-- Uwaga: polityka adminowska na trips (trips_admin_all) zostaje bez zmian
-- i dalej pozwala adminowi na pełen dostęp do wszystkich wycieczek.


