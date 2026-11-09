-- Chatbot Conversations, Messages, and Agent Run Engine
-- Supports conversation history, agent runs, nested agent tasks, real-time SSE notifications, and enqueue RPC

-- 1. Conversations Table
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.environments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Conversation',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_environment_created_idx
  on public.conversations(environment_id, created_at desc);
create index if not exists conversations_user_created_idx
  on public.conversations(user_id, created_at desc);

alter table public.conversations enable row level security;

-- 2. Messages Table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'assistant', 'system')),
  sender_id text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at asc);

alter table public.messages enable row level security;

-- 3. Agent Runs Table
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  environment_id uuid not null references public.environments(id) on delete cascade,
  trigger_message_id uuid references public.messages(id),
  status text not null default 'queued'
    check (status in ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'awaiting_approval')),
  error_details jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_runs_conversation_created_idx
  on public.agent_runs(conversation_id, created_at desc);
create index if not exists agent_runs_environment_status_idx
  on public.agent_runs(environment_id, status);

alter table public.agent_runs enable row level security;

-- 4. Agent Tasks Table
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  parent_task_id uuid references public.agent_tasks(id),
  agent_id text not null,
  mandate_id uuid references public.mandates(id),
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'awaiting_approval')),
  retry_count integer not null default 0 check (retry_count >= 0),
  max_retries integer not null default 3 check (max_retries >= 0),
  error_details jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_tasks_run_created_idx
  on public.agent_tasks(run_id, created_at asc);
create index if not exists agent_tasks_agent_status_idx
  on public.agent_tasks(agent_id, status);

alter table public.agent_tasks enable row level security;

-- 5. Agent Events Table
create table if not exists public.agent_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  task_id uuid references public.agent_tasks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_events_run_id_idx
  on public.agent_events(run_id, id asc);

alter table public.agent_events enable row level security;

-- 6. Postgres Trigger & Notification for Live SSE
create or replace function public.notify_agent_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_notify(
    'agent_run_events:' || new.run_id::text,
    json_build_object('id', new.id, 'event_type', new.event_type)::text
  );
  return new;
end;
$$;

drop trigger if exists trg_agent_events_notify on public.agent_events;
create trigger trg_agent_events_notify
  after insert on public.agent_events
  for each row
  execute function public.notify_agent_event();

revoke all on function public.notify_agent_event() from public, anon, authenticated;
grant execute on function public.notify_agent_event() to service_role;

-- 7. Queue & RPC Helper Function: submit_chat_message
create or replace function public.submit_chat_message(
  p_environment_id uuid,
  p_user_id uuid,
  p_conversation_id uuid,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_message_id uuid;
  v_run_id uuid;
  v_root_task_id uuid;
  v_job_result jsonb;
begin
  if p_environment_id is null or p_user_id is null then
    raise exception using message = 'INVALID_ARGUMENTS';
  end if;

  if nullif(trim(p_content), '') is null then
    raise exception using message = 'CONTENT_REQUIRED';
  end if;

  -- Validate environment exists and user is authorized (owner or member)
  perform 1
  from public.environments env
  where env.id = p_environment_id
    and env.status = 'active'
    and (
      env.owner_user_id = p_user_id
      or exists (
        select 1
        from public.environment_memberships membership
        where membership.environment_id = p_environment_id
          and membership.user_id = p_user_id
      )
    );

  if not found then
    raise exception using message = 'ENVIRONMENT_NOT_FOUND';
  end if;

  -- Validate existing conversation belongs to environment and user, or create one if null
  if p_conversation_id is not null then
    select id into v_conversation_id
    from public.conversations
    where id = p_conversation_id
      and environment_id = p_environment_id
      and user_id = p_user_id
    for update;

    if not found then
      raise exception using message = 'CONVERSATION_NOT_FOUND';
    end if;

    update public.conversations
    set updated_at = now()
    where id = v_conversation_id;
  else
    insert into public.conversations (
      environment_id,
      user_id,
      title
    )
    values (
      p_environment_id,
      p_user_id,
      case
        when length(trim(p_content)) > 60 then substring(trim(p_content) from 1 for 57) || '...'
        else trim(p_content)
      end
    )
    returning id into v_conversation_id;
  end if;

  -- Insert user message
  insert into public.messages (
    conversation_id,
    sender_type,
    sender_id,
    content
  )
  values (
    v_conversation_id,
    'user',
    p_user_id::text,
    trim(p_content)
  )
  returning id into v_message_id;

  -- Create agent run
  insert into public.agent_runs (
    conversation_id,
    environment_id,
    trigger_message_id,
    status
  )
  values (
    v_conversation_id,
    p_environment_id,
    v_message_id,
    'queued'
  )
  returning id into v_run_id;

  -- Create root agent task
  insert into public.agent_tasks (
    run_id,
    parent_task_id,
    agent_id,
    status
  )
  values (
    v_run_id,
    null,
    'personal',
    'queued'
  )
  returning id into v_root_task_id;

  -- Enqueue into provider_jobs with intent 'agent.run_task'
  v_job_result := public.enqueue_provider_job(
    'agent_runtime',
    'agent.run_task',
    'agent_task:' || v_root_task_id::text,
    jsonb_build_object(
      'runId', v_run_id,
      'taskId', v_root_task_id,
      'conversationId', v_conversation_id,
      'environmentId', p_environment_id,
      'userId', p_user_id,
      'messageId', v_message_id,
      'message', trim(p_content),
      'content', trim(p_content),
      'agentId', 'personal',
      'run_id', v_run_id,
      'task_id', v_root_task_id,
      'conversation_id', v_conversation_id,
      'environment_id', p_environment_id,
      'user_id', p_user_id,
      'message_id', v_message_id,
      'agent_id', 'personal'
    ),
    3
  );

  return jsonb_build_object(
    'conversation_id', v_conversation_id,
    'message_id', v_message_id,
    'run_id', v_run_id,
    'root_task_id', v_root_task_id
  );
end;
$$;

revoke all on function public.submit_chat_message(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_chat_message(uuid, uuid, uuid, text) to service_role;
