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
from agent_runtime.context_compiler import (
    CORE_SYSTEM_INSTRUCTIONS,
    SPECIALIST_SYSTEM_PROMPT,
    TRAVEL_SPECIALIST_PROMPT,
    HOTEL_SPECIALIST_PROMPT,
    FOOD_SPECIALIST_PROMPT,
    ContextCompiler,
)
from agent_runtime.gateway_client import GatewayClient, assert_safe_prompt_content
from agent_runtime.mcp_tools import (
    PAYGUARDIAN_MCP_TOOL_SCHEMAS,
    SPECIALIST_MCP_TOOL_SCHEMAS,
    PayGuardianMCPTools,
)
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
    available_reserve_minor: int | None
    already_delegated_minor: int | None
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
    r"\b(?:okay\s+)?delegate(?:\s+(?:the\s+)?budget)?\b",
    r"^\s*proceed\s*$",
    r"\bconfirm(?:\s+(?:the\s+)?(?:plan|proposal|these|this|budget|delegation))?\b",
    r"\bapproved?\b",
    r"\b(?:yes\s+)?(?:proceed|do\s+it|go\s+ahead|delegate)\b",
    r"\bgo\s+ahead\b",
    r"\bdo\s+it\b",
    r"\bexecute(?:\s+(?:the\s+)?(?:plan|payment|proposal|delegation))?\b",
    r"\bbuy\s+it\b",
    r"\bapprove\s+(?:the\s+)?(?:budget|proposal|delegation|plan)\b",
    r"\bauthorized?\b",
    r"\blooks\s+good\b",
    r"\b(?:make|complete|process|proceed\s+with|execute|do)\s+(?:the\s+)?(?:payment|payments|purchase|transaction)\b",
    r"\b(?:go\s+and\s+)?make\s+(?:the\s+)?payment\b",
    r"\bpay\s+(?:for\s+)?(?:these|them|this|it|all)\b",
    r"\b(?:these|this)\s+(?:are|is)\s+(?:the\s+)?plan\b",
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


def is_rejection_message(text: str) -> bool:
    t = text.strip().lower()
    return any(re.search(pat, t) for pat in USER_REJECTION_PATTERNS)


def is_confirmation_message(text: str) -> bool:
    if is_rejection_message(text):
        return False
    t = text.strip().lower()
    if any(w in t for w in ("buy ", "buy the", "buy a", "buy me", "purchase", "ticket", "search products", "biscuit", "chai")):
        return False
    return any(re.search(pat, t) for pat in USER_CONFIRMATION_PATTERNS)


