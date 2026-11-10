-- Migration: 20261111002000_auto_topup_in_delegation_rpcs.sql
-- Enables automatic versioning and top-up when delegating to an agent that already holds an active mandate

-- 1. Redefine delegate_mandate so that if an active mandate already exists for holder_agent_id in the environment,
-- it routes atomically to topup_mandate_atomic
CREATE OR REPLACE FUNCTION public.delegate_mandate(
  p_parent_mandate_id uuid,
  p_issuer_user_id uuid,
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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  parent_row public.mandates;
  existing_child public.mandates;
  holder_row public.agents;
  child_row public.mandates;
  decision_code text;
  decision_reason text;
  new_mandate_id uuid := gen_random_uuid();
begin
  select * into parent_row
  from public.mandates
  where id = p_parent_mandate_id
    and state = 'active'
    and exists (
      select 1
      from public.environment_memberships membership
      where membership.environment_id = mandates.environment_id
        and membership.user_id = p_issuer_user_id
        and membership.role in ('owner', 'operator')
    )
  for update;

  if not found then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'PARENT_NOT_FOUND',
        'reason', 'Active parent mandate not found or caller lacks environment access.'
      )
    );
  end if;

  select * into holder_row
  from public.agents
  where id = p_holder_agent_id
    and environment_id = parent_row.environment_id
    and owner_user_id = p_issuer_user_id
    and status = 'active';

  if not found then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'HOLDER_NOT_FOUND',
        'reason', 'Holder agent not found or inactive.'
      )
    );
  end if;

  -- Check if child already holds an active mandate in this environment
  select * into existing_child
  from public.mandates
  where holder_agent_id = p_holder_agent_id
    and environment_id = parent_row.environment_id
    and state = 'active'
  limit 1;

  if found then
    -- Route to top-up logic!
    return public.topup_mandate_atomic(
      p_parent_mandate_id := parent_row.id,
      p_issuer_user_id := p_issuer_user_id,
      p_holder_agent_id := p_holder_agent_id,
      p_additional_budget_minor := p_budget_limit_minor,
      p_currency := p_currency,
      p_permitted_actions := p_permitted_actions,
      p_expires_at := p_expires_at,
      p_can_delegate := p_can_delegate,
      p_max_delegation_depth := p_max_delegation_depth,
      p_approval_required := p_approval_required,
      p_content_hash := p_content_hash
    );
  end if;

  -- Initial delegation validations
  if not parent_row.can_delegate then
    decision_code := 'DELEGATION_DISABLED';
    decision_reason := 'Parent mandate cannot delegate.';
  elsif parent_row.max_delegation_depth <= 0 then
    decision_code := 'DELEGATION_DEPTH_EXCEEDED';
    decision_reason := 'Maximum delegation depth reached.';
  elsif p_max_delegation_depth >= parent_row.max_delegation_depth then
    decision_code := 'DELEGATION_DEPTH_EXCEEDED';
    decision_reason := 'Child delegation depth must be strictly less than parent.';
  elsif upper(p_currency) <> parent_row.currency then
    decision_code := 'CURRENCY_MISMATCH';
    decision_reason := 'Child currency must match parent currency.';
  elsif p_budget_limit_minor <= 0 then
    decision_code := 'BUDGET_INVALID';
    decision_reason := 'Budget must be greater than zero.';
  elsif (parent_row.budget_limit_minor - parent_row.allocated_minor - parent_row.spent_minor - parent_row.reserved_minor) < p_budget_limit_minor then
    decision_code := 'BUDGET_EXCEEDED';
    decision_reason := 'Child allocation exceeds parent available budget.';
  elsif p_expires_at <= now() or p_expires_at > parent_row.expires_at then
    decision_code := 'MANDATE_EXPIRED';
    decision_reason := 'Child expiry must be in future and cannot exceed parent expiry.';
  elsif jsonb_typeof(p_permitted_actions) <> 'array' or not (
    parent_row.permitted_actions @> '["*"]'::jsonb or parent_row.permitted_actions @> p_permitted_actions
  ) then
    decision_code := 'ACTION_NOT_PERMITTED';
    decision_reason := 'Child actions must be subset of parent actions.';
  elsif parent_row.approval_required and not p_approval_required then
    decision_code := 'APPROVAL_REQUIRED';
    decision_reason := 'Child mandate cannot weaken parent approval requirement.';
  end if;

  if decision_code is not null then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', decision_code,
        'reason', decision_reason
      )
    );
  end if;

  update public.mandates
  set allocated_minor = allocated_minor + p_budget_limit_minor
  where id = parent_row.id;

  insert into public.mandates (
    id,
    mandate_series_id,
    version,
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
    new_mandate_id,
    new_mandate_id,
    1,
    parent_row.environment_id,
    p_issuer_user_id,
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
      'reason', 'Delegation is permitted.'
    )
  );
