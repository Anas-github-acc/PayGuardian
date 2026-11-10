"""MCP Tool Definitions and Execution for PayGuardian Personal Agent.

Implements the 7 required MCP tools:
1. discover_agents: Discovers available specialist agents matching capability requirements.
2. get_agent_manifest: Retrieves the full registered capability manifest for a specialist.
3. get_active_plan: Retrieves current active plan, subgoals, and current task state.
4. get_budget_summary: Retrieves authoritative root mandate budget, total delegated, and remaining reserve.
5. get_delegation_tree: Retrieves the complete hierarchical delegation tree (Root -> Parent -> Child).
6. delegate_task: Creates/registers a delegated task envelope under the authorized hierarchy.
7. get_task_status: Retrieves execution status, phase, results, and itemized quotes for tasks.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from agent_runtime.gateway_client import GatewayClient
from agent_runtime.subagent_registry import SubagentCapability, SubagentRegistry, registry as default_registry

logger = logging.getLogger("agent_runtime.mcp_tools")


PAYGUARDIAN_MCP_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "discover_agents",
            "description": (
                "Discovers available specialist agents based on required capabilities or keywords. "
                "If parent_agent_id is omitted, returns top-level candidate agents. "
                "If parent_agent_id is specified, returns only child specialists permitted under that coordinator."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "parent_agent_id": {
                        "type": "string",
                        "description": "Optional parent coordinator ID or alias (e.g. 'agent-travel-concierge' or 'travel').",
                    },
                    "query": {
                        "type": "string",
                        "description": "Optional capability or domain query (e.g. 'flights', 'lodging', 'dining', 'cloud').",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_agent_manifest",
            "description": "Retrieves the full registered capability manifest, boundaries, and delegation permissions for an agent.",
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "The unique agent ID or alias (e.g. 'agent-travel-concierge', 'hotel', 'merchant_attach').",
                    },
                },
                "required": ["agent_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_active_plan",
            "description": "Retrieves the active plan, subgoals, and current task execution states from the orchestrator.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_budget_summary",
            "description": "Retrieves authoritative budget figures: root mandate budget, total delegated to subagents, remaining orchestrator reserve, and currency.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_delegation_tree",
            "description": "Retrieves the complete hierarchical delegation tree showing root, top-level specialists, and nested child specialists with their allocated budgets and statuses.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delegate_task",
            "description": "Registers or constructs a delegated task envelope for a specialist agent under the authorized hierarchy.",
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "Target specialist agent ID or alias (e.g. 'travel', 'hotel', 'food', 'merchant_attach').",
                    },
                    "objective": {
                        "type": "string",
                        "description": "Specific objective and goal of this task.",
                    },
                    "scope": {
                        "type": "string",
                        "description": "Clear domain scope and boundaries (what is included vs excluded).",
                    },
                    "requested_budget_minor": {
                        "type": "integer",
                        "description": "Requested spending authority envelope in minor currency units (e.g. cents/paise).",
                    },
                    "currency": {
                        "type": "string",
                        "description": "3-letter currency code (e.g. 'USD', 'INR'). Default is 'USD'.",
                    },
                    "parent_task_id": {
                        "type": "string",
                        "description": "Optional parent coordinator task ID for nested child delegations.",
                    },
                    "dependencies": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional list of task IDs that must complete before this task.",
                    },
                },
                "required": ["agent_id", "objective", "scope"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_task_status",
            "description": "Retrieves execution status, phase, results, and itemized quotes for a specific task or all tasks.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "string",
                        "description": "Optional task ID to inspect. If omitted, returns all tasks.",
                    },
                },
                "required": [],
            },
        },
    },
]


def _format_curr(amount_minor: int, currency: str = "USD") -> str:
    cur = currency.upper()
    val = amount_minor / 100.0
    if cur == "INR":
        return f"₹{val:,.2f}"
    if cur == "EUR":
        return f"€{val:,.2f}"
    if cur == "GBP":
        return f"£{val:,.2f}"
    return f"${val:,.2f}"


class PayGuardianMCPTools:
    """Implementation and dispatcher for PayGuardian MCP tools."""

    def __init__(
        self,
        state: dict[str, Any] | None = None,
        gateway_client: GatewayClient | None = None,
        subagent_registry: SubagentRegistry | None = None,
    ) -> None:
        self.state = state if state is not None else {}
        self.gateway_client = gateway_client
        self.subagent_registry = subagent_registry or default_registry

    def get_tool_schemas(self) -> list[dict[str, Any]]:
        """Return the OpenAPI/OpenAI-compatible tool schemas for LLM tool binding."""
        return PAYGUARDIAN_MCP_TOOL_SCHEMAS

    def discover_agents(
        self,
        parent_agent_id: str | None = None,
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        """Tool 1: discover_agents"""
        parent_canonical = (
            self.subagent_registry.resolve_alias_to_id(parent_agent_id)
            if parent_agent_id
            else None
        )
        agents = self.subagent_registry.list_capabilities(parent_agent_id=parent_canonical)

        if query:
            q_terms = [t.lower() for t in query.split() if len(t) > 2]
            scored: list[tuple[int, SubagentCapability]] = []
            for a in agents:
                score = 0
                searchable = f"{a.id} {a.name} {a.alias} {a.specialty} {a.description} {' '.join(a.capabilities)} {' '.join(a.sample_prompts)}".lower()
                for term in q_terms:
                    if term in searchable:
                        score += 2
                    if term in a.name.lower() or term in a.alias.lower():
                        score += 3
                if score > 0 or not q_terms:
                    scored.append((score, a))
            scored.sort(key=lambda x: x[0], reverse=True)
            agents = [a for _, a in scored]

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

    def get_agent_manifest(self, agent_id: str) -> dict[str, Any]:
        """Tool 2: get_agent_manifest"""
        agent = self.subagent_registry.get(agent_id)
        if not agent:
            return {"error": f"Agent '{agent_id}' not found in registry."}

        return {
            "id": agent.id,
            "name": agent.name,
            "alias": agent.alias,
            "specialty": agent.specialty,
            "description": agent.description,
            "capabilities": agent.capabilities,
            "default_action": agent.default_action,
            "sample_prompts": agent.sample_prompts,
            "can_delegate": agent.can_delegate,
            "max_delegation_depth": agent.max_delegation_depth,
            "parent_agent_id": agent.parent_agent_id,
            "allowed_child_agent_ids": agent.allowed_child_agent_ids,
        }

    def get_active_plan(self) -> dict[str, Any]:
        """Tool 3: get_active_plan"""
        plan = self.state.get("plan", [])
        tasks = self.state.get("subagent_tasks", [])
        return {
            "active_plan": plan,
            "current_task": self.state.get("current_task"),
            "task_count": len(tasks),
            "tasks_summary": [
                {
                    "id": t.get("id"),
                    "agent": t.get("agent"),
                    "phase": t.get("phase"),
                    "status": t.get("status"),
                    "amount_minor": t.get("amount_minor"),
                }
                for t in tasks
            ],
        }

    def get_budget_summary(self) -> dict[str, Any]:
        """Tool 4: get_budget_summary"""
        environment_id = self.state.get("environment_id")
        mandate_id = self.state.get("mandate_id")
        currency = self.state.get("budget_currency") or "USD"
        limit_minor = self.state.get("budget_limit_minor") or 0
        total_delegated_minor = 0

        # Query Gateway fresh when available
        if self.gateway_client and environment_id:
            try:
                env_mandates = self.gateway_client.list_mandates(environment_id)
                root_m = next((m for m in env_mandates if not m.get("parentMandateId")), None)
                if root_m:
                    limit_minor = root_m.get("budgetLimitMinor", limit_minor)
                    currency = root_m.get("currency", currency)
                    mandate_id = root_m.get("id", mandate_id)
                active_raw = [
                    m for m in env_mandates
                    if m.get("parentMandateId") and m.get("state") == "active" and not m.get("supersededAt")
                ]
                series_map: dict[str, dict[str, Any]] = {}
                for m in active_raw:
                    s_id = m.get("mandateSeriesId") or f"{m.get('parentMandateId')}_{m.get('holderAgentId')}"
                    existing = series_map.get(s_id)
                    if not existing or m.get("version", 1) > existing.get("version", 1):
                        series_map[s_id] = m
                child_mandates = list(series_map.values())
                for cm in child_mandates:
                    is_nested = bool(root_m and cm.get("parentMandateId") != root_m.get("id"))
                    if not is_nested:
                        total_delegated_minor += cm.get("budgetLimitMinor", 0)
            except Exception as exc:
                logger.debug("Gateway fresh budget lookup fallback: %s", exc)

        if total_delegated_minor == 0 and self.state.get("subagent_tasks"):
            for t in self.state["subagent_tasks"]:
                if t.get("status") in ("authorized", "active", "completed") and not t.get("parent_task_id"):
                    total_delegated_minor += t.get("amount_minor", 0)

        remaining_reserve_minor = max(0, limit_minor - total_delegated_minor)

        return {
            "root_mandate_id": mandate_id or "authoritative-root",
            "currency": currency,
            "root_budget_limit_minor": limit_minor,
            "total_delegated_minor": total_delegated_minor,
            "remaining_reserve_minor": remaining_reserve_minor,
            "root_budget_display": _format_curr(limit_minor, currency),
            "total_delegated_display": _format_curr(total_delegated_minor, currency),
            "remaining_reserve_display": _format_curr(remaining_reserve_minor, currency),
        }

    def get_delegation_tree(self) -> dict[str, Any]:
        """Tool 5: get_delegation_tree"""
        budget_info = self.get_budget_summary()
        tasks = self.state.get("subagent_tasks", [])

        # Build tree of tasks
        task_by_id = {t.get("id"): t for t in tasks if t.get("id")}
        top_level_tasks = [t for t in tasks if not t.get("parent_task_id")]

        def format_node(t: dict[str, Any]) -> dict[str, Any]:
            tid = t.get("id", "")
            children = [
                format_node(ct)
                for ct in tasks
                if ct.get("parent_task_id") == tid
            ]
            node = {
                "task_id": tid,
                "agent": t.get("agent"),
                "action": t.get("action"),
                "status": t.get("status"),
                "phase": t.get("phase"),
                "amount_minor": t.get("amount_minor"),
                "currency": t.get("currency", budget_info["currency"]),
                "amount_display": _format_curr(t.get("amount_minor", 0), t.get("currency", budget_info["currency"])),
            }
            if children:
                node["child_tasks"] = children
            return node

        return {
            "root": {
                "mandate_id": budget_info["root_mandate_id"],
                "total_budget": budget_info["root_budget_display"],
                "total_delegated": budget_info["total_delegated_display"],
                "remaining_reserve": budget_info["remaining_reserve_display"],
                "currency": budget_info["currency"],
                "top_level_delegations": [format_node(t) for t in top_level_tasks],
            }
        }

    def delegate_task(
        self,
        agent_id: str,
        objective: str,
        scope: str,
        requested_budget_minor: int = 0,
        currency: str = "USD",
        parent_task_id: str | None = None,
        dependencies: list[str] | None = None,
    ) -> dict[str, Any]:
        """Tool 6: delegate_task"""
        agent = self.subagent_registry.get(agent_id)
        if not agent:
            return {"error": f"Agent '{agent_id}' does not exist in registry."}

        # Hierarchy verification
        if parent_task_id:
            parent_task = next(
                (t for t in self.state.get("subagent_tasks", []) if t.get("id") == parent_task_id),
                None,
            )
            if parent_task:
                parent_agent = self.subagent_registry.get(parent_task.get("agent", ""))
                if parent_agent and not parent_agent.can_delegate:
                    return {
                        "error": f"Parent agent '{parent_agent.name}' manifest does not permit sub-delegation."
                    }
                if parent_agent and parent_agent.allowed_child_agent_ids and agent.id not in parent_agent.allowed_child_agent_ids:
                    return {
                        "error": f"Agent '{agent.name}' is not an allowed child of '{parent_agent.name}'."
                    }

        # Budget verification
        budget_info = self.get_budget_summary()
        rem_res = budget_info["remaining_reserve_minor"]
        clamped_budget = requested_budget_minor
        if requested_budget_minor > rem_res and rem_res > 0:
            clamped_budget = rem_res

        task_id = f"task_{agent.alias}_{uuid.uuid4().hex[:8]}"
        task_envelope: dict[str, Any] = {
            "id": task_id,
            "agent": agent.alias,
            "agent_id": agent.id,
            "action": agent.default_action,
            "description": objective,
            "scope": scope,
            "amount_minor": clamped_budget,
            "currency": currency,
            "status": "authorization_pending",
            "phase": "budget_planning",
            "parent_task_id": parent_task_id,
            "dependencies": dependencies or [],
            "requires_spending": clamped_budget > 0,
            "authority_checked": False,
            "delegated": False,
        }

        # Append to state's subagent_tasks
        tasks = self.state.setdefault("subagent_tasks", [])
        tasks.append(task_envelope)

        return {
            "status": "task_registered",
            "task": task_envelope,
            "message": f"Task registered for {agent.name} with envelope budget {_format_curr(clamped_budget, currency)}.",
        }

    def get_task_status(self, task_id: str | None = None) -> dict[str, Any]:
        """Tool 7: get_task_status"""
        tasks = self.state.get("subagent_tasks", [])
        if task_id:
            task = next((t for t in tasks if t.get("id") == task_id), None)
            if not task:
                return {"error": f"Task '{task_id}' not found."}
            return {"task": task}

        return {
            "task_count": len(tasks),
            "tasks": tasks,
        }

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool by name with arguments."""
        try:
            if name == "discover_agents":
                return {
                    "agents": self.discover_agents(
                        parent_agent_id=arguments.get("parent_agent_id"),
                        query=arguments.get("query"),
                    )
                }
            elif name == "get_agent_manifest":
                return self.get_agent_manifest(agent_id=arguments.get("agent_id", ""))
            elif name == "get_active_plan":
                return self.get_active_plan()
            elif name == "get_budget_summary":
                return self.get_budget_summary()
            elif name == "get_delegation_tree":
                return self.get_delegation_tree()
            elif name == "delegate_task":
                return self.delegate_task(
                    agent_id=arguments.get("agent_id", ""),
                    objective=arguments.get("objective", ""),
                    scope=arguments.get("scope", ""),
                    requested_budget_minor=arguments.get("requested_budget_minor", 0),
                    currency=arguments.get("currency", "USD"),
                    parent_task_id=arguments.get("parent_task_id"),
                    dependencies=arguments.get("dependencies"),
                )
            elif name == "get_task_status":
                return self.get_task_status(task_id=arguments.get("task_id"))
            else:
                return {"error": f"Unknown tool: '{name}'"}
        except Exception as exc:
            logger.error("Error executing MCP tool '%s': %s", name, exc)
            return {"error": f"Tool execution failed: {exc}"}
