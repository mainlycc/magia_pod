-- 064: Kody srodka transportu TFG (LOTNCZART / NLOT / BRAK / LOTCZART)
-- Zastepuje stare wartosci: Autokar, Samolot, Pociag, Wlasny

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_transport_mode_check;

-- Samolot -> NLOT; pozostale stare etykiety PL / nieznane -> NULL
UPDATE public.trips
SET transport_mode = CASE upper(trim(transport_mode))
  WHEN 'SAMOLOT' THEN 'NLOT'
  WHEN 'LOTNCZART' THEN 'LOTNCZART'
  WHEN 'LOTCZART' THEN 'LOTCZART'
  WHEN 'NLOT' THEN 'NLOT'
  WHEN 'BRAK' THEN 'BRAK'
  ELSE NULL
END
WHERE transport_mode IS NOT NULL;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_transport_mode_check
  CHECK (
    transport_mode IS NULL
    OR transport_mode IN ('LOTNCZART', 'NLOT', 'BRAK', 'LOTCZART')
  );

COMMENT ON COLUMN public.trips.transport_mode IS
  'Srodek transportu TFG: LOTNCZART, NLOT, BRAK, LOTCZART';
