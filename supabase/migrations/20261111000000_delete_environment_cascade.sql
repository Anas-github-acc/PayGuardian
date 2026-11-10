-- Enable audit event deletion when authorized cascade deletion is running
CREATE OR REPLACE FUNCTION public.reject_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_audit_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION USING message = 'AUDIT_EVENTS_APPEND_ONLY';
END;
$$;

-- Cascading deletion for environments and all dependent child records
CREATE OR REPLACE FUNCTION public.delete_environment_cascade(
  p_user_id uuid,
  p_environment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT exists (
    SELECT 1 FROM public.environments
    WHERE id = p_environment_id AND owner_user_id = p_user_id
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN false;
  END IF;

  -- 1. Enable audit event deletion for this transaction
  SET LOCAL app.allow_audit_delete = 'on';

  -- 2. Clean chatbot task events and tasks
  DELETE FROM public.agent_events
  WHERE run_id IN (SELECT id FROM public.agent_runs WHERE environment_id = p_environment_id);

  UPDATE public.agent_tasks
  SET parent_task_id = null, mandate_id = null
  WHERE run_id IN (SELECT id FROM public.agent_runs WHERE environment_id = p_environment_id);

  DELETE FROM public.agent_tasks
  WHERE run_id IN (SELECT id FROM public.agent_runs WHERE environment_id = p_environment_id);

  DELETE FROM public.agent_runs
  WHERE environment_id = p_environment_id;

  DELETE FROM public.messages
  WHERE conversation_id IN (SELECT id FROM public.conversations WHERE environment_id = p_environment_id);

  DELETE FROM public.conversations
  WHERE environment_id = p_environment_id;

  -- 3. Delegation grants
  DELETE FROM public.delegation_grants
  WHERE environment_id = p_environment_id;

  -- 4. Provider operations & events & jobs
  DELETE FROM public.provider_jobs
  WHERE environment_id = p_environment_id;

  DELETE FROM public.provider_events
  WHERE environment_id = p_environment_id;

  DELETE FROM public.provider_operations
  WHERE environment_id = p_environment_id;

  -- 5. Reservations & protected actions
  DELETE FROM public.reservations
  WHERE action_id IN (SELECT id FROM public.protected_actions WHERE environment_id = p_environment_id)
     OR ledger_account_id IN (SELECT id FROM public.ledger_accounts WHERE environment_id = p_environment_id);

  DELETE FROM public.ledger_balance_transitions
  WHERE environment_id = p_environment_id;

  DELETE FROM public.ledger_transfers
  WHERE environment_id = p_environment_id;

  DELETE FROM public.protected_actions
  WHERE environment_id = p_environment_id;

  -- 6. Ledger accounts
  UPDATE public.ledger_accounts
  SET parent_account_id = null
  WHERE environment_id = p_environment_id;

  DELETE FROM public.ledger_accounts
  WHERE environment_id = p_environment_id;

  -- 7. Mandates
  UPDATE public.mandates
  SET parent_mandate_id = null, previous_mandate_id = null, issuer_agent_id = null
  WHERE environment_id = p_environment_id;

  DELETE FROM public.mandates
  WHERE environment_id = p_environment_id;

  -- 8. Audit events
  DELETE FROM public.audit_events
  WHERE environment_id = p_environment_id;

  -- 9. Credentials & Agents
  DELETE FROM public.agent_credentials
  WHERE agent_id IN (SELECT id FROM public.agents WHERE environment_id = p_environment_id);

  UPDATE public.agents
  SET parent_agent_id = null
  WHERE environment_id = p_environment_id;

  DELETE FROM public.agents
  WHERE environment_id = p_environment_id;

  -- 10. Policies & Memberships
  DELETE FROM public.policies
  WHERE environment_id = p_environment_id;

  DELETE FROM public.environment_memberships
  WHERE environment_id = p_environment_id;

  -- 11. Finally, delete the environment
  DELETE FROM public.environments
  WHERE id = p_environment_id AND owner_user_id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_environment_cascade(uuid, uuid) TO service_role;
