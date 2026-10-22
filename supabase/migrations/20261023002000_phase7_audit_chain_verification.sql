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
      jsonb_build_object(
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
      )::text::bytea,
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

revoke all on function public.verify_audit_chain(uuid) from public, anon, authenticated;
grant execute on function public.verify_audit_chain(uuid) to service_role;
