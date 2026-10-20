-- 071: Osoby dopisywane ręcznie tylko do listy ubezpieczenia typu 1 (np. opiekun).
-- Nie są uczestnikami rezerwacji i nie wchodzą do innych kategorii.

CREATE TABLE IF NOT EXISTS public.insurance_type1_extra_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT insurance_type1_extra_persons_first_name_nonempty CHECK (char_length(btrim(first_name)) > 0),
  CONSTRAINT insurance_type1_extra_persons_last_name_nonempty CHECK (char_length(btrim(last_name)) > 0)
);

CREATE INDEX IF NOT EXISTS insurance_type1_extra_persons_trip_id_idx
  ON public.insurance_type1_extra_persons(trip_id);

ALTER TABLE public.insurance_type1_extra_persons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insurance_type1_extra_persons_admin_all ON public.insurance_type1_extra_persons;
CREATE POLICY insurance_type1_extra_persons_admin_all
ON public.insurance_type1_extra_persons FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS insurance_type1_extra_persons_updated_at ON public.insurance_type1_extra_persons;
CREATE TRIGGER insurance_type1_extra_persons_updated_at
BEFORE UPDATE ON public.insurance_type1_extra_persons
FOR EACH ROW EXECUTE FUNCTION public.update_insurance_updated_at();
