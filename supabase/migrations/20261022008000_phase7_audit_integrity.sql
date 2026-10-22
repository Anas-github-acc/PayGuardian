alter table public.audit_events
  add constraint audit_events_actor_type_check
    check (actor_type in ('user', 'agent', 'service', 'system')),
  add constraint audit_events_outcome_check
    check (outcome in ('success', 'denied', 'failure')),
  add constraint audit_events_hash_format_check
    check (event_hash ~ '^[0-9a-f]{64}$');

create index audit_events_environment_created_id_idx
  on public.audit_events(environment_id, created_at asc, id asc);

create or replace function public.reject_audit_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using message = 'AUDIT_EVENTS_APPEND_ONLY';
end;
$$;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function public.reject_audit_event_mutation();

revoke insert, update, delete, truncate on public.audit_events from public, anon, authenticated, service_role;
grant select on public.audit_events to service_role;

revoke all on function public.reject_audit_event_mutation() from public, anon, authenticated, service_role;

create or replace function public.append_audit_event(
  p_id uuid,
  p_environment_id uuid,
  p_actor_type text,
  p_actor_id uuid,
  p_session_id uuid,
  p_mandate_id uuid,
  p_action_id uuid,
  p_event_type text,
  p_outcome text,
  p_reason_code text,
  p_payload jsonb,
  p_created_at timestamptz
)
returns public.audit_events
language plpgsql
security definer
set search_path = public
as $$
declare
  previous text;
  result public.audit_events;
  event_id uuid := coalesce(p_id, gen_random_uuid());
  event_created_at timestamptz := coalesce(p_created_at, now());
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception using message = 'AUDIT_PAYLOAD_INVALID';
  end if;
  if p_actor_type not in ('user', 'agent', 'service', 'system') then
    raise exception using message = 'AUDIT_ACTOR_INVALID';
  end if;
  if p_outcome not in ('success', 'denied', 'failure') then
    raise exception using message = 'AUDIT_OUTCOME_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_environment_id::text, 0));
  select event_hash into previous
  from public.audit_events
  where environment_id = p_environment_id
  order by created_at desc, id desc
  limit 1;

  insert into public.audit_events (
    id, environment_id, actor_type, actor_id, session_id, mandate_id, action_id,
    event_type, outcome, reason_code, payload, previous_hash, event_hash, created_at
  )
  values (
    event_id, p_environment_id, p_actor_type, p_actor_id, p_session_id, p_mandate_id, p_action_id,
    p_event_type, p_outcome, p_reason_code, p_payload, previous,
    encode(digest(
      jsonb_build_object(
        'actionId', p_action_id,
        'actorId', p_actor_id,
        'actorType', p_actor_type,
        'createdAt', to_char(event_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'environmentId', p_environment_id,
        'eventType', p_event_type,
        'id', event_id,
        'mandateId', p_mandate_id,
        'outcome', p_outcome,
        'payload', p_payload,
        'previousHash', previous,
        'reasonCode', p_reason_code,
        'sessionId', p_session_id
      )::text::bytea,
      'sha256'
    ), 'hex'),
     event_created_at
  )
  returning * into result;
  return result;
end;
$$;

revoke all on function public.append_audit_event(uuid, uuid, text, uuid, uuid, uuid, uuid, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.append_audit_event(uuid, uuid, text, uuid, uuid, uuid, uuid, text, text, text, jsonb, timestamptz)
  to service_role;
