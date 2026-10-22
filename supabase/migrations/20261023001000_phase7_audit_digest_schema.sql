-- Supabase installs pgcrypto in the extensions schema. The original audit RPC
-- used an unqualified digest() call while forcing search_path=public, which
-- made live audit appends fail even though the migration itself applied.
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
