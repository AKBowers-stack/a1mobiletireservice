alter table public.service_requests add column if not exists license_plate text;
alter table public.service_requests add column if not exists signature_name text;
alter table public.service_requests add column if not exists signed_at timestamptz;
alter table public.service_requests add column if not exists policy_version text;

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
