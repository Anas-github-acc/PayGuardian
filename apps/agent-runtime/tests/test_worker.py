"""Unit tests for task worker and idempotent execution."""

from agent_runtime.gateway_client import GatewayClient
from agent_runtime.worker import (
    AgentWorker,
    InMemoryTaskStore,
    TaskStatus,
    WorkerTask,
)


def test_in_memory_task_store_submit_and_claim() -> None:
    store = InMemoryTaskStore()
    task = WorkerTask(
        id="task-abc",
        idempotency_key="key-abc",
        message="Plan vacation in Hawaii",
    )
    submitted = store.submit(task)
    assert submitted.id == "task-abc"
    assert submitted.status == TaskStatus.PENDING

    # Submitting with same idempotency key returns existing task
    duplicate = WorkerTask(
        id="task-def",
        idempotency_key="key-abc",
        message="Different message",
    )
    existing = store.submit(duplicate)
    assert existing.id == "task-abc"

    # Claiming task
    claimed = store.claim(worker_id="worker-1", limit=1, lease_duration_s=60.0)
    assert len(claimed) == 1
    assert claimed[0].id == "task-abc"
    assert claimed[0].status == TaskStatus.RUNNING
    assert claimed[0].lease_owner == "worker-1"
    assert claimed[0].lease_token is not None


def test_worker_task_lifecycle_completed() -> None:
    store = InMemoryTaskStore()
    worker = AgentWorker(worker_id="test-worker", store=store)

    task = WorkerTask(
        id="task-life-1",
        idempotency_key="idem-life-1",
        message="Plan trip to Chicago with hotel and food",
    )
    store.submit(task)

    # Worker consumes and completes task
    stats = worker.run_once()
    assert stats["claimed"] == 1
    assert stats["completed"] == 1
    assert stats["failed"] == 0

    saved_task = store.get("task-life-1")
    assert saved_task is not None
    assert saved_task.status == TaskStatus.COMPLETED
    assert saved_task.result is not None
    assert "final_response" in saved_task.result
    assert "results" in saved_task.result
    assert "travel" in saved_task.result["results"]


def test_worker_idempotent_execution() -> None:
    store = InMemoryTaskStore()
    worker = AgentWorker(worker_id="test-worker", store=store)

    task_payload = {
        "id": "task-idem-test",
        "idempotency_key": "unique-idempotency-key-777",
        "message": "Plan a road trip to Austin",
    }

    # First execution
    first_res = worker.execute_task(task_payload)
    assert first_res["status"] == "completed"
    assert first_res["idempotent"] is False
    first_final_response = first_res["result"]["final_response"]

    # Second execution with exact same idempotency key
    second_res = worker.execute_task(task_payload)
    assert second_res["status"] == "completed"
    assert second_res["idempotent"] is True
    assert second_res["result"]["final_response"] == first_final_response


def test_worker_task_lifecycle_failed() -> None:
    store = InMemoryTaskStore()

    class FailingAgent:
        def run(self, *args, **kwargs) -> dict:
            raise RuntimeError("Synthetic specialist agent failure.")

    worker = AgentWorker(
        worker_id="failing-worker",
        store=store,
        personal_agent=FailingAgent(),  # type: ignore[arg-type]
    )

    task = WorkerTask(
        id="task-fail-1",
        idempotency_key="idem-fail-1",
        message="Task that will fail",
    )
    store.submit(task)

    stats = worker.run_once()
    assert stats["claimed"] == 1
    assert stats["completed"] == 0
    assert stats["failed"] == 1

    saved = store.get("task-fail-1")
    assert saved is not None
    assert saved.status == TaskStatus.FAILED
    assert "Synthetic specialist agent failure" in str(saved.error)


def test_worker_gateway_run_status_updates() -> None:
    gateway_updates: list[dict] = []

    class MockGateway(GatewayClient):
        def update_run(
            self,
            environment_id: str,
            session_id: str,
            run_id: str,
            status: str | None = None,
            checkpoint: dict | None = None,
        ) -> dict:
            gateway_updates.append(
                {
                    "env": environment_id,
                    "session": session_id,
                    "run": run_id,
                    "status": status,
                }
            )
            return {"status": status}

    mock_gw = MockGateway()
    worker = AgentWorker(gateway_client=mock_gw)

    task = WorkerTask(
        id="task-gw-1",
        idempotency_key="idem-gw-1",
        message="Plan weekend trip",
        environment_id="env-123",
        session_id="session-456",
        run_id="run-789",
    )

    result = worker.execute_task(task)
    assert result["status"] == "completed"

    # Verify gateway run updates were sent for "running" and "completed"
    statuses = [u["status"] for u in gateway_updates]
    assert "running" in statuses
    assert "completed" in statuses
