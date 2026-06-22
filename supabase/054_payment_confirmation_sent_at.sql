-- Śledzenie wysłanego maila potwierdzającego płatność (deduplikacja webhooków Paynow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_history'
      AND column_name = 'payment_confirmation_sent_at'
  ) THEN
    ALTER TABLE public.payment_history
      ADD COLUMN payment_confirmation_sent_at timestamptz;
    RAISE NOTICE 'Kolumna payment_confirmation_sent_at została dodana';
  ELSE
    RAISE NOTICE 'Kolumna payment_confirmation_sent_at już istnieje';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payment_history_confirmation_sent_idx
  ON public.payment_history(payment_confirmation_sent_at)
  WHERE payment_confirmation_sent_at IS NOT NULL;
