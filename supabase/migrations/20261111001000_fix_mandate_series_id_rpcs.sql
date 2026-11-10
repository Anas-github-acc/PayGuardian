-- Fix mandate_series_id NOT NULL requirement and RPCs
-- Migration: 20261111001000_fix_mandate_series_id_rpcs.sql

-- 1. Ensure public.mandates has a default for mandate_series_id
ALTER TABLE public.mandates
  ALTER COLUMN mandate_series_id SET DEFAULT gen_random_uuid();

-- 2. Update create_root_mandate to explicitly set mandate_series_id = id and version = 1
CREATE OR REPLACE FUNCTION public.create_root_mandate(
  p_environment_id uuid,
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
RETURNS public.mandates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  environment_row public.environments;
  holder_row public.agents;
  result public.mandates;
  new_mandate_id uuid := gen_random_uuid();
begin
  select * into environment_row
  from public.environments
  where id = p_environment_id
    and status = 'active'
    and exists (
      select 1
      from public.environment_memberships membership
      where membership.environment_id = p_environment_id
        and membership.user_id = p_issuer_user_id
        and membership.role in ('owner', 'operator')
    );

  if not found then
    raise exception using message = 'ENVIRONMENT_NOT_FOUND';
  end if;

  select * into holder_row
  from public.agents
  where id = p_holder_agent_id
    and environment_id = p_environment_id
    and owner_user_id = p_issuer_user_id
    and status = 'active';

  if not found then
    raise exception using message = 'AUTHORITY_TARGET_NOT_FOUND';
  end if;

  if upper(p_currency) <> environment_row.currency then
    raise exception using message = 'CURRENCY_MISMATCH';
  end if;
  if p_budget_limit_minor <= 0 then
    raise exception using message = 'ROOT_BUDGET_INVALID';
  end if;
  if p_expires_at <= now() then
    raise exception using message = 'ROOT_EXPIRED';
  end if;
  if p_max_delegation_depth < 0 then
    raise exception using message = 'ROOT_DEPTH_INVALID';
  end if;
  if jsonb_typeof(p_permitted_actions) <> 'array' then
    raise exception using message = 'ROOT_ACTIONS_INVALID';
  end if;

  insert into public.mandates (
    id,
    mandate_series_id,
    version,
    environment_id,
    issuer_user_id,
    holder_agent_id,
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
    p_environment_id,
    p_issuer_user_id,
    p_holder_agent_id,
    p_budget_limit_minor,
    upper(p_currency),
    p_permitted_actions,
    p_expires_at,
    p_can_delegate,
    p_max_delegation_depth,
    p_approval_required,
    p_content_hash
  )
  returning * into result;

  return result;
end;
$$;

-- 3. Update delegate_mandate to assign mandate_series_id
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

-- 4. Update delegate_mandate_with_grant to assign mandate_series_id
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
  child_row public.mandates;
  new_mandate_id uuid := gen_random_uuid();
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

  if grant_row.parent_mandate_id <> p_parent_mandate_id then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'GRANT_SCOPE_MISMATCH',
        'reason', 'Delegation grant parent mandate does not match requested parent.'
      )
    );
  end if;

  if p_caller_kind = 'agent' and (p_caller_agent_id is null or grant_row.granter_agent_id <> p_caller_agent_id) then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'CALLER_NOT_GRANTER',
        'reason', 'Agent caller is not the granter of the delegation grant.'
      )
    );
  end if;

  if p_caller_kind = 'user' and (p_caller_user_id is null or grant_row.issuer_user_id <> p_caller_user_id) then
    return jsonb_build_object(
      'mandate', null,
      'decision', jsonb_build_object(
        'allowed', false,
        'code', 'CALLER_NOT_ISSUER',
        'reason', 'User caller is not the issuer of the delegation grant.'
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

-- 5. Update create_ledger_account to set mandate_series_id
CREATE OR REPLACE FUNCTION public.create_ledger_account(
  p_environment_id uuid,
  p_mandate_id uuid,
  p_parent_account_id uuid,
  p_currency text,
  p_available_minor bigint
)
RETURNS public.ledger_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  mandate_row public.mandates;
  parent_row public.ledger_accounts;
  result public.ledger_accounts;
begin
  if p_available_minor < 0 then
    raise exception using message = 'INVALID_AMOUNT';
  end if;

  select * into mandate_row
  from public.mandates
  where id = p_mandate_id
    and environment_id = p_environment_id;
  if not found then
    raise exception using message = 'MANDATE_NOT_FOUND';
  end if;

  if upper(p_currency) <> mandate_row.currency then
    raise exception using message = 'CURRENCY_MISMATCH';
  end if;

  if p_parent_account_id is not null then
    select * into parent_row
    from public.ledger_accounts
    where id = p_parent_account_id
      and environment_id = p_environment_id;
    if not found then
      raise exception using message = 'ACCOUNT_NOT_FOUND';
    end if;
    if parent_row.currency <> upper(p_currency) then
      raise exception using message = 'CURRENCY_MISMATCH';
    end if;
  elsif p_available_minor <> mandate_row.budget_limit_minor then
    raise exception using message = 'ROOT_FUNDING_MISMATCH';
  end if;

  insert into public.ledger_accounts (
    environment_id,
    mandate_id,
    mandate_series_id,
    parent_account_id,
    currency,
    available_minor
  )
  values (
    p_environment_id,
    p_mandate_id,
    mandate_row.mandate_series_id,
    p_parent_account_id,
    upper(p_currency),
    p_available_minor
  )
  returning * into result;

  return result;
end;
$$;

-- Re-set NOT NULL on mandate_series_id now that all functions populate it
ALTER TABLE public.mandates
  ALTER COLUMN mandate_series_id SET NOT NULL;
