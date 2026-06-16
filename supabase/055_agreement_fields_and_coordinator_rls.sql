-- 055: Pola umowy (room_type, meals, transfer) + RLS koordynatorów dla szablonów umów

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS agreement_room_type text DEFAULT '';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS agreement_meals_info text DEFAULT '';
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS agreement_transfer_info text DEFAULT '';

-- Koordynator przypisany do wycieczki może czytać i zapisywać szablony umów
DROP POLICY IF EXISTS trip_agreement_templates_coordinator_manage ON public.trip_agreement_templates;
CREATE POLICY trip_agreement_templates_coordinator_manage
ON public.trip_agreement_templates
FOR ALL
TO authenticated
USING (
  public.is_coordinator()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'coordinator'
      AND pr.allowed_trip_ids IS NOT NULL
      AND trip_agreement_templates.trip_id = ANY(pr.allowed_trip_ids)
  )
)
WITH CHECK (
  public.is_coordinator()
  AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'coordinator'
      AND pr.allowed_trip_ids IS NOT NULL
      AND trip_agreement_templates.trip_id = ANY(pr.allowed_trip_ids)
  )
);
