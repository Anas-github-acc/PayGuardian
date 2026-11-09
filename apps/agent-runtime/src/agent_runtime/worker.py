"""Task worker for PayGuardian Agent Runtime.

Consumes tasks/jobs, enforces idempotency, updates task status
('running', 'completed', 'failed'), and executes through the LangGraph personal agent.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from agent_runtime.gateway_client import GatewayClient, assert_safe_prompt_content
from agent_runtime.personal_langgraph import PersonalLangGraphAgent

logger = logging.getLogger(__name__)


class TaskStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class WorkerTask:
    id: str
    idempotency_key: str
    message: str
    status: TaskStatus = TaskStatus.PENDING
    environment_id: str | None = None
    mandate_id: str | None = None
    session_id: str | None = None
    run_id: str | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    lease_owner: str | None = None
    lease_token: str | None = None
    lease_expires_at: float | None = None
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "idempotency_key": self.idempotency_key,
            "message": self.message,
            "status": str(self.status),
            "environment_id": self.environment_id,
            "mandate_id": self.mandate_id,
            "session_id": self.session_id,
            "run_id": self.run_id,
            "result": self.result,
            "error": self.error,
            "lease_owner": self.lease_owner,
            "lease_token": self.lease_token,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class InMemoryTaskStore:
    """Thread-safe in-memory store for task claiming and idempotency tracking."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._tasks: dict[str, WorkerTask] = {}
        self._idempotency_map: dict[str, str] = {}  # idempotency_key -> task_id

    def submit(self, task: WorkerTask) -> WorkerTask:
        with self._lock:
            existing_id = self._idempotency_map.get(task.idempotency_key)
            if existing_id and existing_id in self._tasks:
                return self._tasks[existing_id]

            self._tasks[task.id] = task
            self._idempotency_map[task.idempotency_key] = task.id
            return task

    def get(self, task_id: str) -> WorkerTask | None:
        with self._lock:
            return self._tasks.get(task_id)

    def get_by_idempotency_key(self, idempotency_key: str) -> WorkerTask | None:
        with self._lock:
            task_id = self._idempotency_map.get(idempotency_key)
            if task_id:
                return self._tasks.get(task_id)
            return None

    def claim(
        self,
        worker_id: str,
        limit: int = 1,
        lease_duration_s: float = 30.0,
    ) -> list[WorkerTask]:
        with self._lock:
            now = time.time()
            claimed: list[WorkerTask] = []

            for task in self._tasks.values():
                if len(claimed) >= limit:
                    break

                is_pending = task.status == TaskStatus.PENDING
                lease_expired = (
                    task.status == TaskStatus.RUNNING
                    and task.lease_expires_at is not None
                    and task.lease_expires_at < now
                )

                if is_pending or lease_expired:
                    task.status = TaskStatus.RUNNING
                    task.lease_owner = worker_id
                    task.lease_token = str(uuid.uuid4())
                    task.lease_expires_at = now + lease_duration_s
                    task.updated_at = datetime.now(UTC).isoformat()
                    claimed.append(task)

            return claimed

    def update_status(
        self,
        task_id: str,
        status: TaskStatus | str,
        result: dict[str, Any] | None = None,
        error: str | None = None,
        lease_token: str | None = None,
    ) -> WorkerTask | None:
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return None

            # If lease_token is supplied, ensure it matches
            if lease_token and task.lease_token and task.lease_token != lease_token:
                logger.warning("Lease token mismatch for task %s", task_id)
                return None

            task_status = status if isinstance(status, TaskStatus) else TaskStatus(status)
            task.status = task_status
            if result is not None:
                task.result = result
            if error is not None:
                task.error = error
            if task_status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
                task.lease_owner = None
                task.lease_token = None
                task.lease_expires_at = None

            task.updated_at = datetime.now(UTC).isoformat()
            return task


