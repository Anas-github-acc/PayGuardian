alter table public.provider_jobs
  add column if not exists environment_id uuid references public.environments(id) on delete cascade,
  add column if not exists action_id uuid references public.protected_actions(id) on delete set null,
  add column if not exists provider_operation_id uuid references public.provider_operations(id) on delete set null,
  add column if not exists provider_event_id uuid references public.provider_events(id) on delete set null,
  add column if not exists lease_token uuid;

create index if not exists provider_jobs_operation_idx
  on public.provider_jobs(provider_operation_id, created_at desc);
create index if not exists provider_jobs_action_idx
  on public.provider_jobs(action_id, created_at desc);
create index if not exists provider_jobs_event_idx
  on public.provider_jobs(provider_event_id, created_at desc);

create or replace function public.apply_paypal_observation(
  p_environment_id uuid,
  p_action_id uuid,
  p_status text,
  p_observed_provider_status text,
  p_reconciliation_state text,
  p_last_checked_at timestamptz,
  p_last_event_at timestamptz,
  p_last_error_code text,
  p_capture_id text
)
returns public.provider_operations
language plpgsql
security definer
set search_path = public
as $$
declare
  operation_row public.provider_operations;
begin
  select * into operation_row
  from public.provider_operations
  where environment_id = p_environment_id and action_id = p_action_id
  for update;

  if not found then
    raise exception using message = 'PAYPAL_OPERATION_NOT_FOUND';
  end if;

  if p_status in ('COMPLETED', 'CAPTURED') then
    perform public.capture_reservation(p_environment_id, p_action_id);
  elsif p_status in ('FAILED', 'DENIED', 'CANCELLED', 'VOIDED') then
    perform public.release_reservation(
      p_environment_id,
      p_action_id,
      'PayPal provider status: ' || p_status
    );
  end if;

  update public.provider_operations
  set status = p_status,
      observed_provider_status = coalesce(p_observed_provider_status, p_status),
      reconciliation_state = coalesce(p_reconciliation_state, reconciliation_state),
      last_checked_at = coalesce(p_last_checked_at, last_checked_at),
      last_event_at = coalesce(p_last_event_at, last_event_at),
      last_error_code = p_last_error_code,
      capture_id = coalesce(p_capture_id, capture_id),
      updated_at = now()
  where environment_id = p_environment_id and action_id = p_action_id
  returning * into operation_row;

  return operation_row;
end;
$$;

revoke all on function public.apply_paypal_observation(
  uuid, uuid, text, text, text, timestamptz, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.apply_paypal_observation(
  uuid, uuid, text, text, text, timestamptz, timestamptz, text, text
) to service_role;
