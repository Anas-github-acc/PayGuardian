-- Fix bytea conversion in append_audit_event and verify_audit_chain
-- Replace text::bytea with convert_to(text, 'UTF8') so string values containing quotes or backslashes
-- do not fail with "invalid input syntax for type bytea"

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
  event_id uuid := coalesce(p_id, extensions.gen_random_uuid());
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
    encode(extensions.digest(
      convert_to(jsonb_build_object(
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
      )::text, 'UTF8'),
      'sha256'
    ), 'hex'),
    event_created_at
  )
  returning * into result;
  return result;
end;
$$;

create or replace function public.verify_audit_chain(p_environment_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  event_row record;
  previous text := null;
  expected text;
begin
  for event_row in
    select id, environment_id, actor_type, actor_id, session_id, mandate_id, action_id,
           event_type, outcome, reason_code, payload, previous_hash, event_hash, created_at
    from public.audit_events
    where environment_id = p_environment_id
    order by created_at asc, id asc
  loop
    if event_row.previous_hash is distinct from previous then
      return false;
    end if;

    expected := encode(extensions.digest(
      convert_to(jsonb_build_object(
        'actionId', event_row.action_id,
        'actorId', event_row.actor_id,
        'actorType', event_row.actor_type,
        'createdAt', to_char(event_row.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'environmentId', event_row.environment_id,
        'eventType', event_row.event_type,
        'id', event_row.id,
        'mandateId', event_row.mandate_id,
        'outcome', event_row.outcome,
        'payload', event_row.payload,
        'previousHash', event_row.previous_hash,
        'reasonCode', event_row.reason_code,
        'sessionId', event_row.session_id
      )::text, 'UTF8'),
      'sha256'
    ), 'hex');

    if event_row.event_hash is distinct from expected then
      return false;
    end if;
    previous := event_row.event_hash;
  end loop;
  return true;
end;
$$;
