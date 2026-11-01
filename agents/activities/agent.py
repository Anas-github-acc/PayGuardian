"""Phase 4 Activities Specialist Agent.

Coordinates tours, museum tickets, and excursions within bounds allocated by Personal Agent.
"""

from __future__ import annotations

import os
from typing import Any
from agent_runtime.adk import ADK_AVAILABLE
from agent_runtime.gateway_client import GatewayClient


def build_activities_agent(gateway: GatewayClient | None = None) -> Any:
    gateway_client = gateway or GatewayClient()

    if not ADK_AVAILABLE:
        return {"name": "activities_agent", "gateway": gateway_client}

    from google.adk.agents import Agent

    return Agent(
        name="payguardian_activities_agent",
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        instruction=(
            "You are the Activities Agent. You find and book events, tours, and experiences. "
            "You execute actions strictly via the PayGuardian Gateway tools."
        ),
    )
