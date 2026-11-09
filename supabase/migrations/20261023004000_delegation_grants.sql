-- Delegation Grants Table and Transactional RPC
-- Enforces row-level grant tracking, idempotency, and live parent authority validation

create table if not exists public.delegation_grants (
  jti text primary key,
  environment_id uuid not null references public.environments(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  parent_mandate_id uuid not null references public.mandates(id) on delete restrict,
  allowed_child_agents jsonb not null default '[]'::jsonb,
  permitted_actions jsonb not null default '[]'::jsonb,
  max_budget_minor bigint not null check (max_budget_minor > 0),
  amount_used_minor bigint not null default 0 check (amount_used_minor >= 0),
  max_depth integer not null default 1 check (max_depth >= 0),
  approval_strictness text not null check (approval_strictness in ('allow_once', 'allow')),
  expires_at timestamptz not null,
  status text not null check (status in ('active', 'consumed', 'revoked', 'expired')),
  request_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_used_minor <= max_budget_minor),
  check (jsonb_typeof(allowed_child_agents) = 'array'),
  check (jsonb_typeof(permitted_actions) = 'array')
);

create index if not exists delegation_grants_env_idx on public.delegation_grants(environment_id);
create index if not exists delegation_grants_parent_mandate_idx on public.delegation_grants(parent_mandate_id);
create index if not exists delegation_grants_request_hash_idx on public.delegation_grants(request_hash);

alter table public.delegation_grants enable row level security;

