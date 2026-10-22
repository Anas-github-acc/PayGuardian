create table public.provider_operations (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  action_id uuid not null unique references public.protected_actions(id) on delete restrict,
  provider text not null check (provider in ('paypal')),
  provider_order_id text not null,
  status text not null,
  capture_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index provider_operations_provider_order_idx
  on public.provider_operations(provider, provider_order_id);

create index provider_operations_environment_updated_idx
  on public.provider_operations(environment_id, updated_at desc);

alter table public.provider_operations enable row level security;

-- Provider operations are accessed only by the server-side gateway. Client-facing
-- policies are intentionally omitted, matching the project's service-role model.
