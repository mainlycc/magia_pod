-- 003: Rozszerzenie tabeli participants o dodatkowe pola dla CRM uczestników
alter table public.participants
  add column if not exists birth_date date null,
  add column if not exists notes text null,
  add column if not exists medical_info text null,
  add column if not exists consents_summary text null,
  add column if not exists group_name text null;


