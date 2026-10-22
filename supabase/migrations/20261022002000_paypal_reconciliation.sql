alter table public.provider_operations
  add column if not exists approval_url text,
  add column if not exists observed_provider_status text,
  add column if not exists reconciliation_state text not null default 'pending',
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_event_at timestamptz,
  add column if not exists last_error_code text;

alter table public.provider_operations
  add constraint provider_operations_reconciliation_state_check
  check (reconciliation_state in ('pending', 'resolved'));

create index provider_operations_reconciliation_idx
  on public.provider_operations(environment_id, reconciliation_state, updated_at desc);

create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid references public.environments(id) on delete cascade,
  action_id uuid references public.protected_actions(id) on delete set null,
  provider_operation_id uuid references public.provider_operations(id) on delete set null,
  provider text not null check (provider in ('paypal')),
  provider_event_id text not null,
  event_type text not null,
  provider_order_id text,
  capture_id text,
  observed_status text,
  payload_hash text not null,
  verification_state text not null check (verification_state in ('verified', 'rejected')),
  processing_state text not null default 'received' check (processing_state in ('received', 'applied', 'ignored')),
  event_occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create index provider_events_order_received_idx
  on public.provider_events(provider_order_id, received_at desc);
create index provider_events_environment_received_idx
  on public.provider_events(environment_id, received_at desc);

alter table public.provider_events enable row level security;

-- Webhook events are accepted and processed only by the server-side gateway.
