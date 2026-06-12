create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new',
  eta text default '',
  name text not null,
  phone text not null,
  make text not null,
  model text not null,
  tire_size text not null,
  license_plate text not null,
  service text not null,
  location text not null,
  photo_name text default '',
  photo_path text default '',
  notes text default '',
  policies_accepted boolean not null default false,
  signature_name text not null,
  signed_at timestamptz not null default now(),
  policy_version text not null
);

alter table public.service_requests add column if not exists license_plate text;
alter table public.service_requests add column if not exists signature_name text;
alter table public.service_requests add column if not exists signed_at timestamptz;
alter table public.service_requests add column if not exists policy_version text;
alter table public.service_requests add column if not exists cancellation_token uuid;
alter table public.service_requests add column if not exists cancelled_at timestamptz;

alter table public.service_requests enable row level security;

drop policy if exists "Customers can create service requests" on public.service_requests;
create policy "Customers can create service requests"
on public.service_requests
for insert
to anon, authenticated
with check (
  policies_accepted = true
  and nullif(trim(signature_name), '') is not null
  and signed_at is not null
  and nullif(trim(policy_version), '') is not null
  and nullif(trim(license_plate), '') is not null
);

drop policy if exists "Admins can read service requests" on public.service_requests;
create policy "Admins can read service requests"
on public.service_requests
for select
to authenticated
using (true);

drop policy if exists "Admins can update service requests" on public.service_requests;
create policy "Admins can update service requests"
on public.service_requests
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Admins can delete service requests" on public.service_requests;
create policy "Admins can delete service requests"
on public.service_requests
for delete
to authenticated
using (true);

create or replace function public.get_service_request_status(request_id uuid, request_token uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select status
  from public.service_requests
  where id = request_id
    and cancellation_token = request_token
  limit 1;
$$;

revoke all on function public.get_service_request_status(uuid, uuid) from public;
grant execute on function public.get_service_request_status(uuid, uuid) to anon, authenticated;

create or replace function public.cancel_service_request(request_id uuid, request_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.service_requests
  set status = 'cancelled', cancelled_at = now()
  where id = request_id
    and cancellation_token = request_token
    and status = 'new';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.cancel_service_request(uuid, uuid) from public;
grant execute on function public.cancel_service_request(uuid, uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-photos',
  'request-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Customers can upload request photos" on storage.objects;
create policy "Customers can upload request photos"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'request-photos');

drop policy if exists "Admins can read request photos" on storage.objects;
create policy "Admins can read request photos"
on storage.objects
for select
to authenticated
using (bucket_id = 'request-photos');

drop policy if exists "Admins can delete request photos" on storage.objects;
create policy "Admins can delete request photos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'request-photos');
