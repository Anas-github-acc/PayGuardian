-- Migration: Update enqueue_agent_task_pgmq to accept mandate and budget parameters
-- Description: Extends RPC signature so API can pass mandate_id and budget limits to background workers via PGMQ.

drop function if exists public.enqueue_agent_task_pgmq(uuid, uuid, uuid, uuid, text);

create or replace function public.enqueue_agent_task_pgmq(
  p_run_id uuid,
  p_task_id uuid,
  p_conversation_id uuid,
  p_environment_id uuid,
  p_message text,
  p_mandate_id text default null,
  p_budget_limit_minor bigint default null,
  p_budget_currency text default null
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
      'mandateId', p_mandate_id,
      'budgetLimitMinor', p_budget_limit_minor,
      'budgetCurrency', p_budget_currency,
      'enqueuedAt', now()
    )
  ) into v_msg_id;

  return v_msg_id;
end;
$$;

revoke all on function public.enqueue_agent_task_pgmq(uuid, uuid, uuid, uuid, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.enqueue_agent_task_pgmq(uuid, uuid, uuid, uuid, text, text, bigint, text) to service_role;
