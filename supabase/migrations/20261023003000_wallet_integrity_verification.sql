create table if not exists public.ledger_balance_transitions (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  transition_type text not null check (transition_type in (
    'create', 'allocation_in', 'allocation_out', 'reclaim_in', 'reclaim_out', 'reserve', 'capture', 'release'
  )),
  amount_minor bigint not null check (amount_minor >= 0),
  balance_before jsonb not null check (jsonb_typeof(balance_before) = 'object'),
  balance_after jsonb not null check (jsonb_typeof(balance_after) = 'object'),
  reference_id text,
  previous_hash text check (previous_hash is null or previous_hash ~ '^[0-9a-f]{64}$'),
  transition_hash text not null check (transition_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (account_id, sequence)
);

create index if not exists ledger_transitions_account_seq_idx
  on public.ledger_balance_transitions(account_id, sequence asc);
create index if not exists ledger_transitions_env_idx
  on public.ledger_balance_transitions(environment_id, created_at asc);

alter table public.ledger_balance_transitions enable row level security;

create or replace function public.reject_ledger_transition_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception using message = 'LEDGER_TRANSITIONS_APPEND_ONLY';
end;
$$;

drop trigger if exists ledger_transitions_append_only on public.ledger_balance_transitions;
create trigger ledger_transitions_append_only
  before update or delete on public.ledger_balance_transitions
  for each row execute function public.reject_ledger_transition_mutation();

revoke insert, update, delete, truncate on public.ledger_balance_transitions from public, anon, authenticated;
grant select on public.ledger_balance_transitions to service_role;

revoke all on function public.reject_ledger_transition_mutation() from public, anon, authenticated, service_role;

-- Helper to append a cryptographic transition record
create or replace function public.record_ledger_transition(
  p_environment_id uuid,
  p_account_id uuid,
  p_transition_type text,
  p_amount_minor bigint,
  p_balance_before jsonb,
  p_balance_after jsonb,
  p_reference_id text default null
)
returns public.ledger_balance_transitions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transition_id uuid := gen_random_uuid();
  v_created_at timestamptz := now();
  v_sequence integer;
  v_previous_hash text;
  v_computed_hash text;
  v_result public.ledger_balance_transitions;
begin
  select coalesce(max(sequence), 0) + 1,
         (select transition_hash from public.ledger_balance_transitions
          where account_id = p_account_id
          order by sequence desc limit 1)
  into v_sequence, v_previous_hash
  from public.ledger_balance_transitions
  where account_id = p_account_id;

  v_computed_hash := encode(digest(
    jsonb_build_object(
      'accountId', p_account_id,
      'amountMinor', p_amount_minor,
      'balanceAfter', p_balance_after,
      'balanceBefore', p_balance_before,
      'createdAt', to_char(v_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'environmentId', p_environment_id,
      'id', v_transition_id,
      'previousHash', v_previous_hash,
      'referenceId', p_reference_id,
      'sequence', v_sequence,
      'transitionType', p_transition_type
    )::text::bytea,
    'sha256'
  ), 'hex');

  insert into public.ledger_balance_transitions (
    id, environment_id, account_id, sequence, transition_type, amount_minor,
    balance_before, balance_after, reference_id, previous_hash, transition_hash, created_at
  )
  values (
    v_transition_id, p_environment_id, p_account_id, v_sequence, p_transition_type, p_amount_minor,
    p_balance_before, p_balance_after, p_reference_id, v_previous_hash, v_computed_hash, v_created_at
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.record_ledger_transition(uuid, uuid, text, bigint, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_ledger_transition(uuid, uuid, text, bigint, jsonb, jsonb, text) to service_role;

-- Verification of an individual account's cryptographic integrity against its state
create or replace function public.verify_ledger_account_integrity(
  p_environment_id uuid,
  p_account_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  account_row public.ledger_accounts;
  t_row record;
  prev_hash text := null;
  expected_hash text;
  last_after jsonb := null;
  transition_count integer := 0;
begin
  select * into account_row
  from public.ledger_accounts
  where id = p_account_id and environment_id = p_environment_id;

  if not found then
    return false;
  end if;

  for t_row in
    select *
    from public.ledger_balance_transitions
    where account_id = p_account_id
    order by sequence asc
  loop
    transition_count := transition_count + 1;
    if t_row.sequence <> transition_count then
      return false;
    end if;
    if t_row.previous_hash is distinct from prev_hash then
      return false;
    end if;

    expected_hash := encode(digest(
      jsonb_build_object(
        'accountId', t_row.account_id,
        'amountMinor', t_row.amount_minor,
        'balanceAfter', t_row.balance_after,
        'balanceBefore', t_row.balance_before,
        'createdAt', to_char(t_row.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'environmentId', t_row.environment_id,
        'id', t_row.id,
        'previousHash', t_row.previous_hash,
        'referenceId', t_row.reference_id,
        'sequence', t_row.sequence,
        'transitionType', t_row.transition_type
      )::text::bytea,
      'sha256'
    ), 'hex');

    if t_row.transition_hash is distinct from expected_hash then
      return false;
    end if;

    prev_hash := t_row.transition_hash;
    last_after := t_row.balance_after;
  end loop;

  if transition_count = 0 then
    if account_row.available_minor = 0 and account_row.reserved_minor = 0 and account_row.captured_minor = 0 then
      return true;
    end if;
    return false;
  end if;

  if (last_after->>'availableMinor')::bigint <> account_row.available_minor or
     (last_after->>'reservedMinor')::bigint <> account_row.reserved_minor or
     (last_after->>'capturedMinor')::bigint <> account_row.captured_minor then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.verify_ledger_account_integrity(uuid, uuid) from public, anon, authenticated;
grant execute on function public.verify_ledger_account_integrity(uuid, uuid) to service_role;

-- Verification across all accounts in an environment
create or replace function public.verify_wallet_integrity(p_environment_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  acc record;
begin
  for acc in
    select id
    from public.ledger_accounts
    where environment_id = p_environment_id
  loop
    if not public.verify_ledger_account_integrity(p_environment_id, acc.id) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.verify_wallet_integrity(uuid) from public, anon, authenticated;
grant execute on function public.verify_wallet_integrity(uuid) to service_role;
