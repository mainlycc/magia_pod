-- 069: Identyfikator wariantu w logach wysyłek (raporty KR per wariant 100% / 100% Max)
ALTER TABLE public.insurance_email_logs
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.insurance_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS insurance_email_logs_variant_id_idx
  ON public.insurance_email_logs(variant_id);

COMMENT ON COLUMN public.insurance_email_logs.variant_id IS
  'Dla typ 3: konkretny wariant KR (np. 100% vs 100% Max), którego dotyczył raport';
