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
    {
        "type": "function",
        "function": {
            "name": "get_delegated_balance",
            "description": "Check the specialist subagent's available delegated budget and current spending ceiling.",
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "The specialist agent alias or ID (e.g. 'hotel', 'travel', 'food').",
                    },
                    "mandate_id": {
                        "type": "string",
                        "description": "Optional specific child mandate ID.",
                    },
                },
                "required": ["agent_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_payment",
            "description": "Request payment using the subagent's cryptographically delegated child mandate. The Gateway independently validates the mandate, merchant, amount, scope, and balance.",
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "The subagent requesting payment (e.g. 'hotel', 'travel', 'food').",
                    },
                    "amount_minor": {
                        "type": "integer",
                        "description": "Payment amount in minor units (e.g. cents/paise).",
                    },
                    "currency": {
                        "type": "string",
                        "description": "3-letter currency code (e.g. 'USD', 'INR'). Default 'USD'.",
                    },
                    "recipient": {
                        "type": "string",
                        "description": "The merchant or recipient name (e.g. 'Boutique Hotel Center', 'SkyLine Air').",
                    },
                    "action": {
                        "type": "string",
                        "description": "The action scope (e.g. 'book_hotel', 'purchase_flight', 'order_dining').",
                    },
                },
                "required": ["agent_id", "amount_minor", "recipient"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_payment_status",
            "description": "Check whether an initiated payment succeeded, failed, or is pending user approval.",
            "parameters": {
                "type": "object",
                "properties": {
                    "payment_intent_id": {
                        "type": "string",
                        "description": "The payment intent ID or action ID returned by request_payment.",
                    },
                },
                "required": ["payment_intent_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_budget_increase",
            "description": "Request additional allocation from the main agent when an item cost exceeds current delegated budget.",
            "parameters": {
                "type": "object",
                "properties": {
                    "agent_id": {
                        "type": "string",
                        "description": "The specialist agent requesting a budget top-up.",
                    },
                    "additional_amount_minor": {
                        "type": "integer",
                        "description": "Additional amount needed in minor units.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason why additional allocation is required.",
                    },
                    "currency": {
                        "type": "string",
                        "description": "3-letter currency code (default 'USD').",
                    },
                },
                "required": ["agent_id", "additional_amount_minor", "reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_approval_status",
            "description": (
                "Checks live human authorization status of proposals or payment requests in the environment via the Gateway. "
                "Returns whether proposals are currently 'pending', 'approved' (allowed), or 'rejected' (denied)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["pending", "approved", "rejected"],
                        "description": "Optional filter for approval state.",
                    },
                    "approval_id": {
                        "type": "string",
                        "description": "Optional specific approval request ID.",
                    },
                },
                "required": [],
            },
        },
    },
]

