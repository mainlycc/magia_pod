-- 005: Umożliwienie tworzenia uczestników niezależnie od rezerwacji (CRM)
-- Wcześniej kolumna booking_id była NOT NULL, więc insert bez rezerwacji kończył się błędem.

alter table public.participants
  alter column booking_id drop not null;


