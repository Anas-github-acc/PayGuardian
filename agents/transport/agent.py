"""Phase 4 Transport Specialist Agent.

Finds and books transportation (flights, trains, transfers) via gateway tools.
"""

from __future__ import annotations

import os
from typing import Any
from agent_runtime.adk import ADK_AVAILABLE
from agent_runtime.gateway_client import GatewayClient


def build_transport_agent(gateway: GatewayClient | None = None) -> Any:
    gateway_client = gateway or GatewayClient()

    if not ADK_AVAILABLE:
        return {"name": "transport_agent", "gateway": gateway_client}

    from google.adk.agents import Agent

    return Agent(
        name="payguardian_transport_agent",
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        instruction=(
            "You are the Transport Agent. You plan transport and transit. "
            "You execute bookings only through the PayGuardian Gateway tools. "
            "You cannot exceed the budget allocated by the Travel Agent."
        ),
    )
