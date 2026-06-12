alter table public.service_requests add column if not exists cancellation_token uuid;
alter table public.service_requests add column if not exists cancelled_at timestamptz;

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
