"""Phase 4 Hotel Specialist Agent.

Finds and books accommodations using protected gateway simulation and reservation tools.
"""

from __future__ import annotations

import os
from typing import Any
from agent_runtime.adk import ADK_AVAILABLE
from agent_runtime.gateway_client import GatewayClient


def build_hotel_agent(gateway: GatewayClient | None = None) -> Any:
    gateway_client = gateway or GatewayClient()

    if not ADK_AVAILABLE:
        return {"name": "hotel_agent", "gateway": gateway_client}

    from google.adk.agents import Agent

    return Agent(
        name="payguardian_hotel_agent",
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        instruction=(
            "You are the Hotel Agent. You search and suggest lodging options. "
            "You execute bookings only through the PayGuardian Gateway tools. "
            "You have no direct database access."
        ),
    )
