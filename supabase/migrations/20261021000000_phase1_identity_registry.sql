create extension if not exists pgcrypto;

create type public.environment_status as enum ('active', 'paused', 'closed', 'revoked');
create type public.agent_status as enum ('active', 'disabled', 'revoked');
create type public.agent_kind as enum ('personal', 'travel', 'hotel', 'transport', 'food', 'activities', 'custom');

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  purpose text not null check (char_length(purpose) between 1 and 500),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  budget_limit_minor bigint not null check (budget_limit_minor >= 0),
  status public.environment_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.environment_memberships (
  environment_id uuid not null references public.environments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'viewer', 'operator')),
  created_at timestamptz not null default now(),
  primary key (environment_id, user_id)
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  parent_agent_id uuid references public.agents(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 160),
  kind public.agent_kind not null,
  status public.agent_status not null default 'active',
  capabilities jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(capabilities) = 'array')
);

create unique index agents_one_personal_root_per_environment
  on public.agents (environment_id)
  where parent_agent_id is null and kind = 'personal';

create table public.agent_credentials (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  secret_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= created_at)
);

create index environments_owner_created_idx on public.environments(owner_user_id, created_at desc);
create index agents_environment_created_idx on public.agents(environment_id, created_at asc);
create index agent_credentials_agent_idx on public.agent_credentials(agent_id, created_at desc);

alter table public.environments enable row level security;
alter table public.environment_memberships enable row level security;
alter table public.agents enable row level security;
alter table public.agent_credentials enable row level security;

-- No client-facing policies are created in Phase 1. All application access is through
-- the Fastify server using the server-only Supabase service-role key.

create or replace function public.create_environment_with_owner(
  p_owner_user_id uuid,
  p_name text,
  p_purpose text,
  p_currency text,
  p_budget_limit_minor bigint
)
returns table (
  id uuid,
  owner_user_id uuid,
  name text,
  purpose text,
  currency text,
  budget_limit_minor bigint,
  status public.environment_status,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.environments (owner_user_id, name, purpose, currency, budget_limit_minor)
  values (p_owner_user_id, p_name, p_purpose, upper(p_currency), p_budget_limit_minor)
  returning environments.id, environments.owner_user_id, environments.name, environments.purpose,
    environments.currency, environments.budget_limit_minor, environments.status, environments.created_at
  into id, owner_user_id, name, purpose, currency, budget_limit_minor, status, created_at;

  insert into public.environment_memberships (environment_id, user_id, role)
  values (id, p_owner_user_id, 'owner');

  return next;
end;
$$;

revoke all on function public.create_environment_with_owner(uuid, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.create_environment_with_owner(uuid, text, text, text, bigint) to service_role;

create or replace function public.create_agent_with_credential(
  p_environment_id uuid,
  p_owner_user_id uuid,
  p_parent_agent_id uuid,
  p_name text,
  p_kind public.agent_kind,
  p_capabilities jsonb,
  p_credential_id uuid,
  p_secret_hash text,
  p_expires_at timestamptz
)
returns table (
  id uuid,
  environment_id uuid,
  owner_user_id uuid,
  parent_agent_id uuid,
  name text,
  kind public.agent_kind,
  status public.agent_status,
  capabilities jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agents (environment_id, owner_user_id, parent_agent_id, name, kind, capabilities)
  values (p_environment_id, p_owner_user_id, p_parent_agent_id, p_name, p_kind, p_capabilities)
  returning agents.id, agents.environment_id, agents.owner_user_id, agents.parent_agent_id,
    agents.name, agents.kind, agents.status, agents.capabilities, agents.created_at
  into id, environment_id, owner_user_id, parent_agent_id, name, kind, status, capabilities, created_at;

  insert into public.agent_credentials (id, agent_id, secret_hash, expires_at)
  values (p_credential_id, id, p_secret_hash, p_expires_at);

  return next;
end;
$$;

revoke all on function public.create_agent_with_credential(uuid, uuid, uuid, text, public.agent_kind, jsonb, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_agent_with_credential(uuid, uuid, uuid, text, public.agent_kind, jsonb, uuid, text, timestamptz) to service_role;
