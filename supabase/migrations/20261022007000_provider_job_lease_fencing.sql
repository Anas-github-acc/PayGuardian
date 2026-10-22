alter table public.provider_jobs
  add column if not exists lease_token uuid;

create or replace function public.claim_provider_jobs(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_duration_seconds integer default 60
)
returns setof public.provider_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.provider_jobs;
begin
  if p_limit < 1 or p_lease_duration_seconds < 1 then
    raise exception using message = 'INVALID_JOB_CLAIM';
  end if;

  update public.provider_jobs
  set status = 'failed',
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      last_error_code = coalesce(last_error_code, 'MAX_ATTEMPTS_EXCEEDED'),
      last_error_message = coalesce(
        last_error_message,
        'Provider job lease expired after the final attempt.'
      ),
      updated_at = now()
  where status = 'running'
    and lease_expires_at <= now()
    and attempts >= max_attempts;

  for job_row in
    select *
    from public.provider_jobs
    where (
      (status = 'queued' and available_at <= now())
      or (status = 'running' and lease_expires_at <= now() and attempts < max_attempts)
    )
    order by available_at asc, created_at asc
    limit p_limit
    for update skip locked
  loop
    update public.provider_jobs
    set status = 'running',
        attempts = attempts + 1,
        lease_owner = p_worker_id,
        lease_token = gen_random_uuid(),
        lease_expires_at = now() + make_interval(secs => p_lease_duration_seconds),
        updated_at = now()
    where id = job_row.id
    returning * into job_row;
    return next job_row;
  end loop;
end;
$$;

create or replace function public.renew_provider_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_lease_duration_seconds integer default 60
)
returns public.provider_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.provider_jobs;
begin
  update public.provider_jobs
  set lease_expires_at = now() + make_interval(secs => p_lease_duration_seconds),
      updated_at = now()
  where id = p_job_id
    and status = 'running'
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
    and lease_expires_at > now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.complete_provider_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns public.provider_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.provider_jobs;
begin
  update public.provider_jobs
  set status = 'completed',
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id
    and status = 'running'
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
    and lease_expires_at > now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.fail_provider_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_error_code text,
  p_error_message text,
  p_retry_at timestamptz default null,
  p_should_retry boolean default true
)
returns public.provider_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.provider_jobs;
begin
  update public.provider_jobs
  set status = case
        when p_should_retry and attempts < max_attempts then 'queued'
        else 'failed'
      end,
      available_at = case
        when p_should_retry and attempts < max_attempts then coalesce(
          p_retry_at,
          now() + make_interval(
            secs => least(3600::double precision, power(2::double precision, greatest(0, attempts - 1)))
          )
        )
        else available_at
      end,
      lease_owner = null,
      lease_token = null,
      lease_expires_at = null,
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      updated_at = now()
  where id = p_job_id
    and status = 'running'
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
    and lease_expires_at > now()
  returning * into result;
  return result;
end;
$$;

revoke all on function public.claim_provider_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_provider_jobs(text, integer, integer) to service_role;
revoke all on function public.renew_provider_job(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.renew_provider_job(uuid, text, uuid, integer) to service_role;
revoke all on function public.complete_provider_job(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.complete_provider_job(uuid, text, uuid) to service_role;
revoke all on function public.fail_provider_job(uuid, text, uuid, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.fail_provider_job(uuid, text, uuid, text, text, timestamptz, boolean) to service_role;
