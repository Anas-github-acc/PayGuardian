from fastapi.testclient import TestClient

from agent_runtime.main import app

client = TestClient(app)


def test_health_is_explicitly_phase_zero() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["authorityEnforcement"] == "not-enabled"


def test_run_is_simulation_only() -> None:
    response = client.post("/run", json={"agent": "personal", "message": "demo"})

    assert response.status_code == 200
    assert response.json()["status"] == "simulated"
    assert response.json()["authorityGranted"] is False
    assert response.json()["paymentExecuted"] is False


def test_all_dummy_agents_are_discoverable() -> None:
    response = client.get("/agents")

    assert response.status_code == 200
    assert response.json()["agents"] == [
        "personal",
        "travel",
        "hotel",
        "transport",
        "food",
        "activities",
    ]


def test_real_execution_is_not_enabled() -> None:
    response = client.post(
        "/run",
        json={"agent": "personal", "message": "demo", "dry_run": False},
    )

    assert response.status_code == 501