end;
$$;

-- 2. Update topup_mandate_atomic so that:
-- prev_row is resolved by (holder_agent_id = p_holder_agent_id and environment_id = parent_row.environment_id and state = 'active')
CREATE OR REPLACE FUNCTION public.topup_mandate_atomic(
  p_parent_mandate_id uuid,
  p_issuer_user_id uuid,
  p_holder_agent_id uuid,
  p_additional_budget_minor bigint,
  p_currency text,
  p_permitted_actions jsonb,
  p_expires_at timestamptz,
  p_can_delegate boolean,
  p_max_delegation_depth integer,
  p_approval_required boolean,
  p_content_hash text,
  p_idempotency_key text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  parent_row public.mandates;
  prev_row public.mandates;
  new_row public.mandates;
  parent_acc public.ledger_accounts;
  child_acc public.ledger_accounts;
  target_actions jsonb;
  target_expires timestamptz;
  target_approval boolean;
  target_depth integer;
begin
  if p_additional_budget_minor <= 0 then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'BUDGET_EXCEEDED',
        'reason', 'Additional budget must be positive.'
      )
    );
  end if;

  -- 1. Lock parent mandate
  select * into parent_row
  from public.mandates
  where id = p_parent_mandate_id
    and issuer_user_id = p_issuer_user_id
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

  if parent_row.state = 'revoked' then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'MANDATE_REVOKED',
        'reason', 'Parent mandate is revoked.'
      )
    );
  end if;
  if parent_row.expires_at <= now() then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'MANDATE_EXPIRED',
        'reason', 'Parent mandate has expired.'
      )
    );
  end if;
  if not parent_row.can_delegate then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'DELEGATION_NOT_PERMITTED',
        'reason', 'Parent cannot delegate authority.'
      )
    );
  end if;
  if upper(p_currency) <> parent_row.currency then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'CURRENCY_MISMATCH',
        'reason', 'Child currency differs from parent currency.'
      )
    );
  end if;

  -- 2. Lock active previous version for this child in this environment
  select * into prev_row
  from public.mandates
  where holder_agent_id = p_holder_agent_id
    and environment_id = parent_row.environment_id
    and state = 'active'
  for update;

  if not found then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'MANDATE_NOT_FOUND',
        'reason', 'Active previous mandate not found for top-up.'
      )
    );
  end if;

  -- 3. Capacity check on parent (only additional budget)
  if p_additional_budget_minor > (parent_row.budget_limit_minor - parent_row.allocated_minor - parent_row.spent_minor - parent_row.reserved_minor) then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'BUDGET_EXCEEDED',
        'reason', 'Child allocation exceeds parent available budget.'
      )
    );
  end if;

  -- 4. Permission check: subset of both parent and previous
  target_actions := coalesce(p_permitted_actions, prev_row.permitted_actions);
  if not (parent_row.permitted_actions @> '["*"]'::jsonb or parent_row.permitted_actions @> target_actions) then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'ACTION_NOT_PERMITTED',
        'reason', 'Top-up actions exceed parent permitted actions.'
      )
    );
  end if;
  if not (prev_row.permitted_actions @> '["*"]'::jsonb or prev_row.permitted_actions @> target_actions) then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'ACTION_NOT_PERMITTED',
        'reason', 'Top-up actions cannot expand previous permissions.'
      )
    );
  end if;

  -- 5. Expiry check: cannot exceed min(parent.expires_at, prev.expires_at)
  target_expires := coalesce(p_expires_at, prev_row.expires_at);
  if target_expires > parent_row.expires_at then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'MANDATE_EXPIRED',
        'reason', 'Child expiry exceeds parent expiry.'
      )
    );
  end if;
  if target_expires > prev_row.expires_at then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'MANDATE_EXPIRED',
        'reason', 'Child expiry cannot exceed previous mandate expiry.'
      )
    );
  end if;

  -- 6. Approval check: cannot weaken approval requirements
  target_approval := coalesce(p_approval_required, prev_row.approval_required);
  if (parent_row.approval_required and not target_approval) or (prev_row.approval_required and not target_approval) then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'APPROVAL_REQUIRED',
        'reason', 'Child authority cannot weaken the parent or previous approval requirement.'
      )
    );
  end if;

  -- 7. Delegation depth check
  target_depth := coalesce(p_max_delegation_depth, prev_row.max_delegation_depth);
  if target_depth >= parent_row.max_delegation_depth or target_depth > prev_row.max_delegation_depth then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'DELEGATION_DEPTH_EXCEEDED',
        'reason', 'Child delegation depth cannot exceed limits.'
      )
    );
  end if;

  -- 8. Supersede the previous mandate version
  update public.mandates
  set state = 'superseded',
      superseded_at = now()
  where id = prev_row.id;

  -- 9. Insert the new mandate version
  insert into public.mandates (
    environment_id,
    issuer_user_id,
    holder_agent_id,
    parent_mandate_id,
    mandate_series_id,
    version,
    previous_mandate_id,
    budget_limit_minor,
    spent_minor,
    reserved_minor,
    allocated_minor,
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
    prev_row.mandate_series_id,
    prev_row.version + 1,
    prev_row.id,
    prev_row.budget_limit_minor + p_additional_budget_minor,
    prev_row.spent_minor,
    prev_row.reserved_minor,
    prev_row.allocated_minor,
    prev_row.currency,
    target_actions,
    target_expires,
    coalesce(p_can_delegate, prev_row.can_delegate),
    target_depth,
    target_approval,
    p_content_hash
  )
  returning * into new_row;

  -- 10. Update parent mandate allocated amount by ONLY the incremental addition
  update public.mandates
  set allocated_minor = allocated_minor + p_additional_budget_minor
  where id = parent_row.id;

  -- 11. Update ledger accounts if present
  select * into child_acc
  from public.ledger_accounts
  where mandate_series_id = prev_row.mandate_series_id
  for update;

  select * into parent_acc
  from public.ledger_accounts
  where mandate_id = parent_row.id
  for update;

  if child_acc.id is not null and parent_acc.id is not null then
    update public.ledger_accounts
    set available_minor = available_minor + p_additional_budget_minor
    where id = child_acc.id;

    update public.ledger_accounts
    set available_minor = available_minor - p_additional_budget_minor
    where id = parent_acc.id;
  end if;

  return jsonb_build_object(
    'mandate', to_jsonb(new_row),
    'decision', jsonb_build_object(
      'allowed', true,
      'code', 'ALLOW',
      'reason', 'Top-up delegation permitted.'
    )
  );
