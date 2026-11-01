from fastapi.testclient import TestClient

from agent_runtime.main import app

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "agent-runtime"


def test_run_is_simulation_only_in_dry_run() -> None:
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


def test_tools_discovery() -> None:
    response = client.get("/tools")

    assert response.status_code == 200
    assert len(response.json()["tools"]) >= 4
    assert response.json()["credentialsInPrompts"] is False


def test_rejects_credential_leak_in_prompt() -> None:
    response = client.post(
        "/run",
        json={
            "agent": "personal",
            "message": "Use this Bearer secret-token-12345 to book flight",
            "dry_run": True,
        },
    )

    assert response.status_code == 400
    assert "PROMPT_SENSITIVE_LEAK" in response.json()["detail"]


def test_real_execution_requires_gateway_parameters() -> None:
    response = client.post(
        "/run",
        json={"agent": "personal", "message": "demo", "dry_run": False},
    )

    assert response.status_code == 400
    assert "Real agent execution requires" in response.json()["detail"]
