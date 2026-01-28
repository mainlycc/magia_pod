-- 040_trips_weather_visibility.sql
-- Flaga widoczności okna pogody w publicznym widoku wycieczki

alter table public.trips
  add column if not exists show_weather_card boolean default true;

`