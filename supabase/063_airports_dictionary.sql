-- 063: Slownik lotnisk COM-SL-0010-LOTNISKA (TFG / eksport CSV)

CREATE TABLE IF NOT EXISTS public.airports (
  code text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS airports_name_idx ON public.airports (name);
CREATE INDEX IF NOT EXISTS airports_code_lower_idx ON public.airports (lower(code));

COMMENT ON TABLE public.airports IS 'Slownik lotnisk do eksportu umow TFG (kody ICAO)';
COMMENT ON COLUMN public.airports.code IS 'Kod lotniska (np. LKPR, EPWA)';
COMMENT ON COLUMN public.airports.name IS 'Pelna nazwa lotniska';

ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS airports_authenticated_read ON public.airports;
CREATE POLICY airports_authenticated_read
ON public.airports FOR SELECT TO authenticated
USING (true);
