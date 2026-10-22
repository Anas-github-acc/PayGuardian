alter table public.provider_operations
  add column if not exists intent text,
  add column if not exists payload jsonb;

alter table public.provider_events
  add column if not exists intent text,
  add column if not exists payload jsonb;

create table public.provider_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  intent text not null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error_code text,
  last_error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, dedupe_key)
);

create index provider_jobs_claim_idx
  on public.provider_jobs(status, available_at, created_at);
create index provider_jobs_provider_created_idx
  on public.provider_jobs(provider, created_at desc);

alter table public.provider_jobs enable row level security;

create or replace function public.enqueue_provider_job(
  p_provider text,
  p_intent text,
  p_dedupe_key text,
  p_payload jsonb,
  p_max_attempts integer,
  p_available_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.provider_jobs;
  result public.provider_jobs;
begin
  select * into existing
  from public.provider_jobs
  where provider = p_provider and dedupe_key = p_dedupe_key
  for update;

  if found then
    return jsonb_build_object('job', to_jsonb(existing), 'deduplicated', true);
  end if;

  insert into public.provider_jobs (
    provider, intent, dedupe_key, payload, max_attempts, available_at
  )
  values (
    p_provider, p_intent, p_dedupe_key, coalesce(p_payload, '{}'::jsonb), p_max_attempts,
    coalesce(p_available_at, now())
  )
  returning * into result;

  return jsonb_build_object('job', to_jsonb(result), 'deduplicated', false);
exception
  when unique_violation then
    select * into existing
    from public.provider_jobs
    where provider = p_provider and dedupe_key = p_dedupe_key;
    return jsonb_build_object('job', to_jsonb(existing), 'deduplicated', true);
end;
$$;

revoke all on function public.enqueue_provider_job(text, text, text, jsonb, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_provider_job(text, text, text, jsonb, integer, timestamptz) to service_role;

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

revoke all on function public.claim_provider_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_provider_jobs(text, integer, integer) to service_role;

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

revoke all on function public.renew_provider_job(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.renew_provider_job(uuid, text, uuid, integer) to service_role;

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

revoke all on function public.complete_provider_job(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.complete_provider_job(uuid, text, uuid) to service_role;

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

revoke all on function public.fail_provider_job(uuid, text, uuid, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.fail_provider_job(uuid, text, uuid, text, text, timestamptz, boolean) to service_role;
