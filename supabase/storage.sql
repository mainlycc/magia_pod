-- Utwórz prywatny bucket na umowy (agreements)
insert into storage.buckets (id, name, public)
values ('agreements', 'agreements', false)
on conflict (id) do nothing;

-- Polityki: brak publicznego dostępu; admin/koordynator mogą czytać
drop policy if exists storage_agreements_read on storage.objects;
create policy storage_agreements_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'agreements'
  and (
    public.is_admin()
    or public.is_coordinator()
  )
);

-- Upload tylko dla admina (jeśli potrzebny upload z klienta)
drop policy if exists storage_agreements_insert on storage.objects;
create policy storage_agreements_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agreements'
  and public.is_admin()
);

-- Utwórz publiczny bucket na zdjęcia wycieczek (trip-gallery)
insert into storage.buckets (id, name, public)
values ('trip-gallery', 'trip-gallery', true)
on conflict (id) do nothing;

-- Polityki: publiczny odczyt dla wszystkich, upload tylko dla admina
drop policy if exists storage_trip_gallery_read on storage.objects;
create policy storage_trip_gallery_read
on storage.objects
for select
to public
using (bucket_id = 'trip-gallery');

drop policy if exists storage_trip_gallery_insert on storage.objects;
create policy storage_trip_gallery_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trip-gallery'
  and public.is_admin()
);

drop policy if exists storage_trip_gallery_delete on storage.objects;
create policy storage_trip_gallery_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trip-gallery'
  and public.is_admin()
);


