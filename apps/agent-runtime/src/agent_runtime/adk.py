"""Small ADK integration boundary used by the Phase 0 health service."""

from __future__ import annotations

import os
from typing import Any

try:
    from google.adk.agents import Agent

    ADK_AVAILABLE = True
except ImportError:  # pragma: no cover - exercised by setup diagnostics
    Agent = Any  # type: ignore[misc,assignment]
    ADK_AVAILABLE = False


def build_phase_zero_agent() -> Any:
    """Build an ADK agent without granting it gateway authority or tools."""

    if not ADK_AVAILABLE:
        return None

    return Agent(
        name="phase_zero_personal_agent",
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        instruction=(
            "You are a Phase 0 demonstration agent. Do not execute tools, payments, "
            "delegations, or authority changes. Return planning-only responses."
        ),
    )
