"""Subagent capability registry and discovery module.

Allows dynamic registration and LLM-driven discovery of specialist subagents.
Adding a new subagent requires only registering its capabilities and description here
or in the Gateway agent catalog without modifying the Personal Agent's orchestration logic.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Literal, TypedDict

logger = logging.getLogger("agent_runtime.subagent_registry")


class ClarificationQuestion(TypedDict):
    question: str
    required: bool
    reason: str


class ClarificationRequest(TypedDict):
    status: Literal["clarification_required"]
    questions: list[ClarificationQuestion]


@dataclass
class SubagentCapability:
    id: str
    name: str
    alias: str
    specialty: str
    description: str
    capabilities: list[str] = field(default_factory=list)
    default_action: str = "execute"
    sample_prompts: list[str] = field(default_factory=list)
    clarification_checker: Callable[[str, dict[str, Any]], tuple[bool, ClarificationRequest | None]] | None = None
    parent_agent_id: str | None = None
    allowed_child_agent_ids: list[str] = field(default_factory=list)
    can_delegate: bool = False
    max_delegation_depth: int = 0


def _check_merchant_clarification(
    prompt: str, preferences: dict[str, Any]
) -> tuple[bool, ClarificationRequest | None]:
    prompt_lower = prompt.lower()
    is_direct_simulation = (
        "proceed with payment" in prompt_lower
        and ("biscuit" in prompt_lower or "chai" in prompt_lower)
    )
    is_budget_planning = (
        "budget plan" in prompt_lower
        or "plan a budget" in prompt_lower
        or "budget proposal" in prompt_lower
        or "budget allocation" in prompt_lower
    )
    if is_direct_simulation or is_budget_planning:
        return False, None

    if not preferences.get("location"):
        req: ClarificationRequest = {
            "status": "clarification_required",
            "questions": [
                {
                    "question": "Which city or area should I search in?",
                    "required": True,
                    "reason": "Finding nearby merchants",
                }
            ],
        }
        return True, req
    return False, None


# Canonical catalog of built-in subagents
DEFAULT_SUBAGENTS: list[SubagentCapability] = [
    SubagentCapability(
        id="agent-merchant-attach",
        name="MerchantAttach",
        alias="merchant_attach",
        specialty="custom",
        description=(
            "Autonomous merchant catalog search, price comparison, regional groceries, snacks, "
            "biscuits, chai, tea, baked goods, delivery quotes, and bounded checkout."
        ),
        capabilities=["merchant.discover", "catalog.quote", "procure_merchant_goods"],
        default_action="procure_merchant_goods",
        sample_prompts=[
            "Buy biscuit and chai from local store",
            "Search snacks and order from nearby bakery",
            "Procure regional provisions within budget",
        ],
        clarification_checker=_check_merchant_clarification,
        parent_agent_id=None,
        can_delegate=False,
        max_delegation_depth=0,
    ),
    SubagentCapability(
        id="agent-travel-concierge",
        name="Travel Concierge",
        alias="travel",
        specialty="travel",
        description=(
            "Autonomous multi-leg travel planning, flight scheduling, route discovery, "
            "itinerary management, and sub-delegation to lodging & transit specialists."
        ),
        capabilities=["travel.discover", "flight.quote", "plan_itinerary"],
        default_action="plan_itinerary",
        sample_prompts=[
            "Find and book round-trip flights",
            "Plan travel itinerary for trip or vacation",
        ],
        parent_agent_id=None,
        can_delegate=True,
        max_delegation_depth=1,
        allowed_child_agent_ids=["agent-hotel-specialist", "agent-transport-coordinator"],
    ),
    SubagentCapability(
        id="agent-hotel-specialist",
        name="Hotel Specialist",
        alias="hotel",
        specialty="hotel",
        description=(
            "Curated hotel accommodations, boutique suites, room rate quotes, lodging bookings, "
            "and flexible cancellation terms under Travel Concierge authority."
        ),
        capabilities=["hotel.discover", "lodging.quote", "book_hotel"],
        default_action="book_hotel",
        sample_prompts=[
            "Book 3 nights at a hotel near city center",
            "Find boutique accommodation with breakfast",
        ],
        parent_agent_id="agent-travel-concierge",
        can_delegate=False,
        max_delegation_depth=0,
    ),
    SubagentCapability(
        id="agent-food-dining",
        name="Food & Dining Specialist",
        alias="food",
        specialty="food",
        description=(
            "Curated restaurant bookings, culinary venues, regional cuisine discovery, "
            "dinner reservations, and meal allowances."
        ),
        capabilities=["food.discover", "dining.quote", "recommend_dining"],
        default_action="recommend_dining",
        sample_prompts=[
            "Find top-rated ramen spots and reserve dinner",
            "Curate a 3-day dining plan with regional bistro reservations",
        ],
        parent_agent_id=None,
        can_delegate=False,
        max_delegation_depth=0,
    ),
    SubagentCapability(
        id="agent-transport-coordinator",
        name="Transport Coordinator",
        alias="transport",
        specialty="transport",
        description=(
            "Airport transfers, commuter rail, ground transit passes, train tickets, cabs, "
            "subway cards, and express shuttles under Travel Concierge authority."
        ),
        capabilities=["transport.discover", "transit.quote", "arrange_transport"],
        default_action="arrange_transport",
        sample_prompts=[
            "Reserve train ticket and subway transit pass",
            "Book airport transfer shuttle",
        ],
        parent_agent_id=None,
        can_delegate=False,
        max_delegation_depth=0,
    ),
    SubagentCapability(
        id="agent-activities-guide",
        name="Activities & Culture Guide",
        alias="activities",
        specialty="activities",
        description=(
            "Museum admissions, guided walking tours, sightseeing tickets, attractions, "
            "and cultural event passes."
        ),
        capabilities=["activities.discover", "tour.quote", "schedule_activities"],
        default_action="schedule_activities",
        sample_prompts=[
            "Book art museum passes and historic quarter walking tour",
            "Schedule city sightseeing attractions",
        ],
        parent_agent_id=None,
        can_delegate=False,
        max_delegation_depth=0,
    ),
]


class SubagentRegistry:
    """Registry managing available subagents and their capabilities."""

    def __init__(self) -> None:
        self._agents: dict[str, SubagentCapability] = {}
        for agent in DEFAULT_SUBAGENTS:
            self.register(agent)

    def register(self, agent: SubagentCapability) -> None:
        """Register a new subagent or update an existing one."""
        self._agents[agent.id] = agent
        self._agents[agent.alias] = agent
        self._agents[agent.name.lower()] = agent

    def list_capabilities(self, parent_agent_id: str | None = None) -> list[SubagentCapability]:
        """Return unique list of registered subagent capabilities for a given parent level.
        If parent_agent_id is None, returns top-level agents (available to root Personal Agent).
        If parent_agent_id is specified, returns only child agents permitted under that parent.
        """
        seen = set()
        unique: list[SubagentCapability] = []
        for agent in self._agents.values():
            if agent.id not in seen:
                seen.add(agent.id)
                if parent_agent_id is None:
                    if agent.parent_agent_id is None:
                        unique.append(agent)
                else:
                    parent_canonical = self.resolve_alias_to_id(parent_agent_id)
                    parent_obj = self.get(parent_agent_id)
                    allowed = parent_obj.allowed_child_agent_ids if parent_obj else []
                    if agent.parent_agent_id == parent_canonical or agent.id in allowed:
                        unique.append(agent)
        return unique

    def list_all_capabilities(self) -> list[SubagentCapability]:
        """Return all unique registered subagents across all hierarchy levels."""
        seen = set()
        unique: list[SubagentCapability] = []
        for agent in self._agents.values():
            if agent.id not in seen:
                seen.add(agent.id)
                unique.append(agent)
        return unique

    def get_child_agents(self, parent_id_or_alias: str) -> list[SubagentCapability]:
        """Return permitted child subagents for a given parent agent."""
        canonical_id = self.resolve_alias_to_id(parent_id_or_alias)
        parent = self.get(parent_id_or_alias)
        if not parent or not parent.can_delegate:
            return []
        return [
            a for a in self.list_capabilities(parent_agent_id=canonical_id)
            if not parent.allowed_child_agent_ids or a.id in parent.allowed_child_agent_ids
        ]

    def discover_agents(self, parent_agent_id: str | None = None) -> list[dict[str, Any]]:
        """MCP tool handler: Discovers available agents and their permitted child relationships."""
        agents = self.list_capabilities(parent_agent_id=parent_agent_id)
        return [
            {
                "id": a.id,
                "name": a.name,
                "alias": a.alias,
                "specialty": a.specialty,
                "description": a.description,
                "capabilities": a.capabilities,
                "default_action": a.default_action,
                "can_delegate": a.can_delegate,
                "max_delegation_depth": a.max_delegation_depth,
                "parent_agent_id": a.parent_agent_id,
                "allowed_child_agent_ids": a.allowed_child_agent_ids,
            }
            for a in agents
        ]

    def get(self, identifier: str) -> SubagentCapability | None:
        """Look up subagent by id, alias, or name."""
        return self._agents.get(identifier.strip().lower())

    def resolve_alias_to_id(self, alias_or_name: str) -> str:
        """Resolve any alias or name to canonical catalog agent ID."""
        agent = self.get(alias_or_name)
        if agent:
            return agent.id
        return alias_or_name

    def resolve_id_to_alias(self, agent_id: str) -> str:
        """Resolve catalog ID to standard short alias."""
        agent = self.get(agent_id)
        if agent:
            return agent.alias
        return agent_id.replace("agent-", "").replace("-", "_")


# Global registry singleton
registry = SubagentRegistry()
