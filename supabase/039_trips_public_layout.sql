-- 039_trips_public_layout.sql
-- Pola do przechowywania ustawień layoutu publicznego widoku wycieczki

alter table public.trips
  add column if not exists public_middle_sections text[] default null,
  add column if not exists public_right_sections text[] default null,
  add column if not exists public_hidden_middle_sections text[] default null,
  add column if not exists public_hidden_right_sections text[] default null,
  add column if not exists public_hidden_additional_sections text[] default null;

