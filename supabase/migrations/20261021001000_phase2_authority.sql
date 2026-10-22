create type public.mandate_state as enum ('active', 'expired', 'revoked');

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  version integer not null check (version > 0),
  rules jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (environment_id, version),
  check (jsonb_typeof(rules) = 'object')
);

create table public.mandates (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  issuer_user_id uuid not null references auth.users(id) on delete restrict,
  issuer_agent_id uuid references public.agents(id) on delete restrict,
  holder_agent_id uuid not null references public.agents(id) on delete restrict,
  parent_mandate_id uuid references public.mandates(id) on delete restrict,
  policy_id uuid references public.policies(id) on delete restrict,
  budget_limit_minor bigint not null check (budget_limit_minor > 0),
  allocated_minor bigint not null default 0 check (allocated_minor >= 0),
  spent_minor bigint not null default 0 check (spent_minor >= 0),
  reserved_minor bigint not null default 0 check (reserved_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  permitted_actions jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  can_delegate boolean not null default false,
  max_delegation_depth integer not null default 0 check (max_delegation_depth >= 0),
  approval_required boolean not null default false,
  state public.mandate_state not null default 'active',
  revoked_at timestamptz,
  content_hash text not null,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(permitted_actions) = 'array'),
  check (allocated_minor + spent_minor + reserved_minor <= budget_limit_minor),
  check (revoked_at is null or state = 'revoked')
);

create index mandates_environment_created_idx on public.mandates(environment_id, created_at desc);
create index mandates_parent_idx on public.mandates(parent_mandate_id);
create index mandates_holder_idx on public.mandates(holder_agent_id, state);
create unique index mandates_one_active_root_per_agent
  on public.mandates(holder_agent_id)
  where parent_mandate_id is null and state = 'active';

alter table public.policies enable row level security;
alter table public.mandates enable row level security;

-- No client-facing policies are created. The Fastify server uses the server-only
-- Supabase service-role key and applies all principal/environment/authority checks.
