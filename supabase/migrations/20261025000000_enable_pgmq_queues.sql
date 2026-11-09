-- Migration: Enable pgmq (Supabase Queues) and create agent_task_queue
-- Description: Sets up pgmq extension and establishes agent task queue for background workers.

create extension if not exists pgmq cascade;

-- Create the agent task queue if it does not already exist
do $$
begin
  perform pgmq.create('agent_task_queue');
exception
  when others then
    -- queue may already exist, ignore error
    null;
end;
$$;

-- Helper RPC function to publish task into pgmq
create or replace function public.enqueue_agent_task_pgmq(
  p_run_id uuid,
  p_task_id uuid,
  p_conversation_id uuid,
  p_environment_id uuid,
  p_message text
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  v_msg_id bigint;
begin
  select pgmq.send(
    'agent_task_queue',
    jsonb_build_object(
      'runId', p_run_id,
      'taskId', p_task_id,
      'conversationId', p_conversation_id,
      'environmentId', p_environment_id,
      'message', p_message,
      'enqueuedAt', now()
    )
  ) into v_msg_id;

  return v_msg_id;
end;
$$;

revoke all on function public.enqueue_agent_task_pgmq(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.enqueue_agent_task_pgmq(uuid, uuid, uuid, uuid, text) to service_role;

-- Helper RPC function to read a batch of tasks from pgmq with visibility timeout (in seconds)
create or replace function public.read_agent_tasks_pgmq(
  p_visibility_timeout_seconds integer default 30,
  p_limit integer default 1
)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  return query
  select r.msg_id, r.read_ct, r.enqueued_at, r.vt, r.message
  from pgmq.read('agent_task_queue', p_visibility_timeout_seconds, p_limit) r;
end;
$$;

revoke all on function public.read_agent_tasks_pgmq(integer, integer) from public, anon, authenticated;
grant execute on function public.read_agent_tasks_pgmq(integer, integer) to service_role;

-- Helper RPC function to acknowledge (archive) completed task
create or replace function public.archive_agent_task_pgmq(
  p_msg_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  return pgmq.archive('agent_task_queue', p_msg_id);
end;
$$;

revoke all on function public.archive_agent_task_pgmq(bigint) from public, anon, authenticated;
grant execute on function public.archive_agent_task_pgmq(bigint) to service_role;
