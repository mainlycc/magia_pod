-- 056: Backfill signed_at dla opłaconych umów bez daty zawarcia (raporty TFG/TFP)

UPDATE public.agreements a
SET signed_at = COALESCE(b.updated_at, b.created_at, a.generated_at, a.created_at)
FROM public.bookings b
WHERE a.booking_id = b.id
  AND a.signed_at IS NULL
  AND (
    a.status = 'signed'
    OR b.payment_status IN ('paid', 'partial', 'overpaid')
  );
