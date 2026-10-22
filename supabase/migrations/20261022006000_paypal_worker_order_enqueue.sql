create or replace function public.enqueue_paypal_order_worker(
  p_environment_id uuid,
  p_agent_id uuid,
  p_mandate_id uuid,
  p_ledger_account_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_action text,
  p_amount_minor bigint,
  p_currency text,
  p_return_url text,
  p_cancel_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  authorization_result jsonb;
  action_row public.protected_actions;
  reservation_row public.reservations;
  operation_row public.provider_operations;
  job_row public.provider_jobs;
  job_result jsonb;
  return_url text;
  cancel_url text;
  deduplicated boolean;
begin
  if nullif(trim(p_return_url), '') is null or nullif(trim(p_cancel_url), '') is null then
    raise exception using message = 'PAYPAL_CALLBACK_URL_REQUIRED';
  end if;

  -- Reuse the existing authority, idempotency, account, and reservation checks
  -- inside this transaction rather than repeating them in a second API call.
  authorization_result := public.authorize_and_reserve_action(
    p_environment_id,
    p_agent_id,
    p_mandate_id,
    p_ledger_account_id,
    p_idempotency_key,
    p_request_hash,
    p_action,
    p_amount_minor,
    p_currency
  );

  select * into action_row
  from public.protected_actions
  where id = (authorization_result->'action'->>'id')::uuid
  for update;

  select * into reservation_row
  from public.reservations
  where action_id = action_row.id
  for update;

  return_url := p_return_url
    || case when strpos(p_return_url, '?') > 0 then '&' else '?' end
    || 'environment_id=' || action_row.environment_id::text
    || '&action_id=' || action_row.id::text;
  cancel_url := p_cancel_url
    || case when strpos(p_cancel_url, '?') > 0 then '&' else '?' end
    || 'environment_id=' || action_row.environment_id::text
    || '&action_id=' || action_row.id::text;

  insert into public.provider_operations (
    environment_id,
    action_id,
    provider,
    provider_order_id,
    approval_url,
    status,
    observed_provider_status,
    intent,
    payload
  )
  values (
    action_row.environment_id,
    action_row.id,
    'paypal',
    null,
    null,
    'PENDING',
    'PENDING',
    'create_order',
    jsonb_build_object('returnUrl', return_url, 'cancelUrl', cancel_url)
  )
  on conflict (action_id) do nothing
  returning * into operation_row;

  if operation_row.id is null then
    select * into operation_row
    from public.provider_operations
    where action_id = action_row.id
    for update;
  end if;

  if operation_row.provider <> 'paypal' then
    raise exception using message = 'PAYPAL_OPERATION_PROVIDER_CONFLICT';
  end if;

  job_result := public.enqueue_provider_job(
    'paypal',
    'create_order',
    'paypal:create_order:' || action_row.id::text,
    jsonb_build_object(
      'action', jsonb_build_object(
        'id', action_row.id,
        'environmentId', action_row.environment_id,
        'agentId', action_row.agent_id,
        'mandateId', action_row.mandate_id,
        'idempotencyKey', action_row.idempotency_key,
        'requestHash', action_row.request_hash,
        'action', action_row.action,
        'amountMinor', action_row.amount_minor,
        'currency', action_row.currency,
        'authorizationState', action_row.authorization_state,
        'executionState', action_row.execution_state,
        'createdAt', action_row.created_at
      ),
      'returnUrl', return_url,
      'cancelUrl', cancel_url
    ),
    5,
    now()
  );
  deduplicated := coalesce((job_result->>'deduplicated')::boolean, false);

  -- Backfill the relationship columns when this deduplicates a job created by
  -- the earlier non-atomic enqueue path.
  update public.provider_jobs
  set environment_id = coalesce(environment_id, action_row.environment_id),
      action_id = coalesce(action_id, action_row.id),
      provider_operation_id = coalesce(provider_operation_id, operation_row.id),
      updated_at = now()
  where id = (job_result->'job'->>'id')::uuid
    and (
      environment_id is null
      or action_id is null
      or provider_operation_id is null
    );

  select * into job_row
  from public.provider_jobs
  where id = (job_result->'job'->>'id')::uuid;

  return jsonb_build_object(
    'action', jsonb_build_object(
      'id', action_row.id,
      'environmentId', action_row.environment_id,
      'agentId', action_row.agent_id,
      'mandateId', action_row.mandate_id,
      'idempotencyKey', action_row.idempotency_key,
      'requestHash', action_row.request_hash,
      'action', action_row.action,
      'amountMinor', action_row.amount_minor,
      'currency', action_row.currency,
      'authorizationState', action_row.authorization_state,
      'executionState', action_row.execution_state,
      'createdAt', action_row.created_at
    ),
    'reservation', jsonb_build_object(
      'actionId', reservation_row.action_id,
      'accountId', reservation_row.ledger_account_id,
      'amountMinor', reservation_row.amount_minor,
      'state', reservation_row.state
    ),
    'operation', to_jsonb(operation_row),
    'job', to_jsonb(job_row),
    'deduplicated', deduplicated
  );
end;
$$;

revoke all on function public.enqueue_paypal_order_worker(
  uuid, uuid, uuid, uuid, text, text, text, bigint, text, text, text
) from public, anon, authenticated;
grant execute on function public.enqueue_paypal_order_worker(
  uuid, uuid, uuid, uuid, text, text, text, bigint, text, text, text
) to service_role;
