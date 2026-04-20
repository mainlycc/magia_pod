-- Jednorazowy backfill: paid_amount_cents = suma wpisów z payment_history (np. po naprawie webhook Paynow).

UPDATE public.bookings b
SET paid_amount_cents = COALESCE(t.sum_cents, 0)
FROM (
  SELECT booking_id, SUM(amount_cents)::integer AS sum_cents
  FROM public.payment_history
  GROUP BY booking_id
) t
WHERE b.id = t.booking_id
  AND COALESCE(b.paid_amount_cents, 0) <> COALESCE(t.sum_cents, 0);
