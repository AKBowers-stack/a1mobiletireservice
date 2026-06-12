alter table public.service_requests add column if not exists cancellation_token uuid;
alter table public.service_requests add column if not exists cancelled_at timestamptz;

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

drop policy if exists "Admins can delete request photos" on storage.objects;
create policy "Admins can delete request photos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'request-photos');
