-- Środek transportu i kody lotnisk (informacje ogólne wycieczki)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS transport_mode text
    CHECK (
      transport_mode IS NULL
      OR transport_mode IN ('Autokar', 'Samolot', 'Pociąg', 'Własny')
    ),
  ADD COLUMN IF NOT EXISTS airport_codes text;

COMMENT ON COLUMN public.trips.transport_mode IS 'Środek transportu: Autokar, Samolot, Pociąg, Własny';
COMMENT ON COLUMN public.trips.airport_codes IS 'Kody lotnisk (np. WAW, KRK), dowolny tekst';
