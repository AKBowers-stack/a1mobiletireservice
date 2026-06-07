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
