-- 059: Rozszerzenie wariantów ubezpieczeń — zakres/sumy i załączniki per wariant

ALTER TABLE public.insurance_variants
  ADD COLUMN IF NOT EXISTS coverage_scope text;

COMMENT ON COLUMN public.insurance_variants.coverage_scope IS
  'Zakres i sumy ubezpieczenia (np. KL, NNW) — widoczne w umowie i formularzu';

CREATE TABLE IF NOT EXISTS public.insurance_variant_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.insurance_variants(id) ON DELETE CASCADE,
  attachment_type text NOT NULL CHECK (attachment_type IN ('owu', 'other')),
  file_name text NOT NULL,
  display_name text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_variant_attachments_variant_id_idx
  ON public.insurance_variant_attachments(variant_id);

CREATE UNIQUE INDEX IF NOT EXISTS insurance_variant_attachments_one_owu_per_variant_idx
  ON public.insurance_variant_attachments(variant_id)
  WHERE attachment_type = 'owu';

DROP TRIGGER IF EXISTS insurance_variant_attachments_updated_at ON public.insurance_variant_attachments;
CREATE TRIGGER insurance_variant_attachments_updated_at
  BEFORE UPDATE ON public.insurance_variant_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.insurance_variant_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insurance_variant_attachments_read ON public.insurance_variant_attachments;
CREATE POLICY insurance_variant_attachments_read
ON public.insurance_variant_attachments
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS insurance_variant_attachments_admin_all ON public.insurance_variant_attachments;
CREATE POLICY insurance_variant_attachments_admin_all
ON public.insurance_variant_attachments
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Backfill zakresu z nazwy wariantu (pierwsze wdrożenie)
UPDATE public.insurance_variants
SET coverage_scope = description
WHERE coverage_scope IS NULL
  AND description IS NOT NULL
  AND trim(description) <> '';
