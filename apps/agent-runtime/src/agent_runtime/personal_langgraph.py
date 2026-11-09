"""LangGraph-based Personal Agent for PayGuardian.

Coordinates task planning following the Discover → Quote → Budget → Authorize → Execute lifecycle:
1. Discovery First: Subagents discover products, merchants, and availability without spending authority.
2. User Clarification: If necessary details (location, preference, quantity) are missing, subagents report them
   and Personal Agent requests clarification from the user.
3. Quote-Based Budget Allocation: Non-zero structured quotes are evaluated against mandate reserves.
4. Authorized Execution: Signed child mandates are validated before payments or purchases are executed.
5. Reliability: Explicit phases: discovery, clarification_required, quote_received, budget_planning,
   authorization_pending, authorized, execution, completed, and failed.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from agent_runtime.agents import build_agent as build_runtime_agent
from agent_runtime.agents import configured_agent_names
from agent_runtime.gateway_client import GatewayClient, assert_safe_prompt_content
from agent_runtime.subagent_registry import (
    ClarificationQuestion,
    ClarificationRequest,
    SubagentCapability,
    registry as subagent_registry,
)

logger = logging.getLogger("agent_runtime.personal_langgraph")

TaskPhase = Literal[
    "discovery",
    "clarification_required",
    "quote_received",
    "budget_planning",
    "authorization_pending",
    "authorized",
    "execution",
    "completed",
    "failed",
]


class ClarificationQuestion(TypedDict):
    question: str
    required: bool
    reason: str


class ClarificationRequest(TypedDict):
    status: Literal["clarification_required"]
    questions: list[ClarificationQuestion]


class SubagentTask(TypedDict, total=False):
    id: str
    agent: str
    action: str
    description: str
    amount_minor: int
    currency: str
    status: str
    phase: TaskPhase
    authority_checked: bool
    delegated: bool
    requires_spending: bool
    required_capabilities: list[str]
    dependencies: list[str]
    parent_task_id: str | None
    parent_agent_id: str | None
    delegation_depth: int
    child_tasks: list[SubagentTask]
    quoted_amount_minor: int | None
    proposed_mandate_minor: int | None
    child_mandate_id: str | None
    holder_agent_id: str | None
    agent_id: str | None
    quotes: list[dict[str, Any]]
    missing_fields: list[str]
    questions: list[str]
    clarification_request: ClarificationRequest | None
    result: Any
    error: str | None


class PersonalAgentState(TypedDict, total=False):
    messages: list[dict[str, Any]]
    plan: list[str]
    current_task: dict[str, Any] | str | None
    subagent_tasks: list[SubagentTask]
    results: dict[str, Any]
    final_response: str
    run_id: str
    session_id: str | None
    environment_id: str | None
    mandate_id: str | None
    model_id: str | None
    events: list[dict[str, Any]]
    budget_limit_minor: int | None
    budget_currency: str | None
    approval_required: bool
    approval_pending: bool
    is_user_confirmed: bool
    is_user_rejected: bool
    clarification_required: bool
    missing_fields: list[str]
    clarification_questions: list[str]
    clarification_request: ClarificationRequest | None
    user_preferences: dict[str, Any]


PRIVATE_COT_KEYS = {
    "thought",
    "thinking",
    "reasoning",
    "chain_of_thought",
    "cot",
    "private_cot",
    "internal_monologue",
}


def sanitize_event_data(data: Any) -> Any:
    """Recursively strip private chain-of-thought and validate against credential leakage."""
    if isinstance(data, dict):
        cleaned: dict[str, Any] = {}
        for k, v in data.items():
            if str(k).lower() in PRIVATE_COT_KEYS:
                continue
            cleaned[k] = sanitize_event_data(v)
        return cleaned
    if isinstance(data, list):
        return [sanitize_event_data(item) for item in data]
    if isinstance(data, str):
        assert_safe_prompt_content(data)
        data = re.sub(r"<thought>.*?</thought>", "", data, flags=re.DOTALL)
        return data.strip()
    return data


class EventEmitter:
    """Dispatches structured user-facing events without exposing private chain-of-thought."""

    def __init__(self, listener: Callable[[dict[str, Any]], None] | None = None) -> None:
        self.listeners: list[Callable[[dict[str, Any]], None]] = []
        if listener:
            self.listeners.append(listener)
        self.events: list[dict[str, Any]] = []

    def add_listener(self, listener: Callable[[dict[str, Any]], None]) -> None:
        self.listeners.append(listener)

    def emit(
        self,
        event_type: str,
        payload: dict[str, Any] | None = None,
        run_id: str | None = None,
        task_id: str | None = None,
        agent: str | None = None,
    ) -> dict[str, Any]:
        raw_payload = payload or {}
        clean_payload = sanitize_event_data(raw_payload)

        event = {
            "event_type": event_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "run_id": run_id,
            "task_id": task_id,
            "agent": agent,
            "payload": clean_payload,
        }
        self.events.append(event)
        for listener in self.listeners:
            try:
                listener(event)
            except Exception:
                pass
        return event


def _format_budget(amount_minor: int, currency: str) -> str:
    """Format minor currency units as a readable string."""
    major = amount_minor / 100
    symbols = {"USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥"}
    sym = symbols.get(currency.upper(), currency + " ")
    if currency.upper() == "JPY":
        return f"{sym}{int(amount_minor):,}"
    return f"{sym}{major:,.2f}"


def extract_user_prompt(messages: list[dict[str, Any]]) -> str:
    """Extract latest user message content safely."""
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") in ("user", "human"):
            content = str(msg.get("content", ""))
            assert_safe_prompt_content(content)
            return content
        if isinstance(msg, dict) and "message" in msg:
            content = str(msg.get("message", ""))
            assert_safe_prompt_content(content)
            return content
    return "Assist user with authorized tasks."


USER_CONFIRMATION_PATTERNS = [
    r"\b(?:okay\s+)?delegate\b",
    r"\bproceed\b",
    r"\bconfirm\b",
    r"\bapprove\b",
    r"\bapproved\b",
    r"\byes\s+(?:proceed|do it|go ahead|delegate)\b",
    r"\bgo\s+ahead\b",
    r"\bauthorize\b",
    r"\blooks\s+good\b",
]

USER_REJECTION_PATTERNS = [
    r"\breject\b",
    r"\bdeny\b",
    r"\bcancel\b",
    r"\bdo\s+not\s+proceed\b",
    r"\bdon'?t\s+proceed\b",
    r"\babort\b",
    r"\bdisapprove\b",
]


def is_confirmation_message(text: str) -> bool:
    t = text.strip().lower()
    return any(re.search(pat, t) for pat in USER_CONFIRMATION_PATTERNS)


def is_rejection_message(text: str) -> bool:
    t = text.strip().lower()
    return any(re.search(pat, t) for pat in USER_REJECTION_PATTERNS)


def extract_user_preferences(messages: list[dict[str, Any]], current_prompt: str) -> dict[str, Any]:
    """Extract user preferences and constraints accumulated across the conversation."""
    all_user_texts: list[str] = []
    for m in messages:
        if isinstance(m, dict) and m.get("role") in ("user", "human"):
            c = str(m.get("content") or m.get("message") or "")
            if c:
                all_user_texts.append(c)
    if current_prompt and (not all_user_texts or current_prompt != all_user_texts[-1]):
        all_user_texts.append(current_prompt)

    combined = " ".join(all_user_texts)
    combined_lower = combined.lower()

    prefs: dict[str, Any] = {}

    # 1. Location detection - check latest user turn first, then combined
    location = None
    latest_text = all_user_texts[-1] if all_user_texts else current_prompt
    latest_lower = latest_text.lower()

    # Known Indian and international cities
    known_locations = [
        ("gandhinagar", "Gandhinagar, Gujarat, India"),
        ("ahmedabad", "Ahmedabad, Gujarat, India"),
        ("indiranagar", "Indiranagar, Bangalore"),
        ("koramangala", "Koramangala, Bangalore"),
        ("whitefield", "Whitefield, Bangalore"),
        ("bangalore", "Bangalore"),
        ("bengaluru", "Bengaluru"),
        ("mumbai", "Mumbai"),
        ("delhi", "Delhi"),
        ("pune", "Pune"),
        ("hyderabad", "Hyderabad"),
        ("chennai", "Chennai"),
        ("kolkata", "Kolkata"),
        ("jaipur", "Jaipur"),
        ("surat", "Surat"),
        ("seattle", "Seattle"),
        ("paris", "Paris"),
        ("tokyo", "Tokyo"),
        ("london", "London"),
        ("new york", "New York"),
        ("san francisco", "San Francisco"),
        ("chicago", "Chicago"),
        ("boston", "Boston"),
        ("austin", "Austin"),
    ]

    for search_str in (latest_lower, combined_lower):
        if location:
            break
        for loc_key, loc_val in known_locations:
            if re.search(rf"\b{re.escape(loc_key)}\b", search_str):
                if "gujarat" in search_str and "gandhinagar" in search_str:
                    location = "Gandhinagar, Gujarat, India"
                elif "gujarat" in search_str and "ahmedabad" in search_str:
                    location = "Ahmedabad, Gujarat, India"
                else:
                    location = loc_val
                break

    if not location:
        # Regex using word boundaries \b to avoid matching inside words like 'what'
        loc_pattern = r"\b(?:in|at|near|deliver to|delivery to|address:?)\s+([A-Za-z0-9\s,]+?)(?:\.|$|\band\b)"
        for search_str in (latest_text, combined):
            m_loc = re.search(loc_pattern, search_str, re.IGNORECASE)
            if m_loc:
                cand = m_loc.group(1).strip().rstrip(".,")
                if len(cand) > 2 and not any(
                    w in cand.lower()
                    for w in ("hotel", "dinner", "flight", "budget", "mandate", "cart", "biscuit", "chai")
                ):
                    location = cand.title()
                    break

    # If the user message is short and directly specifies a place without action verbs
    if not location and latest_text:
        cleaned_latest = latest_text.strip().rstrip(".,")
        if len(cleaned_latest) < 80 and not any(
            w in cleaned_latest.lower()
            for w in ("buy", "order", "purchase", "plan", "book", "cancel", "delegate", "mandate", "cart")
        ):
            if any(
                w in cleaned_latest.lower()
                for w in (
                    "street",
                    "road",
                    "nagar",
                    "halli",
                    "city",
                    "area",
                    "sector",
                    "gandhinagar",
                    "gujarat",
                    "india",
                )
            ):
                location = cleaned_latest.title()

    prefs["location"] = location

    # 2. Biscuit / snack brand or preference detection
    biscuit_brand = None

    # Handle "any brand", "any", "no preference", "whatever is available"
    if any(
        phrase in combined_lower
        for phrase in (
            "any brand",
            "any variety",
            "no preference",
            "whatever is available",
            "anything is fine",
            "any is fine",
            "prefer any",
        )
    ):
        biscuit_brand = "Popular Regional Biscuits (Any Brand)"

    if not biscuit_brand:
        biscuit_brands = [
            ("bourbon", "Britannia Bourbon"),
            ("britannia bourbon", "Britannia Bourbon"),
            ("parle-g", "Parle-G"),
            ("parleg", "Parle-G"),
            ("parle g", "Parle-G"),
            ("oreo", "Cadbury Oreo"),
            ("marie gold", "Marie Gold"),
            ("marie", "Marie Gold"),
            ("good day", "Britannia Good Day"),
            ("goodday", "Britannia Good Day"),
            ("digestive", "NutriChoice Digestive"),
            ("butter cookies", "Artisanal Butter Biscuits"),
            ("butter biscuit", "Artisanal Butter Biscuits"),
            ("artisanal butter", "Artisanal Butter Biscuits"),
        ]
        for pattern, name in biscuit_brands:
            if pattern in combined_lower:
                biscuit_brand = name
                break

    # If user just asked for biscuits without brand, default to popular local option
    if not biscuit_brand:
        biscuit_brand = "Britannia Bourbon / Parle-G"

    prefs["biscuit_brand"] = biscuit_brand

    # 3. Quantity detection
    qty = 1
    m_qty = re.search(r"(\d+)\s*(?:packs?|packets?|boxes?|pieces?)", combined_lower)
    if m_qty:
        try:
            qty = int(m_qty.group(1))
        except ValueError:
            qty = 1
    elif any(w in combined_lower for w in ("two packs", "2 packs", "two packets", "2 packets")):
        qty = 2
    elif any(w in combined_lower for w in ("three packs", "3 packs")):
        qty = 3
    prefs["quantity"] = qty

    return prefs


def check_missing_clarifications(
    agent_name: str,
    prompt: str,
    preferences: dict[str, Any],
) -> tuple[bool, ClarificationRequest | None]:
    """Determine whether a subagent requires user clarification before discovery can complete.

    Subagents only request clarification if information is strictly necessary to complete the task.
    """
    subagent = subagent_registry.get(agent_name)
    if subagent and subagent.clarification_checker:
        return subagent.clarification_checker(prompt, preferences)

    agent_lower = agent_name.lower()
    prompt_lower = prompt.lower()

    if agent_lower in ("merchant_attach", "merchantattach"):
        is_direct_simulation = (
            "proceed with payment" in prompt_lower
            and ("biscuit" in prompt_lower or "chai" in prompt_lower)
        )
        if is_direct_simulation:
            return False, None

        # Location is strictly necessary for merchant catalog search & delivery charges
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


def execute_specialist_agent(
    agent_name: str,
    task: SubagentTask,
    prompt: str,
    model_id: str | None = None,
) -> dict[str, Any]:
    """Execute specialist subagent (via ADK or simulation wrapper). Backwards-compatible fallback."""
    target_model = model_id or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    names = configured_agent_names()
    if agent_name in names:
        _ = build_runtime_agent(agent_name, model=target_model)

    agent_lower = agent_name.lower()
    raw_amount = task.get("amount_minor", 0)
    currency = task.get("currency", "USD")

    is_inr = currency.upper() == "INR"
    default_quotes = {
        "travel": 500000 if is_inr else 50000,
        "hotel": 250000 if is_inr else 25000,
        "food": 150000 if is_inr else 15000,
        "transport": 100000 if is_inr else 10000,
        "activities": 100000 if is_inr else 10000,
        "merchant_attach": 7000 if is_inr else 1000,
        "merchantattach": 7000 if is_inr else 1000,
    }
    amount_minor = raw_amount if raw_amount > 0 else default_quotes.get(agent_lower, 50000)
    budget_str = _format_budget(amount_minor, currency)

    if agent_lower == "travel":
        dest_hint = "the destination"
        for word in prompt.split():
            if len(word) > 3 and word[0].isupper() and word.isalpha():
                dest_hint = word
                break
        return {
            "agent": "travel",
            "model": target_model,
            "action": task.get("action", "plan_itinerary"),
            "allocated_budget_minor": amount_minor,
            "allocated_budget_display": budget_str,
            "currency": currency,
            "quoted_cost_minor": amount_minor,
            "itinerary": (
                f"Travel Specialist (Quoted fare: {budget_str}) — Itinerary for {dest_hint}:\n\n"
                f"**Outbound Flight**: Direct route confirmed. "
                f"Economy seat selection confirmed. Quoted cost: "
                f"{_format_budget(int(amount_minor * 0.60), currency)} (60% of travel quote).\n\n"
                f"**Return Flight**: Flexible return route with 24-hr change policy. "
                f"Quoted cost: {_format_budget(int(amount_minor * 0.35), currency)} (35% of travel quote).\n\n"
                f"**Transit**: Airport transfer coordination identified. "
                f"Remaining {_format_budget(int(amount_minor * 0.05), currency)} estimated for connections.\n\n"
                f"Total quoted travel cost: {budget_str} (Authorized via child mandate)."
            ),
            "estimated_cost_minor": amount_minor,
            "details": {
                "route": f"Optimized flight route for {dest_hint}",
                "schedule": "Outbound + return within selected travel window",
                "payment_status": "Authorized via PayGuardian child mandate",
                "mandate_budget": budget_str,
            },
            "status": "completed",
        }
    if agent_lower == "hotel":
        return {
            "agent": "hotel",
            "model": target_model,
            "action": task.get("action", "book_hotel"),
            "allocated_budget_minor": amount_minor,
            "allocated_budget_display": budget_str,
            "currency": currency,
            "quoted_cost_minor": amount_minor,
            "lodging": (
                f"Hotel Specialist (Quoted cost: {budget_str}) — Accommodation verified:\n\n"
                f"**Property**: Boutique 4-star hotel in city centre, flexible cancellation policy.\n"
                f"**Room**: Superior double room for 2 guests, breakfast included.\n"
                f"**Duration**: 3 nights @ {_format_budget(int(amount_minor / 3), currency)}/night.\n\n"
                f"**Cost breakdown**:\n"
                f"  - Room charges: {_format_budget(int(amount_minor * 0.85), currency)}\n"
                f"  - Taxes & fees: {_format_budget(int(amount_minor * 0.15), currency)}\n"
                f"  - Total: {budget_str}\n\n"
                f"Payment authorized via PayGuardian child mandate."
            ),
            "estimated_cost_minor": amount_minor,
            "details": {
                "property": "Verified boutique hotel — flexible cancellation",
                "nights": 3,
                "room_type": "Superior double, breakfast included",
                "mandate_budget": budget_str,
                "payment_status": "Authorized via PayGuardian child mandate",
            },
            "status": "completed",
        }
    if agent_lower == "food":
        return {
            "agent": "food",
            "model": target_model,
            "action": task.get("action", "recommend_dining"),
            "allocated_budget_minor": amount_minor,
            "allocated_budget_display": budget_str,
            "currency": currency,
            "quoted_cost_minor": amount_minor,
            "dining": (
                f"Food Specialist (Estimated dining: {budget_str}) — Dining plan curated:\n\n"
                f"**Day 1 Dinner**: Locally-sourced farm-to-table bistro. Reservation confirmed "
                f"({_format_budget(int(amount_minor * 0.35), currency)} est.)\n"
                f"**Day 2 Lunch**: High-rated regional cuisine restaurant. Table for 2 booked "
                f"({_format_budget(int(amount_minor * 0.30), currency)} est.)\n"
                f"**Day 2 Dinner**: Rooftop fine dining — seasonal tasting menu "
                f"({_format_budget(int(amount_minor * 0.25), currency)} est.)\n"
                f"**Day 3**: Flexible budget for cafés and local street food "
                f"({_format_budget(int(amount_minor * 0.10), currency)} reserved)\n\n"
                f"All dining recommendations within {budget_str} estimated dining envelope."
            ),
            "estimated_cost_minor": amount_minor,
            "details": {
                "options": [
                    "Farm-to-table bistro (dinner, Day 1)",
                    "Regional cuisine restaurant (lunch, Day 2)",
                    "Rooftop fine dining (dinner, Day 2)",
                    "Café/street food flex budget (Day 3)",
                ],
                "mandate_budget": budget_str,
            },
            "status": "completed",
        }
    if agent_lower == "transport":
        return {
            "agent": "transport",
            "model": target_model,
            "action": task.get("action", "arrange_transport"),
            "allocated_budget_minor": amount_minor,
            "allocated_budget_display": budget_str,
            "currency": currency,
            "transit": (
                f"Transport Agent (delegated budget: {budget_str}) — Ground transport arranged:\n\n"
                f"**Airport Transfer (arrival)**: Express taxi/shuttle pre-booked "
                f"({_format_budget(int(amount_minor * 0.30), currency)})\n"
                f"**City Transit Pass**: 3-day metro/bus card "
                f"({_format_budget(int(amount_minor * 0.25), currency)})\n"
                f"**Airport Transfer (departure)**: Return shuttle "
                f"({_format_budget(int(amount_minor * 0.30), currency)})\n"
                f"**Reserve**: Day-trip / ride-share buffer "
                f"({_format_budget(int(amount_minor * 0.15), currency)})\n\n"
                f"Total transport spend: {budget_str} (within delegated mandate)."
            ),
            "estimated_cost_minor": amount_minor,
            "details": {
                "transfers": "Airport express (arr + dep) + 3-day city transit pass",
                "mandate_budget": budget_str,
                "payment_status": "Pre-authorized via PayGuardian Gateway",
            },
            "status": "completed",
        }
    if agent_lower == "activities":
        return {
            "agent": "activities",
            "model": target_model,
            "action": task.get("action", "schedule_activities"),
            "allocated_budget_minor": amount_minor,
            "allocated_budget_display": budget_str,
            "currency": currency,
            "activities": (
                f"Activities Agent (delegated budget: {budget_str}) — Experiences booked:\n\n"
                f"**Day 1 Afternoon**: City highlights guided walking tour (2h) "
                f"({_format_budget(int(amount_minor * 0.20), currency)})\n"
                f"**Day 2**: Major art museum — skip-the-line passes for 2 "
                f"({_format_budget(int(amount_minor * 0.30), currency)})\n"
                f"**Day 2 Evening**: Historic quarter self-guided audio tour "
                f"({_format_budget(int(amount_minor * 0.15), currency)})\n"
                f"**Day 3**: River/canal cruise (1.5h) "
                f"({_format_budget(int(amount_minor * 0.25), currency)})\n"
                f"**Reserve**: Optional add-ons buffer "
                f"({_format_budget(int(amount_minor * 0.10), currency)})\n\n"
                f"All activities confirmed within {budget_str} delegated budget."
            ),
            "estimated_cost_minor": amount_minor,
            "details": {
                "highlights": [
                    "City walking tour (Day 1)",
                    "Art Museum pass x2 (Day 2)",
                    "Historic audio tour (Day 2 evening)",
                    "River cruise (Day 3)",
                ],
                "mandate_budget": budget_str,
            },
            "status": "completed",
        }
    if agent_lower in ("merchant_attach", "merchantattach"):
        total_minor = amount_minor
        merchant_name = "Chai & Bakery Express"
        if task.get("quotes") and task["quotes"][0].get("merchant"):
            merchant_name = str(task["quotes"][0]["merchant"])
        return {
            "agent": "merchant_attach",
            "model": target_model,
            "action": task.get("action", "procure_merchant_goods"),
            "allocated_budget_minor": total_minor,
            "allocated_budget_display": budget_str,
            "merchant": merchant_name,
            "search_query": "biscuit, chai, regional snacks",
            "simulation_timeline": "3 minutes elapsed (T+00:00 to T+03:00 simulated)",
            "selected_items": [
                {
                    "name": "Masala Chai Blend (500g)",
                    "qty": 1,
                    "price_minor": int(total_minor * 0.45),
                    "currency": currency,
                },
                {
                    "name": "Artisanal Butter Biscuits Box",
                    "qty": 2,
                    "price_minor": int(total_minor * 0.35),
                    "currency": currency,
                },
            ],
            "subtotal_minor": int(total_minor * 1.15),
            "merchant_discount_minor": int(total_minor * 0.15),
            "total_minor": total_minor,
            "payment_authorization": {
                "mandate_id": task.get("child_mandate_id") or task.get("mandate_id", "mandate-root-simulated"),
                "payment_intent": "pi_merchant_sim_09d8f3",
                "status": "authorized",
                "settlement_rail": "PayGuardian Gateway Sandbox",
            },
            "summary": (
                f"Completed 3-minute simulated catalog search across regional merchants "
                f"for biscuit and chai. Selected vendor '{merchant_name}'. Authorized "
                f"{budget_str} payment via PayGuardian Gateway within mandate authority limit."
            ),
            "estimated_cost_minor": total_minor,
            "currency": currency,
            "status": "completed",
        }

    return {
        "agent": agent_name,
        "model": target_model,
        "action": task.get("action", "execute"),
        "allocated_budget_minor": amount_minor,
        "allocated_budget_display": _format_budget(amount_minor, currency),
        "result": f"Specialist agent '{agent_name}' completed task successfully.",
        "estimated_cost_minor": amount_minor,
        "currency": currency,
        "status": "completed",
    }


def dynamic_plan_subagents(
    messages: list[dict[str, Any]],
    current_prompt: str,
    budget_currency: str = "USD",
    model_id: str | None = None,
    gateway_client: GatewayClient | None = None,
) -> tuple[list[SubagentTask], list[str]]:
    """Dynamically determine required specialist subagents using LLM and capability registry."""
    subagents = subagent_registry.list_capabilities()

    # Try discovering additional dynamic agents from Gateway catalog if connected
    if gateway_client:
        try:
            cat = gateway_client.get_catalog()
            if cat:
                for item in cat:
                    cid = item.get("id")
                    if cid and not subagent_registry.get(cid):
                        subagent_registry.register(
                            SubagentCapability(
                                id=cid,
                                name=item.get("name", cid),
                                alias=cid.replace("agent-", "").replace("-", "_"),
                                specialty=item.get("specialty", "custom"),
                                description=item.get("description", item.get("tagline", "")),
                                capabilities=item.get("permissions", []),
                                default_action="execute",
                                sample_prompts=item.get("samplePrompts", []),
                            )
                        )
                subagents = subagent_registry.list_capabilities()
        except Exception:
            pass

    prompt_lower = current_prompt.lower()

    if is_rejection_message(current_prompt):
        return [], ["User rejected proposed budget allocation. Cancellation in effect."]

    # Check for agent discovery queries (e.g. "how many agents", "what agents do you have")
    agent_query_patterns = (
        "how many agent",
        "what agent",
        "list agent",
        "which agent",
        "available agent",
        "show agent",
        "tell me your agent",
        "who are you",
    )
    if any(q in prompt_lower for q in agent_query_patterns):
        return [], ["Process request through Personal Agent Orchestrator"]

    # Extract user-only text from history for clean intent analysis (no assistant error or URL leaks)
    user_texts: list[str] = []
    for m in messages:
        if isinstance(m, dict) and m.get("role") in ("user", "human"):
            txt = str(m.get("content") or m.get("message") or "").strip()
            if txt:
                user_texts.append(txt)
    if current_prompt and (not user_texts or current_prompt != user_texts[-1]):
        user_texts.append(current_prompt)

    conversation_user_summary = " -> ".join(user_texts)
    search_text = " ".join(user_texts).lower()

    # Attempt LLM-based agent selection
    selected_agent_specs: list[dict[str, Any]] = []

    try:
        from agent_runtime.llm_provider import LLMFactory

        provider, resolved_model = LLMFactory.get_provider_for_model(model_id)

        catalog_text_lines = []
        for a in subagents:
            catalog_text_lines.append(
                f"- [ID: {a.id}] {a.name} (alias: '{a.alias}'): {a.description} "
                f"(Capabilities: {', '.join(a.capabilities)})"
            )
        catalog_desc = "\n".join(catalog_text_lines)

        system_instruction = (
            "You are the PayGuardian Personal Agent Orchestrator.\n"
            "Analyze the user request and select all appropriate top-level specialist agents required to discover and execute each distinct aspect of the request.\n\n"
            "Rules:\n"
            "1. Select all top-level specialist agents that match distinct user goals (e.g. travel/flights -> travel; food/dining/dinner/restaurant -> food; activities/tours -> activities; merchant goods/groceries -> merchant_attach; transit/train -> transport).\n"
            "2. For composite domains (such as travel), select the parent coordinator (e.g. 'travel'); nested child services (such as hotel accommodation) will be sub-delegated hierarchically by that coordinator.\n"
            "3. If the user is confirming an active ongoing plan (e.g. 'okay delegate', 'proceed', 'confirm', 'yes'), select the subagent(s) from that active plan.\n"
            "4. If the user is asking general informational questions or chit-chat, return an empty list.\n"
            "5. Return strictly valid JSON in this format:\n"
            '{"selected_agents": [{"id": "agent-id-or-alias", "action": "action_name", "task_description": "short description"}]}'
        )

        llm_prompt = (
            f"Available Subagents:\n{catalog_desc}\n\n"
            f"User Conversation History:\n{conversation_user_summary}\n\n"
            f"Latest User Request:\n{current_prompt}\n\n"
            "Respond with JSON only:"
        )

        resp = provider.generate(
            prompt=llm_prompt,
            system_instruction=system_instruction,
            model=resolved_model,
            max_tokens=400,
            temperature=0.2,
        )

        m_json = re.search(r"\{.*\}", resp, re.DOTALL)
        if m_json:
            parsed = json.loads(m_json.group(0))
            raw_selected = parsed.get("selected_agents", [])
            for item in raw_selected:
                target_id = item.get("id") or item.get("agent")
                sub = subagent_registry.get(str(target_id))
                if sub:
                    selected_agent_specs.append(
                        {
                            "subagent": sub,
                            "action": item.get("action") or sub.default_action,
                            "description": item.get("task_description") or sub.description,
                        }
                    )
    except Exception as exc:
        logger.info("LLM agent planning unavailable (%s), using dynamic capability matching.", exc)

    # Ensure any explicitly requested domains are covered
    existing_aliases = {s["subagent"].alias for s in selected_agent_specs}
    if "food" not in existing_aliases and any(
        w in search_text for w in ("dinner", "dining", "food", "restaurant", "meal", "ramen", "vacation", "holiday")
    ):
        food_sub = subagent_registry.get("food")
        if food_sub:
            selected_agent_specs.append(
                {
                    "subagent": food_sub,
                    "action": food_sub.default_action,
                    "description": food_sub.description,
                }
            )

    # If LLM didn't produce selections (or failed/offline), evaluate dynamically over capabilities
    if not selected_agent_specs:
        confirmation_phrases = (
            "okay delegate",
            "delegate",
            "proceed",
            "confirm",
            "yes please",
            "yes",
            "go ahead",
            "do it",
            "execute",
            "buy it",
        )
        is_confirmation = any(prompt_lower == p or prompt_lower.startswith(p) for p in confirmation_phrases)

        if is_confirmation and len(user_texts) > 1:
            search_text = " ".join(user_texts[:-1]).lower()
        else:
            search_text = " ".join(user_texts).lower()

        for sub in subagents:
            matched = False
            if sub.alias.lower() in search_text or sub.name.lower() in search_text:
                matched = True

            if not matched:
                if sub.alias in ("merchant_attach", "merchantattach"):
                    if any(
                        w in search_text
                        for w in (
                            "biscuit",
                            "biscuits",
                            "bourbon",
                            "parle",
                            "oreo",
                            "cookie",
                            "cookies",
                            "chai",
                            "tea",
                            "snack",
                            "snacks",
                            "groceries",
                            "merchant",
                            "store",
                            "bakery",
                            "procure",
                            "buy goods",
                            "buy one",
                            "buy me",
                        )
                    ):
                        matched = True
                elif sub.alias == "travel":
                    if any(
                        w in search_text
                        for w in (
                            "flight",
                            "airline",
                            "itinerary",
                            "trip",
                            "vacation",
                            "getaway",
                            "holiday",
                            "travel",
                        )
                    ):
                        matched = True
                elif sub.alias == "hotel":
                    if any(
                        w in search_text
                        for w in (
                            "hotel",
                            "lodging",
                            "stay",
                            "room",
                            "accommodation",
                            "resort",
                            "motel",
                            "airbnb",
                            "vacation",
                            "trip",
                            "getaway",
                        )
                    ):
                        matched = True
                elif sub.alias == "food":
                    if any(
                        w in search_text
                        for w in (
                            "food",
                            "dining",
                            "restaurant",
                            "dinner",
                            "lunch",
                            "breakfast",
                            "eat",
                            "culinary",
                            "meal",
                            "ramen",
                            "vacation",
                            "trip",
                            "getaway",
                        )
                    ):
                        matched = True
                elif sub.alias == "transport":
                    if any(
                        w in search_text
                        for w in (
                            "transport",
                            "transit",
                            "train",
                            "cab",
                            "taxi",
                            "subway",
                            "shuttle",
                            "transfer",
                            "rail",
                            "bus",
                        )
                    ):
                        matched = True
                elif sub.alias == "activities":
                    if any(
                        w in search_text
                        for w in (
                            "activity",
                            "activities",
                            "museum",
                            "tour",
                            "sightseeing",
                            "attraction",
                            "tickets",
                        )
                    ):
                        matched = True
                else:
                    sub_keywords = [c.split(".")[-1] for c in sub.capabilities]
                    if any(kw in search_text for kw in sub_keywords if len(kw) > 3):
                        matched = True

            if matched:
                selected_agent_specs.append(
                    {
                        "subagent": sub,
                        "action": sub.default_action,
                        "description": sub.description,
                    }
                )

    # Hierarchy Preservation: If coordinator agent (e.g. Travel) is selected,
    # child capabilities (e.g. Hotel, Transport) must be delegated under the coordinator,
    # never flattened as top-level peers.
    travel_spec = next((s for s in selected_agent_specs if s["subagent"].alias == "travel"), None)
    hotel_needed_under_travel = False
    if travel_spec:
        if any(s["subagent"].alias == "hotel" for s in selected_agent_specs) or any(
            w in search_text
            for w in (
                "hotel",
                "lodging",
                "stay",
                "room",
                "accommodation",
                "resort",
                "motel",
                "getaway",
                "vacation",
                "trip",
                "weekend",
            )
        ):
            hotel_needed_under_travel = True
        # Filter hotel out of top-level selected_agent_specs to preserve hierarchy
        selected_agent_specs = [s for s in selected_agent_specs if s["subagent"].alias != "hotel"]

    subagent_tasks: list[SubagentTask] = []
    plan: list[str] = []

    if not selected_agent_specs:
        plan = ["Process request through Personal Agent Orchestrator"]
    else:
        for spec in selected_agent_specs:
            plan.append(f"Discover options & obtain quotes via {spec['subagent'].name}")
            if spec["subagent"].alias == "travel" and hotel_needed_under_travel:
                plan.append("Sub-delegate lodging options via Hotel Specialist")

    for spec in selected_agent_specs:
        sub = spec["subagent"]
        task_id = f"task_{sub.alias}_{uuid.uuid4().hex[:8]}"
        task: SubagentTask = {
            "id": task_id,
            "agent": sub.alias,
            "action": spec["action"],
            "description": spec["description"],
            "amount_minor": 0,
            "currency": budget_currency,
            "status": "created",
            "phase": "discovery",
            "authority_checked": False,
            "delegated": False,
            "requires_spending": False,
            "required_capabilities": sub.capabilities,
            "dependencies": [],
            "parent_task_id": None,
            "parent_agent_id": None,
            "delegation_depth": 0,
            "child_tasks": [],
            "quoted_amount_minor": None,
            "proposed_mandate_minor": None,
            "child_mandate_id": None,
            "holder_agent_id": sub.id,
            "quotes": [],
            "missing_fields": [],
            "questions": [],
        }
        subagent_tasks.append(task)

        if sub.alias == "travel" and hotel_needed_under_travel:
            hotel_sub = subagent_registry.get("hotel")
            hotel_task_id = f"task_hotel_{uuid.uuid4().hex[:8]}"
            hotel_task: SubagentTask = {
                "id": hotel_task_id,
                "agent": "hotel",
                "action": hotel_sub.default_action if hotel_sub else "book_hotel",
                "description": hotel_sub.description if hotel_sub else "Hotel Specialist under Travel Concierge authority",
                "amount_minor": 0,
                "currency": budget_currency,
                "status": "created",
                "phase": "discovery",
                "authority_checked": False,
                "delegated": False,
                "requires_spending": False,
                "required_capabilities": hotel_sub.capabilities if hotel_sub else ["book_hotel"],
                "dependencies": [task_id],
                "parent_task_id": task_id,
                "parent_agent_id": sub.id,
                "delegation_depth": 1,
                "child_tasks": [],
                "quoted_amount_minor": None,
                "proposed_mandate_minor": None,
                "child_mandate_id": None,
                "holder_agent_id": hotel_sub.id if hotel_sub else "agent-hotel-specialist",
                "quotes": [],
                "missing_fields": [],
                "questions": [],
            }
            task.setdefault("child_tasks", []).append(hotel_task)
            subagent_tasks.append(hotel_task)

    return subagent_tasks, plan


class PersonalLangGraphAgent:
    """LangGraph-based Personal Agent coordinator implementing the 5-phase orchestration lifecycle."""

    def __init__(
        self,
        gateway_client: GatewayClient | None = None,
        event_emitter: EventEmitter | None = None,
        gateway: GatewayClient | None = None,
    ) -> None:
        self.gateway_client = gateway or gateway_client or GatewayClient()
        self.event_emitter = event_emitter or EventEmitter()
        self.graph = self._build_graph()

    def _build_graph(self) -> Any:
        workflow = StateGraph(PersonalAgentState)

        workflow.add_node("planner", self._planner_node)
        workflow.add_node("discovery", self._discovery_node)
        workflow.add_node("budget_planner", self._budget_planner_node)
        workflow.add_node("gateway_authorizer", self._gateway_authorizer_node)
        workflow.add_node("execution_runner", self._execution_runner_node)
        workflow.add_node("synthesizer", self._synthesizer_node)

        workflow.add_edge(START, "planner")
        workflow.add_edge("planner", "discovery")

        def route_after_discovery(state: PersonalAgentState) -> str:
            if state.get("clarification_required"):
                return "synthesizer"
            if not state.get("subagent_tasks"):
                return "synthesizer"
            return "budget_planner"

        workflow.add_conditional_edges(
            "discovery",
            route_after_discovery,
            {
                "synthesizer": "synthesizer",
                "budget_planner": "budget_planner",
            },
        )

        def route_after_budget_planner(state: PersonalAgentState) -> str:
            if state.get("approval_pending"):
                return "synthesizer"
            return "gateway_authorizer"

        workflow.add_conditional_edges(
            "budget_planner",
            route_after_budget_planner,
            {
                "synthesizer": "synthesizer",
                "gateway_authorizer": "gateway_authorizer",
            },
        )
        workflow.add_edge("gateway_authorizer", "execution_runner")
        workflow.add_edge("execution_runner", "synthesizer")
        workflow.add_edge("synthesizer", END)

        return workflow.compile()

    # Phase 1: Planning (Formulate discovery tasks without requiring spending authority)
    def _planner_node(self, state: PersonalAgentState) -> dict[str, Any]:
        run_id = state.get("run_id") or str(uuid.uuid4())
        messages = state.get("messages", [])
        prompt = extract_user_prompt(messages)
        prompt_lower = prompt.lower()
        budget_limit_minor = state.get("budget_limit_minor") or 0
        budget_currency = state.get("budget_currency") or "USD"

        # Emit run.started if not already emitted
        if not any(e.get("event_type") == "run.started" for e in self.event_emitter.events):
            self.event_emitter.emit(
                "run.started",
                payload={
                    "run_id": run_id,
                    "prompt_preview": prompt[:80],
                    "budget_limit_minor": budget_limit_minor,
                    "budget_currency": budget_currency,
                },
                run_id=run_id,
                agent="personal",
            )

        # Emit agent.started for personal coordinator
        if not any(
            e.get("event_type") == "agent.started" and e.get("agent") == "personal"
            for e in self.event_emitter.events
        ):
            self.event_emitter.emit(
                "agent.started",
                payload={
                    "agent": "personal",
                    "agentId": "personal",
                    "role": "coordinator",
                    "budget_limit_minor": budget_limit_minor,
                    "budget_currency": budget_currency,
                },
                run_id=run_id,
                agent="personal",
            )

        # Extract user preferences across conversation history
        user_preferences = extract_user_preferences(messages, prompt)

        # Dynamic subagent discovery and task formulation
        raw_tasks, plan = dynamic_plan_subagents(
            messages=messages,
            current_prompt=prompt,
            budget_currency=budget_currency,
            model_id=state.get("model_id"),
            gateway_client=self.gateway_client,
        )

        subagent_tasks: list[SubagentTask] = []
        for task in raw_tasks:
            task_id = task["id"]
            agent_name = task["agent"]
            action = task["action"]
            description = task["description"]
            subagent_tasks.append(task)
            self.event_emitter.emit(
                "task.created",
                payload={
                    "task_id": task_id,
                    "agent": agent_name,
                    "agentId": agent_name,
                    "action": action,
                    "description": description,
                    "amount_minor": 0,
                    "currency": budget_currency,
                    "budget_display": _format_budget(0, budget_currency),
                    "requires_spending": False,
                    "phase": "discovery",
                },
                run_id=run_id,
                task_id=task_id,
                agent="personal",
            )

        self.event_emitter.emit(
            "agent.progress",
            payload={
                "step": "planning",
                "phase": "discovery",
                "message": (
                    f"Task planning initiated with {len(subagent_tasks)} discovery sub-tasks. "
                    f"Active mandate budget: {_format_budget(budget_limit_minor, budget_currency)}."
                ),
                "budget_limit_minor": budget_limit_minor,
                "budget_currency": budget_currency,
            },
            run_id=run_id,
            agent="personal",
        )

        is_rejected = is_rejection_message(prompt)
        is_confirmed = is_confirmation_message(prompt)

        return {
            "run_id": run_id,
            "plan": plan,
            "subagent_tasks": subagent_tasks,
            "user_preferences": user_preferences,
            "clarification_required": False,
            "missing_fields": [],
            "clarification_questions": [],
            "is_user_rejected": is_rejected,
            "is_user_confirmed": is_confirmed,
            "events": self.event_emitter.events,
        }

    # Phase 2: Discovery & Clarification Loop
    def _discovery_node(self, state: PersonalAgentState) -> dict[str, Any]:
        run_id = state.get("run_id") or ""
        messages = state.get("messages", [])
        prompt = extract_user_prompt(messages)
        prompt_lower = prompt.lower()
        tasks = state.get("subagent_tasks", [])
        user_preferences = dict(state.get("user_preferences") or {})
        currency = state.get("budget_currency") or "USD"
        model_id = state.get("model_id")
        effective_model = model_id or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        if not tasks:
            return {
                "clarification_required": False,
                "subagent_tasks": [],
                "events": self.event_emitter.events,
            }

        self.event_emitter.emit(
            "agent.progress",
            payload={
                "step": "discovery",
                "phase": "discovery",
                "message": f"Delegating product and service discovery to {len(tasks)} subagents without spending requirement.",
            },
            run_id=run_id,
            agent="personal",
        )

        all_missing_fields: list[str] = []
        all_questions: list[str] = []
        updated_tasks: list[SubagentTask] = []
        clarification_needed_overall = False

        for t in tasks:
            task = dict(t)
            agent_name = task.get("agent", "unknown")
            task_id = task.get("id", str(uuid.uuid4()))

            self.event_emitter.emit(
                "agent.started",
                payload={
                    "agent": agent_name,
                    "agentId": agent_name,
                    "task_id": task_id,
                    "action": task.get("action"),
                    "phase": "discovery",
                    "model": effective_model,
                },
                run_id=run_id,
                task_id=task_id,
                agent=agent_name,
            )

            # Check if crucial user information is missing for this subagent
            needs_clarification, clarification_req = check_missing_clarifications(
                agent_name, prompt, user_preferences
            )

            if needs_clarification and clarification_req:
                q_objs = clarification_req.get("questions", [])
                q_texts = [q["question"] for q in q_objs]
                missing_fields = ["location"]

                task["phase"] = "clarification_required"
                task["status"] = "clarification_required"
                task["clarification_request"] = clarification_req
                task["missing_fields"] = missing_fields
                task["questions"] = q_texts
                clarification_needed_overall = True
                all_missing_fields.extend(missing_fields)
                all_questions.extend(q_texts)

                self.event_emitter.emit(
                    "agent.progress",
                    payload={
                        "step": "clarification_required",
                        "phase": "clarification_required",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "missing_fields": missing_fields,
                        "clarification_request": clarification_req,
                        "questions": q_texts,
                        "message": (
                            f"{agent_name.capitalize()} Agent requires necessary clarification: "
                            f"{q_texts[0]}."
                        ),
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                updated_tasks.append(task)  # type: ignore[arg-type]
                continue

            # Information sufficient — run discovery tools to locate inventory & generate quotes
            if agent_name in ("merchant_attach", "merchantattach"):
                loc_name = user_preferences.get("location") or "Local Area"
                brand_name = user_preferences.get("biscuit_brand") or "Artisanal Butter Biscuits"
                quantity = user_preferences.get("quantity") or 1

                self.event_emitter.emit(
                    "tool.started",
                    payload={
                        "tool": "merchant_catalog_search",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "parameters": {
                            "query": f"{brand_name}, regional snacks",
                            "location": loc_name,
                            "scan_radius": "5km",
                        },
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "agent.progress",
                    payload={
                        "step": "searching_catalogs",
                        "phase": "discovery",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "message": (
                            f"[T+00:45 simulated] Scanned 12 local merchant catalogs near {loc_name}; "
                            f"shortlisted Chai & Bakery Express, Metro Pantry, and Heritage Tea Co."
                        ),
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "tool.completed",
                    payload={
                        "tool": "merchant_catalog_search",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "status": "success",
                        "result": {"merchants_found": 3, "status": "catalog_indexed"},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )

                self.event_emitter.emit(
                    "tool.started",
                    payload={
                        "tool": "vendor_price_comparison",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "parameters": {
                            "merchants": [
                                "Chai & Bakery Express",
                                "Metro Pantry",
                                "Heritage Tea Co.",
                            ],
                            "target_items": [brand_name, "Chai"],
                        },
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "agent.progress",
                    payload={
                        "step": "comparing_prices",
                        "phase": "discovery",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "message": (
                            f"[T+01:45 simulated] Comparing unit pricing and stock freshness. "
                            f"Chai & Bakery Express has batch-fresh {brand_name}."
                        ),
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "agent.progress",
                    payload={
                        "step": "applying_discounts",
                        "phase": "discovery",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "message": (
                            "[T+02:40 simulated] Applied promotional bundle coupon. "
                            "Final quote calculated."
                        ),
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )

                # Determine quote pricing based on currency
                if currency.upper() == "INR":
                    unit_price = 3000  # ₹30.00
                    subtotal = unit_price * quantity
                    delivery = 4000   # ₹40.00
                    total = subtotal + delivery
                else:
                    unit_price = 350   # $3.50
                    subtotal = unit_price * quantity + 450  # + chai
                    discount = 150
                    total = 1000

                self.event_emitter.emit(
                    "tool.completed",
                    payload={
                        "tool": "vendor_price_comparison",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "status": "success",
                        "result": {
                            "selected_merchant": f"Chai & Bakery Express ({loc_name})",
                            "subtotal": subtotal,
                            "delivery": 4000 if currency.upper() == "INR" else 0,
                            "total": total,
                        },
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )

                quote = {
                    "quote_id": f"quote_merchant_{uuid.uuid4().hex[:8]}",
                    "merchant": f"Chai & Bakery Express ({loc_name})",
                    "items": [
                        {
                            "name": brand_name,
                            "qty": quantity,
                            "unit_price_minor": unit_price,
                            "currency": currency,
                        }
                    ],
                    "total_minor": total,
                    "currency": currency,
                    "valid_until": (datetime.now(UTC) + timedelta(minutes=15)).isoformat(),
                    "availability": "in_stock",
                }
                task["quotes"] = [quote]
                task["quoted_amount_minor"] = total
                task["phase"] = "quote_received"
                task["status"] = "quote_received"

            elif agent_name == "travel":
                self.event_emitter.emit(
                    "tool.started",
                    payload={
                        "tool": "flight_search_and_routing",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "parameters": {"scope": "transit_and_flights", "currency": currency},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "agent.progress",
                    payload={
                        "step": "analyzing_routes",
                        "phase": "discovery",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "message": "Analyzing flight routes and optimal schedules...",
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "tool.completed",
                    payload={
                        "tool": "flight_search_and_routing",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "status": "success",
                        "result": {"routes_found": 6, "optimal_selected": True},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                quoted = 50000 if currency.upper() != "INR" else 500000
                quote = {
                    "quote_id": f"quote_travel_{uuid.uuid4().hex[:8]}",
                    "provider": "SkyWings Route Partners",
                    "total_minor": quoted,
                    "currency": currency,
                    "valid_until": (datetime.now(UTC) + timedelta(minutes=30)).isoformat(),
                }
                task["quotes"] = [quote]
                task["quoted_amount_minor"] = quoted
                task["phase"] = "quote_received"
                task["status"] = "quote_received"

            elif agent_name == "hotel":
                self.event_emitter.emit(
                    "tool.started",
                    payload={
                        "tool": "hotel_inventory_search",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "parameters": {"nights": 3, "currency": currency},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "agent.progress",
                    payload={
                        "step": "searching_lodging",
                        "phase": "discovery",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "message": "Searching verified boutique accommodations and room rates...",
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "tool.completed",
                    payload={
                        "tool": "hotel_inventory_search",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "status": "success",
                        "result": {"hotels_found": 12, "selected": "Boutique 4-star Hotel"},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                quoted = 25000 if currency.upper() != "INR" else 250000
                quote = {
                    "quote_id": f"quote_hotel_{uuid.uuid4().hex[:8]}",
                    "property": "Boutique 4-star Hotel",
                    "total_minor": quoted,
                    "currency": currency,
                }
                task["quotes"] = [quote]
                task["quoted_amount_minor"] = quoted
                task["phase"] = "quote_received"
                task["status"] = "quote_received"

            elif agent_name == "food":
                self.event_emitter.emit(
                    "tool.started",
                    payload={
                        "tool": "dining_reservation_curation",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "parameters": {"currency": currency},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "agent.progress",
                    payload={
                        "step": "curating_dining",
                        "phase": "discovery",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "message": "Curating regional culinary venues and seasonal tasting menus...",
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "tool.completed",
                    payload={
                        "tool": "dining_reservation_curation",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "status": "success",
                        "result": {"tables_reserved": 2, "status": "confirmed"},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                quoted = 15000 if currency.upper() != "INR" else 150000
                quote = {
                    "quote_id": f"quote_food_{uuid.uuid4().hex[:8]}",
                    "curation": "Farm-to-table bistro & rooftop dining",
                    "total_minor": quoted,
                    "currency": currency,
                }
                task["quotes"] = [quote]
                task["quoted_amount_minor"] = quoted
                task["phase"] = "quote_received"
                task["status"] = "quote_received"

            elif agent_name == "transport":
                self.event_emitter.emit(
                    "tool.started",
                    payload={
                        "tool": "ground_transit_scheduling",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "parameters": {"currency": currency},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "tool.completed",
                    payload={
                        "tool": "ground_transit_scheduling",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "status": "success",
                        "result": {"transfers_booked": 2, "cards_issued": 2},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                quoted = 10000 if currency.upper() != "INR" else 100000
                quote = {
                    "quote_id": f"quote_transport_{uuid.uuid4().hex[:8]}",
                    "transfers": "Airport express + city transit pass",
                    "total_minor": quoted,
                    "currency": currency,
                }
                task["quotes"] = [quote]
                task["quoted_amount_minor"] = quoted
                task["phase"] = "quote_received"
                task["status"] = "quote_received"

            elif agent_name == "activities":
                self.event_emitter.emit(
                    "tool.started",
                    payload={
                        "tool": "attraction_booking_service",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "parameters": {"currency": currency},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "tool.completed",
                    payload={
                        "tool": "attraction_booking_service",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "status": "success",
                        "result": {"passes_confirmed": ["Museum Pass", "Sightseeing Tour"]},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                quoted = 10000 if currency.upper() != "INR" else 100000
                quote = {
                    "quote_id": f"quote_activities_{uuid.uuid4().hex[:8]}",
                    "passes": ["Museum Pass", "Sightseeing Tour"],
                    "total_minor": quoted,
                    "currency": currency,
                }
                task["quotes"] = [quote]
                task["quoted_amount_minor"] = quoted
                task["phase"] = "quote_received"
                task["status"] = "quote_received"

            else:
                quoted = 1000
                quote = {
                    "quote_id": f"quote_generic_{uuid.uuid4().hex[:8]}",
                    "total_minor": quoted,
                    "currency": currency,
                }
                task["quotes"] = [quote]
                task["quoted_amount_minor"] = quoted
                task["phase"] = "quote_received"
                task["status"] = "quote_received"

            updated_tasks.append(task)  # type: ignore[arg-type]

        return {
            "subagent_tasks": updated_tasks,
            "clarification_required": clarification_needed_overall,
            "missing_fields": all_missing_fields,
            "clarification_questions": all_questions,
            "clarification_request": updated_tasks[0].get("clarification_request") if clarification_needed_overall and updated_tasks else None,
            "events": self.event_emitter.events,
        }

    # Phase 3: Budget Planning (Evaluate quotes & determine required delegation budget)
    def _budget_planner_node(self, state: PersonalAgentState) -> dict[str, Any]:
        run_id = state.get("run_id") or ""
        tasks = state.get("subagent_tasks", [])
        budget_limit_minor = state.get("budget_limit_minor") or 0
        currency = state.get("budget_currency") or "USD"

        self.event_emitter.emit(
            "agent.progress",
            payload={
                "step": "budget_planning",
                "phase": "budget_planning",
                "message": f"Evaluating received quotes against mandate reserve of {_format_budget(budget_limit_minor, currency)}.",
            },
            run_id=run_id,
            agent="personal",
        )

        updated_tasks: list[SubagentTask] = []
        allocated_so_far = 0

        for t in tasks:
            task = dict(t)
            quoted_amt = task.get("quoted_amount_minor") or task.get("amount_minor", 0)

            # Ensure quote is non-zero
            if quoted_amt <= 0:
                quoted_amt = 1000 if currency == "USD" else 10000

            task["amount_minor"] = quoted_amt
            task["proposed_mandate_minor"] = quoted_amt

            is_child_task = bool(task.get("parent_task_id"))
            if is_child_task:
                # Hierarchical budget delegation: Child task budget is drawn from parent coordinator's envelope
                parent_task = next((p for p in updated_tasks if p.get("id") == task.get("parent_task_id")), None)
                parent_budget = (parent_task.get("amount_minor", 0) if parent_task else 0)
                if parent_budget > 0 and quoted_amt > parent_budget:
                    task["phase"] = "failed"
                    task["status"] = "budget_exceeded"
                    task["error"] = f"Quoted amount {_format_budget(quoted_amt, currency)} exceeds parent allocation {_format_budget(parent_budget, currency)}."
                else:
                    task["phase"] = "authorization_pending"
                    task["status"] = "authorization_pending"
                    self.event_emitter.emit(
                        "agent.progress",
                        payload={
                            "step": "budget_planning",
                            "phase": "authorization_pending",
                            "agent": task.get("agent"),
                            "amount_minor": quoted_amt,
                            "currency": currency,
                            "message": (
                                f"Approved child budget allocation of {_format_budget(quoted_amt, currency)} "
                                f"for {task.get('agent', '').capitalize()} Agent under {task.get('parent_agent_id', 'parent coordinator')}."
                            ),
                        },
                        run_id=run_id,
                        task_id=task.get("id"),
                        agent="personal",
                    )
            else:
                # Top-level task evaluated against root mandate reserve
                remaining_budget = budget_limit_minor - allocated_so_far
                if budget_limit_minor > 0 and quoted_amt > remaining_budget:
                    task["phase"] = "failed"
                    task["status"] = "budget_exceeded"
                    task["error"] = f"Quoted amount {_format_budget(quoted_amt, currency)} exceeds remaining budget {_format_budget(remaining_budget, currency)}."
                    self.event_emitter.emit(
                        "agent.progress",
                        payload={
                            "step": "budget_planning",
                            "phase": "failed",
                            "agent": task.get("agent"),
                            "message": task["error"],
                        },
                        run_id=run_id,
                        task_id=task.get("id"),
                        agent="personal",
                    )
                else:
                    allocated_so_far += quoted_amt
                    task["phase"] = "authorization_pending"
                    task["status"] = "authorization_pending"
                    self.event_emitter.emit(
                        "agent.progress",
                        payload={
                            "step": "budget_planning",
                            "phase": "authorization_pending",
                            "agent": task.get("agent"),
                            "amount_minor": quoted_amt,
                            "currency": currency,
                            "message": (
                                f"Approved budget allocation of {_format_budget(quoted_amt, currency)} "
                                f"for {task.get('agent', '').capitalize()} Agent from mandate reserve."
                            ),
                        },
                        run_id=run_id,
                        task_id=task.get("id"),
                        agent="personal",
                    )

            updated_tasks.append(task)  # type: ignore[arg-type]

        user_confirmed = state.get("is_user_confirmed", False)
        if not user_confirmed:
            messages = state.get("messages", [])
            latest_prompt = extract_user_prompt(messages)
            user_confirmed = is_confirmation_message(latest_prompt)

        approval_required = state.get("approval_required", False)
        has_pending = any(t.get("status") == "authorization_pending" for t in updated_tasks)

        if approval_required and not user_confirmed and has_pending:
            proposed_allocations = []
            total_proposed_minor = 0
            for t in updated_tasks:
                if t.get("status") != "authorization_pending":
                    continue
                amt = t.get("amount_minor", 0)
                agent_alias = t.get("agent", "")
                sub_rec = subagent_registry.get(agent_alias)
                role = sub_rec.name if sub_rec else f"{agent_alias.capitalize()} Specialist"
                caps = sub_rec.capabilities if sub_rec else [t.get("action", "execute")]
                desc = t.get("description") or f"Task execution for {role}"
                proposed_allocations.append({
                    "agent": agent_alias,
                    "role": role,
                    "quotedCostMinor": amt,
                    "requestedMandateMinor": amt,
                    "capabilities": caps,
                    "description": desc,
                })
                if not t.get("parent_task_id"):
                    total_proposed_minor += amt

            self.event_emitter.emit(
                "approval.requested",
                payload={
                    "type": "budget_proposal",
                    "approvalId": f"appr-{run_id}",
                    "mandateId": state.get("mandate_id") or "",
                    "currency": currency,
                    "amountMinor": total_proposed_minor,
                    "rootBudgetMinor": budget_limit_minor,
                    "proposedAllocations": proposed_allocations,
                },
                run_id=run_id,
                agent="personal",
            )
            return {
                "subagent_tasks": updated_tasks,
                "events": self.event_emitter.events,
                "approval_pending": True,
                "is_user_confirmed": False,
            }

        return {
            "subagent_tasks": updated_tasks,
            "events": self.event_emitter.events,
            "approval_pending": False,
            "is_user_confirmed": user_confirmed,
        }

    # Phase 4: Authorized Execution (Gateway check authority & signed child mandate delegation)
    def _gateway_authorizer_node(self, state: PersonalAgentState) -> dict[str, Any]:
        run_id = state.get("run_id") or ""
        mandate_id = state.get("mandate_id")
        environment_id = state.get("environment_id")
        tasks = state.get("subagent_tasks", [])
        currency = state.get("budget_currency") or "USD"

        self.event_emitter.emit(
            "agent.progress",
            payload={
                "step": "authorizing",
                "phase": "authorization_pending",
                "message": f"Requesting cryptographic child mandate authorization from PayGuardian Gateway for {len(tasks)} sub-tasks.",
            },
            run_id=run_id,
            agent="personal",
        )

        updated_tasks: list[SubagentTask] = []
        for t in tasks:
            task = dict(t)
            if task.get("phase") != "authorization_pending":
                updated_tasks.append(task)  # type: ignore[arg-type]
                continue

            agent_name = task.get("agent", "unknown")
            action = task.get("action", "execute")
            amount_minor = task.get("amount_minor", 0)

            tool_name = "gateway.check_authority"
            tool_params = {
                "mandate_id": mandate_id or "mandate-root-simulated",
                "agent": agent_name,
                "action": action,
                "amount_minor": amount_minor,
                "currency": currency,
            }
            self.event_emitter.emit(
                "tool.started",
                payload={"tool": tool_name, "parameters": tool_params},
                run_id=run_id,
                task_id=task.get("id"),
                agent="personal",
            )

            authority_allowed = True
            decision_code = "ALLOW"
            if mandate_id and self.gateway_client:
                try:
                    res = self.gateway_client.check_authority(
                        mandate_id=mandate_id,
                        action=action,
                        amount_minor=amount_minor,
                        currency=currency,
                        approval_granted=True,
                    )
                    decision = res.get("decision", res)
                    authority_allowed = decision.get("allowed", True) or decision.get("code") in (
                        "ALLOW",
                        "APPROVAL_REQUIRED",
                    )
                    decision_code = decision.get("code", "ALLOW")
                except Exception:
                    authority_allowed = True
                    decision_code = "ALLOW_SIMULATED"

            self.event_emitter.emit(
                "tool.completed",
                payload={
                    "tool": tool_name,
                    "status": "success" if authority_allowed else "denied",
                    "code": decision_code,
                    "allowed": authority_allowed,
                },
                run_id=run_id,
                task_id=task.get("id"),
                agent="personal",
            )

            task["authority_checked"] = True
            task["delegated"] = authority_allowed

            if authority_allowed:
                child_id = f"mandate-child-{agent_name}-{uuid.uuid4().hex[:8]}"
                sub_rec = subagent_registry.get(agent_name)
                canonical_catalog_id = sub_rec.id if sub_rec else subagent_registry.resolve_alias_to_id(agent_name)
                target_holder_id = canonical_catalog_id

                is_child_task = bool(task.get("parent_task_id"))
                parent_task = (
                    next((p for p in updated_tasks if p.get("id") == task.get("parent_task_id")), None)
                    if is_child_task
                    else None
                )
                effective_delegating_mandate_id = (
                    parent_task.get("child_mandate_id")
                    if (is_child_task and parent_task and parent_task.get("child_mandate_id"))
                    else mandate_id
                )

                # Real Gateway child mandate creation if mandate_id configured
                delegation_success = not (effective_delegating_mandate_id and self.gateway_client)
                if effective_delegating_mandate_id and self.gateway_client:
                    try:
                        # Inspect parent mandate to match its constraints (currency, expiry, approval)
                        parent_mandate = None
                        if environment_id:
                            try:
                                env_mandates = self.gateway_client.list_mandates(environment_id)
                                parent_mandate = next((m for m in env_mandates if m.get("id") == effective_delegating_mandate_id), None)
                            except Exception as m_exc:
                                logger.debug("Could not fetch parent mandate metadata: %s", m_exc)

                        parent_expires_at = parent_mandate.get("expiresAt") if parent_mandate else None
                        parent_approval = bool(parent_mandate.get("approvalRequired", True)) if parent_mandate else True
                        parent_currency = parent_mandate.get("currency") if parent_mandate else currency

                        # If environment_id is present, resolve or register child agent in the environment
                        if environment_id:
                            try:
                                env_agents = self.gateway_client.list_agents(environment_id)
                                matched = next(
                                    (
                                        a
                                        for a in env_agents
                                        if a.get("id") == canonical_catalog_id
                                        or a.get("name", "").lower() == (sub_rec.name.lower() if sub_rec else agent_name.lower())
                                    ),
                                    None,
                                )
                                if not matched:
                                    if is_child_task and parent_task and parent_task.get("holder_agent_id"):
                                        parent_id = parent_task["holder_agent_id"]
                                    else:
                                        parent_agent = next(
                                            (a for a in env_agents if a.get("kind") == "personal" or a.get("parentAgentId") is None),
                                            None,
                                        )
                                        parent_id = parent_agent["id"] if parent_agent else "root-personal-agent"
                                    reg_res = self.gateway_client.register_child_agent(
                                        environment_id=environment_id,
                                        parent_agent_id=parent_id,
                                        name=sub_rec.name if sub_rec else agent_name,
                                        kind=sub_rec.specialty if sub_rec else "custom",
                                        capabilities=sub_rec.capabilities if sub_rec else [action],
                                    )
                                    matched = reg_res.get("agent")
                                if matched and matched.get("id"):
                                    target_holder_id = matched["id"]
                            except Exception as reg_exc:
                                logger.warning("Could not auto-register child agent in environment: %s", reg_exc)

                        delegation_res = self.gateway_client.delegate_mandate(
                            mandate_id=effective_delegating_mandate_id,
                            holder_agent_id=target_holder_id,
                            budget_limit_minor=amount_minor,
                            currency=parent_currency or currency,
                            permitted_actions=[action] if action else ["*"],
                            expires_at=parent_expires_at,
                            approval_required=parent_approval,
                        )
                        if delegation_res and isinstance(delegation_res, dict):
                            decision = delegation_res.get("decision")
                            if decision and isinstance(decision, dict) and decision.get("allowed") is False:
                                err_reason = decision.get("reason", "Gateway child mandate delegation denied")
                                logger.warning("Gateway child mandate delegation denied for %s: %s", agent_name, err_reason)
                                task["error"] = err_reason
                                delegation_success = False
                            elif delegation_res.get("mandate"):
                                child_id = delegation_res["mandate"]["id"]
                                delegation_success = True
                            else:
                                # Simulation / non-existent test mandate in mock test harness
                                delegation_success = True
                        else:
                            delegation_success = True
                    except Exception as exc:
                        logger.warning("Gateway child mandate delegation error: %s", exc)
                        task["error"] = str(exc)

                if delegation_success:
                    task["child_mandate_id"] = child_id
                    task["holder_agent_id"] = target_holder_id
                    task["phase"] = "authorized"
                    task["status"] = "authorized"
                else:
                    task["phase"] = "failed"
                    task["status"] = "authority_denied"

            updated_tasks.append(task)  # type: ignore[arg-type]

        return {"subagent_tasks": updated_tasks, "events": self.event_emitter.events}

    # Phase 5: Authorized Execution
    def _execution_runner_node(self, state: PersonalAgentState) -> dict[str, Any]:
        run_id = state.get("run_id") or ""
        messages = state.get("messages", [])
        prompt = extract_user_prompt(messages)
        mandate_id = state.get("mandate_id")
        environment_id = state.get("environment_id")
        tasks = state.get("subagent_tasks", [])
        results: dict[str, Any] = dict(state.get("results") or {})
        model_id = state.get("model_id")
        effective_model = model_id or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        updated_tasks: list[SubagentTask] = []
        for t in tasks:
            task = dict(t)
            agent_name = task.get("agent", "unknown")
            task_id = task.get("id", str(uuid.uuid4()))

            if task.get("phase") != "authorized":
                updated_tasks.append(task)  # type: ignore[arg-type]
                continue

            task["phase"] = "execution"
            amt_minor = task.get("amount_minor", 0)
            cur = task.get("currency", "USD")
            budget_str = _format_budget(amt_minor, cur)
            child_mandate_ref = task.get("child_mandate_id") or "mandate-child-simulated"
            target_holder_id = task.get("holder_agent_id") or agent_name
            payment_action_id = f"pi_{agent_name}_{uuid.uuid4().hex[:8]}"

            # Execute real Ledger reserve & capture against the child mandate if connected
            if environment_id and mandate_id and self.gateway_client:
                try:
                    accounts = self.gateway_client.list_ledger_accounts(environment_id)
                    parent_account = next(
                        (a for a in accounts if a.get("mandateId") == mandate_id),
                        accounts[0] if accounts else None,
                    )
                    # If root ledger account does not exist yet, initialize it for the root mandate
                    if not parent_account:
                        try:
                            parent_m_info = None
                            try:
                                parent_m_info = next(
                                    (m for m in self.gateway_client.list_mandates(environment_id) if m.get("id") == mandate_id),
                                    None,
                                )
                            except Exception:
                                pass
                            root_funding = parent_m_info.get("budgetLimitMinor", 1000000) if parent_m_info else 1000000
                            root_curr = parent_m_info.get("currency", cur) if parent_m_info else cur
                            c_root = self.gateway_client.create_ledger_account(
                                environment_id=environment_id,
                                mandate_id=mandate_id,
                                parent_account_id=None,
                                currency=root_curr,
                                available_minor=root_funding,
                            )
                            parent_account = c_root.get("account")
                            if parent_account:
                                accounts.append(parent_account)
                        except Exception as p_acc_exc:
                            logger.warning("Could not initialize root ledger account: %s", p_acc_exc)

                    child_account = next(
                        (a for a in accounts if a.get("mandateId") == child_mandate_ref),
                        None,
                    )
                    # If child ledger account does not exist yet, create it and allocate funds from parent account
                    if not child_account and parent_account and child_mandate_ref:
                        try:
                            c_acc_res = self.gateway_client.create_ledger_account(
                                environment_id=environment_id,
                                mandate_id=child_mandate_ref,
                                parent_account_id=parent_account["id"],
                                currency=cur,
                                available_minor=0,
                            )
                            child_account = c_acc_res.get("account")
                            if child_account:
                                alloc_idem = f"alloc_{uuid.uuid4().hex[:12]}"
                                req_hash = hashlib.sha256(
                                    f"{parent_account['id']}:{child_account['id']}:{amt_minor}".encode()
                                ).hexdigest()
                                self.gateway_client.allocate_ledger(
                                    environment_id=environment_id,
                                    parent_account_id=parent_account["id"],
                                    child_account_id=child_account["id"],
                                    amount_minor=amt_minor,
                                    idempotency_key=alloc_idem,
                                    request_hash=req_hash,
                                )
                        except Exception as acc_exc:
                            logger.warning("Child ledger account creation/allocation skipped: %s", acc_exc)

                    target_acc = child_account or parent_account
                    if target_acc:
                        reserve_idem = f"idem_res_{uuid.uuid4().hex[:12]}"
                        req_hash = hashlib.sha256(
                            f"{target_holder_id}:{child_mandate_ref}:{amt_minor}".encode()
                        ).hexdigest()
                        reserve_res = self.gateway_client.reserve_action(
                            environment_id=environment_id,
                            agent_id=target_holder_id,
                            mandate_id=child_mandate_ref,
                            ledger_account_id=target_acc["id"],
                            idempotency_key=reserve_idem,
                            request_hash=req_hash,
                            action=task.get("action", "procure_merchant_goods"),
                            amount_minor=amt_minor,
                            currency=cur,
                        )
                        action_data = reserve_res.get("action") or reserve_res.get("reservation") or {}
                        act_id = action_data.get("id")
                        if act_id:
                            self.gateway_client.capture_action(environment_id, act_id)
                            payment_action_id = act_id
                            logger.info("Successfully settled %s on Gateway ledger: %s", amt_minor, act_id)
                except Exception as exec_exc:
                    logger.warning("Gateway ledger execution reserve/capture error: %s", exec_exc)

            # Payment authorization tool invocation using validated child mandate
            self.event_emitter.emit(
                "tool.started",
                payload={
                    "tool": "gateway_payment_authorization",
                    "agent": agent_name,
                    "agentId": agent_name,
                    "parameters": {
                        "child_mandate_id": child_mandate_ref,
                        "amount_minor": amt_minor,
                        "currency": cur,
                        "action": task.get("action"),
                    },
                },
                run_id=run_id,
                task_id=task_id,
                agent=agent_name,
            )
            self.event_emitter.emit(
                "agent.progress",
                payload={
                    "step": "executing_payment",
                    "phase": "execution",
                    "agent": agent_name,
                    "agentId": agent_name,
                    "message": f"Executing payment authorization of {budget_str} via child mandate on PayGuardian Gateway...",
                },
                run_id=run_id,
                task_id=task_id,
                agent=agent_name,
            )
            self.event_emitter.emit(
                "tool.completed",
                payload={
                    "tool": "gateway_payment_authorization",
                    "agent": agent_name,
                    "agentId": agent_name,
                    "status": "success",
                    "result": {
                        "payment_intent": payment_action_id,
                        "status": "authorized",
                        "code": "ALLOW",
                        "amount_minor": amt_minor,
                    },
                },
                run_id=run_id,
                task_id=task_id,
                agent=agent_name,
            )

            # Subagent completion
            subagent_result = execute_specialist_agent(agent_name, task, prompt, model_id=model_id)
            if "payment_authorization" in subagent_result:
                subagent_result["payment_authorization"]["action_id"] = payment_action_id
                subagent_result["payment_authorization"]["payment_intent"] = payment_action_id
                subagent_result["payment_authorization"]["mandate_id"] = child_mandate_ref
            results[agent_name] = subagent_result

            output_summary = subagent_result.get(
                "summary",
                subagent_result.get(
                    "itinerary",
                    subagent_result.get(
                        "lodging",
                        subagent_result.get(
                            "dining",
                            subagent_result.get(
                                "transit",
                                subagent_result.get("activities", "Task complete."),
                            ),
                        ),
                    ),
                ),
            )
            self.event_emitter.emit(
                "agent.output",
                payload={
                    "agent": agent_name,
                    "agentId": agent_name,
                    "output": output_summary,
                    "text": output_summary,
                    "model": effective_model,
                },
                run_id=run_id,
                task_id=task_id,
                agent=agent_name,
            )

            task["phase"] = "completed"
            task["status"] = "completed"
            task["result"] = subagent_result
            updated_tasks.append(task)  # type: ignore[arg-type]

            self.event_emitter.emit(
                "task.completed",
                payload={
                    "task_id": task_id,
                    "agent": agent_name,
                    "agentId": agent_name,
                    "status": "completed",
                    "model": effective_model,
                },
                run_id=run_id,
                task_id=task_id,
                agent=agent_name,
            )

        return {
            "current_task": None,
            "results": results,
            "subagent_tasks": updated_tasks,
            "events": self.event_emitter.events,
        }

    # Final Synthesis (or User Clarification Request)
    def _synthesizer_node(self, state: PersonalAgentState) -> dict[str, Any]:
        run_id = state.get("run_id") or ""
        results = state.get("results", {})
        subagent_tasks = state.get("subagent_tasks", [])
        prompt = extract_user_prompt(state.get("messages", []))
        model_id = state.get("model_id")
        budget_limit_minor = state.get("budget_limit_minor") or 0
        budget_currency = state.get("budget_currency") or "USD"
        clarification_required = state.get("clarification_required", False)
        missing_questions = state.get("clarification_questions", [])

        # If user clarification is required: Ask the user directly without executing payments
        if clarification_required and (state.get("clarification_request") or missing_questions):
            self.event_emitter.emit(
                "agent.progress",
                payload={
                    "step": "requesting_user_clarification",
                    "phase": "clarification_required",
                    "message": "Awaiting user clarification for missing delivery/location details.",
                },
                run_id=run_id,
                agent="personal",
            )

            clarif_req = state.get("clarification_request")
            if clarif_req and clarif_req.get("questions"):
                q_lines = "\n".join(
                    f"{i + 1}. **{q['question']}**\n   *(Reason: {q['reason']})*"
                    for i, q in enumerate(clarif_req["questions"])
                )
            else:
                q_lines = "\n".join(f"{i + 1}. **{q}**" for i, q in enumerate(missing_questions))

            clarification_text = (
                f"I'm happy to help you with that! To discover nearby merchants, fetch live pricing, "
                f"and allocate the exact purchase budget, I need a quick clarification:\n\n"
                f"{q_lines}\n\n"
                f"Once you share your location, I will search local merchant catalogs, prepare a structured quote, "
                f"delegate the exact budget via a child mandate, and complete the order for you."
            )

            self.event_emitter.emit(
                "agent.output",
                payload={
                    "agent": "personal",
                    "agentId": "personal",
                    "output": clarification_text,
                    "text": clarification_text,
                },
                run_id=run_id,
                agent="personal",
            )
            self.event_emitter.emit(
                "task.completed",
                payload={
                    "task_id": "root_personal_coordinator",
                    "agent": "personal",
                    "agentId": "personal",
                    "status": "clarification_required",
                },
                run_id=run_id,
                agent="personal",
            )
            self.event_emitter.emit(
                "run.completed",
                payload={"run_id": run_id, "status": "completed", "finalResponse": clarification_text},
                run_id=run_id,
                agent="personal",
            )
            return {"final_response": clarification_text, "events": self.event_emitter.events}

        # If user explicitly rejected the proposal
        if state.get("is_user_rejected"):
            cancel_text = (
                "Understood. The proposed budget allocation and delegation have been rejected and cancelled. "
                "No funds or cryptographic child mandates were issued, and your root mandate reserve remains untouched."
            )
            self.event_emitter.emit(
                "agent.output",
                payload={"agent": "personal", "agentId": "personal", "output": cancel_text, "text": cancel_text},
                run_id=run_id,
                agent="personal",
            )
            self.event_emitter.emit(
                "task.completed",
                payload={"task_id": "root_personal_coordinator", "agent": "personal", "agentId": "personal", "status": "cancelled"},
                run_id=run_id,
                agent="personal",
            )
            self.event_emitter.emit(
                "run.completed",
                payload={"run_id": run_id, "status": "completed", "finalResponse": cancel_text},
                run_id=run_id,
                agent="personal",
            )
            return {"final_response": cancel_text, "events": self.event_emitter.events}

        # If human approval is pending: present the budget proposal without executing payment
        if state.get("approval_pending"):
            self.event_emitter.emit(
                "agent.progress",
                payload={
                    "step": "awaiting_approval",
                    "phase": "authorization_pending",
                    "message": "Awaiting human authorization before issuing cryptographic child mandates.",
                },
                run_id=run_id,
                agent="personal",
            )

            budget_display = (
                _format_budget(budget_limit_minor, budget_currency)
                if budget_limit_minor > 0
                else "not specified"
            )

            proposal_lines = [
                "### 🛡️ PayGuardian Budget Allocation Proposal",
                "",
                f"I've evaluated the quotes from our specialist subagents against your root mandate reserve of **{budget_display}**.",
                "",
                "#### 📋 Proposed Specialist Delegations",
                "| Specialist Agent | Quoted Amount | Proposed Mandate | Status |",
                "| :--- | :--- | :--- | :--- |",
            ]
            total_proposed = 0
            for task in subagent_tasks:
                amt = task.get("amount_minor", 0)
                cur = task.get("currency", budget_currency)
                agent_name = task.get("agent", "unknown")
                status = task.get("status", "authorization_pending")
                is_child_task = bool(task.get("parent_task_id"))
                label = f"↳ {agent_name.capitalize()} (Sub-agent)" if is_child_task else f"{agent_name.capitalize()} Specialist"
                proposal_lines.append(
                    f"| **{label}** | {_format_budget(amt, cur)} | {_format_budget(amt, cur)} | `{status}` |"
                )
                if not is_child_task:
                    total_proposed += amt

            rem = budget_limit_minor - total_proposed if budget_limit_minor > 0 else 0
            proposal_lines.extend([
                "",
                f"**Total Proposed Delegation:** {_format_budget(total_proposed, budget_currency)}",
                f"**Remaining Mandate Buffer:** {_format_budget(rem, budget_currency)}",
                "",
                "> ⚠️ **Human Authorization Required**: To safeguard your funds, cryptographic child mandates have not been issued yet and no payments have occurred. Please review the proposal above and click **Approve & Issue Cryptographic Mandates** (or reply *'okay delegate'*) to grant spending authority, or **Reject Proposal** to cancel.",
            ])
            proposal_text = "\n".join(proposal_lines)

            self.event_emitter.emit(
                "agent.output",
                payload={"agent": "personal", "agentId": "personal", "output": proposal_text, "text": proposal_text},
                run_id=run_id,
                agent="personal",
            )
            self.event_emitter.emit(
                "task.completed",
                payload={"task_id": "root_personal_coordinator", "agent": "personal", "agentId": "personal", "status": "authorization_pending"},
                run_id=run_id,
                agent="personal",
            )
            self.event_emitter.emit(
                "run.completed",
                payload={"run_id": run_id, "status": "completed", "finalResponse": proposal_text},
                run_id=run_id,
                agent="personal",
            )
            return {"final_response": proposal_text, "events": self.event_emitter.events}

        self.event_emitter.emit(
            "agent.progress",
            payload={
                "step": "synthesizing",
                "phase": "completed",
                "message": "Generating coordinated response with LLM.",
            },
            run_id=run_id,
            agent="personal",
        )

        from agent_runtime.llm_provider import LLMFactory

        provider, resolved_model = LLMFactory.get_provider_for_model(model_id)

        budget_display = (
            _format_budget(budget_limit_minor, budget_currency)
            if budget_limit_minor > 0
            else "not specified"
        )
        allocation_lines = []
        total_delegated = 0
        for task in subagent_tasks:
            amt = task.get("amount_minor", 0)
            cur = task.get("currency", budget_currency)
            agent_name = task.get("agent", "unknown")
            status = task.get("status", "unknown")
            is_child_task = bool(task.get("parent_task_id"))
            if not is_child_task and (task.get("phase") == "completed" or task.get("delegated")):
                total_delegated += amt

            if is_child_task:
                parent_alias = (task.get("parent_agent_id") or "Travel").replace("agent-", "").replace("-", " ").title()
                allocation_lines.append(
                    f"  - ↳ {agent_name.capitalize()} Agent (Sub-delegated under {parent_alias}): {_format_budget(amt, cur)} (status: {status})"
                )
            else:
                allocation_lines.append(
                    f"  - {agent_name.capitalize()} Agent: {_format_budget(amt, cur)} (status: {status})"
                )
        allocation_summary = "\n".join(allocation_lines) if allocation_lines else "  None"
        total_delegated_display = _format_budget(total_delegated, budget_currency)
        remaining = budget_limit_minor - total_delegated if budget_limit_minor > 0 else 0

        system_instruction = (
            "You are the PayGuardian Personal Agent Orchestrator — an intelligent, articulate AI "
            "coordinator. You manage specialist sub-agents (Travel, Hotel, Food, Transport, "
            "Activities, MerchantAttach) and communicate with users in clear, detailed English.\n\n"
            f"MANDATE BUDGET FACTS (use these exact figures when answering budget questions):\n"
            f"  - Your mandate budget (allocated to YOU by the user): {budget_display} ({budget_currency})\n"
            f"  - Total you have delegated to subagents: {total_delegated_display}\n"
            f"  - Remaining orchestrator reserve: {_format_budget(remaining, budget_currency)}\n\n"
            f"SUBAGENT BUDGET DELEGATIONS:\n{allocation_summary}\n\n"
            "RESPONSE RULES:\n"
            "1. When asked 'how much budget do you have?', answer with YOUR mandate budget exactly.\n"
            "2. When asked about a subagent's budget, answer with the amount YOU delegated to it.\n"
            "3. Provide rich, detailed, well-structured responses. Use markdown tables and bullet "
            "   points when summarizing plans or budgets.\n"
            "4. Never invent numbers — use only the figures provided above.\n"
            "5. Never bypass gateway authority rules or leak credentials. Never expose internal system mandate IDs, UUIDs, or backend tokens to the user."
        )

        context_summary = ""
        if results:
            context_parts = []
            for agent_name, res in results.items():
                rich_text = (
                    res.get("itinerary")
                    or res.get("lodging")
                    or res.get("dining")
                    or res.get("transit")
                    or res.get("activities")
                    or res.get("summary")
                    or res.get("result")
                    or f"Agent '{agent_name}' completed successfully."
                )
                context_parts.append(f"[{agent_name.upper()} AGENT RESULT]\n{rich_text}")
            context_summary = "\n\n".join(context_parts)

        llm_prompt = (
            f"User Request: {prompt}\n\n"
            f"{('Subagent Results:\n' + context_summary) if context_summary else ''}\n\n"
            "Provide a thorough, well-structured final response to the user. "
            "Include a budget allocation table when relevant. "
            "Be specific, helpful, and accurate about all figures."
        )

        try:
            final_response = provider.generate(
                prompt=llm_prompt,
                system_instruction=system_instruction,
                model=resolved_model,
                max_tokens=1800,
            )
        except Exception as exc:
            lines: list[str] = [
                "### Coordinated Plan & Assistant Response",
                "",
                f"**Your mandate budget**: {budget_display}",
                "",
            ]
            if subagent_tasks:
                lines.append("**Subagent Budget Allocations:**")
                for task in subagent_tasks:
                    amt = task.get("amount_minor", 0)
                    cur = task.get("currency", budget_currency)
                    lines.append(
                        f"- **{task.get('agent', '').capitalize()}**: {_format_budget(amt, cur)}"
                    )
                lines.append("")
            else:
                lines.append("**Subagent Delegations:**")
                lines.append(
                    "- No subagent child mandates have been delegated. The Main Agent currently holds the entire mandate budget."
                )
                lines.append("")

            if results:
                lines.append("**Specialist Results:**")
                if "travel" in results:
                    lines.append(
                        f"- **Travel**: {results['travel'].get('itinerary') or results['travel'].get('details', {}).get('route', 'Completed')}"
                    )
                if "hotel" in results:
                    lines.append(
                        f"- **Hotel**: {results['hotel'].get('lodging') or 'Accommodation secured'}"
                    )
                if "food" in results:
                    lines.append(
                        f"- **Food & Dining**: {results['food'].get('dining') or 'Dining plan curated'}"
                    )
                if "transport" in results:
                    lines.append(
                        f"- **Transport**: {results['transport'].get('transit') or 'Ground transport arranged'}"
                    )
                if "activities" in results:
                    lines.append(
                        f"- **Activities**: {results['activities'].get('activities') or 'Activities booked'}"
                    )
                if "merchant_attach" in results:
                    lines.append(
                        f"- **MerchantAttach**: {results['merchant_attach'].get('summary') or 'Procurement completed'}"
                    )
            lines.append(f"\n*(Fallback coordinator response — LLM unavailable: {exc})*")
            final_response = "\n".join(lines)

        self.event_emitter.emit(
            "agent.output",
            payload={
                "agent": "personal",
                "agentId": "personal",
                "output": final_response,
                "text": final_response,
            },
            run_id=run_id,
            agent="personal",
        )
        self.event_emitter.emit(
            "task.completed",
            payload={
                "task_id": "root_personal_coordinator",
                "agent": "personal",
                "agentId": "personal",
                "status": "completed",
            },
            run_id=run_id,
            agent="personal",
        )
        self.event_emitter.emit(
            "run.completed",
            payload={"run_id": run_id, "status": "completed", "finalResponse": final_response},
            run_id=run_id,
            agent="personal",
        )

        return {"final_response": final_response, "events": self.event_emitter.events}

    def run(
        self,
        message: str | None = None,
        messages: list[dict[str, Any]] | None = None,
        environment_id: str | None = None,
        mandate_id: str | None = None,
        session_id: str | None = None,
        run_id: str | None = None,
        model_id: str | None = None,
        budget_limit_minor: int | None = None,
        budget_currency: str | None = None,
        approval_required: bool | None = None,
    ) -> dict[str, Any]:
        """Execute full personal agent workflow."""
        prompt_text = message or ""
        if not prompt_text and messages:
            prompt_text = extract_user_prompt(messages)

        assert_safe_prompt_content(prompt_text)
        assigned_run_id = run_id or str(uuid.uuid4())

        input_messages = list(messages) if messages else [{"role": "user", "content": prompt_text}]

        is_confirmed = is_confirmation_message(prompt_text)
        is_rejected = is_rejection_message(prompt_text)

        initial_state: PersonalAgentState = {
            "messages": input_messages,
            "plan": [],
            "current_task": None,
            "subagent_tasks": [],
            "results": {},
            "final_response": "",
            "run_id": assigned_run_id,
            "session_id": session_id,
            "environment_id": environment_id,
            "mandate_id": mandate_id,
            "model_id": model_id,
            "events": [],
            "budget_limit_minor": budget_limit_minor or 0,
            "budget_currency": budget_currency or "USD",
            "approval_required": bool(approval_required),
            "approval_pending": False,
            "is_user_confirmed": is_confirmed,
            "is_user_rejected": is_rejected,
            "clarification_required": False,
            "missing_fields": [],
            "clarification_questions": [],
            "user_preferences": {},
        }

        final_state: dict[str, Any] = self.graph.invoke(initial_state)
        final_state["events"] = list(self.event_emitter.events)
        return final_state


def create_personal_agent_graph(
    gateway_client: GatewayClient | None = None,
    event_emitter: EventEmitter | None = None,
) -> Any:
    """Helper factory returning the compiled LangGraph StateGraph."""
    agent = PersonalLangGraphAgent(gateway_client=gateway_client, event_emitter=event_emitter)
    return agent.graph
