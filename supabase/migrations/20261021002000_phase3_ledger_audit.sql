create type public.reservation_state as enum ('held', 'captured', 'released');
create type public.protected_action_state as enum ('requested', 'authorized', 'denied', 'pending', 'succeeded', 'failed', 'uncertain');

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  mandate_id uuid not null references public.mandates(id) on delete restrict,
  parent_account_id uuid references public.ledger_accounts(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  available_minor bigint not null default 0 check (available_minor >= 0),
  reserved_minor bigint not null default 0 check (reserved_minor >= 0),
  captured_minor bigint not null default 0 check (captured_minor >= 0),
  created_at timestamptz not null default now()
);

create table public.protected_actions (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete restrict,
  mandate_id uuid not null references public.mandates(id) on delete restrict,
  idempotency_key text not null,
  request_hash text not null,
  action text not null,
  amount_minor bigint check (amount_minor is null or amount_minor > 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  authorization_state public.protected_action_state not null default 'requested',
  execution_state public.protected_action_state not null default 'requested',
  created_at timestamptz not null default now(),
  unique (agent_id, idempotency_key)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null unique references public.protected_actions(id) on delete restrict,
  ledger_account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  state public.reservation_state not null default 'held',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  actor_type text not null,
  actor_id uuid,
  session_id uuid,
  mandate_id uuid,
  action_id uuid,
  event_type text not null,
  outcome text not null,
  reason_code text,
  payload jsonb not null default '{}'::jsonb,
  previous_hash text,
  event_hash text not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object')
);

create index ledger_accounts_environment_idx on public.ledger_accounts(environment_id);
create index protected_actions_environment_created_idx on public.protected_actions(environment_id, created_at desc);
create index audit_events_environment_created_idx on public.audit_events(environment_id, created_at desc);

alter table public.ledger_accounts enable row level security;
alter table public.protected_actions enable row level security;
alter table public.reservations enable row level security;
alter table public.audit_events enable row level security;

-- Financial mutations will use server-side transactions/RPC functions. No client-facing
-- policies are created; the service-role key remains server-only.

create or replace function public.allocate_budget(
  p_parent_account_id uuid,
  p_child_account_id uuid,
  p_amount_minor bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_account public.ledger_accounts;
  child_account public.ledger_accounts;
begin
  if p_amount_minor <= 0 then
    raise exception using errcode = '22003', message = 'Allocation amount must be positive';
  end if;

  -- Lock both accounts in a stable order to avoid parent/child deadlocks.
  perform 1
  from public.ledger_accounts
  where id in (p_parent_account_id, p_child_account_id)
  order by id
  for update;

  select * into parent_account from public.ledger_accounts where id = p_parent_account_id;
  select * into child_account from public.ledger_accounts where id = p_child_account_id;

  if parent_account.id is null or child_account.id is null then
    raise exception using errcode = 'P0002', message = 'Ledger account not found';
  end if;
  if child_account.parent_account_id <> parent_account.id then
    raise exception using errcode = '23514', message = 'Child account is not owned by parent';
  end if;
  if parent_account.currency <> child_account.currency then
    raise exception using errcode = '22023', message = 'Currency mismatch';
  end if;
  if parent_account.available_minor < p_amount_minor then
    raise exception using errcode = '22003', message = 'Insufficient available budget';
  end if;

  update public.ledger_accounts
  set available_minor = available_minor - p_amount_minor
  where id = parent_account.id;
  update public.ledger_accounts
  set available_minor = available_minor + p_amount_minor
  where id = child_account.id;
end;
$$;

create or replace function public.reserve_budget(
  p_action_id uuid,
  p_ledger_account_id uuid,
  p_amount_minor bigint
)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.reservations;
  account public.ledger_accounts;
  created public.reservations;
begin
  if p_amount_minor <= 0 then
    raise exception using errcode = '22003', message = 'Reservation amount must be positive';
  end if;

  select * into existing from public.reservations where action_id = p_action_id for update;
  if existing.id is not null then
    if existing.ledger_account_id <> p_ledger_account_id or existing.amount_minor <> p_amount_minor then
      raise exception using errcode = '23505', message = 'Reservation idempotency conflict';
    end if;
    return existing;
  end if;

  select * into account from public.ledger_accounts where id = p_ledger_account_id for update;
  if account.id is null then
    raise exception using errcode = 'P0002', message = 'Ledger account not found';
  end if;
  if account.available_minor < p_amount_minor then
    raise exception using errcode = '22003', message = 'Insufficient available budget';
  end if;

  update public.ledger_accounts
  set available_minor = available_minor - p_amount_minor,
      reserved_minor = reserved_minor + p_amount_minor
  where id = account.id;

  insert into public.reservations (action_id, ledger_account_id, amount_minor)
  values (p_action_id, p_ledger_account_id, p_amount_minor)
  returning * into created;
  return created;
end;
$$;

revoke all on function public.allocate_budget(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.reserve_budget(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.allocate_budget(uuid, uuid, bigint) to service_role;
grant execute on function public.reserve_budget(uuid, uuid, bigint) to service_role;
