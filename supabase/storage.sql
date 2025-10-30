-- Utwórz prywatny bucket na umowy (agreements)
insert into storage.buckets (id, name, public)
values ('agreements', 'agreements', false)
on conflict (id) do nothing;

-- Polityki: brak publicznego dostępu; admin/koordynator mogą czytać
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
create policy storage_agreements_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agreements'
  and public.is_admin()
);


