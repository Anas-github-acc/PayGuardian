-- Mandate Versioning, Top-up Lineage, and Atomic Accounting Continuity
-- Migration: 20261110000000_mandate_versioning_and_topups.sql

-- 1. Add 'superseded' to mandate_state enum
alter type public.mandate_state add value if not exists 'superseded';

-- 2. Add versioning columns to public.mandates
alter table public.mandates
  add column if not exists mandate_series_id uuid,
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists previous_mandate_id uuid references public.mandates(id) on delete restrict,
  add column if not exists superseded_at timestamptz;

-- Backfill mandate_series_id for existing records
update public.mandates
set mandate_series_id = id
where mandate_series_id is null;

alter table public.mandates
  alter column mandate_series_id set not null;

-- 3. Add mandate_series_id to public.ledger_accounts
alter table public.ledger_accounts
  add column if not exists mandate_series_id uuid;

-- Backfill ledger_accounts.mandate_series_id
update public.ledger_accounts acc
set mandate_series_id = m.mandate_series_id
from public.mandates m
where acc.mandate_id = m.id and acc.mandate_series_id is null;

-- 4. Indexes for versioning and series lookups
create index if not exists mandates_series_version_idx
  on public.mandates (mandate_series_id, version desc);

create index if not exists mandates_previous_id_idx
  on public.mandates (previous_mandate_id);

create unique index if not exists mandates_one_active_per_series
  on public.mandates (mandate_series_id)
  where state = 'active';

create index if not exists ledger_accounts_series_idx
  on public.ledger_accounts (mandate_series_id);

-- 5. Atomic Top-Up Function
create or replace function public.topup_mandate_atomic(
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
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  -- 2. Lock active previous version for this child under parent
  select * into prev_row
  from public.mandates
  where parent_mandate_id = p_parent_mandate_id
    and holder_agent_id = p_holder_agent_id
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
        'reason', 'Delegation depth cannot increase beyond previous or parent limit.'
      )
    );
  end if;

  -- 8. Supersede previous version
  update public.mandates
  set state = 'superseded',
      superseded_at = now()
  where id = prev_row.id;

  -- 9. Insert new mandate version carrying forward spent, reserved, allocated
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
    if parent_acc.available_minor >= p_additional_budget_minor then
      update public.ledger_accounts
      set available_minor = available_minor - p_additional_budget_minor
      where id = parent_acc.id;

      update public.ledger_accounts
      set available_minor = available_minor + p_additional_budget_minor,
          mandate_id = new_row.id
      where id = child_acc.id;

      if p_idempotency_key is not null then
        insert into public.ledger_transfers (
          environment_id, parent_account_id, child_account_id, amount_minor, idempotency_key, request_hash
        )
        values (
          parent_row.environment_id, parent_acc.id, child_acc.id, p_additional_budget_minor,
          'topup:' || p_idempotency_key, p_content_hash
        )
        on conflict do nothing;
      end if;
    end if;
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

revoke all on function public.topup_mandate_atomic(
  uuid, uuid, uuid, bigint, text, jsonb, timestamptz, boolean, integer, boolean, text, text
) from public, anon, authenticated;

grant execute on function public.topup_mandate_atomic(
  uuid, uuid, uuid, bigint, text, jsonb, timestamptz, boolean, integer, boolean, text, text
) to service_role;