-- Atomic, Idempotent Delegation RPC under Row Locks
create or replace function public.delegate_mandate_with_grant(
  p_grant_jti text,
  p_idempotency_key text,
  p_caller_kind text,
  p_caller_user_id uuid,
  p_caller_agent_id uuid,
  p_parent_mandate_id uuid,
  p_holder_agent_id uuid,
  p_budget_limit_minor bigint,
  p_currency text,
  p_permitted_actions jsonb,
  p_expires_at timestamptz,
  p_can_delegate boolean,
  p_max_delegation_depth integer,
  p_approval_required boolean,
  p_content_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_row public.delegation_grants;
  parent_row public.mandates;
  child_agent_row public.agents;
  child_row public.mandates;
  existing_child public.mandates;
  decision_code text;
  decision_reason text;
begin
  -- 1. Idempotency check: if a child mandate was already created with this idempotency key/content hash
  select * into existing_child
  from public.mandates
  where parent_mandate_id = p_parent_mandate_id
    and holder_agent_id = p_holder_agent_id
    and content_hash = p_content_hash
    and budget_limit_minor = p_budget_limit_minor;

  if found then
    return jsonb_build_object(
      'mandate', to_jsonb(existing_child),
      'decision', jsonb_build_object(
        'allowed', true,
        'code', 'ALLOW',
        'reason', 'Delegation returned from idempotent execution.'
      )
    );
  end if;

  -- 2. Lock grant and parent mandate rows
  select * into grant_row
  from public.delegation_grants
  where jti = p_grant_jti
  for update;

  if not found then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_NOT_FOUND',
        'reason', 'Delegation grant not found.'
      )
    );
  end if;

  select * into parent_row
  from public.mandates
  where id = p_parent_mandate_id
  for update;

  if not found then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'MANDATE_NOT_FOUND',
        'reason', 'Parent mandate not found.'
      )
    );
  end if;

  -- 3. Verify cross-environment & identity bindings
  if parent_row.environment_id <> grant_row.environment_id then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'AUTHORITY_TARGET_NOT_FOUND',
        'reason', 'Environment mismatch on grant and parent mandate.'
      )
    );
  end if;

  -- Verify caller authority
  if p_caller_kind = 'agent' then
    if p_caller_agent_id is null or p_caller_agent_id <> parent_row.holder_agent_id or p_caller_agent_id <> grant_row.agent_id then
      return jsonb_build_object(
        'mandate', null,
        'decision', jsonb_build_object(
          'allowed', false,
          'code', 'AGENT_IDENTITY_MISMATCH',
          'reason', 'Caller agent does not hold the parent mandate or match the grant.'
        )
      );
    end if;
  elsif p_caller_kind = 'user' then
    if parent_row.issuer_user_id <> p_caller_user_id then
      return jsonb_build_object(
        'mandate', null,
        'decision', jsonb_build_object(
          'allowed', false,
          'code', 'MANDATE_NOT_FOUND',
          'reason', 'Parent mandate not owned by caller user.'
        )
      );
    end if;
  else
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'AUTHENTICATION_REQUIRED',
        'reason', 'Invalid caller principal kind.'
      )
    );
  end if;

  -- 4. Check Child Agent
  select * into child_agent_row
  from public.agents
  where id = p_holder_agent_id
    and environment_id = parent_row.environment_id
    and status = 'active';

  if not found then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'MANDATE_NOT_FOUND',
        'reason', 'Child agent not found in mandate environment.'
      )
    );
  end if;

  -- 5. Validate Live Parent Chain & Status
  if parent_row.state = 'revoked' then
    decision_code := 'MANDATE_REVOKED';
    decision_reason := 'Parent mandate is revoked.';
  elsif parent_row.expires_at <= now() then
    decision_code := 'MANDATE_EXPIRED';
    decision_reason := 'Parent mandate has expired.';
  elsif not parent_row.can_delegate then
    decision_code := 'DELEGATION_NOT_PERMITTED';
    decision_reason := 'Parent cannot delegate authority.';
  elsif parent_row.max_delegation_depth <= 0
    or p_max_delegation_depth >= parent_row.max_delegation_depth then
    decision_code := 'DELEGATION_DEPTH_EXCEEDED';
    decision_reason := 'Delegation depth exceeds parent authority.';
  elsif upper(p_currency) <> parent_row.currency then
    decision_code := 'CURRENCY_MISMATCH';
    decision_reason := 'Child currency differs from parent currency.';
  elsif p_budget_limit_minor <= 0
    or p_budget_limit_minor > parent_row.budget_limit_minor - parent_row.allocated_minor - parent_row.spent_minor - parent_row.reserved_minor then
    decision_code := 'BUDGET_EXCEEDED';
    decision_reason := 'Child allocation exceeds parent available budget.';
  elsif not (parent_row.permitted_actions @> '["*"]'::jsonb or parent_row.permitted_actions @> p_permitted_actions) then
    decision_code := 'ACTION_NOT_PERMITTED';
    decision_reason := 'Child scope broadens parent scope.';
  elsif p_expires_at > parent_row.expires_at then
    decision_code := 'MANDATE_EXPIRED';
    decision_reason := 'Child expiry exceeds parent expiry.';
  elsif parent_row.approval_required and not p_approval_required then
    decision_code := 'APPROVAL_REQUIRED';
    decision_reason := 'Child authority cannot weaken parent approval requirement.';
  end if;

  if decision_code is not null then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object('allowed', false, 'code', decision_code, 'reason', decision_reason)
    );
  end if;

  -- 6. Validate Grant Status & Constraints
  if grant_row.status <> 'active' then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_INACTIVE',
        'reason', 'Delegation grant is ' || grant_row.status || '.'
      )
    );
  end if;

  if grant_row.expires_at <= now() or grant_row.expires_at > parent_row.expires_at then
    update public.delegation_grants set status = 'expired', updated_at = now() where jti = grant_row.jti;
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_EXPIRED',
        'reason', 'Delegation grant has expired.'
      )
    );
  end if;

  if grant_row.allowed_child_agents is not null
    and jsonb_array_length(grant_row.allowed_child_agents) > 0
    and not (grant_row.allowed_child_agents @> jsonb_build_array(p_holder_agent_id::text)
             or grant_row.allowed_child_agents @> jsonb_build_array('*')) then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'CHILD_AGENT_NOT_ALLOWED_BY_GRANT',
        'reason', 'Child agent is not allowed by this delegation grant.'
      )
    );
  end if;

  if not (grant_row.permitted_actions @> '["*"]'::jsonb or grant_row.permitted_actions @> p_permitted_actions) then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'ACTION_NOT_PERMITTED_BY_GRANT',
        'reason', 'Child actions exceed permitted actions on the delegation grant.'
      )
    );
  end if;

  if p_max_delegation_depth > grant_row.max_depth then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'DELEGATION_DEPTH_EXCEEDED',
        'reason', 'Child delegation depth exceeds grant limit.'
      )
    );
  end if;

  if (grant_row.amount_used_minor + p_budget_limit_minor) > grant_row.max_budget_minor then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_BUDGET_EXCEEDED',
        'reason', 'Requested budget exceeds remaining grant capacity.'
      )
    );
  end if;

  -- 7. Execute Delegation & Update Grant
  update public.mandates
  set allocated_minor = allocated_minor + p_budget_limit_minor
  where id = parent_row.id;

  if grant_row.approval_strictness = 'allow_once' then
    update public.delegation_grants
    set amount_used_minor = amount_used_minor + p_budget_limit_minor,
        status = 'consumed',
        updated_at = now()
    where jti = grant_row.jti;
  else
    update public.delegation_grants
    set amount_used_minor = amount_used_minor + p_budget_limit_minor,
        status = case when (amount_used_minor + p_budget_limit_minor) >= max_budget_minor then 'consumed' else 'active' end,
        updated_at = now()
    where jti = grant_row.jti;
  end if;

  insert into public.mandates (
    environment_id,
    issuer_user_id,
    holder_agent_id,
    parent_mandate_id,
    budget_limit_minor,
    currency,
    permitted_actions,
    expires_at,
    can_delegate,
    max_delegation_depth,
    approval_required,
    content_hash
  )
  values (
    parent_row.environment_id,
    parent_row.issuer_user_id,
    p_holder_agent_id,
    parent_row.id,
    p_budget_limit_minor,
    upper(p_currency),
    p_permitted_actions,
    p_expires_at,
    p_can_delegate,
    p_max_delegation_depth,
    p_approval_required,
    p_content_hash
  )
  returning * into child_row;

  return jsonb_build_object(
    'mandate', to_jsonb(child_row),
    'decision', jsonb_build_object(
      'allowed', true,
      'code', 'ALLOW',
      'reason', 'Delegation is permitted under grant.'
    )
  );
end;
$$;

revoke all on function public.delegate_mandate_with_grant(
  text, text, text, uuid, uuid, uuid, uuid, bigint, text, jsonb, timestamptz, boolean, integer, boolean, text
) from public, anon, authenticated;

grant execute on function public.delegate_mandate_with_grant(
  text, text, text, uuid, uuid, uuid, uuid, bigint, text, jsonb, timestamptz, boolean, integer, boolean, text
) to service_role;
