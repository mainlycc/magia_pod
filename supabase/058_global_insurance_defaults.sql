-- 058: Globalne domyślne ubezpieczenia (OWU + warianty dla nowych wycieczek)

CREATE TABLE IF NOT EXISTS public.global_insurance_owu_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_type smallint NOT NULL CHECK (insurance_type IN (1, 2, 3)),
  file_name text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (insurance_type)
);

CREATE INDEX IF NOT EXISTS global_insurance_owu_documents_type_idx
  ON public.global_insurance_owu_documents(insurance_type);

DROP TRIGGER IF EXISTS global_insurance_owu_documents_updated_at ON public.global_insurance_owu_documents;
CREATE TRIGGER global_insurance_owu_documents_updated_at
  BEFORE UPDATE ON public.global_insurance_owu_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.global_insurance_owu_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_insurance_owu_documents_read ON public.global_insurance_owu_documents;
CREATE POLICY global_insurance_owu_documents_read
ON public.global_insurance_owu_documents
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS global_insurance_owu_documents_admin_all ON public.global_insurance_owu_documents;
CREATE POLICY global_insurance_owu_documents_admin_all
ON public.global_insurance_owu_documents
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================

CREATE TABLE IF NOT EXISTS public.global_insurance_trip_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.insurance_variants(id) ON DELETE CASCADE,
  price_grosz integer CHECK (price_grosz IS NULL OR price_grosz >= 0),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id)
);

CREATE INDEX IF NOT EXISTS global_insurance_trip_defaults_variant_id_idx
  ON public.global_insurance_trip_defaults(variant_id);

DROP TRIGGER IF EXISTS global_insurance_trip_defaults_updated_at ON public.global_insurance_trip_defaults;
CREATE TRIGGER global_insurance_trip_defaults_updated_at
  BEFORE UPDATE ON public.global_insurance_trip_defaults
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.global_insurance_trip_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_insurance_trip_defaults_read ON public.global_insurance_trip_defaults;
CREATE POLICY global_insurance_trip_defaults_read
ON public.global_insurance_trip_defaults
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS global_insurance_trip_defaults_admin_all ON public.global_insurance_trip_defaults;
CREATE POLICY global_insurance_trip_defaults_admin_all
ON public.global_insurance_trip_defaults
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Seed: domyślne warianty oznaczone is_default w słowniku
INSERT INTO public.global_insurance_trip_defaults (variant_id, price_grosz, is_enabled)
SELECT iv.id, NULL, true
FROM public.insurance_variants iv
WHERE iv.is_default = true
  AND iv.is_active = true
ON CONFLICT (variant_id) DO NOTHING;