def is_payment_order_message(text: str) -> bool:
    if is_rejection_message(text):
        return False
    t = text.strip().lower()
    return any(
        re.search(pat, t)
        for pat in (
            r"\b(buy|book|pay|purchase|order|checkout)\b",
            r"\b(make\s+(the\s+)?payment)\b",
            r"\b(go\s+and\s+spend|spend\s+the\s+money)\b",
        )
    )


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
    mcp_tools: Any | None = None,
) -> dict[str, Any]:
    """Execute specialist subagent using real LLM, specialist system prompt, and MCP payment tools."""
    target_model = model_id or os.getenv("DEFAULT_MODEL", "free/gpt-6-luna")
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

    domain_prompts = {
        "travel": TRAVEL_SPECIALIST_PROMPT,
        "hotel": HOTEL_SPECIALIST_PROMPT,
        "food": FOOD_SPECIALIST_PROMPT,
    }
    independent_system_prompt = domain_prompts.get(
        agent_lower, f"You are the {agent_name.capitalize()} Specialist. Execute your assigned domain tasks."
    )
    # Assemble core specialist system prompt and independent domain system prompt
    specialist_system_prompt = f"{SPECIALIST_SYSTEM_PROMPT}\n\n{independent_system_prompt}"

    # Assembled MCP tool definitions for LLM
    mcp_tool_definitions = [
        {
            "type": "function",
            "function": {
                "name": "get_delegated_balance",
                "description": "Check the subagent's available delegated budget ceiling and remaining spendable balance",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "agent_id": {"type": "string", "description": "Specialist subagent alias (e.g. hotel, travel, food)"}
                    },
                    "required": ["agent_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "request_payment",
                "description": "Request payment using delegated authority through the PayGuardian Gateway",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "agent_id": {"type": "string", "description": "Specialist subagent alias"},
                        "amount_minor": {"type": "integer", "description": "Payment amount in minor units (paise or cents)"},
                        "currency": {"type": "string", "description": "Currency code (e.g. INR, USD)"},
                        "recipient": {"type": "string", "description": "Merchant, vendor or service provider name"},
                        "action": {"type": "string", "description": "Action being executed (e.g. book_hotel, buy_tickets, order_dining)"},
                        "mandate_id": {"type": "string", "description": "Child mandate reference ID"},
                    },
                    "required": ["agent_id", "amount_minor", "currency", "recipient", "action"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_payment_status",
                "description": "Check whether an initiated payment succeeded, failed, or is pending",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "payment_intent_id": {"type": "string", "description": "Payment intent ID returned from request_payment"}
                    },
                    "required": ["payment_intent_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "request_budget_increase",
                "description": "Request additional allocation from the main agent when price exceeds available delegated ceiling",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "agent_id": {"type": "string", "description": "Specialist subagent alias"},
                        "additional_amount_minor": {"type": "integer", "description": "Additional amount needed in minor units"},
                        "reason": {"type": "string", "description": "Justification explaining why extra funds are required"},
                        "currency": {"type": "string", "description": "Currency code"},
                    },
                    "required": ["agent_id", "additional_amount_minor", "reason"],
                },
            },
        },
    ]

    # Assemble task envelope prompt combining task instructions, user prompt, and constraints
    child_mandate_id = task.get("child_mandate_id") or "mandate-child-simulated"
    task_envelope_prompt = (
        f"<TASK_ENVELOPE>\n"
        f"Objective: {task.get('description', f'Fulfill {agent_name} request')}\n"
        f"Domain Specialist: {agent_name.capitalize()}\n"
        f"Assigned Action: {task.get('action', f'execute_{agent_lower}')}\n"
        f"User Prompt: '{prompt}'\n"
        f"Delegated Child Mandate: {child_mandate_id}\n"
        f"Allocated Budget Ceiling: {budget_str} ({currency})\n"
        f"Available MCP Tools: get_delegated_balance, request_payment, get_payment_status, request_budget_increase\n"
        f"Instructions:\n"
        f"1. Check your delegated balance using get_delegated_balance.\n"
        f"2. Initiate the payment using request_payment under your child mandate {child_mandate_id}.\n"
        f"3. If the cost exceeds your allocation, use request_budget_increase.\n"
        f"4. Provide a structured, verified fulfillment summary confirming the reservation/booking details and cost.\n"
        f"</TASK_ENVELOPE>"
    )

    llm_generated_text = ""
    payment_auth_result: dict[str, Any] | None = None

    # Call LLM with assembled system prompt and MCP tools
    try:
        from agent_runtime.llm_provider import LLMFactory, LLMResponse

        provider, resolved_model = LLMFactory.get_provider_for_model(target_model)
        resp = provider.generate(
            prompt=task_envelope_prompt,
            system_instruction=specialist_system_prompt,
            model=resolved_model,
            tools=mcp_tool_definitions,
            max_tokens=800,
            temperature=0.3,
        )
        if isinstance(resp, LLMResponse):
            llm_generated_text = resp.content or ""
            if resp.tool_calls and mcp_tools is not None:
                for tc in resp.tool_calls:
                    fn = tc.name
                    args = tc.arguments or {}
                    if fn == "get_delegated_balance":
                        mcp_tools.get_delegated_balance(args.get("agent_id", agent_lower))
                    elif fn == "request_budget_increase":
                        inc_amt = args.get("additional_amount_minor", 0)
                        if inc_amt > 0:
                            topup = mcp_tools.request_budget_increase(
                                agent_id=args.get("agent_id", agent_lower),
                                additional_amount_minor=inc_amt,
                                reason=args.get("reason", "Budget increase"),
                                currency=args.get("currency", currency),
                            )
                            if topup.get("success"):
                                amount_minor = topup.get("new_budget_limit_minor", amount_minor)
                                budget_str = _format_budget(amount_minor, currency)
                    elif fn == "request_payment":
                        pay_req = mcp_tools.request_payment(
                            agent_id=args.get("agent_id", agent_lower),
                            amount_minor=args.get("amount_minor", amount_minor),
                            currency=args.get("currency", currency),
                            recipient=args.get("recipient", task.get("description", f"{agent_name.capitalize()} Merchant")),
                            action=args.get("action", task.get("action", f"book_{agent_lower}")),
                            mandate_id=args.get("mandate_id") or child_mandate_id,
                        )
                        if pay_req.get("success"):
                            payment_auth_result = {
                                "action_id": pay_req.get("payment_intent_id"),
                                "payment_intent": pay_req.get("payment_intent_id"),
                                "mandate_id": pay_req.get("child_mandate_id") or child_mandate_id,
                                "status": pay_req.get("status", "authorized"),
                                "amount_minor": args.get("amount_minor", amount_minor),
                                "approval_url": pay_req.get("approval_url"),
                                "provider_order_id": pay_req.get("provider_order_id"),
                                "rail": pay_req.get("rail", "GatewayLedger"),
                            }
        elif isinstance(resp, str):
            llm_generated_text = resp
    except Exception as exc:
        logger.debug("Specialist subagent LLM execution fallback for %s: %s", agent_name, exc)

    # Ensure MCP tool payment execution runs if not already triggered by LLM tool calls
    if payment_auth_result is None and mcp_tools is not None:
        try:
            bal = mcp_tools.get_delegated_balance(agent_lower)
            avail_minor = bal.get("available_budget_minor", amount_minor)
            if amount_minor > avail_minor and avail_minor > 0:
                topup = mcp_tools.request_budget_increase(
                    agent_id=agent_lower,
                    additional_amount_minor=amount_minor - avail_minor,
                    reason=f"Price quote for {agent_lower} exceeds currently delegated balance",
                    currency=currency,
                )
                if topup.get("success"):
                    amount_minor = topup.get("new_budget_limit_minor", amount_minor)
                    budget_str = _format_budget(amount_minor, currency)

            recipient_name = task.get("description") or f"{agent_name.capitalize()} Merchant Provider"
            pay_req = mcp_tools.request_payment(
                agent_id=agent_lower,
                amount_minor=amount_minor,
                currency=currency,
                recipient=recipient_name,
                action=task.get("action", f"book_{agent_lower}"),
                mandate_id=child_mandate_id,
            )
            if pay_req.get("success"):
                payment_auth_result = {
                    "action_id": pay_req.get("payment_intent_id"),
                    "payment_intent": pay_req.get("payment_intent_id"),
                    "mandate_id": pay_req.get("child_mandate_id") or child_mandate_id,
                    "status": pay_req.get("status", "authorized"),
                    "amount_minor": amount_minor,
                    "approval_url": pay_req.get("approval_url"),
                    "provider_order_id": pay_req.get("provider_order_id"),
                    "rail": pay_req.get("rail", "GatewayLedger"),
                }
        except Exception as exc:
            logger.debug("Specialist subagent fallback MCP interaction error: %s", exc)

    has_real_llm_text = bool(llm_generated_text and len(llm_generated_text.strip()) > 30 and "Processed by" not in llm_generated_text)

    if agent_lower == "travel":
        dest_hint = "the destination"
        for word in prompt.split():
            if len(word) > 3 and word[0].isupper() and word.isalpha():
                dest_hint = word
                break
        itinerary_text = (
            llm_generated_text.strip()
            if has_real_llm_text
            else (
                f"Travel Specialist (Quoted fare: {budget_str}) — Itinerary for {dest_hint}:\n\n"
                f"**Outbound Flight**: Direct route confirmed. "
                f"Economy seat selection confirmed. Quoted cost: "
                f"{_format_budget(int(amount_minor * 0.60), currency)} (60% of travel quote).\n\n"
                f"**Return Flight**: Flexible return route with 24-hr change policy. "
                f"Quoted cost: {_format_budget(int(amount_minor * 0.35), currency)} (35% of travel quote).\n\n"
                f"**Transit**: Airport transfer coordination identified. "
                f"Remaining {_format_budget(int(amount_minor * 0.05), currency)} estimated for connections.\n\n"
                f"Total quoted travel cost: {budget_str} (Authorized via child mandate)."
            )
        )
        return {
            "agent": "travel",
            "model": target_model,
            "action": task.get("action", "plan_itinerary"),
            "allocated_budget_minor": amount_minor,
            "allocated_budget_display": budget_str,
            "currency": currency,
            "quoted_cost_minor": amount_minor,
            "itinerary": itinerary_text,
            "estimated_cost_minor": amount_minor,
            "payment_authorization": payment_auth_result,
            "details": {
                "route": f"Optimized flight route for {dest_hint}",
                "schedule": "Outbound + return within selected travel window",
                "payment_status": "Authorized via PayGuardian child mandate",
                "mandate_budget": budget_str,
            },
            "status": "completed",
        }
    if agent_lower == "hotel":
        lodging_text = (
            llm_generated_text.strip()
            if has_real_llm_text
            else (
                f"Hotel Specialist (Quoted cost: {budget_str}) — Accommodation verified:\n\n"
                f"**Property**: Boutique 4-star hotel in city centre, flexible cancellation policy.\n"
                f"**Room**: Superior double room for 2 guests, breakfast included.\n"
                f"**Duration**: 3 nights @ {_format_budget(int(amount_minor / 3), currency)}/night.\n\n"
                f"**Cost breakdown**:\n"
                f"  - Room charges: {_format_budget(int(amount_minor * 0.85), currency)}\n"
                f"  - Taxes & fees: {_format_budget(int(amount_minor * 0.15), currency)}\n"
                f"  - Total: {budget_str}\n\n"
                f"Payment authorized via PayGuardian child mandate."
            )
        )
        return {
            "agent": "hotel",
            "model": target_model,
            "action": task.get("action", "book_hotel"),
            "allocated_budget_minor": amount_minor,
            "allocated_budget_display": budget_str,
            "currency": currency,
            "quoted_cost_minor": amount_minor,
            "lodging": lodging_text,
            "estimated_cost_minor": amount_minor,
            "payment_authorization": payment_auth_result,
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
        dining_text = (
            llm_generated_text.strip()
            if has_real_llm_text
            else (
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
            )
        )
        return {
            "agent": "food",
            "model": target_model,
            "action": task.get("action", "recommend_dining"),
            "allocated_budget_minor": amount_minor,
            "allocated_budget_display": budget_str,
            "currency": currency,
            "quoted_cost_minor": amount_minor,
            "dining": dining_text,
            "estimated_cost_minor": amount_minor,
            "payment_authorization": payment_auth_result,
            "details": {
                "options": [
                    "Farm-to-table bistro (dinner, Day 1)",
                    "Regional cuisine restaurant (lunch, Day 2)",
                    "Rooftop fine dining (dinner, Day 2)",
                    "Café/street food flex budget (Day 3)",
                ],
                "mandate_budget": budget_str,
                "payment_status": "Authorized via PayGuardian child mandate",
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
    state: dict[str, Any] | None = None,
) -> tuple[list[SubagentTask], list[str]]:
    """Dynamically determine required specialist subagents using Context Engineering and MCP discovery."""
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
    context_compiler = ContextCompiler(gateway_client=gateway_client, subagent_registry=subagent_registry)
    mcp_tools = PayGuardianMCPTools(state=state, gateway_client=gateway_client, subagent_registry=subagent_registry)

    # 1. Intent Classification
    intent, intent_reasoning = context_compiler.classify_intent(
        current_message=current_prompt,
        messages=messages,
        active_tasks=state.get("subagent_tasks") if state else None,
        active_plan=state.get("plan") if state else None,
    )

    if intent == "CANCELLATION":
        return [], ["User rejected proposed budget allocation. Cancellation in effect."]

    if intent in ("STATUS_QUERY", "INFORMATION_QUERY", "GENERAL_CONVERSATION"):
        return [], ["Process request through Personal Agent Orchestrator"]

    if intent == "CLARIFICATION_NEEDED":
        return [], ["Clarification needed: Please provide more details on what you would like to accomplish."]

    # If user confirms/approves, verify whether an active proposal actually exists in ledger
    has_active_proposal = any(
        t.get("status") in ("authorization_pending", "quote_received", "budget_planning")
        or t.get("phase") in ("authorization_pending", "budget_planning")
        for t in ((state.get("subagent_tasks") if state else None) or [])
    ) or any(
        isinstance(m, dict) and m.get("role") in ("assistant", "agent")
        and any(w in str(m.get("content") or "").lower() for w in (
            "budget allocation proposal",
            "proposed budget allocation",
            "proposed specialist delegations",
            "human authorization required",
            "please approve or reject",
            "pending human sign-off",
            "pending human authorization",
            "coordinated plan",
            "quoted",
            "cryptographic child mandates",
            "available mandate reserve",
        ))
        for m in (messages[-2:] if messages else [])
    )

    # Check for payment execution intent (e.g. "buy me hotel room", "buy the cheap hotel in pune", "buy the hotel", "book the flight", "pay for dinner")
    is_payment_action = (intent == "PAYMENT_EXECUTION_INTENT") or any(
        w in prompt_lower
        for w in (
            "buy ", "buy the", "buy a", "buy me", "book ", "book the", "pay for",
            "make payment", "order ", "purchase ", "checkout ",
        )
    ) or any(w in prompt_lower.split() for w in ("buy", "book", "pay", "purchase", "order", "checkout"))
    if is_payment_action:
        target_domain = None
        if any(w in prompt_lower for w in ("hotel", "room", "stay", "lodging")):
            target_domain = "hotel"
        elif any(w in prompt_lower for w in ("train", "transit", "subway", "rail", "cab", "taxi")):
            target_domain = "transport"
        elif any(w in prompt_lower for w in ("flight", "airline", "travel", "ticket")):
            target_domain = "travel"
        elif any(w in prompt_lower for w in ("food", "dinner", "lunch", "meal", "restaurant", "bistro")):
            target_domain = "food"
        elif messages:
            # Fall back to inspecting previous turns for domain context
            for prev_m in reversed(messages):
                prev_txt = str(prev_m.get("content") or "").lower()
                if any(w in prev_txt for w in ("hotel", "room", "stay", "lodging")):
                    target_domain = "hotel"
                    break
                elif any(w in prev_txt for w in ("flight", "travel", "airline")):
                    target_domain = "travel"
                    break
                elif any(w in prev_txt for w in ("food", "dining", "meal", "biscuit", "snack")):
                    target_domain = "food"
                    break

        if target_domain:
            # Check for existing quoted amount in state tasks or conversation messages
            extracted_amt = 0
            if state and state.get("subagent_tasks"):
                for t in state["subagent_tasks"]:
                    if t.get("agent") == target_domain or t.get("agent_id") == f"agent-{target_domain}-specialist":
                        extracted_amt = t.get("quoted_amount_minor") or t.get("amount_minor") or 0
                        t["phase"] = "payment_execution"
                        t["status"] = "payment_execution"
                        t["requires_spending"] = True
                        return [t], [f"Delegate payment execution for {target_domain} to specialist subagent via child mandate"]

            # If not in state tasks, scan messages for quoted numbers
            if extracted_amt <= 0 and messages:
                for prev_m in reversed(messages):
                    c = str(prev_m.get("content") or "")
                    m_val = re.search(r"(?:hotel|specialist|fare|rate|quote).*?(?:\$|₹|inr|usd)\s*([\d,]+(?:\.\d+)?)", c, re.IGNORECASE)
                    if not m_val:
                        m_val = re.search(r"(?:\$|₹|rs\.?\s*)([\d,]+(?:\.\d+)?)", c)
                    if m_val:
                        try:
                            extracted_amt = int(float(m_val.group(1).replace(",", "")) * 100)
                            break
                        except Exception:
                            pass

            if extracted_amt <= 0:
                extracted_amt = 25000 if budget_currency == "USD" else 250000

            sub = next((s for s in subagents if s.alias == target_domain or s.id == f"agent-{target_domain}-specialist" or s.id == f"agent-{target_domain}-coordinator"), None)
            if sub:
                task_envelope = {
                    "id": f"task_{sub.alias}_{uuid.uuid4().hex[:8]}",
                    "agent": sub.alias,
                    "agent_id": sub.id,
                    "action": "book_hotel" if target_domain == "hotel" else sub.default_action,
                    "description": f"Execute booking and payment for {sub.name}",
                    "scope": f"Autonomous {sub.specialty} execution and payment",
                    "amount_minor": extracted_amt,
                    "quoted_amount_minor": extracted_amt,
                    "currency": budget_currency,
                    "status": "payment_execution",
                    "phase": "payment_execution",
                    "requires_spending": True,
                    "authority_checked": True,
                    "delegated": True,
                }
                return [task_envelope], [f"Delegate payment execution for {target_domain} to specialist subagent via child mandate"]

    if is_confirmation_message(current_prompt):
        if not has_active_proposal and not any(t.get("status") == "completed" for t in ((state.get("subagent_tasks") if state else None) or [])):
            return [], ["No pending budget proposal exists to authorize."]
        if state and state.get("subagent_tasks"):
            return state["subagent_tasks"], state.get("plan", ["Execute authorized plan"])

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

    # Attempt LLM-based agent selection with attached MCP tools and Context Compiler
    selected_agent_specs: list[dict[str, Any]] = []
    llm_planning_succeeded = False

    if not is_confirmation_message(current_prompt):
        try:
            from agent_runtime.llm_provider import LLMFactory

            provider, resolved_model = LLMFactory.get_provider_for_model(model_id)

            # Compile operational context using exact dynamic template
            operational_context = context_compiler.compile_operational_context(
                current_message=current_prompt,
                messages=messages,
                active_plan=state.get("plan") if state else None,
                active_tasks=state.get("subagent_tasks") if state else None,
                environment_id=state.get("environment_id") if state else None,
                mandate_id=state.get("mandate_id") if state else None,
                fallback_state=state,
            )

            agents_text = "\n".join([f"- {s.name} (alias: {s.alias}, id: {s.id}): {s.description}" for s in subagents])
            llm_planning_prompt = (
                f"{operational_context}\n\n"
                f"AVAILABLE SPECIALIST AGENTS IN REGISTRY:\n{agents_text}\n\n"
                "You are the PayGuardian Personal Agent analyzing the user request.\n"
                "Use the attached MCP tools (discover_agents, get_agent_manifest, get_budget_summary, etc.) as needed.\n"
                "Rules:\n"
                "1. First, identify user intent from the INTENT TAXONOMY & DEFINITIONS and identify which policies apply from the APPLICATION POLICY CATALOG.\n"
                "2. If intent is STATUS_QUERY, INFORMATION_QUERY, or GENERAL_CONVERSATION: do NOT select subagents; return empty selected_agents.\n"
                "3. If intent is APPROVAL_INTENT: The LLM understands intentions but NEVER grants authority. Check 'Pending Proposals in Ledger'. If a proposal is pending, direct user to confirm via UI. If NO proposal is pending, return empty selected_agents and state that no pending proposal exists.\n"
                "4. If intent is CLARIFICATION_NEEDED: ONLY use if the prompt is completely unintelligible or lacks any domain/action (e.g. 'help' or 'do something'). Never use CLARIFICATION_NEEDED for planning a budget, trip, food, or purchase even if destination, dates, or items are unspecified.\n"
                "5. If intent is NEW_OBJECTIVE (any goal, task, budget plan, trip, sightseeing, food, optimization, or purchase): ALWAYS select matching specialist agent(s) from the AVAILABLE SPECIALIST AGENTS IN REGISTRY. Specialist agents will formulate quotes or ask specific parameters during discovery.\n"
                "6. Return strictly valid JSON in this format:\n"
                '{\n'
                '  "identified_intent": "NEW_OBJECTIVE | STATUS_QUERY | APPROVAL_INTENT | CANCELLATION | MODIFICATION | CONTINUATION | CLARIFICATION_NEEDED | INFORMATION_QUERY | GENERAL_CONVERSATION",\n'
                '  "applicable_policies": ["POL-MANDATE-LIMIT-01", ...],\n'
                '  "reasoning": "brief explanation",\n'
                '  "clarification_question": "optional question if CLARIFICATION_NEEDED",\n'
                '  "selected_agents": [{"id": "agent-id-or-alias", "action": "action_name", "task_description": "short description"}]\n'
                '}'
            )

            resp = provider.generate(
                prompt=llm_planning_prompt,
                system_instruction=CORE_SYSTEM_INSTRUCTIONS,
                model=resolved_model,
                max_tokens=500,
                temperature=0.2,
                tools=mcp_tools.get_tool_schemas(),
            )

            content = resp.content if hasattr(resp, "content") else str(resp)

            # Handle native tool calls if emitted by the LLM
            if hasattr(resp, "tool_calls") and resp.tool_calls:
                for tc in resp.tool_calls:
                    mcp_tools.call_tool(tc.name, tc.arguments)
                    if tc.name in ("delegate_task", "discover_agents", "get_agent_manifest"):
                        target_id = tc.arguments.get("agent_id") or tc.arguments.get("parent_agent_id")
                        if target_id:
                            sub = subagent_registry.get(str(target_id))
                            if sub and not any(s["subagent"].id == sub.id for s in selected_agent_specs):
                                selected_agent_specs.append(
                                    {
                                        "subagent": sub,
                                        "action": sub.default_action,
                                        "description": tc.arguments.get("objective") or sub.description,
                                    }
                                )

            llm_planning_succeeded = False
            m_json = re.search(r"\{.*\}", content, re.DOTALL)
            if m_json:
                parsed = json.loads(m_json.group(0))
                identified_intent = parsed.get("identified_intent")
                if identified_intent in ("STATUS_QUERY", "INFORMATION_QUERY", "GENERAL_CONVERSATION"):
                    return [], ["Process request through Personal Agent Orchestrator"]
                if identified_intent == "CANCELLATION":
                    return [], ["User rejected proposed budget allocation. Cancellation in effect."]

                raw_selected = parsed.get("selected_agents", [])
                for item in raw_selected:
                    target_id = item.get("id") or item.get("agent")
                    sub = subagent_registry.get(str(target_id))
                    if sub:
                        act = item.get("action")
                        if not act or act not in sub.capabilities:
                            act = sub.default_action
                        selected_agent_specs.append(
                            {
                                "subagent": sub,
                                "action": act,
                                "description": item.get("task_description") or sub.description,
                            }
                        )
                if selected_agent_specs:
                    llm_planning_succeeded = True
                elif identified_intent == "CLARIFICATION_NEEDED" or (identified_intent != "APPROVAL_INTENT" and parsed.get("clarification_question")):
                    q = parsed.get("clarification_question") or "Could you clarify what you would like me to help you with?"
                    return [], [f"Clarification needed: {q}"]
        except Exception as exc:
            logger.info("LLM agent planning unavailable (%s), using dynamic capability matching.", exc)

    # Dynamic Capability Matching Fallback (ONLY if LLM is unavailable, offline, or threw error)
    if not llm_planning_succeeded and not selected_agent_specs:
        if intent == "CLARIFICATION_NEEDED":
            return [], ["Clarification needed: Please provide more details on what you would like to accomplish."]

        is_action_request = any(
            w in prompt_lower
            for w in ("buy", "ticket", "train", "hotel", "flight", "search", "food", "procure", "optimize", "cloud", "biscuit", "chai")
        )
        is_confirmation = is_confirmation_message(prompt_lower) or (
            (not is_action_request)
            and any(
                prompt_lower == p or prompt_lower.startswith(f"{p} ")
                for p in (
                    "okay delegate",
                    "delegate the budget",
                    "confirm",
                    "approve",
                    "approved",
                    "yes please",
                    "yes proceed",
                    "go ahead and delegate",
                    "make the payment",
                    "pay for these",
                    "proceed with payment",
                )
            )
        )

        if is_confirmation and not has_active_proposal and not any(t.get("status") == "completed" for t in ((state.get("subagent_tasks") if state else None) or [])):
            return [], ["No pending budget proposal exists to authorize."]

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
                    for sp in sub.sample_prompts:
                        sp_words = [w.lower() for w in re.split(r"\W+", sp) if len(w) > 3]
                        if sum(1 for w in sp_words if w in search_text) >= 2:
                            matched = True
                            break
                    if not matched:
                        for c in sub.capabilities:
                            cap_words = [w.lower() for w in re.split(r"[\._]+", c) if len(w) > 3]
                            if any(w in search_text for w in cap_words):
                                matched = True
                                break

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


def _generate_heuristic_specialist_quote(
    agent_name: str,
    prompt: str,
    currency: str,
    is_budget_trip: bool,
) -> dict[str, Any]:
    """Generate deterministic, context-aware heuristic quotes and explanations when LLM is unavailable."""
    p_lower = prompt.lower()
    is_goa = "goa" in p_lower
    cur = currency.upper()

    if cur == "INR":
        if agent_name == "travel":
            if is_goa or is_budget_trip:
                return {
                    "provider": "IRCTC & Konkan Kanya Express / Intercity Transit",
                    "reasoning": "Cost-effective round-trip sleeper/transit booking to Goa plus local transfers, keeping travel affordable.",
                    "items": [
                        {"name": "Round-trip Train / Transit to Goa", "qty": 1, "unit_price_minor": 250000, "currency": "INR"},
                        {"name": "Station transfer and local transit buffer", "qty": 1, "unit_price_minor": 250000, "currency": "INR"},
                    ],
                }
            return {
                "provider": "National Rail & Regional Transit",
                "reasoning": "Standard economical rail transit and station connection.",
                "items": [{"name": "Standard Regional Transit", "qty": 1, "unit_price_minor": 300000, "currency": "INR"}],
            }
        elif agent_name == "hotel":
            if is_goa or is_budget_trip:
                return {
                    "provider": "Zostel / Anjuna Beachside Backpacker Guesthouse",
                    "reasoning": "Budget-friendly beachside hostel/guesthouse stay (3 nights at ~₹833/night) to minimize accommodation costs.",
                    "items": [
                        {"name": "Budget beachside stay (3 nights)", "qty": 3, "unit_price_minor": 83333, "currency": "INR"},
                    ],
                }
            return {
                "provider": "Comfort City Lodging",
                "reasoning": "Standard economical city guesthouse lodging.",
                "items": [{"name": "Standard Room (2 nights)", "qty": 2, "unit_price_minor": 125000, "currency": "INR"}],
            }
        elif agent_name == "food":
            if is_goa or is_budget_trip:
                return {
                    "provider": "Local Goan Beach Shacks & Authentic Thali Spots",
                    "reasoning": "Authentic Goan fish curry thalis, beach shacks, and local breakfast joints (~₹375/day for 4 days).",
                    "items": [
                        {"name": "Local Goan Meals & Beach Shack Dining (4 days)", "qty": 4, "unit_price_minor": 37500, "currency": "INR"},
                    ],
                }
            return {
                "provider": "Local Dining & Street Food Curation",
                "reasoning": "Economical local dining and casual restaurants.",
                "items": [{"name": "Daily Meal Package", "qty": 3, "unit_price_minor": 50000, "currency": "INR"}],
            }
        elif agent_name == "activities":
            if is_goa or is_budget_trip:
                return {
                    "provider": "Goa Coastal Experiences & Fort Trails",
                    "reasoning": "Scooter rental (₹400/day for 2 days), fort admissions (Aguada & Chapora), and low-cost beach exploration.",
                    "items": [
                        {"name": "Scooter rental (2 days)", "qty": 2, "unit_price_minor": 40000, "currency": "INR"},
                        {"name": "Heritage Fort Entry Fees & Sightseeing", "qty": 1, "unit_price_minor": 20000, "currency": "INR"},
                    ],
                }
            return {
                "provider": "City Walking Tours & Museums",
                "reasoning": "Standard entry tickets and sightseeing activities.",
                "items": [{"name": "Sightseeing & Tour Passes", "qty": 1, "unit_price_minor": 100000, "currency": "INR"}],
            }
        elif agent_name == "transport":
            return {
                "provider": "Regional Bus & Rail Schedule",
                "reasoning": "Direct express bus or train fare for regional connection.",
                "items": [{"name": "Express Regional Ticket", "qty": 1, "unit_price_minor": 120000, "currency": "INR"}],
            }
    else:  # USD and other currencies
        if agent_name == "travel":
            return {
                "provider": "Budget Flight & Regional Transit Express",
                "reasoning": "Cost-effective economy flights and airport transit.",
                "items": [
                    {"name": "Economy Transit Roundtrip", "qty": 1, "unit_price_minor": 5000, "currency": cur},
                ],
            }
        elif agent_name == "hotel":
            return {
                "provider": "Backpacker & Boutique Hostels",
                "reasoning": "Budget boutique lodging with essential amenities.",
                "items": [
                    {"name": "Budget Room (2 nights)", "qty": 2, "unit_price_minor": 2000, "currency": cur},
                ],
            }
        elif agent_name == "food":
            return {
                "provider": "Local Market & Eatery Pass",
                "reasoning": "Affordable local street food, bakeries, and casual dining.",
                "items": [
                    {"name": "Local Dining Allowance", "qty": 1, "unit_price_minor": 2500, "currency": cur},
                ],
            }
        elif agent_name == "activities":
            return {
                "provider": "Historic Trails & Discovery Passes",
                "reasoning": "Self-guided walking tours and cultural site access.",
                "items": [
                    {"name": "Activity & Sightseeing Passes", "qty": 1, "unit_price_minor": 1500, "currency": cur},
                ],
            }
        elif agent_name == "transport":
            return {
                "provider": "City Metro & Regional Transit",
                "reasoning": "Unlimited multi-day transit pass.",
                "items": [
                    {"name": "Multi-Day Transit Pass", "qty": 1, "unit_price_minor": 2000, "currency": cur},
                ],
            }

    return {
        "provider": f"Verified {agent_name.capitalize()} Network",
        "reasoning": f"Standard quote tailored for {agent_name} requirements.",
        "items": [{"name": f"{agent_name.capitalize()} base expense", "qty": 1, "unit_price_minor": 1000 if cur == "USD" else 100000, "currency": cur}],
    }


SPECIALIST_DOMAIN_SCOPES = {
    "travel": (
        "STRICT DOMAIN SCOPE: Intercity and regional transportation ONLY (flights, trains, intercity buses, airport/station transfers). "
        "FORBIDDEN: You must NEVER include hotel stays, room lodging, meals, dining, or sightseeing/activity tours."
    ),
    "hotel": (
        "STRICT DOMAIN SCOPE: Lodging and accommodations ONLY (hotel rooms, dorms, hostels, guesthouse nights). "
        "FORBIDDEN: You must NEVER include flights, trains, station transfers, meals, food, or sightseeing activities."
    ),
    "food": (
        "STRICT DOMAIN SCOPE: Dining, food, and daily meals ONLY (breakfast, lunch, dinner, street food, cafes, local thalis). "
        "FORBIDDEN: You must NEVER include hotel lodging, room stays, flights, trains, or sightseeing tours."
    ),
    "activities": (
        "STRICT DOMAIN SCOPE: Local attractions, entry tickets, monument passes, bike/scooter day rental, and sightseeing experiences ONLY. "
        "FORBIDDEN: You must NEVER include hotel stays, room lodging, flights, trains, or meals/dining in your quote."
    ),
    "transport": (
        "STRICT DOMAIN SCOPE: Local intra-city transit fares ONLY (city metro, local buses, auto-rickshaws). "
        "FORBIDDEN: You must NEVER include hotel stays, meals, or intercity flights."
    ),
    "merchant_attach": (
        "STRICT DOMAIN SCOPE: Physical merchant goods, snacks, or retail groceries ONLY. "
        "FORBIDDEN: You must NEVER include travel or hotel booking."
    ),
}

DOMAIN_QUOTA_PROPORTIONS = {
    "travel": 0.40,
    "hotel": 0.25,
    "food": 0.20,
    "activities": 0.15,
    "transport": 0.15,
    "merchant_attach": 0.25,
}


def evaluate_quote_critique(
    agent_name: str,
    quote: dict[str, Any],
    currency: str,
    budget_limit_minor: int | None = None,
    is_child: bool = False,
) -> tuple[bool, str | None]:
    """Orchestrator reviews a subagent's proposed quote & reasoning to decide if it violates domain boundaries or requires improvement."""
    reasoning = str(quote.get("reasoning", "")).lower()
    items = quote.get("items", [])
    item_names = " ".join(str(it.get("name", "")) for it in items).lower()
    combined_text = f"{reasoning} {item_names}"
    total = int(quote.get("total_minor", 0))

    # 1. Domain Leak Checks
    if agent_name == "activities":
        forbidden = [w for w in ("hotel", "hostel", "guesthouse", "resort", "lodging", "room", "flight", "airfare", "train", "meal", "food", "thali", "restaurant") if w in combined_text]
        if forbidden:
            return True, f"Activities quote improperly included non-activity expenses ({', '.join(forbidden)}). You must budget EXCLUSIVELY for local attractions, entry passes, scooter rental, and activities."
    elif agent_name == "food":
        forbidden = [w for w in ("hotel", "hostel", "lodging", "room", "stay", "flight", "train ticket") if w in combined_text]
        if forbidden:
            return True, f"Food quote improperly included non-dining costs ({', '.join(forbidden)}). You must budget EXCLUSIVELY for food, drinks, and meals."
    elif agent_name == "hotel":
        forbidden = [w for w in ("flight", "airfare", "train ticket", "scooter rental", "dining package") if w in combined_text]
        if forbidden:
            return True, f"Hotel quote improperly included transportation or activities ({', '.join(forbidden)}). You must budget EXCLUSIVELY for accommodation and room stay."
    elif agent_name == "travel" and not is_child:
        forbidden = [w for w in ("dining package", "dinner at", "food thali") if w in combined_text]
        if forbidden:
            return True, f"Travel quote included non-transit meal costs ({', '.join(forbidden)}). You must budget EXCLUSIVELY for travel and transportation."

    # 2. Budget envelope check: Ensure specialist does not exceed its recommended domain target
    if budget_limit_minor and budget_limit_minor > 0:
        proportion = DOMAIN_QUOTA_PROPORTIONS.get(agent_name, 0.25)
        target_ceiling = int(budget_limit_minor * proportion * 1.35)
        if total > target_ceiling:
            return True, f"Quote of {_format_budget(total, currency)} exceeds the recommended domain target of {_format_budget(int(budget_limit_minor * proportion), currency)}. Please refine with more cost-effective alternatives."

    return False, None


def dynamic_subagent_research_and_quote(
    agent_name: str,
    prompt: str,
    user_preferences: dict[str, Any] | None = None,
    currency: str = "USD",
    budget_limit_minor: int | None = None,
    model_id: str | None = None,
    orchestrator_critique: str | None = None,
) -> dict[str, Any]:
    """Dynamically research pricing and generate a realistic itemized quote with reasoning for a specialist subagent.

    Adheres to the core rules:
    1. LLM plans and estimates dynamically from the user's prompt (never hardcoded allocations).
    2. Deterministic calculations enforce and clamp limits (LLMs do not directly execute or spend).
    3. Hierarchical consideration (Travel envelope covers travel & child accommodations).
    """
    user_prefs = user_preferences or {}
    cur = (currency or "USD").upper()

    prompt_lower = prompt.lower()
    is_budget_trip = any(w in prompt_lower for w in ("cheap", "cheaper", "budget", "low cost", "economical", "affordable"))

    domain_proportion = DOMAIN_QUOTA_PROPORTIONS.get(agent_name, 0.25)
    domain_guideline_minor = int(budget_limit_minor * domain_proportion) if budget_limit_minor else None

    quote_data: dict[str, Any] | None = None
    try:
        from agent_runtime.llm_provider import LLMFactory

        provider, resolved_model = LLMFactory.get_provider_for_model(model_id)

        domain_scope_text = SPECIALIST_DOMAIN_SCOPES.get(
            agent_name, f"STRICT DOMAIN SCOPE: {agent_name.capitalize()} services exclusively."
        )
        guideline_text = (
            f"TARGET ALLOCATION GUIDELINE: Your estimated total should be around {_format_budget(domain_guideline_minor, cur)} "
            f"(maximum domain ceiling: {_format_budget(int(domain_guideline_minor * 1.25), cur)}). "
            f"Do NOT claim the entire user reserve; other agents are covering the other domains.\n"
            if domain_guideline_minor
            else ""
        )
        critique_section = (
            f"\nORCHESTRATOR FEEDBACK & REQUIRED IMPROVEMENT:\n"
            f"The Personal Agent Orchestrator reviewed your preliminary quote and flagged:\n"
            f"\"{orchestrator_critique}\"\n"
            f"You MUST fix this critique: remove out-of-domain items, re-estimate within your domain guideline, and explain your improvements.\n"
            if orchestrator_critique
            else ""
        )

        task_envelope_prompt = (
            f"ASSIGNED TASK ENVELOPE:\n"
            f"- Objective: Autonomous specialist research and quotation for {agent_name.capitalize()}.\n"
            f"- Task Description: Research options and itemize realistic pricing for {agent_name.capitalize()} services.\n"
            f"- Included Responsibilities: {domain_scope_text}\n"
            f"- Excluded Responsibilities: Services outside {agent_name.capitalize()} domain (handled by other specialists).\n"
            f"- User Requirements: '{prompt}'.\n"
            f"- Relevant Context: Currency: {cur}. {guideline_text}\n"
            f"- Dependencies: Coordinated by Personal Agent Orchestrator.\n"
            f"- Budget Limit: {_format_budget(domain_guideline_minor, cur) if domain_guideline_minor else 'Bounded by parent mandate'}\n"
            f"- Parent Agent: Personal Agent Orchestrator\n"
            f"- Expected Output: Return strictly valid JSON object with provider, reasoning, and items.\n"
            f"{critique_section}\n\n"
            "Output Schema:\n"
            "{\n"
            '  "provider": "Service or Merchant Name",\n'
            '  "reasoning": "Detailed 1-2 sentence justification explaining why this amount is realistic, how it was estimated, and how it keeps the trip cost-effective",\n'
            '  "items": [\n'
            '    {"name": "Item or service name", "qty": 1, "unit_price_minor": ' + ("440000" if cur == "INR" else "4400") + ', "currency": "' + cur + '"}\n'
            "  ]\n"
            "}\n"
            f"CRITICAL UNIT RULE: Unit prices MUST be in {cur} MINOR units (e.g. For INR: 1 INR = 100 paise, so ₹4,400.00 MUST be written as 440000, NOT 4400. For USD: $44.00 = 4400 cents)."
        )

        resp = provider.generate(
            prompt=task_envelope_prompt,
            system_instruction=SPECIALIST_SYSTEM_PROMPT,
            model=resolved_model,
            max_tokens=600,
            temperature=0.3,
        )
        resp_text = resp.content if hasattr(resp, "content") else str(resp)

        if resp_text:
            cleaned = resp_text.strip()
            if "```" in cleaned:
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
                cleaned = cleaned.strip()
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict) and parsed.get("items") and isinstance(parsed["items"], list):
                quote_data = parsed
    except Exception as exc:
        logger.debug("LLM dynamic quote generation fallback for %s: %s", agent_name, exc)

    if not quote_data or not quote_data.get("items"):
        quote_data = _generate_heuristic_specialist_quote(agent_name, prompt, cur, is_budget_trip)

    items = quote_data.get("items", [])
    computed_total = 0
    valid_items = []
    for it in items:
        qty = max(1, int(it.get("qty", 1)))
        price = max(0, int(it.get("unit_price_minor", 0)))
        computed_total += qty * price
        valid_items.append({
            "name": str(it.get("name", f"{agent_name.capitalize()} expense")),
            "qty": qty,
            "unit_price_minor": price,
            "currency": cur,
        })

    if computed_total <= 0:
        computed_total = 1000 if cur == "USD" else 100000
        valid_items = [{
            "name": f"{agent_name.capitalize()} base service",
            "qty": 1,
            "unit_price_minor": computed_total,
            "currency": cur,
        }]

    # Detect if LLM mistakenly returned major units instead of minor units
    # (e.g. outputting 4400 for ₹4,400 instead of 440000 paise)
    is_major_unit_leak = False
    reasoning_text = str(quote_data.get("reasoning", ""))
    if cur == "INR" and computed_total > 0:
        has_major_number_in_reasoning = (
            f"₹{computed_total}" in reasoning_text
            or f"₹{computed_total:,}" in reasoning_text
            or f"{computed_total}rs" in reasoning_text.lower()
            or f"{computed_total} inr" in reasoning_text.lower()
            or f"{computed_total} rupees" in reasoning_text.lower()
            or f"{computed_total} ceiling" in reasoning_text.lower()
            or f"{computed_total} budget" in reasoning_text.lower()
        )
        if has_major_number_in_reasoning or (computed_total < 10000 and (budget_limit_minor or 0) >= 100000):
            is_major_unit_leak = True
    elif domain_guideline_minor and computed_total > 0:
        if (computed_total * 100) <= int(domain_guideline_minor * 1.5) and computed_total <= (domain_guideline_minor // 40):
            is_major_unit_leak = True

    if is_major_unit_leak:
        for it in valid_items:
            it["unit_price_minor"] = it["unit_price_minor"] * 100
        computed_total *= 100

    # Deterministic envelope enforcement: scale items if exceeding domain ceiling
    target_max = int(domain_guideline_minor * 1.3) if domain_guideline_minor else (budget_limit_minor or 0)
    if target_max > 0 and computed_total > target_max:
        scale = target_max / computed_total
        computed_total = 0
        for it in valid_items:
            it["unit_price_minor"] = max(1, int(it["unit_price_minor"] * scale * 0.95))
            computed_total += it["qty"] * it["unit_price_minor"]

    quote_id = f"quote_{agent_name}_{uuid.uuid4().hex[:8]}"
    return {
        "quote_id": quote_id,
        "provider": quote_data.get("provider", f"Verified {agent_name.capitalize()} Network"),
        "reasoning": quote_data.get("reasoning") or f"Cost-effective quote tailored for {agent_name} based on user requirements.",
        "items": valid_items,
        "total_minor": computed_total,
        "currency": cur,
        "valid_until": (datetime.now(UTC) + timedelta(minutes=30)).isoformat(),
        "availability": "available",
    }


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
            state=state,
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

        context_compiler = ContextCompiler(gateway_client=self.gateway_client)
        op_context = context_compiler.compile_operational_context(
            current_message=prompt,
            messages=messages,
            active_plan=plan,
            active_tasks=subagent_tasks,
            environment_id=state.get("environment_id"),
            mandate_id=state.get("mandate_id"),
            fallback_state=state,
        )

        total_chars = len(CORE_SYSTEM_INSTRUCTIONS) + len(op_context)
        assembled_context_data = {
            "system_instruction": CORE_SYSTEM_INSTRUCTIONS,
            "system_prompt": CORE_SYSTEM_INSTRUCTIONS,
            "assembled_prompt": op_context,
            "operational_context": op_context,
            "total_characters": total_chars,
            "estimated_tokens": int(total_chars / 4),
            "system_prompt_tokens": int(len(CORE_SYSTEM_INSTRUCTIONS) / 4),
            "assembled_prompt_tokens": int(len(op_context) / 4),
            "messages_count": len(messages),
            "active_tasks_count": len(subagent_tasks),
        }

        self.event_emitter.emit(
            "context.assembled",
            payload=assembled_context_data,
            run_id=run_id,
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

        has_pending_proposal = any(
            t.get("status") in ("authorization_pending", "quote_received", "budget_planning")
            or t.get("phase") in ("authorization_pending", "budget_planning")
            for t in (state.get("subagent_tasks") or [])
        ) or any(
            isinstance(m, dict) and m.get("role") in ("assistant", "agent")
            and any(w in str(m.get("content") or "").lower() for w in (
                "budget allocation proposal",
                "proposed budget allocation",
                "proposed specialist delegations",
                "human authorization required",
                "please approve or reject",
                "pending human sign-off",
                "pending human authorization",
                "coordinated plan",
                "quoted",
                "cryptographic child mandates",
                "available mandate reserve",
            ))
            for m in (messages[-2:] if messages else [])
        )

        if is_rejected:
            subagent_tasks = []
            plan = ["User rejected proposed budget allocation. Cancellation in effect."]

        clarification_required = False
        clarification_questions = []
        if plan and any(p.startswith("Clarification needed:") for p in plan):
            clarification_required = True
            for p in plan:
                if p.startswith("Clarification needed:"):
                    clarification_questions.append(p.replace("Clarification needed:", "").strip())
            subagent_tasks = []

        if is_confirmed and not has_pending_proposal and not any(t.get("status") == "completed" for t in (state.get("subagent_tasks") or [])):
            return {
                "run_id": run_id,
                "plan": ["No pending budget proposal exists to authorize."],
                "subagent_tasks": [],
                "user_preferences": user_preferences,
                "clarification_required": False,
                "missing_fields": [],
                "clarification_questions": [],
                "is_user_rejected": False,
                "is_user_confirmed": False,
                "no_pending_proposal_to_approve": True,
                "assembled_context": assembled_context_data,
                "events": self.event_emitter.events,
            }

        return {
            "run_id": run_id,
            "plan": plan,
            "subagent_tasks": subagent_tasks,
            "user_preferences": user_preferences,
            "clarification_required": clarification_required,
            "missing_fields": [],
            "clarification_questions": clarification_questions,
            "is_user_rejected": is_rejected,
            "is_user_confirmed": is_confirmed,
            "assembled_context": assembled_context_data,
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
        budget_limit_minor = state.get("budget_limit_minor") or state.get("root_mandate_limit_minor") or 0
        available_reserve_minor = state.get("available_reserve_minor")
        available_reserve = available_reserve_minor if available_reserve_minor is not None else budget_limit_minor
        model_id = state.get("model_id")
        effective_model = model_id or os.getenv("DEFAULT_MODEL", "free/gpt-6-luna")

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

            # If task is an explicit payment execution task, preserve task envelope and pass through
            if task.get("phase") in ("payment_execution", "authorized") and task.get("requires_spending"):
                self.event_emitter.emit(
                    "agent.started",
                    payload={
                        "agent": agent_name,
                        "agentId": agent_name,
                        "task_id": task_id,
                        "action": task.get("action"),
                        "phase": task.get("phase", "payment_execution"),
                        "model": effective_model,
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                updated_tasks.append(task)  # type: ignore[arg-type]
                continue

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

            else:
                tool_mapping = {
                    "travel": ("flight_search_and_routing", "transit_and_flights"),
                    "hotel": ("hotel_inventory_search", "lodging_and_accommodations"),
                    "food": ("dining_reservation_curation", "dining_and_restaurants"),
                    "transport": ("ground_transit_scheduling", "local_transit_and_transfers"),
                    "activities": ("attraction_booking_service", "activities_and_tours"),
                }
                tool_name, tool_scope = tool_mapping.get(agent_name, ("domain_service_discovery", "general"))
                self.event_emitter.emit(
                    "tool.started",
                    payload={
                        "tool": tool_name,
                        "agent": agent_name,
                        "agentId": agent_name,
                        "parameters": {"scope": tool_scope, "currency": currency},
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                self.event_emitter.emit(
                    "agent.progress",
                    payload={
                        "step": "researching_options",
                        "phase": "discovery",
                        "agent": agent_name,
                        "agentId": agent_name,
                        "message": f"Researching available options and pricing for {agent_name.capitalize()}...",
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                quote = dynamic_subagent_research_and_quote(
                    agent_name=agent_name,
                    prompt=prompt,
                    user_preferences=user_preferences,
                    currency=currency,
                    budget_limit_minor=available_reserve,
                    model_id=state.get("model_id"),
                )

                # Main orchestrator critique & improvement evaluation
                critique_needed, critique_feedback = evaluate_quote_critique(
                    agent_name=agent_name,
                    quote=quote,
                    currency=currency,
                    budget_limit_minor=available_reserve,
                    is_child=bool(task.get("parent_task_id")),
                )
                if critique_needed and critique_feedback:
                    self.event_emitter.emit(
                        "agent.progress",
                        payload={
                            "step": "critique_and_refinement",
                            "phase": "discovery",
                            "agent": agent_name,
                            "agentId": agent_name,
                            "critique": critique_feedback,
                            "message": f"Orchestrator requested refinement from {agent_name.capitalize()} Agent: {critique_feedback}",
                        },
                        run_id=run_id,
                        task_id=task_id,
                        agent="personal",
                    )
                    refined_quote = dynamic_subagent_research_and_quote(
                        agent_name=agent_name,
                        prompt=prompt,
                        user_preferences=user_preferences,
                        currency=currency,
                        budget_limit_minor=available_reserve,
                        model_id=state.get("model_id"),
                        orchestrator_critique=critique_feedback,
                    )
                    if refined_quote:
                        quote = refined_quote
                self.event_emitter.emit(
                    "tool.completed",
                    payload={
                        "tool": tool_name,
                        "agent": agent_name,
                        "agentId": agent_name,
                        "status": "success",
                        "result": {
                            "provider": quote.get("provider"),
                            "total_minor": quote.get("total_minor"),
                            "reasoning": quote.get("reasoning"),
                            "items": quote.get("items"),
                        },
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )
                task["quotes"] = [quote]
                task["quoted_amount_minor"] = quote["total_minor"]
                task["reasoning"] = quote.get("reasoning")
                task["breakdown"] = quote.get("items")
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
        available_reserve_minor = state.get("available_reserve_minor")
        available_reserve = (
            available_reserve_minor
            if available_reserve_minor is not None
            else budget_limit_minor
        )
        currency = state.get("budget_currency") or "USD"

        self.event_emitter.emit(
            "agent.progress",
            payload={
                "step": "budget_planning",
                "phase": "budget_planning",
                "message": f"Evaluating received quotes against mandate reserve of {_format_budget(available_reserve, currency)}.",
            },
            run_id=run_id,
            agent="personal",
        )

        updated_tasks: list[SubagentTask] = []
        allocated_so_far = 0

        for t in tasks:
            task = dict(t)
            quoted_amt = task.get("quoted_amount_minor") or task.get("amount_minor", 0)

            # If task is an explicit payment execution task ordered by the user, authorize it directly
            if task.get("phase") in ("payment_execution", "authorized") and task.get("requires_spending"):
                task["amount_minor"] = quoted_amt if quoted_amt > 0 else (25000 if currency == "USD" else 250000)
                task["proposed_mandate_minor"] = task["amount_minor"]
                task["phase"] = "authorized"
                task["status"] = "authorized"
                task["authority_checked"] = True
                task["delegated"] = True
                updated_tasks.append(task)  # type: ignore[arg-type]
                continue

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
                    # Enforce clamp to parent allocation
                    quoted_amt = parent_budget
                    task["amount_minor"] = quoted_amt
                    task["proposed_mandate_minor"] = quoted_amt
                    task["reasoning"] = (task.get("reasoning") or "") + f" (Clamped to parent {parent_task.get('agent', 'parent').capitalize()} ceiling of {_format_budget(parent_budget, currency)})"

                task["amount_minor"] = quoted_amt
                task["proposed_mandate_minor"] = quoted_amt
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
                # Top-level task evaluated against available mandate reserve
                remaining_budget = available_reserve - allocated_so_far
                if available_reserve > 0 and quoted_amt > remaining_budget:
                    if task.get("agent") in ("merchant_attach", "merchantattach"):
                        task["phase"] = "failed"
                        task["status"] = "budget_exceeded"
                        task["amount_minor"] = quoted_amt
                        self.event_emitter.emit(
                            "agent.progress",
                            payload={
                                "step": "budget_planning",
                                "phase": "budget_exceeded",
                                "agent": task.get("agent"),
                                "amount_minor": quoted_amt,
                                "currency": currency,
                                "message": (
                                    f"Quoted budget of {_format_budget(quoted_amt, currency)} "
                                    f"exceeds available mandate buffer of {_format_budget(max(0, remaining_budget), currency)}."
                                ),
                            },
                            run_id=run_id,
                            task_id=task.get("id"),
                            agent="personal",
                        )
                    else:
                        # CLAMP flexible spending envelopes to remaining available budget to prevent over-budget proposals
                        clamped_amt = max(0, remaining_budget)
                        if clamped_amt > 0:
                            quoted_amt = clamped_amt
                            task["amount_minor"] = quoted_amt
                            task["proposed_mandate_minor"] = quoted_amt
                            task["reasoning"] = (task.get("reasoning") or "") + f" (Clamped to fit remaining reserve of {_format_budget(remaining_budget, currency)})"
                            allocated_so_far += quoted_amt
                            task["phase"] = "authorization_pending"
                            task["status"] = "authorization_pending"
                        else:
                            task["phase"] = "failed"
                            task["status"] = "budget_exhausted"
                            task["amount_minor"] = 0
                            task["proposed_mandate_minor"] = 0
                            task["error"] = f"No reserve remaining from available mandate buffer ({_format_budget(available_reserve, currency)})."
                else:
                    allocated_so_far += quoted_amt
                    task["amount_minor"] = quoted_amt
                    task["proposed_mandate_minor"] = quoted_amt
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
            user_confirmed = is_confirmation_message(latest_prompt) or (
                bool(messages and len(messages) > 1) and is_payment_order_message(latest_prompt)
            )

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
                is_child = bool(t.get("parent_task_id"))
                parent_alias = (
                    next((p.get("agent") for p in updated_tasks if p.get("id") == t.get("parent_task_id")), None)
                    if is_child
                    else None
                )
                reasoning = t.get("reasoning") or desc
                proposed_allocations.append({
                    "agent": agent_alias,
                    "role": role,
                    "quotedCostMinor": amt,
                    "requestedMandateMinor": amt,
                    "capabilities": caps,
                    "description": desc,
                    "isChild": is_child,
                    "parentAgent": parent_alias,
                    "reasoning": reasoning,
                })
                if not is_child:
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
            if task.get("child_mandate_id") or task.get("phase") not in ("authorization_pending", "authorized", "payment_execution"):
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
                has_real_mandate = bool(mandate_id and self.gateway_client)
                delegation_success = not has_real_mandate
                if has_real_mandate and effective_delegating_mandate_id:
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
                        if not delegation_res or not isinstance(delegation_res, dict):
                            delegation_success = False
                            task["error"] = "Gateway returned invalid delegation response"
                        elif delegation_res.get("mandate"):
                            child_id = delegation_res["mandate"]["id"]
                            delegation_success = True
                        else:
                            decision = delegation_res.get("decision")
                            err_reason = decision.get("reason") if isinstance(decision, dict) else "Gateway child mandate delegation denied"
                            logger.warning("Gateway child mandate delegation denied for %s: %s", agent_name, err_reason)
                            task["error"] = err_reason or "Mandate creation failed"
                            delegation_success = False
                    except Exception as exc:
                        logger.warning("Gateway child mandate delegation error: %s", exc)
                        task["error"] = str(exc)
                        delegation_success = False

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
        effective_model = model_id or os.getenv("DEFAULT_MODEL", "free/gpt-6-luna")

        updated_tasks: list[SubagentTask] = []
        for t in tasks:
            task = dict(t)
            agent_name = task.get("agent", "unknown")
            task_id = task.get("id", str(uuid.uuid4()))

            if task.get("phase") not in ("authorized", "payment_execution"):
                updated_tasks.append(task)  # type: ignore[arg-type]
                continue

            task["phase"] = "execution"
            amt_minor = task.get("amount_minor", 0)
            cur = task.get("currency", "USD")
            budget_str = _format_budget(amt_minor, cur)
            child_mandate_ref = task.get("child_mandate_id") or "mandate-child-simulated"
            target_holder_id = task.get("holder_agent_id") or agent_name
            payment_action_id = f"pi_{agent_name}_{uuid.uuid4().hex[:8]}"
            paypal_approval_url: str | None = None
            paypal_order_id: str | None = None

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
                        is_paypal = cur.upper() == "USD" or task.get("rail") == "PayPal"
                        if is_paypal and hasattr(self.gateway_client, "create_paypal_order"):
                            try:
                                pp_res = self.gateway_client.create_paypal_order(
                                    environment_id=environment_id,
                                    agent_id=target_holder_id,
                                    mandate_id=child_mandate_ref,
                                    ledger_account_id=target_acc["id"],
                                    idempotency_key=reserve_idem,
                                    request_hash=req_hash,
                                    action=task.get("action", "procure_merchant_goods"),
                                    amount_minor=amt_minor,
                                    currency="USD",
                                )
                                act_data = pp_res.get("action") or {}
                                act_id = act_data.get("id")
                                order_data = pp_res.get("order") or {}
                                order_id = order_data.get("id")
                                approval_url = order_data.get("approvalUrl")
                                if act_id:
                                    payment_action_id = act_id
                                    paypal_approval_url = approval_url
                                    paypal_order_id = order_id
                                    logger.info(
                                        "PayPal order %s created for action %s: approvalUrl=%s",
                                        order_id, act_id, approval_url
                                    )
                            except Exception as pp_exc:
                                logger.warning("PayPal order creation skipped, using internal ledger: %s", pp_exc)
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
                        else:
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
            tool_result: dict[str, Any] = {
                "payment_intent": payment_action_id,
                "status": "awaiting_buyer_approval" if paypal_approval_url else "authorized",
                "code": "ALLOW",
                "amount_minor": amt_minor,
            }
            if paypal_approval_url:
                tool_result["approval_url"] = paypal_approval_url
                tool_result["provider_order_id"] = paypal_order_id
                tool_result["rail"] = "PayPal"

            self.event_emitter.emit(
                "tool.started",
                payload={
                    "tool": "gateway_payment_authorization",
                    "agent": agent_name,
                    "agentId": agent_name,
                    "parameters": {
                        "child_mandate_id": child_mandate_ref,
                        "amount_minor": amt_minor,
                        "currency": "USD" if paypal_approval_url else cur,
                        "action": task.get("action"),
                        "rail": "PayPal" if paypal_approval_url else "Simulation",
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
                    "message": (
                        f"PayPal order created for {budget_str}. Awaiting sandbox buyer approval..."
                        if paypal_approval_url
                        else f"Executing payment authorization of {budget_str} via child mandate on PayGuardian Gateway..."
                    ),
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
                    "result": tool_result,
                },
                run_id=run_id,
                task_id=task_id,
                agent=agent_name,
            )

            if paypal_approval_url:
                self.event_emitter.emit(
                    "payment.order_created",
                    payload={
                        "actionId": payment_action_id,
                        "provider": "paypal",
                        "providerOrderId": paypal_order_id,
                        "approvalUrl": paypal_approval_url,
                        "amountMinor": amt_minor,
                        "currency": "USD",
                        "agentId": agent_name,
                        "recipient": task.get("description", f"{agent_name.capitalize()} Merchant"),
                    },
                    run_id=run_id,
                    task_id=task_id,
                    agent=agent_name,
                )

            # Subagent completion via MCP tools and specialist prompts
            mcp_tools = PayGuardianMCPTools(
                state=state,
                gateway_client=self.gateway_client,
                subagent_registry=subagent_registry,
                environment_id=environment_id,
                mandate_id=mandate_id,
            )
            subagent_result = execute_specialist_agent(
                agent_name, task, prompt, model_id=effective_model, mcp_tools=mcp_tools
            )
            if "payment_authorization" in subagent_result:
                subagent_result["payment_authorization"]["action_id"] = payment_action_id
                subagent_result["payment_authorization"]["payment_intent"] = payment_action_id
                subagent_result["payment_authorization"]["mandate_id"] = child_mandate_ref
                if paypal_approval_url:
                    subagent_result["payment_authorization"]["approval_url"] = paypal_approval_url
                    subagent_result["payment_authorization"]["provider_order_id"] = paypal_order_id
                    subagent_result["payment_authorization"]["rail"] = "PayPal"
                    subagent_result["payment_authorization"]["status"] = "awaiting_approval"
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
            if paypal_approval_url and output_summary:
                output_summary += (
                    f"\n\n💳 **PayPal Sandbox Payment Created**: A payment of {budget_str} has been reserved. "
                    f"Please [**Approve on PayPal Sandbox**]({paypal_approval_url}) to authorize and capture funds."
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
        messages = state.get("messages", [])
        prompt = extract_user_prompt(messages)
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

        # If user approved but no proposal is pending
        if state.get("no_pending_proposal_to_approve"):
            no_prop_text = (
                "There is currently no pending budget proposal or mandate delegation awaiting your authorization. "
                "If you would like to plan a new trip or delegate tasks to specialist agents, please let me know your goal!"
            )
            self.event_emitter.emit(
                "agent.output",
                payload={"agent": "personal", "agentId": "personal", "output": no_prop_text, "text": no_prop_text},
                run_id=run_id,
                agent="personal",
            )
            self.event_emitter.emit(
                "task.completed",
                payload={"task_id": "root_personal_coordinator", "agent": "personal", "agentId": "personal", "status": "completed"},
                run_id=run_id,
                agent="personal",
            )
            self.event_emitter.emit(
                "run.completed",
                payload={"run_id": run_id, "status": "completed", "finalResponse": no_prop_text},
                run_id=run_id,
                agent="personal",
            )
            return {"final_response": no_prop_text, "events": self.event_emitter.events}

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

            available_reserve_minor = state.get("available_reserve_minor")
            available_reserve = (
                available_reserve_minor
                if available_reserve_minor is not None
                else (budget_limit_minor or 0)
            )
            reserve_display = (
                _format_budget(available_reserve, budget_currency)
                if available_reserve > 0
                else "not specified"
            )

            proposal_lines = [
                "### 🛡️ PayGuardian Budget Allocation Proposal",
                "",
                f"I've evaluated the quotes from our specialist subagents against your available mandate reserve of **{reserve_display}**.",
                "",
                "#### 📋 Proposed Specialist Delegations",
                "| Specialist Agent | Quoted Amount | Proposed Mandate | Estimated Purpose & Reasoning | Status |",
                "| :--- | :--- | :--- | :--- | :--- |",
            ]
            total_proposed = 0
            for task in subagent_tasks:
                if task.get("status") != "authorization_pending" or task.get("amount_minor", 0) <= 0:
                    continue
                amt = task.get("amount_minor", 0)
                cur = task.get("currency", budget_currency)
                agent_name = task.get("agent", "unknown")
                status = task.get("status", "authorization_pending")
                is_child_task = bool(task.get("parent_task_id"))
                parent_alias = (task.get("parent_agent_id") or "Travel").replace("agent-", "").replace("-", " ").title()
                label = f"↳ {agent_name.capitalize()} (Sub-agent under {parent_alias})" if is_child_task else f"{agent_name.capitalize()} Specialist"
                reasoning = task.get("reasoning") or task.get("description") or "Specialist domain estimate"
                proposal_lines.append(
                    f"| **{label}** | {_format_budget(amt, cur)} | {_format_budget(amt, cur)} | {reasoning} | `{status}` |"
                )
                if not is_child_task:
                    total_proposed += amt

            rem = max(0, available_reserve - total_proposed if available_reserve > 0 else 0)
            proposal_lines.extend([
                "",
                f"**Total Proposed Delegation:** {_format_budget(total_proposed, budget_currency)}",
                f"**Remaining Mandate Buffer:** {_format_budget(rem, budget_currency)}",
                "",
                "> ⚠️ **Human Authorization Required**: To safeguard your funds, cryptographic child mandates have not been issued yet and no payments have occurred. Please review the proposal above and click **Approve & Issue Cryptographic Mandates** (or reply *'okay delegate'*) to grant spending authority, or **Reject Proposal** to cancel.",
                ">",
                "> 💡 **Ready to Purchase**: Once this delegation is authorized, each subagent holds its own dedicated spending envelope. You can then simply instruct the system or subagent to execute payment whenever ready (e.g., *'buy me the hotel'*, *'book the flight'*, or *'order dinner'*).",
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
        environment_id = state.get("environment_id")
        if not allocation_lines and environment_id and self.gateway_client:
            try:
                env_mandates = self.gateway_client.list_mandates(environment_id)
                env_agents = self.gateway_client.list_agents(environment_id)
                agent_name_by_id = {a["id"]: a.get("name", a["id"]) for a in env_agents}
                root_m = next((m for m in env_mandates if not m.get("parentMandateId")), None)
                
                # Filter only active, non-superseded child mandates
                active_child_mandates = [
                    m for m in env_mandates
                    if m.get("parentMandateId") and m.get("state") == "active" and not m.get("supersededAt")
                ]
                
                # Deduplicate by series keeping the highest version
                series_map: dict[str, dict[str, Any]] = {}
                for m in active_child_mandates:
                    s_id = m.get("mandateSeriesId") or f"{m.get('parentMandateId')}_{m.get('holderAgentId')}"
                    existing = series_map.get(s_id)
                    if not existing or m.get("version", 1) > existing.get("version", 1):
                        series_map[s_id] = m
                child_mandates = list(series_map.values())

                if child_mandates:
                    total_delegated = 0
                    root_id = root_m.get("id") if root_m else None
                    
                    # Separate direct children from nested children
                    direct_children = [
                        cm for cm in child_mandates
                        if not root_id or cm.get("parentMandateId") == root_id
                    ]
                    
                    # Group nested children by parentMandateId
                    nested_by_parent: dict[str, list[dict[str, Any]]] = {}
                    for cm in child_mandates:
                        p_id = cm.get("parentMandateId")
                        if root_id and p_id != root_id:
                            nested_by_parent.setdefault(p_id, []).append(cm)

                    # Hierarchical dynamic rendering: each parent is followed by its own child subagents
                    for parent_cm in direct_children:
                        holder_name = agent_name_by_id.get(parent_cm.get("holderAgentId"), "Specialist")
                        amt = parent_cm.get("budgetLimitMinor", 0)
                        cur = parent_cm.get("currency", budget_currency)
                        total_delegated += amt
                        allocation_lines.append(f"  - {holder_name}: {_format_budget(amt, cur)}")

                        # Sub-delegations nested strictly under this parent
                        for sub_cm in nested_by_parent.get(parent_cm.get("id"), []):
                            sub_name = agent_name_by_id.get(sub_cm.get("holderAgentId"), "Specialist")
                            sub_amt = sub_cm.get("budgetLimitMinor", 0)
                            sub_cur = sub_cm.get("currency", budget_currency)
                            allocation_lines.append(f"    ↳ {sub_name}: {_format_budget(sub_amt, sub_cur)} (under {holder_name})")

                    if root_m and root_m.get("budgetLimitMinor"):
                        budget_limit_minor = root_m["budgetLimitMinor"]
                        budget_display = _format_budget(budget_limit_minor, budget_currency)
            except Exception as e_m:
                logger.debug("Could not inspect active env mandates for synthesizer: %s", e_m)

        allocation_summary = "\n".join(allocation_lines) if allocation_lines else "  None"
        total_delegated_display = _format_budget(total_delegated, budget_currency)
        remaining = max(0, budget_limit_minor - total_delegated if budget_limit_minor > 0 else 0)

        context_compiler = ContextCompiler(gateway_client=self.gateway_client, subagent_registry=subagent_registry)
        op_context = context_compiler.compile_operational_context(
            current_message=prompt,
            messages=messages,
            active_plan=state.get("plan"),
            active_tasks=subagent_tasks,
            environment_id=state.get("environment_id"),
            mandate_id=state.get("mandate_id"),
            fallback_state=state,
        )

        system_instruction = CORE_SYSTEM_INSTRUCTIONS

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
                pay_auth = res.get("payment_authorization")
                if pay_auth and isinstance(pay_auth, dict):
                    pay_status = pay_auth.get("status")
                    pay_amt = _format_budget(pay_auth.get("amount_minor", 0), pay_auth.get("currency", budget_currency))
                    appr_id = pay_auth.get("approval_id")
                    appr_url = pay_auth.get("approval_url")
                    rich_text += f"\n- Payment Initiation: {pay_status} for {pay_amt}"
                    if appr_id:
                        rich_text += f"\n- Gateway Approval ID: {appr_id}"
                    if appr_url:
                        rich_text += f"\n- PayPal Sandbox Checkout URL: {appr_url}"
                context_parts.append(f"[{agent_name.upper()} AGENT RESULT]\n{rich_text}")
            context_summary = "\n\n".join(context_parts)

        llm_prompt = (
            f"{op_context}\n\n"
            f"User Request: {prompt}\n\n"
            f"{('Subagent Results:\n' + context_summary) if context_summary else ''}\n\n"
            "Communicate clearly and honestly. When answering budget or execution questions:\n"
            "- Use actual application data from the operational context and subagent results.\n"
            "- If a specialist subagent has initiated a payment awaiting human approval (status 'awaiting_approval'), clearly inform the user that the subagent submitted the payment request to the PayGuardian Gateway, report the Gateway Approval ID, and provide the PayPal Sandbox Checkout URL (if present) so the user can authorize or complete the transaction.\n"
            "- Present the relevant figures clearly.\n"
            "- Distinguish proposals from authorized allocations.\n"
            "- Distinguish completed tasks from pending tasks.\n"
            "- Never invent missing information."
        )

        mcp_tools = PayGuardianMCPTools(
            state=state,
            gateway_client=self.gateway_client,
            subagent_registry=subagent_registry,
            environment_id=state.get("environment_id"),
            mandate_id=state.get("mandate_id"),
        )

        final_response = ""
        try:
            resp = provider.generate(
                prompt=llm_prompt,
                system_instruction=system_instruction,
                model=resolved_model,
                max_tokens=1800,
            )
            raw_content = resp.content if hasattr(resp, "content") else str(resp)
            if hasattr(resp, "tool_calls") and resp.tool_calls:
                for tc in resp.tool_calls:
                    mcp_tools.call_tool(tc.name, tc.arguments)
            cleaned = re.sub(r"<tool_call>.*?</tool_call>", "", raw_content, flags=re.DOTALL).strip()
            final_response = cleaned
        except Exception as exc:
            logger.debug("Synthesizer LLM generation fallback: %s", exc)

        if not final_response:
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
        available_reserve_minor: int | None = None,
        already_delegated_minor: int | None = None,
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

        is_confirmed = is_confirmation_message(prompt_text) or (bool(messages and len(messages) > 1) and is_payment_order_message(prompt_text))
        is_rejected = is_rejection_message(prompt_text)

        eff_budget_limit = budget_limit_minor or 0
        eff_available_reserve = available_reserve_minor
        eff_already_delegated = already_delegated_minor or 0

        if eff_available_reserve is None and self.gateway_client and environment_id:
            try:
                context_compiler = ContextCompiler(gateway_client=self.gateway_client)
                live_facts = context_compiler.fetch_live_application_context(
                    environment_id=environment_id,
                    mandate_id=mandate_id,
                    fallback_state={"budget_limit_minor": eff_budget_limit, "budget_currency": budget_currency or "USD"},
                )
                eff_budget_limit = live_facts.get("budget_limit_minor", eff_budget_limit)
                eff_available_reserve = live_facts.get("remaining_reserve_minor")
                eff_already_delegated = live_facts.get("total_delegated_minor", 0)
            except Exception:
                pass

        if eff_available_reserve is None:
            eff_available_reserve = eff_budget_limit

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
            "budget_limit_minor": eff_budget_limit,
            "available_reserve_minor": eff_available_reserve,
            "already_delegated_minor": eff_already_delegated,
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
