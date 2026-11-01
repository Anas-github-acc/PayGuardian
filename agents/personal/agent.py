"""Phase 4 Personal Agent.

Coordinates task planning, registers specialist child agents, and delegates bounded authority
through the PayGuardian Gateway. Credentials are never placed in model prompts.
"""

from __future__ import annotations

import os
from typing import Any
from agent_runtime.adk import ADK_AVAILABLE
from agent_runtime.gateway_client import GatewayClient


def build_personal_agent(gateway: GatewayClient | None = None) -> Any:
    gateway_client = gateway or GatewayClient()

    if not ADK_AVAILABLE:
        return {"name": "personal_agent", "gateway": gateway_client}

    from google.adk.agents import Agent

    return Agent(
        name="payguardian_personal_agent",
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        instruction=(
            "You are the Personal Agent. You coordinate tasks with user approval. "
            "You may register Travel, Food, or Activities children through the gateway. "
            "You cannot grant authority or bypass gateway policy denials."
        ),
    )
