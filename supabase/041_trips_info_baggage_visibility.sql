-- 041_trips_info_baggage_visibility.sql
-- Flagi widoczności kart: informacje o wyjeździe i bagaż

alter table public.trips
  add column if not exists show_trip_info_card boolean default true,
  add column if not exists show_baggage_card boolean default true;

