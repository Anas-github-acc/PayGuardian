create unique index if not exists ledger_accounts_one_per_mandate_idx
  on public.ledger_accounts(mandate_id);

create table public.ledger_transfers (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  parent_account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  child_account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  idempotency_key text not null,
  request_hash text not null,
  created_at timestamptz not null default now(),
  unique (environment_id, idempotency_key)
);

create index ledger_transfers_environment_created_idx
  on public.ledger_transfers(environment_id, created_at desc);

alter table public.ledger_transfers enable row level security;

create or replace function public.create_ledger_account(
  p_environment_id uuid,
  p_mandate_id uuid,
  p_parent_account_id uuid,
  p_currency text,
  p_available_minor bigint
)
returns public.ledger_accounts
language plpgsql
security definer
set search_path = public
as $$
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
      and environment_id = p_environment_id
    for update;
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
    parent_account_id,
    currency,
    available_minor
  )
  values (
    p_environment_id,
    p_mandate_id,
    p_parent_account_id,
    upper(p_currency),
    p_available_minor
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.create_ledger_account(uuid, uuid, uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.create_ledger_account(uuid, uuid, uuid, text, bigint) to service_role;

create or replace function public.allocate_budget_idempotent(
  p_environment_id uuid,
  p_parent_account_id uuid,
  p_child_account_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.ledger_transfers;
  parent_row public.ledger_accounts;
  child_row public.ledger_accounts;
  transfer_row public.ledger_transfers;
begin
  if p_amount_minor <= 0 then
    raise exception using message = 'INVALID_AMOUNT';
  end if;

  select * into existing
  from public.ledger_transfers
  where environment_id = p_environment_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if existing.request_hash <> p_request_hash
      or existing.parent_account_id <> p_parent_account_id
      or existing.child_account_id <> p_child_account_id
      or existing.amount_minor <> p_amount_minor then
      raise exception using message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select * into parent_row from public.ledger_accounts where id = p_parent_account_id;
    select * into child_row from public.ledger_accounts where id = p_child_account_id;
    return jsonb_build_object('transfer', to_jsonb(existing), 'parent', to_jsonb(parent_row), 'child', to_jsonb(child_row));
  end if;

  perform 1 from public.ledger_accounts
  where id in (p_parent_account_id, p_child_account_id)
  order by id
  for update;

  select * into parent_row from public.ledger_accounts
  where id = p_parent_account_id and environment_id = p_environment_id;
  select * into child_row from public.ledger_accounts
  where id = p_child_account_id and environment_id = p_environment_id;
  if parent_row.id is null or child_row.id is null then
    raise exception using message = 'ACCOUNT_NOT_FOUND';
  end if;
  if child_row.parent_account_id <> parent_row.id then
    raise exception using message = 'INVALID_STATE';
  end if;
  if parent_row.currency <> child_row.currency then
    raise exception using message = 'CURRENCY_MISMATCH';
  end if;
  if parent_row.available_minor < p_amount_minor then
    raise exception using message = 'INSUFFICIENT_AVAILABLE';
  end if;

  update public.ledger_accounts
  set available_minor = available_minor - p_amount_minor
  where id = parent_row.id;
  update public.ledger_accounts
  set available_minor = available_minor + p_amount_minor
  where id = child_row.id;

  insert into public.ledger_transfers (
    environment_id, parent_account_id, child_account_id, amount_minor, idempotency_key, request_hash
  )
  values (
    p_environment_id, p_parent_account_id, p_child_account_id, p_amount_minor, p_idempotency_key, p_request_hash
  )
  returning * into transfer_row;

  select * into parent_row from public.ledger_accounts where id = p_parent_account_id;
  select * into child_row from public.ledger_accounts where id = p_child_account_id;
  return jsonb_build_object('transfer', to_jsonb(transfer_row), 'parent', to_jsonb(parent_row), 'child', to_jsonb(child_row));
end;
$$;

revoke all on function public.allocate_budget_idempotent(uuid, uuid, uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.allocate_budget_idempotent(uuid, uuid, uuid, bigint, text, text) to service_role;

create or replace function public.authorize_and_reserve_action(
  p_environment_id uuid,
  p_agent_id uuid,
  p_mandate_id uuid,
  p_ledger_account_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_action text,
  p_amount_minor bigint,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action_row public.protected_actions;
  reservation_row public.reservations;
  mandate_row public.mandates;
  account_row public.ledger_accounts;
begin
  if p_amount_minor <= 0 then
    raise exception using message = 'INVALID_AMOUNT';
  end if;

  select * into action_row
  from public.protected_actions
  where agent_id = p_agent_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    if action_row.request_hash <> p_request_hash
      or action_row.amount_minor <> p_amount_minor
      or action_row.currency <> upper(p_currency)
      or action_row.action <> p_action
      or action_row.mandate_id <> p_mandate_id then
      raise exception using message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select * into reservation_row from public.reservations where action_id = action_row.id;
    return jsonb_build_object('action', to_jsonb(action_row), 'reservation', to_jsonb(reservation_row));
  end if;

  select * into mandate_row
  from public.mandates
  where id = p_mandate_id
    and environment_id = p_environment_id
    and state = 'active'
    and expires_at > now();
  if not found then
    raise exception using message = 'MANDATE_NOT_FOUND';
  end if;
  if not mandate_row.permitted_actions @> jsonb_build_array(p_action) then
    raise exception using message = 'ACTION_NOT_PERMITTED';
  end if;
  if mandate_row.currency <> upper(p_currency) then
    raise exception using message = 'CURRENCY_MISMATCH';
  end if;

  select * into account_row
  from public.ledger_accounts
  where id = p_ledger_account_id
    and environment_id = p_environment_id
    and mandate_id = p_mandate_id
    and currency = upper(p_currency)
  for update;
  if not found then
    raise exception using message = 'ACCOUNT_NOT_FOUND';
  end if;
  if account_row.available_minor < p_amount_minor then
    raise exception using message = 'INSUFFICIENT_AVAILABLE';
  end if;

  insert into public.protected_actions (
    environment_id, agent_id, mandate_id, idempotency_key, request_hash,
    action, amount_minor, currency, authorization_state, execution_state
  )
  values (
    p_environment_id, p_agent_id, p_mandate_id, p_idempotency_key, p_request_hash,
    p_action, p_amount_minor, upper(p_currency), 'authorized', 'pending'
  )
  returning * into action_row;

  update public.ledger_accounts
  set available_minor = available_minor - p_amount_minor,
      reserved_minor = reserved_minor + p_amount_minor
  where id = account_row.id;

  insert into public.reservations (action_id, ledger_account_id, amount_minor)
  values (action_row.id, account_row.id, p_amount_minor)
  returning * into reservation_row;

  return jsonb_build_object('action', to_jsonb(action_row), 'reservation', to_jsonb(reservation_row));
end;
$$;

revoke all on function public.authorize_and_reserve_action(uuid, uuid, uuid, uuid, text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.authorize_and_reserve_action(uuid, uuid, uuid, uuid, text, text, text, bigint, text) to service_role;

create or replace function public.capture_reservation(
  p_environment_id uuid,
  p_action_id uuid
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.reservations;
  action_row public.protected_actions;
begin
  select reservation.* into reservation_row
  from public.reservations reservation
  join public.protected_actions action on action.id = reservation.action_id
  where reservation.action_id = p_action_id and action.environment_id = p_environment_id
  for update;
  if not found then
    raise exception using message = 'RESERVATION_NOT_FOUND';
  end if;
  if reservation_row.state = 'captured' then return reservation_row; end if;
  if reservation_row.state <> 'held' then
    raise exception using message = 'INVALID_STATE';
  end if;

  select * into action_row from public.protected_actions where id = p_action_id for update;
  update public.ledger_accounts
  set reserved_minor = reserved_minor - reservation_row.amount_minor,
      captured_minor = captured_minor + reservation_row.amount_minor
  where id = reservation_row.ledger_account_id;
  update public.reservations
  set state = 'captured', updated_at = now()
  where id = reservation_row.id
  returning * into reservation_row;
  update public.protected_actions
  set execution_state = 'succeeded'
  where id = action_row.id;
  return reservation_row;
end;
$$;

revoke all on function public.capture_reservation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.capture_reservation(uuid, uuid) to service_role;

create or replace function public.release_reservation(
  p_environment_id uuid,
  p_action_id uuid,
  p_reason text
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.reservations;
begin
  select reservation.* into reservation_row
  from public.reservations reservation
  join public.protected_actions action on action.id = reservation.action_id
  where reservation.action_id = p_action_id and action.environment_id = p_environment_id
  for update;
  if not found then
    raise exception using message = 'RESERVATION_NOT_FOUND';
  end if;
  if reservation_row.state = 'released' then return reservation_row; end if;
  if reservation_row.state <> 'held' then
    raise exception using message = 'INVALID_STATE';
  end if;

  update public.ledger_accounts
  set reserved_minor = reserved_minor - reservation_row.amount_minor,
      available_minor = available_minor + reservation_row.amount_minor
  where id = reservation_row.ledger_account_id;
  update public.reservations
  set state = 'released', updated_at = now()
  where id = reservation_row.id
  returning * into reservation_row;
  update public.protected_actions
  set execution_state = 'failed'
  where id = p_action_id;
  return reservation_row;
end;
$$;

revoke all on function public.release_reservation(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.release_reservation(uuid, uuid, text) to service_role;