class AgentWorker:
    """Consumes tasks/jobs, runs Personal LangGraph Agent, and updates status."""

    def __init__(
        self,
        worker_id: str | None = None,
        store: InMemoryTaskStore | None = None,
        gateway_client: GatewayClient | None = None,
        personal_agent: PersonalLangGraphAgent | None = None,
    ) -> None:
        self.worker_id = worker_id or f"worker_{uuid.uuid4().hex[:8]}"
        self.store = store or InMemoryTaskStore()
        self.gateway_client = gateway_client or GatewayClient()
        self.personal_agent = personal_agent or PersonalLangGraphAgent(
            gateway_client=self.gateway_client,
        )
        self._stopping = False

    def execute_task(self, task_or_dict: WorkerTask | dict[str, Any]) -> dict[str, Any]:
        """Execute a task idempotently and update status to running -> completed/failed."""
        if isinstance(task_or_dict, dict):
            task = WorkerTask(
                id=task_or_dict.get("id") or str(uuid.uuid4()),
                idempotency_key=task_or_dict.get("idempotency_key") or str(uuid.uuid4()),
                message=task_or_dict.get("message", ""),
                status=TaskStatus.PENDING,
                environment_id=task_or_dict.get("environment_id"),
                mandate_id=task_or_dict.get("mandate_id"),
                session_id=task_or_dict.get("session_id"),
                run_id=task_or_dict.get("run_id"),
            )
        else:
            task = task_or_dict

        # Invariant: prompt must not leak credentials
        assert_safe_prompt_content(task.message)

        # Idempotency check: if already completed, return cached result
        existing = self.store.get_by_idempotency_key(task.idempotency_key)
        if existing and existing.status == TaskStatus.COMPLETED and existing.result is not None:
            logger.info("Task %s completed previously (%s)", existing.id, task.idempotency_key)
            return {
                "task_id": existing.id,
                "status": "completed",
                "idempotent": True,
                "result": existing.result,
            }

        # Register task in store if not present
        if not existing:
            self.store.submit(task)
        else:
            task = existing

        # Update status to RUNNING
        self.store.update_status(task.id, TaskStatus.RUNNING)

        # Notify gateway of run status if session & run are attached
        if task.environment_id and task.session_id and task.run_id:
            try:
                self.gateway_client.update_run(
                    environment_id=task.environment_id,
                    session_id=task.session_id,
                    run_id=task.run_id,
                    status="running",
                )
            except Exception as exc:
                logger.warning("Gateway update_run (running) failed: %s", exc)

        try:
            # Execute personal LangGraph agent
            run_result = self.personal_agent.run(
                message=task.message,
                environment_id=task.environment_id,
                mandate_id=task.mandate_id,
                session_id=task.session_id,
                run_id=task.run_id or task.id,
            )

            # Update status to COMPLETED
            self.store.update_status(task.id, TaskStatus.COMPLETED, result=run_result)

            if task.environment_id and task.session_id and task.run_id:
                try:
                    self.gateway_client.update_run(
                        environment_id=task.environment_id,
                        session_id=task.session_id,
                        run_id=task.run_id,
                        status="completed",
                        checkpoint={"final_response": run_result.get("final_response")},
                    )
                except Exception as exc:
                    logger.warning("Gateway update_run (completed) failed: %s", exc)

            return {
                "task_id": task.id,
                "status": "completed",
                "idempotent": False,
                "result": run_result,
            }

        except Exception as exc:
            error_message = str(exc)
            logger.exception("Task %s failed: %s", task.id, error_message)
            self.store.update_status(task.id, TaskStatus.FAILED, error=error_message)

            if task.environment_id and task.session_id and task.run_id:
                try:
                    self.gateway_client.update_run(
                        environment_id=task.environment_id,
                        session_id=task.session_id,
                        run_id=task.run_id,
                        status="failed",
                        checkpoint={"error": error_message},
                    )
                except Exception as gw_exc:
                    logger.warning("Gateway update_run (failed) failed: %s", gw_exc)

            return {
                "task_id": task.id,
                "status": "failed",
                "idempotent": False,
                "error": error_message,
            }

    def run_once(self, limit: int = 1) -> dict[str, int]:
        """Poll and execute one batch of claimed tasks."""
        claimed = self.store.claim(worker_id=self.worker_id, limit=limit)
        completed = 0
        failed = 0

        for task in claimed:
            res = self.execute_task(task)
            if res.get("status") == "completed":
                completed += 1
            else:
                failed += 1

        return {
            "claimed": len(claimed),
            "completed": completed,
            "failed": failed,
        }

    def stop(self) -> None:
        self._stopping = True

    def poll_loop(self, max_iterations: int | None = None, poll_interval_s: float = 0.5) -> None:
        """Poll continuously until stopped or max_iterations reached."""
        iterations = 0
        while not self._stopping:
            self.run_once()
            iterations += 1
            if max_iterations is not None and iterations >= max_iterations:
                break
            time.sleep(poll_interval_s)