end;
$$;

-- 3. Update delegate_mandate_with_grant to auto-topup existing active mandates
DROP FUNCTION IF EXISTS public.delegate_mandate_with_grant(uuid, text, text, uuid, uuid, uuid, uuid, bigint, text, jsonb, timestamptz, boolean, integer, boolean, text);

CREATE OR REPLACE FUNCTION public.delegate_mandate_with_grant(
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
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  grant_row public.delegation_grants;
  parent_row public.mandates;
  existing_child public.mandates;
  child_row public.mandates;
  new_mandate_id uuid := gen_random_uuid();
  topup_res jsonb;
begin
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
        'reason', 'Delegation grant was not found or is invalid.'
      )
    );
  end if;

  if grant_row.status <> 'active' then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_NOT_ACTIVE',
        'reason', 'Delegation grant is no longer active.'
      )
    );
  end if;

  if grant_row.expires_at <= now() then
    update public.delegation_grants
    set status = 'expired', updated_at = now()
    where jti = grant_row.jti;

    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_EXPIRED',
        'reason', 'Delegation grant has expired.'
      )
    );
  end if;

  if p_caller_kind <> 'agent' or p_caller_agent_id is null or p_caller_agent_id <> grant_row.agent_id then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_CALLER_MISMATCH',
        'reason', 'Caller agent does not match the agent bound to this delegation grant.'
      )
    );
  end if;

  if grant_row.allowed_child_agents is not null and jsonb_array_length(to_jsonb(grant_row.allowed_child_agents)) > 0 then
    if not (
      grant_row.allowed_child_agents @> array['*']::text[]
      or grant_row.allowed_child_agents @> array[p_holder_agent_id::text]::text[]
    ) then
      return jsonb_build_object(
        'mandate', null,
        'decision', jsonb_build_object(
          'allowed', false,
          'code', 'CHILD_AGENT_NOT_ALLOWED',
          'reason', 'Grant does not permit delegation to the requested child agent.'
        )
      );
    end if;
  end if;

  if not (
    grant_row.permitted_actions @> array['*']::text[]
    or grant_row.permitted_actions @> array(select jsonb_array_elements_text(p_permitted_actions))
  ) then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'ACTION_NOT_PERMITTED_BY_GRANT',
        'reason', 'Requested actions exceed permitted actions on the delegation grant.'
      )
    );
  end if;

  if (grant_row.amount_used_minor + p_budget_limit_minor) > grant_row.max_budget_minor then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_BUDGET_EXCEEDED',
        'reason', 'Requested amount exceeds available grant budget.'
      )
    );
  end if;

  if grant_row.approval_strictness = 'strict' and not p_approval_required then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'STRICT_APPROVAL_REQUIRED',
        'reason', 'Grant strictly enforces approval_required = true for delegated authority.'
      )
    );
  end if;

  if p_max_delegation_depth > grant_row.max_depth then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_DEPTH_EXCEEDED',
        'reason', 'Delegation depth exceeds the max depth specified in the grant.'
      )
    );
  end if;

  select * into parent_row
  from public.mandates
  where id = p_parent_mandate_id
    and state = 'active'
  for update;

  if not found then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'PARENT_NOT_FOUND',
        'reason', 'Parent mandate not found or inactive.'
      )
    );
  end if;

  if upper(p_currency) <> parent_row.currency then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'CURRENCY_MISMATCH',
        'reason', 'Child currency must match parent currency.'
      )
    );
  end if;

  if p_expires_at > parent_row.expires_at or p_expires_at > grant_row.expires_at then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'MANDATE_EXPIRED',
        'reason', 'Child expiry cannot exceed parent mandate or grant expiry.'
      )
    );
  end if;

  -- Check if child already holds an active mandate in this environment
  select * into existing_child
  from public.mandates
  where holder_agent_id = p_holder_agent_id
    and environment_id = parent_row.environment_id
    and state = 'active'
  limit 1;

  if found then
    topup_res := public.topup_mandate_atomic(
      p_parent_mandate_id := parent_row.id,
      p_issuer_user_id := parent_row.issuer_user_id,
      p_holder_agent_id := p_holder_agent_id,
      p_additional_budget_minor := p_budget_limit_minor,
      p_currency := p_currency,
      p_permitted_actions := p_permitted_actions,
      p_expires_at := p_expires_at,
      p_can_delegate := p_can_delegate,
      p_max_delegation_depth := p_max_delegation_depth,
      p_approval_required := p_approval_required,
      p_content_hash := p_content_hash,
      p_idempotency_key := p_idempotency_key
    );

    if (topup_res->'mandate') is not null and (topup_res->'mandate') <> 'null'::jsonb then
      update public.delegation_grants
      set amount_used_minor = amount_used_minor + p_budget_limit_minor,
          status = case when (amount_used_minor + p_budget_limit_minor) >= max_budget_minor then 'consumed' else 'active' end,
          updated_at = now()
      where jti = grant_row.jti;
    end if;

    return topup_res;
  end if;

  if (parent_row.budget_limit_minor - parent_row.allocated_minor - parent_row.spent_minor - parent_row.reserved_minor) < p_budget_limit_minor then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'BUDGET_EXCEEDED',
        'reason', 'Child allocation exceeds parent available budget.'
      )
    );
  end if;

  update public.mandates
  set allocated_minor = allocated_minor + p_budget_limit_minor
  where id = parent_row.id;

  update public.delegation_grants
  set amount_used_minor = amount_used_minor + p_budget_limit_minor,
      status = case when (amount_used_minor + p_budget_limit_minor) >= max_budget_minor then 'consumed' else 'active' end,
      updated_at = now()
  where jti = grant_row.jti;

  insert into public.mandates (
    id,
    mandate_series_id,
    version,
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
    new_mandate_id,
    new_mandate_id,
    1,
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
    'decision', jsonb_build_object('allowed', true, 'code', 'ALLOW', 'reason', 'Delegation is permitted under grant.')
  );
end;
$$;
