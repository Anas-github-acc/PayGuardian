"""PGMQ Consumer Worker for PayGuardian Agent Runtime.

Connects to Supabase PostgreSQL, reads queued tasks from `agent_task_queue` (pgmq),
executes tasks via LangGraph Personal Agent, persists events to agent_events,
and archives (acknowledges) processed messages.
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any

import httpx

from agent_runtime.gateway_client import GatewayClient
from agent_runtime.personal_langgraph import PersonalLangGraphAgent

logger = logging.getLogger("agent_runtime.pgmq_worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


# Automatically load env from candidate paths (.env, apps/agent-runtime/.env, ../../.env)
_curr = Path(__file__).resolve().parent
for _p in [
    _curr / ".env",
    _curr.parent / ".env",
    _curr.parent.parent / ".env",
    Path.cwd() / ".env",
    Path.cwd() / "apps/agent-runtime/.env",
]:
    _load_env_file(_p)


class PGMQAgentWorker:
    def __init__(
        self,
        supabase_url: str | None = None,
        supabase_key: str | None = None,
        gateway_url: str | None = None,
        visibility_timeout: int = 45,
    ) -> None:
        self.supabase_url = (
            supabase_url or os.getenv("SUPABASE_URL") or "https://ntdgrdoylzqgwbdlkkna.supabase.co"
        ).rstrip("/")
        self.supabase_key = (
            supabase_key
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
            or ""
        )
        self.gateway_url = (
            gateway_url
            or os.getenv("GATEWAY_API_URL")
            or os.getenv("PAYGUARDIAN_API_URL")
            or "http://localhost:3001"
        ).rstrip("/")
        self.visibility_timeout = visibility_timeout

        self.gateway = GatewayClient(base_url=self.gateway_url)
        self.agent = PersonalLangGraphAgent(gateway_client=self.gateway)

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.supabase_key:
            headers["apikey"] = self.supabase_key
            headers["Authorization"] = f"Bearer {self.supabase_key}"

        self.client = httpx.Client(
            base_url=self.supabase_url,
            headers=headers,
            timeout=30.0,
        )
        self._stopping = False

    def read_next_task(self) -> dict[str, Any] | None:
        """Call Supabase RPC `read_agent_tasks_pgmq` to read from pgmq queue."""
        try:
            resp = self.client.post(
                "/rest/v1/rpc/read_agent_tasks_pgmq",
                json={
                    "p_visibility_timeout_seconds": self.visibility_timeout,
                    "p_limit": 1,
                },
            )
            if resp.status_code == 200:
                rows = resp.json()
                if rows and len(rows) > 0:
                    return rows[0]
            else:
                logger.warning("PGMQ read error: %d - %s", resp.status_code, resp.text)
        except Exception as exc:
            logger.error("Failed to connect to Supabase pgmq RPC: %s", exc)
        return None

    def archive_task(self, msg_id: int) -> bool:
        """Acknowledge and archive the processed message in pgmq."""
        try:
            resp = self.client.post(
                "/rest/v1/rpc/archive_agent_task_pgmq",
                json={"p_msg_id": msg_id},
            )
            return resp.status_code == 200
        except Exception as exc:
            logger.error("Failed to archive pgmq msg %s: %s", msg_id, exc)
            return False

    def process_task(self, record: dict[str, Any]) -> None:
        msg_id = record.get("msg_id")
        body = record.get("message") or {}
        run_id = body.get("runId")
        task_id = body.get("taskId")
        environment_id = body.get("environmentId")
        conversation_id = body.get("conversationId")
        model_id = body.get("modelId") or body.get("model")
        prompt = body.get("message") or ""

        mandate_id = body.get("mandateId") or body.get("mandate_id")
        budget_limit_minor = body.get("budgetLimitMinor") or body.get("budget_limit_minor")
        budget_currency = body.get("budgetCurrency") or body.get("budget_currency")
        approval_required = bool(
            body.get("approvalRequired") or body.get("approval_required") or False
        )

        logger.info(
            "Claimed PGMQ message %s (run_id=%s, task_id=%s, model=%s, mandate=%s, budget=%s %s)",
            msg_id,
            run_id,
            task_id,
            model_id or "default",
            mandate_id,
            budget_limit_minor,
            budget_currency,
        )

        try:
            # 1. Update task & run state in gateway
            if environment_id and run_id:
                try:
                    self.client.patch(
                        f"/rest/v1/agent_runs?id=eq.{run_id}",
                        json={"status": "running", "started_at": "now()"},
                    )
                    if task_id:
                        self.client.patch(
                            f"/rest/v1/agent_tasks?id=eq.{task_id}",
                            json={"status": "running", "started_at": "now()"},
                        )
                except Exception as db_err:
                    logger.warning("Failed to update status to running: %s", db_err)

            # 2. Execute via LangGraph Personal Agent
            result = self.agent.run(
                message=prompt,
                environment_id=environment_id,
                mandate_id=mandate_id,
                session_id=conversation_id,
                run_id=run_id,
                model_id=model_id,
                budget_limit_minor=budget_limit_minor,
                budget_currency=budget_currency,
                approval_required=approval_required,
            )

            final_text = result.get("final_response") or "Task executed successfully."

            # 3. Notify gateway of completion (appends message and fires SSE stream events)
            if environment_id and run_id:
                try:
                    self.gateway.post_json(
                        f"/v1/environments/{environment_id}/runs/{run_id}/complete",
                        payload={
                            "taskId": task_id,
                            "finalResponse": final_text,
                            "status": "completed",
                        },
                    )
                except Exception as gw_err:
                    logger.warning("Gateway complete callback failed: %s", gw_err)

            # 4. Also persist to Supabase tables directly for hosted persistence
            if conversation_id:
                try:
                    self.client.post(
                        "/rest/v1/messages",
                        json={
                            "conversation_id": conversation_id,
                            "sender_type": "assistant",
                            "sender_id": "personal",
                            "content": final_text,
                        },
                    )
                except Exception:
                    pass

            # 5. Archive message from pgmq
            self.archive_task(msg_id)
            logger.info("Successfully completed and archived PGMQ message %s", msg_id)

        except Exception as exc:
            logger.exception("Error processing PGMQ task %s: %s", msg_id, exc)
            if run_id:
                try:
                    self.client.patch(
                        f"/rest/v1/agent_runs?id=eq.{run_id}",
                        json={"status": "failed", "error_details": {"error": str(exc)}},
                    )
                except Exception:
                    pass

    def run_loop(self, poll_interval: float = 1.0) -> None:
        """Continuous polling loop."""
        logger.info("PGMQ Worker started. Listening on 'agent_task_queue'...")
        while not self._stopping:
            task = self.read_next_task()
            if task:
                self.process_task(task)
            else:
                time.sleep(poll_interval)


if __name__ == "__main__":
    worker = PGMQAgentWorker()
    worker.run_loop()
