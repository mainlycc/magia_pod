-- 004: Funkcja agregująca dane uczestników na potrzeby listy CRM
create or replace function public.get_participants_overview()
returns table (
  id uuid,
  first_name text,
  last_name text,
  pesel text,
  birth_date date,
  notes text,
  group_name text,
  trips_count integer,
  last_trip_title text,
  last_trip_start date,
  last_trip_end date
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.pesel,
    p.birth_date,
    p.notes,
    p.group_name,
    count(distinct t.id)::integer as trips_count,
    max(t.title) as last_trip_title,
    max(t.start_date) as last_trip_start,
    max(t.end_date) as last_trip_end
  from public.participants p
  left join public.bookings b on b.id = p.booking_id
  left join public.trips t on t.id = b.trip_id
  group by
    p.id,
    p.first_name,
    p.last_name,
    p.pesel,
    p.birth_date,
    p.notes,
    p.group_name;
$$;

grant execute on function public.get_participants_overview() to authenticated;


