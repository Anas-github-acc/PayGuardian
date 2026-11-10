"""HTTP surface for the ADK-compatible agent runtime."""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from agent_runtime.adk import ADK_AVAILABLE
from agent_runtime.agents import build_agent, configured_agent_names
from agent_runtime.gateway_client import GatewayClient, assert_safe_prompt_content
from agent_runtime.personal_langgraph import PersonalLangGraphAgent

app = FastAPI(
    title="PayGuardian Agent Runtime",
    description=(
        "ADK-compatible agent runtime; calls protected gateway tools "
        "without prompt credential leakage."
    ),
    version="0.2.0",
)


class RunRequest(BaseModel):
    agent: str = Field(default="personal", min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=4000)
    dry_run: bool = True
    environment_id: str | None = None
    mandate_id: str | None = None
    action: str | None = None
    amount_minor: int | None = None
    currency: str = "USD"
    parameters: dict[str, Any] | None = None


class LangGraphRunRequest(BaseModel):
    message: str | None = Field(default=None, max_length=4000)
    messages: list[dict[str, Any]] | None = None
    environment_id: str | None = None
    mandate_id: str | None = None
    session_id: str | None = None
    run_id: str | None = None
    model_id: str | None = None
    budget_limit_minor: int | None = None
    available_reserve_minor: int | None = None
    already_delegated_minor: int | None = None
    budget_currency: str | None = None
    approval_required: bool | None = None


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "agent-runtime",
        "phase": "approvals-and-agent-workflows",
        "adkAvailable": ADK_AVAILABLE,
        "configuredAgents": configured_agent_names(),
        "authorityEnforcement": "gateway-enforced",
    }


@app.get("/agents")
def agents() -> dict[str, object]:
    return {"agents": configured_agent_names(), "authorityEnforcement": "gateway-enforced"}


@app.get("/tools")
def tools() -> dict[str, object]:
    return {
        "tools": [
            {
                "name": "check_authority",
                "description": "Check whether an action is permitted by a mandate.",
            },
            {
                "name": "simulate_action",
                "description": "Execute a non-payment simulation action through the gateway.",
            },
            {
                "name": "request_approval",
                "description": "Submit a protected action for human approval.",
            },
            {
                "name": "reserve_action",
                "description": "Reserve ledger budget for an authorized protected action.",
            },
        ],
        "credentialsInPrompts": False,
    }


@app.post("/run")
def run(request: RunRequest) -> dict[str, object]:
    # Invariant: Prompt must NOT contain runtime credentials or bearer tokens
    try:
        assert_safe_prompt_content(request.message)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if request.agent not in configured_agent_names():
        raise HTTPException(status_code=404, detail=f"Agent '{request.agent}' not found.")

    agent = build_agent(request.agent)

    if request.dry_run:
        return {
            "status": "simulated",
            "agent": request.agent,
            "message": request.message,
            "adkAgentConfigured": True,
            "adkAgentConstructed": agent is not None,
            "authorityGranted": False,
            "paymentExecuted": False,
        }

    # Real execution: invoke protected gateway path
    if not (request.environment_id and request.mandate_id and request.action):
        raise HTTPException(
            status_code=400,
            detail=(
                "Real agent execution requires environment_id, mandate_id, and action to invoke "
                "protected gateway tools."
            ),
        )

    client = GatewayClient(
        base_url=os.getenv("GATEWAY_API_URL", "http://localhost:3001"),
        local_user_id=os.getenv("GATEWAY_LOCAL_USER_ID", "local-user"),
    )

    try:
        gateway_result = client.simulate_action(
            environment_id=request.environment_id,
            agent_id=request.agent,
            mandate_id=request.mandate_id,
            action=request.action,
            amount_minor=request.amount_minor or 0,
            currency=request.currency,
            parameters=request.parameters,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gateway service communication failure: {exc}",
        ) from exc

    return {
        "status": "executed",
        "agent": request.agent,
        "message": request.message,
        "adkAgentConfigured": True,
        "adkAgentConstructed": agent is not None,
        "gatewayResult": gateway_result,
        "authorityGranted": False,  # Gateway is the only authority source
        "paymentExecuted": False,
    }


@app.post("/langgraph/run")
def run_langgraph(request: LangGraphRunRequest) -> dict[str, object]:
    effective_message = request.message or ""
    if not effective_message and request.messages:
        for m in reversed(request.messages):
            if m.get("role") in ("user", "human") and m.get("content"):
                effective_message = str(m["content"])
                break
    if not effective_message:
        effective_message = "Assist user with authorized tasks."

    try:
        assert_safe_prompt_content(effective_message)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    agent = PersonalLangGraphAgent()
    result = agent.run(
        message=effective_message,
        messages=request.messages,
        environment_id=request.environment_id,
        mandate_id=request.mandate_id,
        session_id=request.session_id,
        run_id=request.run_id,
        model_id=request.model_id,
        budget_limit_minor=request.budget_limit_minor,
        available_reserve_minor=request.available_reserve_minor,
        already_delegated_minor=request.already_delegated_minor,
        budget_currency=request.budget_currency,
        approval_required=request.approval_required,
    )
    return {
        "status": "completed",
        "agent": "personal",
        "finalResponse": result.get("final_response"),
        "plan": result.get("plan"),
        "results": result.get("results"),
        "subagentTasks": result.get("subagent_tasks"),
        "events": result.get("events"),
    }
