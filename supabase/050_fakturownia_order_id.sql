-- 050: Dodanie kolumny fakturownia_order_id do tabeli bookings
-- Przechowuje ID zamówienia w Fakturownia (wymagane dla faktur zaliczkowych od KSeF)

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS fakturownia_order_id TEXT;

COMMENT ON COLUMN public.bookings.fakturownia_order_id IS
  'ID zamówienia w systemie Fakturownia – wymagane jako podstawa dla faktur zaliczkowych (KSeF)';
