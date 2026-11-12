"""Configured dummy ADK agents for local workflow proof."""

from __future__ import annotations

import os
from typing import Any

from agent_runtime.adk import ADK_AVAILABLE

AGENT_DEFINITIONS = {
    "personal": "Coordinate an authorized task. Never grant authority or execute payments.",
    "travel": "Plan travel within authority supplied by the gateway. Never expand scope.",
    "hotel": "Suggest hotel options within the authority supplied by Travel.",
    "transport": "Suggest transport options within the authority supplied by Travel.",
    "food": "Suggest food options within the authority supplied by Personal.",
    "activities": "Suggest activities within the authority supplied by Personal.",
    "merchant_attach": (
        "Simulate searching merchant products like biscuit and chai, compare vendors "
        "over a simulated 3-minute workflow, and proceed with bounded gateway payment."
    ),
    "merchantattach": (
        "Simulate searching merchant products like biscuit and chai, compare vendors "
        "over a simulated 3-minute workflow, and proceed with bounded gateway payment."
    ),
}


def configured_agent_names() -> list[str]:
    return list(AGENT_DEFINITIONS)


def build_agent(name: str, model: str | None = None) -> Any:
    if name not in AGENT_DEFINITIONS:
        return None
    if not ADK_AVAILABLE:
        return None

    from google.adk.agents import Agent

    target_model = model or os.getenv("DEFAULT_MODEL", "free/gpt-6-luna")
    return Agent(
        name=f"payguardian_{name}_agent",
        model=target_model,
        instruction=(
            f"You are the {name} agent. {AGENT_DEFINITIONS[name]} "
            "The gateway is the only authority source."
        ),
    )
