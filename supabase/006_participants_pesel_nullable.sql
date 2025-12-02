-- 006: Umożliwienie uczestników bez PESEL w CRM
-- Wcześniej kolumna pesel była NOT NULL, więc insert z pesel = null kończył się błędem.

alter table public.participants
  alter column pesel drop not null;