SPECIALIST_MCP_TOOL_SCHEMAS: list[dict[str, Any]] = [
    t for t in PAYGUARDIAN_MCP_TOOL_SCHEMAS
    if t["function"]["name"] in (
        "get_delegated_balance",
        "request_payment",
        "get_payment_status",
        "request_budget_increase",
    )
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
        environment_id: str | None = None,
        mandate_id: str | None = None,
        event_emitter: Any | None = None,
        run_id: str | None = None,
        task_id: str | None = None,
    ) -> None:
        self.state = state if state is not None else {}
        self.gateway_client = gateway_client
        self.subagent_registry = subagent_registry or default_registry
        self.environment_id = environment_id
        self.mandate_id = mandate_id
        self.event_emitter = event_emitter
        self.run_id = run_id
        self.task_id = task_id

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

    def get_delegated_balance(
        self, agent_id: str, mandate_id: str | None = None
    ) -> dict[str, Any]:
        """Tool 8: get_delegated_balance. Checks subagent's available delegated budget."""
        agent_clean = agent_id.lower().replace("agent-", "").split("-")[0]
        tasks = self.state.get("subagent_tasks", [])
        task = next(
            (t for t in tasks if (t.get("agent", "").lower() == agent_clean or t.get("agent_id") == agent_id)),
            None,
        )

        env_id = self.environment_id or self.state.get("environment_id")
        allocated_minor = task.get("amount_minor", 0) if task else 0
        currency = task.get("currency", "USD") if task else "USD"
        child_mandate_ref = (task.get("child_mandate_id") if task else None) or mandate_id

        if not child_mandate_ref and self.gateway_client and env_id:
            try:
                m_list = self.gateway_client.list_mandates(env_id)
                matched_m = next(
                    (
                        m for m in m_list
                        if m.get("holderAgentId") in (agent_id, f"agent-{agent_clean}-specialist", agent_clean)
                        and m.get("state") == "active"
                        and not m.get("supersededAt")
                    ),
                    None,
                )
                if matched_m:
                    child_mandate_ref = matched_m["id"]
                    if allocated_minor == 0:
                        allocated_minor = matched_m.get("budgetLimitMinor", 0)
                        currency = matched_m.get("currency", currency)
            except Exception as exc:
                logger.debug("Gateway mandate lookup in get_delegated_balance fallback: %s", exc)

        # Query gateway ledger accounts if available for real balance
        spent_minor = 0
        if self.gateway_client and env_id and child_mandate_ref:
            try:
                accounts = self.gateway_client.list_ledger_accounts(env_id)
                child_acc = next((a for a in accounts if a.get("mandateId") == child_mandate_ref), None)
                if child_acc:
                    allocated_minor = child_acc.get("availableMinor", allocated_minor)
                    spent_minor = child_acc.get("settledMinor", 0)
            except Exception as exc:
                logger.debug("Gateway balance query fallback: %s", exc)

        available_minor = max(0, allocated_minor - spent_minor)
        return {
            "agent_id": agent_id,
            "child_mandate_id": child_mandate_ref,
            "allocated_budget_minor": allocated_minor,
            "spent_minor": spent_minor,
            "available_budget_minor": available_minor,
            "currency": currency,
            "status": "active" if child_mandate_ref else "pending_delegation",
        }

    def request_payment(
        self,
        agent_id: str,
        amount_minor: int,
        currency: str = "USD",
        recipient: str = "",
        action: str = "procure_goods",
        mandate_id: str | None = None,
    ) -> dict[str, Any]:
        """Tool 9: request_payment.

        Binds the subagent strictly to its cryptographic child mandate.
        The PayGuardian Gateway independently validates mandate validity, merchant,
        amount, scope, and available ledger balance.
        """
        agent_clean = agent_id.lower().replace("agent-", "").split("-")[0]
        tasks = self.state.get("subagent_tasks", [])
        task = next(
            (t for t in tasks if (t.get("agent", "").lower() == agent_clean or t.get("agent_id") == agent_id)),
            None,
        )

        child_mandate_ref = (task.get("child_mandate_id") if task else None) or mandate_id or self.mandate_id
        env_id = self.environment_id or self.state.get("environment_id")
        matched_m = None
        if self.gateway_client and env_id:
            try:
                agents_list = self.gateway_client.list_agents(env_id) or []
                matched_agent = next(
                    (
                        a for a in agents_list
                        if a.get("id") == agent_id
                        or a.get("kind", "").lower() == agent_clean
                        or agent_clean in a.get("name", "").lower()
                    ),
                    None,
                )
                if matched_agent:
                    agent_id = matched_agent["id"]

                if not child_mandate_ref:
                    m_list = self.gateway_client.list_mandates(env_id)
                    matched_m = next(
                        (
                            m for m in m_list
                            if m.get("holderAgentId") == agent_id
                            and m.get("state") == "active"
                            and not m.get("supersededAt")
                        ),
                        None,
                    )
                    if not matched_m:
                        matched_m = next(
                            (
                                m for m in m_list
                                if m.get("holderAgentId") in (agent_id, f"agent-{agent_clean}-specialist", agent_clean)
                                and m.get("state") == "active"
                                and not m.get("supersededAt")
                            ),
                            None,
                        )
                    if not matched_m:
                        matched_m = next((m for m in m_list if not m.get("parentMandateId") and m.get("state") == "active"), None)
                    if matched_m:
                        child_mandate_ref = matched_m["id"]
            except Exception:
                pass

        if not child_mandate_ref:
            return {
                "success": False,
                "error": "UNAUTHORIZED_PAYMENT: Subagent has not been delegated a cryptographic child mandate.",
                "code": "NO_CHILD_MANDATE",
            }

        # Validate against subagent's allocated budget ceiling
        allocated_limit = task.get("amount_minor", 0) if task else 0
        if allocated_limit == 0 and matched_m:
            allocated_limit = matched_m.get("budgetLimitMinor", 0)
        if allocated_limit > 0 and amount_minor > allocated_limit:
            return {
                "success": False,
                "error": (
                    f"EXCEEDS_DELEGATED_BUDGET: Requested payment of {_format_curr(amount_minor, currency)} "
                    f"exceeds subagent's delegated budget of {_format_curr(allocated_limit, currency)}. "
                    "Use request_budget_increase to request additional allocation from orchestrator."
                ),
                "code": "BUDGET_EXCEEDED",
                "allocated_limit_minor": allocated_limit,
                "requested_amount_minor": amount_minor,
            }

        payment_intent_id = f"pi_{agent_clean}_{uuid.uuid4().hex[:8]}"
        paypal_approval_url: str | None = None
        paypal_order_id: str | None = None
        approval_id: str | None = None
        status = "authorized"
        is_approval_required = False

        if self.gateway_client:
            try:
                # Independent Gateway verification
                auth_check = self.gateway_client.check_authority(
                    mandate_id=child_mandate_ref,
                    action=action,
                    amount_minor=amount_minor,
                    currency=currency,
                )
                decision = auth_check.get("decision", {})
                if not decision.get("allowed", True):
                    code = decision.get("code")
                    if code == "APPROVAL_REQUIRED":
                        is_approval_required = True
                    else:
                        return {
                            "success": False,
                            "error": f"GATEWAY_REJECTED: {decision.get('reason', 'Payment disallowed by mandate policies')}",
                            "code": code or "POLICY_REJECT",
                        }
            except Exception as gw_exc:
                logger.warning("Gateway check_authority exception: %s", gw_exc)

        import hashlib
        req_hash = hashlib.sha256(f"{agent_id}:{child_mandate_ref}:{amount_minor}:{action}".encode()).hexdigest()

        # If human authorization is required, dispatch approval request to Gateway
        if is_approval_required:
            status = "awaiting_approval"
            if self.gateway_client and env_id:
                try:
                    appr_res = self.gateway_client.request_approval(
                        environment_id=env_id,
                        mandate_id=child_mandate_ref,
                        agent_id=agent_id,
                        action=action,
                        amount_minor=amount_minor,
                        currency=currency,
                        request_hash=req_hash,
                    )
                    if isinstance(appr_res, dict) and appr_res.get("approval"):
                        approval_id = appr_res["approval"]["id"]
                except Exception as a_exc:
                    logger.warning("Gateway request_approval exception: %s", a_exc)

        if not approval_id:
            approval_id = f"appr-{payment_intent_id}"

        # PayPal Order routing for USD / PayPal transactions
        is_paypal = currency.upper() == "USD"
        if is_paypal and hasattr(self.gateway_client, "create_paypal_order") and env_id:
            try:
                accounts: list[dict[str, Any]] = []
                try:
                    accounts = self.gateway_client.list_ledger_accounts(env_id) or []
                except Exception:
                    pass
                target_acc = next((a for a in accounts if a.get("mandateId") == child_mandate_ref), accounts[0] if accounts else None)
                acc_id = target_acc["id"] if (target_acc and isinstance(target_acc, dict) and "id" in target_acc) else f"acc_{child_mandate_ref}"
                pp_res = self.gateway_client.create_paypal_order(
                    environment_id=env_id,
                    agent_id=agent_id,
                    mandate_id=child_mandate_ref,
                    ledger_account_id=acc_id,
                    idempotency_key=f"pp_req_{uuid.uuid4().hex[:12]}",
                    request_hash=req_hash,
                    action=action,
                    amount_minor=amount_minor,
                    currency="USD",
                    approval_id=approval_id,
                )
                order_info = pp_res.get("order") or {}
                act_info = pp_res.get("action") or {}
                if act_info.get("id"):
                    payment_intent_id = act_info["id"]
                elif pp_res.get("approvalId"):
                    payment_intent_id = pp_res["approvalId"]
                paypal_order_id = order_info.get("id")
                paypal_approval_url = order_info.get("approvalUrl") or pp_res.get("approveUrl")
                if paypal_approval_url:
                    status = "awaiting_approval"
            except Exception as pp_err:
                logger.warning("PayPal checkout creation via gateway skipped: %s", pp_err)

        if is_paypal and not paypal_approval_url:
            paypal_approval_url = None
            if is_approval_required:
                status = "awaiting_approval"

        # Record payment intent in state
        payment_record = {
            "payment_intent_id": payment_intent_id,
            "agent_id": agent_id,
            "child_mandate_id": child_mandate_ref,
            "amount_minor": amount_minor,
            "currency": currency,
            "recipient": recipient,
            "action": action,
            "status": status,
            "approval_id": approval_id,
            "approval_url": paypal_approval_url,
            "paypal_order_id": paypal_order_id,
        }
        self.state.setdefault("payment_intents", {})[payment_intent_id] = payment_record

        # Update task status
        if task:
            task["payment_authorization"] = {
                "action_id": payment_intent_id,
                "payment_intent": payment_intent_id,
                "mandate_id": child_mandate_ref,
                "amount_minor": amount_minor,
                "currency": currency,
                "status": status,
                "approval_id": approval_id,
                "approval_url": paypal_approval_url,
                "provider_order_id": paypal_order_id,
                "rail": "PayPal" if paypal_approval_url else "GatewayLedger",
            }

        if self.event_emitter and (status == "awaiting_approval" or paypal_approval_url or approval_id):
            try:
                self.event_emitter.emit(
                    "approval.requested",
                    payload={
                        "type": "action_approval",
                        "approvalId": approval_id or payment_intent_id,
                        "agentId": agent_id,
                        "action": action,
                        "recipient": recipient,
                        "amountMinor": amount_minor,
                        "currency": "USD" if paypal_approval_url else currency,
                        "mandateId": child_mandate_ref,
                        "approvalUrl": paypal_approval_url,
                    },
                    run_id=self.run_id,
                    task_id=self.task_id,
                    agent=agent_id,
                )
                if paypal_approval_url:
                    self.event_emitter.emit(
                        "payment.order_created",
                        payload={
                            "actionId": payment_intent_id,
                            "provider": "paypal",
                            "providerOrderId": paypal_order_id,
                            "approvalUrl": paypal_approval_url,
                            "amountMinor": amount_minor,
                            "currency": "USD",
                            "agentId": agent_id,
                            "recipient": recipient,
                            "mandateId": child_mandate_ref,
                        },
                        run_id=self.run_id,
                        task_id=self.task_id,
                        agent=agent_id,
                    )
            except Exception as ev_err:
                logger.warning("Error emitting payment approval events from MCP tool: %s", ev_err)

        return {
            "success": True,
            "payment_intent_id": payment_intent_id,
            "status": status,
            "approval_id": approval_id,
            "amount_minor": amount_minor,
            "currency": currency,
            "recipient": recipient,
            "child_mandate_id": child_mandate_ref,
            "approval_url": paypal_approval_url,
            "provider_order_id": paypal_order_id,
            "rail": "PayPal" if paypal_approval_url else "GatewayLedger",
            "message": (
                f"Payment request of {_format_curr(amount_minor, currency)} for {recipient} "
                f"successfully initiated by {agent_id} under child mandate {child_mandate_ref} ({status})."
                + (f" Approval request {approval_id} registered on Gateway for human authorization." if status == "awaiting_approval" else "")
                + (f" Complete payment via PayPal Sandbox: {paypal_approval_url}" if paypal_approval_url else "")
            ),
        }

    def get_payment_status(self, payment_intent_id: str) -> dict[str, Any]:
        """Tool 10: get_payment_status. Checks whether payment succeeded, failed or is pending."""
        intents = self.state.get("payment_intents", {})
        intent = intents.get(payment_intent_id)
        if not intent:
            # Check within tasks
            tasks = self.state.get("subagent_tasks", [])
            for t in tasks:
                pa = t.get("payment_authorization")
                if pa and (pa.get("action_id") == payment_intent_id or pa.get("payment_intent") == payment_intent_id):
                    return {"payment_intent_id": payment_intent_id, "status": pa.get("status", "unknown"), "details": pa}
            return {"error": f"Payment intent '{payment_intent_id}' not found.", "status": "not_found"}

        return {
            "payment_intent_id": payment_intent_id,
            "status": intent.get("status", "unknown"),
            "amount_minor": intent.get("amount_minor"),
            "currency": intent.get("currency"),
            "recipient": intent.get("recipient"),
            "approval_url": intent.get("approval_url"),
            "child_mandate_id": intent.get("child_mandate_id"),
        }

    def request_budget_increase(
        self,
        agent_id: str,
        additional_amount_minor: int,
        reason: str = "",
        currency: str = "USD",
    ) -> dict[str, Any]:
        """Tool 11: request_budget_increase.

        Allows a subagent to request additional spending allocation from the main agent
        when merchant prices exceed initial delegation.
        """
        agent_clean = agent_id.lower().replace("agent-", "").split("-")[0]
        tasks = self.state.get("subagent_tasks", [])
        task = next(
            (t for t in tasks if (t.get("agent", "").lower() == agent_clean or t.get("agent_id") == agent_id)),
            None,
        )

        curr_limit = task.get("amount_minor", 0) if task else 0
        new_requested_limit = curr_limit + additional_amount_minor

        # Check remaining reserve from root mandate
        budget_summary = self.get_budget_summary()
        remaining_reserve = budget_summary.get("remaining_reserve_minor", 0)

        if remaining_reserve >= additional_amount_minor:
            # Main agent grants budget increase from parent reserve
            if task:
                task["amount_minor"] = new_requested_limit
                task["budget_increased"] = True
                task["budget_increase_reason"] = reason

            # Top up child ledger account if connected to Gateway
            env_id = self.environment_id or self.state.get("environment_id")
            mandate_id = self.mandate_id or self.state.get("mandate_id")
            child_ref = task.get("child_mandate_id") if task else None
            if self.gateway_client and env_id and mandate_id and child_ref:
                try:
                    accounts = self.gateway_client.list_ledger_accounts(env_id)
                    parent_acc = next((a for a in accounts if a.get("mandateId") == mandate_id), None)
                    child_acc = next((a for a in accounts if a.get("mandateId") == child_ref), None)
                    if parent_acc and child_acc:
                        import hashlib
                        self.gateway_client.allocate_ledger(
                            environment_id=env_id,
                            parent_account_id=parent_acc["id"],
                            child_account_id=child_acc["id"],
                            amount_minor=additional_amount_minor,
                            idempotency_key=f"topup_{uuid.uuid4().hex[:12]}",
                            request_hash=hashlib.sha256(f"{parent_acc['id']}:{child_acc['id']}:{additional_amount_minor}".encode()).hexdigest(),
                        )
                except Exception as topup_exc:
                    logger.debug("Ledger top-up skipped: %s", topup_exc)

            return {
                "success": True,
                "status": "granted",
                "agent_id": agent_id,
                "additional_granted_minor": additional_amount_minor,
                "new_budget_limit_minor": new_requested_limit,
                "currency": currency,
                "reason": reason,
                "message": (
                    f"Budget increase of {_format_curr(additional_amount_minor, currency)} granted by Main Agent. "
                    f"New spending ceiling is {_format_curr(new_requested_limit, currency)}."
                ),
            }
        else:
            return {
                "success": False,
                "status": "requires_user_approval",
                "agent_id": agent_id,
                "requested_additional_minor": additional_amount_minor,
                "remaining_reserve_minor": remaining_reserve,
                "currency": currency,
                "reason": reason,
                "message": (
                    f"Requested increase of {_format_curr(additional_amount_minor, currency)} exceeds "
                    f"available parent reserve ({_format_curr(remaining_reserve, currency)}). "
                    "Escalated to human user for root mandate expansion."
                ),
            }

    def get_approval_status(
        self,
        status: str | None = None,
        approval_id: str | None = None,
    ) -> dict[str, Any]:
        """Tool: get_approval_status - Check live gateway approval records (pending, approved, rejected)."""
        env_id = self.environment_id or self.state.get("environment_id")
        if not env_id and self.gateway_client:
            try:
                envs = self.gateway_client._client.get("/v1/environments", headers=self.gateway_client._headers()).json()
                env_list = envs.get("environments", [])
                if env_list:
                    env_id = env_list[0].get("id")
            except Exception:
                pass

        if self.gateway_client and env_id:
            try:
                if approval_id:
                    single = self.gateway_client.get_approval(env_id, approval_id)
                    if single:
                        return {
                            "count": 1,
                            "has_pending": single.get("status") == "pending",
                            "approval": single,
                            "approvals": [single],
                        }
                    return {"count": 0, "has_pending": False, "approval": None, "approvals": []}

                approvals = self.gateway_client.list_approvals(env_id, status=status)
                pending = [a for a in approvals if a.get("status") == "pending"]
                approved = [a for a in approvals if a.get("status") == "approved"]
                rejected = [a for a in approvals if a.get("status") == "rejected"]
                return {
                    "count": len(approvals),
                    "has_pending": len(pending) > 0,
                    "pending_count": len(pending),
                    "approved_count": len(approved),
                    "rejected_count": len(rejected),
                    "approvals": approvals,
                }
            except Exception as exc:
                logger.debug("Gateway get_approval_status fetch failed: %s", exc)

        # Fallback inspection from local state
        tasks = self.state.get("subagent_tasks", [])
        pending_tasks = [t for t in tasks if t.get("status") in ("authorization_pending", "quote_received")]
        return {
            "count": len(tasks),
            "has_pending": len(pending_tasks) > 0,
            "pending_count": len(pending_tasks),
            "approved_count": 0,
            "rejected_count": 0,
            "approvals": [],
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
            elif name == "get_delegated_balance":
                return self.get_delegated_balance(
                    agent_id=arguments.get("agent_id", ""),
                    mandate_id=arguments.get("mandate_id"),
                )
            elif name == "request_payment":
                return self.request_payment(
                    agent_id=arguments.get("agent_id", ""),
                    amount_minor=int(arguments.get("amount_minor", 0)),
                    currency=arguments.get("currency", "USD"),
                    recipient=arguments.get("recipient", ""),
                    action=arguments.get("action", "procure_goods"),
                    mandate_id=arguments.get("mandate_id"),
                )
            elif name == "get_payment_status":
                return self.get_payment_status(
                    payment_intent_id=arguments.get("payment_intent_id", "")
                )
            elif name == "request_budget_increase":
                return self.request_budget_increase(
                    agent_id=arguments.get("agent_id", ""),
                    additional_amount_minor=int(arguments.get("additional_amount_minor", 0)),
                    reason=arguments.get("reason", ""),
                    currency=arguments.get("currency", "USD"),
                )
            elif name == "get_approval_status":
                return self.get_approval_status(
                    status=arguments.get("status"),
                    approval_id=arguments.get("approval_id"),
                )
            else:
                return {"error": f"Unknown tool: '{name}'"}
        except Exception as exc:
            logger.error("Error executing MCP tool '%s': %s", name, exc)
            return {"error": f"Tool execution failed: {exc}"}
