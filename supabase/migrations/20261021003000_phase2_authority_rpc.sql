create or replace function public.create_root_mandate(
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
returns public.mandates
language plpgsql
security definer
set search_path = public
as $$
declare
  environment_row public.environments;
  holder_row public.agents;
  result public.mandates;
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

revoke all on function public.create_root_mandate(uuid, uuid, uuid, bigint, text, jsonb, timestamptz, boolean, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.create_root_mandate(uuid, uuid, uuid, bigint, text, jsonb, timestamptz, boolean, integer, boolean, text) to service_role;

create or replace function public.delegate_mandate(
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
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_row public.mandates;
  holder_row public.agents;
  child_row public.mandates;
  decision_code text;
  decision_reason text;
begin
  select * into parent_row
  from public.mandates
  where id = p_parent_mandate_id
    and issuer_user_id = p_issuer_user_id
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
        'code', 'MANDATE_NOT_FOUND',
        'reason', 'Parent mandate not found.'
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
        'code', 'MANDATE_NOT_FOUND',
        'reason', 'Child agent not found.'
      )
    );
  end if;

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
  elsif not (parent_row.permitted_actions @> p_permitted_actions) then
    decision_code := 'ACTION_NOT_PERMITTED';
    decision_reason := 'Child scope broadens parent scope.';
  elsif p_expires_at > parent_row.expires_at then
    decision_code := 'MANDATE_EXPIRED';
    decision_reason := 'Child expiry exceeds parent expiry.';
  elsif parent_row.approval_required and not p_approval_required then
    decision_code := 'APPROVAL_REQUIRED';
    decision_reason := 'Child authority cannot weaken the parent approval requirement.';
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

revoke all on function public.delegate_mandate(uuid, uuid, uuid, bigint, text, jsonb, timestamptz, boolean, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.delegate_mandate(uuid, uuid, uuid, bigint, text, jsonb, timestamptz, boolean, integer, boolean, text) to service_role;

create or replace function public.revoke_mandate(
  p_mandate_id uuid,
  p_issuer_user_id uuid
)
returns public.mandates
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.mandates;
begin
  if not exists (
    select 1
    from public.mandates mandate
    where mandate.id = p_mandate_id
      and mandate.issuer_user_id = p_issuer_user_id
  ) then
    return null;
  end if;

  with recursive descendants as (
    select id
    from public.mandates
    where id = p_mandate_id

    union all

    select child.id
    from public.mandates child
    join descendants parent on child.parent_mandate_id = parent.id
  )
  update public.mandates
  set state = 'revoked',
      revoked_at = coalesce(revoked_at, now())
  where id in (select id from descendants);

  select * into result
  from public.mandates
  where id = p_mandate_id;
  return result;
end;
$$;

revoke all on function public.revoke_mandate(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_mandate(uuid, uuid) to service_role;

create or replace function public.get_mandate_chain_for_user(
  p_mandate_id uuid,
  p_user_id uuid
)
returns setof public.mandates
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with recursive chain as (
    select mandate.id, mandate.parent_mandate_id, 0 as depth
    from public.mandates mandate
    where mandate.id = p_mandate_id
      and exists (
        select 1
        from public.environment_memberships membership
        where membership.environment_id = mandate.environment_id
          and membership.user_id = p_user_id
      )

    union all

    select parent.id, parent.parent_mandate_id, chain.depth + 1
    from public.mandates parent
    join chain on parent.id = chain.parent_mandate_id
  )
  select mandate.*
  from public.mandates mandate
  join chain on chain.id = mandate.id
  order by chain.depth desc;
end;
$$;

revoke all on function public.get_mandate_chain_for_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_mandate_chain_for_user(uuid, uuid) to service_role;
