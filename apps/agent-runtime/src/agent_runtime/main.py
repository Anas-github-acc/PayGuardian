"""HTTP surface for the Phase 0 ADK-compatible runtime."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from agent_runtime.adk import ADK_AVAILABLE
from agent_runtime.agents import build_agent, configured_agent_names

app = FastAPI(
    title="PayGuardian Agent Runtime",
    description="Phase 0 health and dry-run surface; no authority or payment tools.",
    version="0.1.0",
)


class RunRequest(BaseModel):
    agent: str = Field(default="personal", min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=4000)
    dry_run: bool = True


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "agent-runtime",
        "phase": "repository-and-deployment-proof",
        "adkAvailable": ADK_AVAILABLE,
        "configuredAgents": configured_agent_names(),
        "authorityEnforcement": "not-enabled",
    }


@app.get("/agents")
def agents() -> dict[str, object]:
    return {"agents": configured_agent_names(), "authorityEnforcement": "not-enabled"}


@app.post("/run")
def run(request: RunRequest) -> dict[str, object]:
    if not request.dry_run:
        raise HTTPException(
            status_code=501,
            detail=(
                "Real agent execution is disabled until the protected gateway path is implemented."
            ),
        )

    agent = build_agent(request.agent)
    return {
        "status": "simulated",
        "agent": request.agent,
        "message": request.message,
        "adkAgentConfigured": request.agent in configured_agent_names(),
        "adkAgentConstructed": agent is not None,
        "authorityGranted": False,
        "paymentExecuted": False,
    }
