"""Phase 4 Travel Specialist Agent.

Coordinates travel itineraries. Permitted to delegate narrower authority to Hotel and Transport
specialists within bounds granted by the Personal Agent.
"""

from __future__ import annotations

import os
from typing import Any
from agent_runtime.adk import ADK_AVAILABLE
from agent_runtime.gateway_client import GatewayClient


def build_travel_agent(gateway: GatewayClient | None = None) -> Any:
    gateway_client = gateway or GatewayClient()

    if not ADK_AVAILABLE:
        return {"name": "travel_agent", "gateway": gateway_client}

    from google.adk.agents import Agent

    return Agent(
        name="payguardian_travel_agent",
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        instruction=(
            "You are the Travel Agent. You plan travel itineraries. "
            "You may delegate bounded authority to Hotel or Transport agents through the gateway. "
            "All actions are strictly bounded by your parent mandate."
        ),
    )
