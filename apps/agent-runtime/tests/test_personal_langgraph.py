"""Unit tests for LangGraph Personal Agent and event emission."""

import pytest
from fastapi.testclient import TestClient

from agent_runtime.gateway_client import GatewayClient
from agent_runtime.main import app
from agent_runtime.personal_langgraph import (
    EventEmitter,
    PersonalLangGraphAgent,
    sanitize_event_data,
)

client = TestClient(app)


def test_langgraph_agent_full_workflow() -> None:
    agent = PersonalLangGraphAgent()
    result = agent.run("Plan a weekend getaway to Seattle with hotel and dinner")

    assert "final_response" in result
    assert len(result["final_response"]) > 0

    # Verify plan contains subgoals
    assert len(result["plan"]) >= 3
    assert any("travel" in step.lower() or "itinerary" in step.lower() for step in result["plan"])

    # Verify subagent tasks
    tasks = result["subagent_tasks"]
    assert len(tasks) >= 3
    agent_names = {t["agent"] for t in tasks}
    assert "travel" in agent_names
    assert "hotel" in agent_names
    assert "food" in agent_names

    for t in tasks:
        assert t["status"] == "completed"
        assert t["authority_checked"] is True
        assert t["delegated"] is True

    # Verify results
    results = result["results"]
    assert "travel" in results
    assert "hotel" in results
    assert "food" in results


def test_structured_events_emission() -> None:
    emitted_events: list[dict] = []
    emitter = EventEmitter(listener=lambda e: emitted_events.append(e))

    agent = PersonalLangGraphAgent(event_emitter=emitter)
    _ = agent.run("Plan a trip to Tokyo with lodging and ramen recommendations")

    event_types = [e["event_type"] for e in emitted_events]

    # Verify all 9 required event types are emitted
    required_events = [
        "run.started",
        "task.created",
        "agent.started",
        "agent.progress",
        "tool.started",
        "tool.completed",
        "agent.output",
        "task.completed",
        "run.completed",
    ]

    for req in required_events:
        assert req in event_types, f"Missing required event: {req}"

    # Verify event order invariants
    first_run_started = event_types.index("run.started")
    last_run_completed = len(event_types) - 1 - event_types[::-1].index("run.completed")
    assert first_run_started == 0
    assert last_run_completed == len(event_types) - 1

    # Verify event structure
    for event in emitted_events:
        assert "event_type" in event
        assert "timestamp" in event
        assert "payload" in event
        assert isinstance(event["payload"], dict)


def test_private_chain_of_thought_not_exposed() -> None:
    # Test data sanitization directly
    dirty_payload = {
        "summary": "Legitimate user-facing plan",
        "thought": "Private internal reasoning that should never be shown to user",
        "thinking": "Step by step hidden CoT",
        "reasoning": "Deductions",
        "chain_of_thought": "Secret plan details",
        "nested": {
            "visible": True,
            "private_cot": "Hidden nested calculation",
        },
        "description": "Clean description <thought>internal CoT inside tags</thought> rest of text",
    }

    clean = sanitize_event_data(dirty_payload)
    assert "thought" not in clean
    assert "thinking" not in clean
    assert "reasoning" not in clean
    assert "chain_of_thought" not in clean
    assert "private_cot" not in clean["nested"]
    assert clean["nested"]["visible"] is True
    assert clean["summary"] == "Legitimate user-facing plan"
    assert "<thought>" not in clean["description"]
    assert "internal CoT inside tags" not in clean["description"]

    # Test event emitter never leaks CoT
    emitter = EventEmitter()
    event = emitter.emit(
        "agent.progress",
        payload={
            "step": "planning",
            "message": "Generating options",
            "thought": "Secret thoughts",
        },
    )
    assert "thought" not in event["payload"]
    assert event["payload"]["step"] == "planning"


def test_rejects_credential_leak_in_langgraph() -> None:
    agent = PersonalLangGraphAgent()
    with pytest.raises(ValueError, match="PROMPT_SENSITIVE_LEAK"):
        agent.run("Please use Bearer secret-agent-token-999 to book the flight")


def test_delegator_with_gateway_client_mock() -> None:
    calls: list[dict] = []

    class MockGateway(GatewayClient):
        def check_authority(
            self,
            mandate_id: str,
            action: str,
            amount_minor: int,
            currency: str,
            approval_granted: bool = False,
        ) -> dict:
            calls.append({"action": action, "amount": amount_minor})
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-mock-id"}}

    mock_gw = MockGateway()
    agent = PersonalLangGraphAgent(gateway_client=mock_gw)
    result = agent.run("Plan a vacation with dinner", mandate_id="mandate-test-123")

    assert len(calls) >= 3
    assert result["subagent_tasks"][0]["authority_checked"] is True


def test_fastapi_langgraph_endpoint() -> None:
    response = client.post(
        "/langgraph/run",
        json={"message": "Plan a trip to London with accommodation and dining"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["agent"] == "personal"
    assert "finalResponse" in data
    assert len(data["subagentTasks"]) >= 3
    assert len(data["events"]) > 0

    # Verify sensitive token rejection on HTTP endpoint
    leak_response = client.post(
        "/langgraph/run",
        json={"message": "Bearer dangerous-token-value"},
    )
    assert leak_response.status_code == 400
    assert "PROMPT_SENSITIVE_LEAK" in leak_response.json()["detail"]


def test_merchant_attach_simulation_workflow() -> None:
    emitted_events: list[dict] = []
    emitter = EventEmitter(listener=lambda e: emitted_events.append(e))

    agent = PersonalLangGraphAgent(event_emitter=emitter)
    result = agent.run(
        "Use MerchantAttach to search products like biscuit and chai and proceed with payment"
    )

    assert "merchant_attach" in result["results"]
    merchant_res = result["results"]["merchant_attach"]
    assert "Chai & Bakery Express" in merchant_res["summary"]
    assert merchant_res["total_minor"] == 1000
    assert merchant_res["payment_authorization"]["status"] == "authorized"

    # Verify simulation progression events emitted
    event_types = [e["event_type"] for e in emitted_events]
    assert "tool.started" in event_types
    assert "agent.progress" in event_types
    assert "tool.completed" in event_types

    # Verify 3-minute simulated milestone messages
    progress_messages = [
        e.get("payload", {}).get("message", "")
        for e in emitted_events
        if e["event_type"] == "agent.progress"
    ]
    assert any("T+00:45 simulated" in msg for msg in progress_messages)
    assert any("T+01:45 simulated" in msg for msg in progress_messages)
    assert any("T+02:40 simulated" in msg for msg in progress_messages)


def test_agent_discovery_query_handling() -> None:
    agent = PersonalLangGraphAgent()
    result = agent.run("how many agents do you have")

    assert "final_response" in result
    assert len(result["final_response"]) > 0
    # Should not spawn unrelated travel subgoals
    assert len(result["subagent_tasks"]) == 0


def test_transport_delegation_for_train_ticket() -> None:
    agent = PersonalLangGraphAgent()
    result = agent.run("delegate the money to buy the train ticket")

    assert len(result["subagent_tasks"]) == 1
    assert result["subagent_tasks"][0]["agent"] == "transport"
    assert result["subagent_tasks"][0]["status"] == "completed"
    assert "transport" in result["results"]


def test_biscuit_purchase_clarification_required() -> None:
    """When buying biscuits without location, subagent returns structured clarification request."""
    calls: list[dict] = []

    class MockGateway(GatewayClient):
        def check_authority(
            self,
            mandate_id: str,
            action: str,
            amount_minor: int,
            currency: str,
            approval_granted: bool = False,
        ) -> dict:
            calls.append({"action": action, "amount": amount_minor})
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-mock-id"}}

    mock_gw = MockGateway()
    agent = PersonalLangGraphAgent(gateway_client=mock_gw)

    result = agent.run("okay i what to buy biscuit can you buy me one", mandate_id="mandate-test-123")

    # Verify task went into clarification_required phase
    assert result.get("clarification_required") is True
    tasks = result["subagent_tasks"]
    assert len(tasks) == 1
    assert tasks[0]["agent"] == "merchant_attach"
    assert tasks[0]["phase"] == "clarification_required"
    assert "location" in tasks[0]["missing_fields"]

    # Verify exact structured clarification request format
    clarif_req = tasks[0].get("clarification_request")
    assert clarif_req is not None
    assert clarif_req["status"] == "clarification_required"
    assert len(clarif_req["questions"]) == 1
    q = clarif_req["questions"][0]
    assert q["question"] == "Which city or area should I search in?"
    assert q["required"] is True
    assert q["reason"] == "Finding nearby merchants"

    # Verify no spending authority check was performed with amount=0
    assert len(calls) == 0

    # Verify final response asks the user for the missing location
    final_response = result["final_response"].lower()
    assert "which city or area should i search in" in final_response or "location" in final_response


def test_biscuit_purchase_flow_with_gandhinagar_user_turn() -> None:
    """User provides 'gandhinagar, gujarat, india and i would prefer any brand' in turn 2 -> resumes and executes."""
    class MockGateway(GatewayClient):
        def check_authority(self, *args, **kwargs) -> dict:
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-gandhinagar-id"}}

    agent = PersonalLangGraphAgent(gateway_client=MockGateway())

    # Turn 1: User asks without location
    turn1_messages = [{"role": "user", "content": "okay i what to buy biscuit can you buy me one"}]
    result1 = agent.run(messages=turn1_messages, budget_currency="INR")
    assert result1.get("clarification_required") is True

    # Turn 2: User responds with Gandhinagar and 'any brand'
    turn2_messages = [
        {"role": "user", "content": "okay i what to buy biscuit can you buy me one"},
        {"role": "assistant", "content": result1["final_response"]},
        {"role": "user", "content": "i am in gandhinagar, gujarat, india and i would prefer any brand"},
    ]
    result2 = agent.run(
        messages=turn2_messages,
        mandate_id="mandate-test-123",
        budget_limit_minor=1000000,
        budget_currency="INR",
    )

    # In Turn 2, clarification is satisfied and task resumes to completion
    assert result2.get("clarification_required") is False
    assert len(result2["subagent_tasks"]) == 1
    task = result2["subagent_tasks"][0]
    assert task["phase"] == "completed"
    assert task["status"] == "completed"
    assert task["amount_minor"] > 0
    assert "merchant_attach" in result2["results"]
    assert "Gandhinagar" in result2["results"]["merchant_attach"]["merchant"] or "Gandhinagar" in result2["final_response"]


def test_biscuit_purchase_quote_to_authorized_execution() -> None:
    """When user provides location and preference, subagent discovers quotes and gateway authorizes non-zero budget."""
    calls: list[dict] = []

    class MockGateway(GatewayClient):
        def check_authority(
            self,
            mandate_id: str,
            action: str,
            amount_minor: int,
            currency: str,
            approval_granted: bool = False,
        ) -> dict:
            calls.append({"action": action, "amount": amount_minor})
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-mock-id"}}

    mock_gw = MockGateway()
    agent = PersonalLangGraphAgent(gateway_client=mock_gw)

    result = agent.run(
        "I am in Indiranagar Bangalore, buy me 2 packs of Britannia Bourbon",
        mandate_id="mandate-test-123",
        budget_limit_minor=1000000,  # ₹10,000.00
        budget_currency="INR",
    )

    assert result.get("clarification_required") is False
    tasks = result["subagent_tasks"]
    assert len(tasks) == 1
    task = tasks[0]
    assert task["agent"] == "merchant_attach"
    assert task["phase"] == "completed"
    assert task["status"] == "completed"
    assert task["authority_checked"] is True
    assert task["delegated"] is True

    # Quoted amount must be positive (₹100.00 = 10000 minor)
    assert task["amount_minor"] > 0
    assert task["quoted_amount_minor"] == task["amount_minor"]

    # Gateway authority check was called with positive non-zero amount
    assert len(calls) == 1
    assert calls[0]["amount"] == task["amount_minor"]
    assert calls[0]["action"] == "procure_merchant_goods"


def test_multi_turn_clarification_preserves_state() -> None:
    """Conversation history carries clarification answers across turns without restarting discovery."""
    agent = PersonalLangGraphAgent()

    # Turn 1: User asks without details
    turn1_messages = [{"role": "user", "content": "buy biscuit"}]
    result1 = agent.run(messages=turn1_messages, budget_currency="INR")
    assert result1.get("clarification_required") is True

    # Turn 2: User provides location and brand preference in reply
    turn2_messages = [
        {"role": "user", "content": "buy biscuit"},
        {"role": "assistant", "content": result1["final_response"]},
        {"role": "user", "content": "I am in Indiranagar Bangalore, get Britannia Bourbon"},
    ]
    result2 = agent.run(messages=turn2_messages, budget_currency="INR")

    # In Turn 2, clarification is satisfied and execution completes
    assert result2.get("clarification_required") is False
    assert len(result2["subagent_tasks"]) == 1
    assert result2["subagent_tasks"][0]["phase"] == "completed"
    assert result2["subagent_tasks"][0]["amount_minor"] > 0
    assert "merchant_attach" in result2["results"]


def test_budget_exceeded_prevents_unauthorized_execution() -> None:
    """When a quote exceeds available mandate budget, task transitions to failed without execution."""
    agent = PersonalLangGraphAgent()

    # Budget limit is set to 500 minor (₹5.00), while biscuit quote is ₹100.00 (10000 minor)
    result = agent.run(
        "I am in Indiranagar Bangalore, buy me 2 packs of Britannia Bourbon",
        mandate_id="mandate-test-123",
        budget_limit_minor=500,
        budget_currency="INR",
    )

    task = result["subagent_tasks"][0]
    assert task["phase"] == "failed"
    assert task["status"] == "budget_exceeded"
    assert task.get("delegated") is False
    # MerchantAttach execution result was NOT produced
    assert "merchant_attach" not in result.get("results", {})


def test_dynamic_agent_discovery_without_modifying_orchestrator() -> None:
    """Registering a new subagent in the capability registry allows Personal Agent to dynamically discover it."""
    from agent_runtime.subagent_registry import SubagentCapability, registry

    new_subagent = SubagentCapability(
        id="agent-cloud-optimizer",
        name="Cloud Cost Optimizer",
        alias="cloud_optimizer",
        specialty="custom",
        description="Autonomous spot instance scaling, cloud infrastructure optimization, compute capacity contracts, and invoice settlement.",
        capabilities=["cloud.discover", "compute.quote", "optimize_cloud_spend"],
        default_action="optimize_cloud_spend",
        sample_prompts=["Optimize AWS compute cluster spot instances and reduce cloud spend"],
    )
    registry.register(new_subagent)

    agent = PersonalLangGraphAgent()
    result = agent.run("Optimize AWS compute cluster spot instances and reduce cloud spend")

    tasks = result["subagent_tasks"]
    assert len(tasks) == 1
    assert tasks[0]["agent"] == "cloud_optimizer"
    assert tasks[0]["action"] == "optimize_cloud_spend"


def test_child_mandate_gateway_delegation_and_ledger_reserve_capture() -> None:
    """Verifies that child mandate is delegated to the Gateway and funds are reserved & captured on ledger."""
    delegated_calls: list[dict] = []
    reserved_calls: list[dict] = []
    captured_calls: list[str] = []

    class MockLedgerGateway(GatewayClient):
        def check_authority(self, **kwargs) -> dict:
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def list_agents(self, environment_id: str) -> list[dict]:
            return [
                {"id": "agent-root-personal", "name": "Personal Coordinator", "kind": "personal", "parentAgentId": None},
                {"id": "agent-merchant-attach", "name": "MerchantAttach", "kind": "custom", "parentAgentId": "agent-root-personal"},
            ]

        def delegate_mandate(self, **kwargs) -> dict:
            delegated_calls.append(kwargs)
            return {
                "mandate": {
                    "id": "mandate-child-merchant-real-001",
                    "parentMandateId": kwargs["mandate_id"],
                    "holderAgentId": kwargs["holder_agent_id"],
                    "budgetLimitMinor": kwargs["budget_limit_minor"],
                }
            }

        def list_ledger_accounts(self, environment_id: str) -> list[dict]:
            return [
                {"id": "acc_parent_root", "mandateId": "mandate-parent-123", "balanceMinor": 1000000, "currency": "INR"},
                {"id": "acc_child_merchant", "mandateId": "mandate-child-merchant-real-001", "balanceMinor": 10000, "currency": "INR"},
            ]

        def reserve_action(self, **kwargs) -> dict:
            reserved_calls.append(kwargs)
            return {
                "action": {"id": "act_reserve_tx_9988"},
                "reservation": {"id": "act_reserve_tx_9988", "state": "reserved"},
            }

        def capture_action(self, environment_id: str, action_id: str) -> dict:
            captured_calls.append(action_id)
            return {"reservation": {"id": action_id, "state": "captured"}}

    mock_gw = MockLedgerGateway()
    agent = PersonalLangGraphAgent(gateway_client=mock_gw)

    messages = [
        {"role": "user", "content": "buy biscuit"},
        {"role": "assistant", "content": "Which city or area should I search in?"},
        {"role": "user", "content": "I am in Gandhinagar, Gujarat, India. Buy Britannia Bourbon"},
    ]

    result = agent.run(
        messages=messages,
        environment_id="env-test-456",
        mandate_id="mandate-parent-123",
        budget_limit_minor=1000000,
        budget_currency="INR",
    )

    # 1. Child mandate delegated to Gateway
    assert len(delegated_calls) == 1
    assert delegated_calls[0]["holder_agent_id"] == "agent-merchant-attach"
    assert delegated_calls[0]["budget_limit_minor"] > 0
    assert result["subagent_tasks"][0]["child_mandate_id"] == "mandate-child-merchant-real-001"

    # 2. Ledger reserve and capture executed
    assert len(reserved_calls) == 1
    assert reserved_calls[0]["mandate_id"] == "mandate-child-merchant-real-001"
    assert reserved_calls[0]["amount_minor"] == result["subagent_tasks"][0]["amount_minor"]
    assert len(captured_calls) == 1
    assert captured_calls[0] == "act_reserve_tx_9988"

    # 3. Action ID recorded in payment authorization
    merchant_res = result["results"]["merchant_attach"]
    assert merchant_res["payment_authorization"]["action_id"] == "act_reserve_tx_9988"


def test_child_mandate_paypal_order_creation_flow() -> None:
    """When a specialist task uses USD currency or PayPal rail, a PayPal order with an approval URL is created."""
    paypal_order_calls = []

    class MockPayPalGateway(GatewayClient):
        def check_authority(self, *args, **kwargs) -> dict:
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def get_catalog(self) -> list[dict]:
            return [
                {
                    "name": "merchant_attach",
                    "displayName": "MerchantAttach Agent",
                    "description": "Simulated procurement",
                    "supportedRails": ["PayPal", "Simulation"],
                }
            ]

        def list_agents(self, environment_id: str) -> list[dict]:
            return []

        def register_child_agent(self, *args, **kwargs) -> dict:
            return {"agent": {"id": "agent-merchant-paypal"}}

        def list_mandates(self, environment_id: str) -> list[dict]:
            return []

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-paypal-001"}}

        def list_ledger_accounts(self, environment_id: str) -> list[dict]:
            return [{"id": "acc-root-usd", "mandateId": "mandate-root-usd"}]

        def create_ledger_account(self, *args, **kwargs) -> dict:
            return {"account": {"id": "acc-child-usd"}}

        def allocate_ledger(self, *args, **kwargs) -> dict:
            return {"allocation": {"id": "alloc-child-usd"}}

        def create_paypal_order(self, **kwargs) -> dict:
            paypal_order_calls.append(kwargs)
            return {
                "action": {"id": "act_paypal_1001", "amountMinor": kwargs.get("amount_minor")},
                "reservation": {"id": "res_paypal_1001"},
                "order": {
                    "id": "order_pp_555",
                    "status": "CREATED",
                    "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=order_pp_555",
                    "currency": "USD",
                    "amountMinor": kwargs.get("amount_minor"),
                },
            }

    emitted_events = []
    emitter = EventEmitter(listener=lambda e: emitted_events.append(e))

    agent = PersonalLangGraphAgent(gateway_client=MockPayPalGateway(), event_emitter=emitter)

    messages = [
        {"role": "user", "content": "buy biscuit"},
        {"role": "assistant", "content": "Which city or area should I search in?"},
        {"role": "user", "content": "I am in New York, USA. Buy Britannia Bourbon and proceed with payment in USD"},
    ]

    result = agent.run(
        messages=messages,
        environment_id="env-usd-123",
        mandate_id="mandate-root-usd",
        budget_limit_minor=50000,
        budget_currency="USD",
    )

    assert len(paypal_order_calls) >= 1
    assert paypal_order_calls[0]["currency"] == "USD"
    assert paypal_order_calls[0]["mandate_id"] == "mandate-child-paypal-001"

    payment_events = [e for e in emitted_events if e.get("event_type") == "payment.order_created"]
    assert len(payment_events) >= 1
    assert payment_events[0]["payload"]["provider"] == "paypal"
    assert payment_events[0]["payload"]["providerOrderId"] == "order_pp_555"
    assert "https://www.sandbox.paypal.com/checkoutnow?token=order_pp_555" in payment_events[0]["payload"]["approvalUrl"]


def test_okay_delegate_activates_only_ongoing_plan() -> None:
    """When user confirms with 'okay delegate', only the active subagent is delegated, avoiding keyword leak traps."""
    class MockGateway(GatewayClient):
        def check_authority(self, *args, **kwargs) -> dict:
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-plan-id"}}

    agent = PersonalLangGraphAgent(gateway_client=MockGateway())

    # Multi-turn history with biscuit purchase and coordinator fallback note containing external link
    messages = [
        {"role": "user", "content": "okay i what to buy biscuit can you buy me one"},
        {"role": "assistant", "content": "Which city or area should I search in?"},
        {"role": "user", "content": "i am at gandhinagar, gujarat, india"},
        {
            "role": "assistant",
            "content": (
                "Coordinated Plan: MerchantAttach selected Chai & Bakery Express (Gandhinagar). "
                "Quoted ₹70.00. (Fallback coordinator response — LLM unavailable: Please visit https://apinex.bond/overview)"
            ),
        },
        {"role": "user", "content": "okay delegate"},
    ]

    result = agent.run(
        messages=messages,
        mandate_id="mandate-test-123",
        budget_limit_minor=1000000,
        budget_currency="INR",
    )

    tasks = result["subagent_tasks"]
    # MUST only delegate to merchant_attach; travel, hotel, food MUST NOT be activated
    assert len(tasks) == 1
    assert tasks[0]["agent"] == "merchant_attach"
    assert tasks[0]["phase"] == "completed"
    assert "merchant_attach" in result["results"]
    assert "travel" not in result["results"]
    assert "hotel" not in result["results"]
    assert "food" not in result["results"]


def test_human_approval_pause_and_budget_proposal_event() -> None:
    """When approval_required=True and user has not confirmed, agent halts after budget planner and emits approval.requested."""
    emitter = EventEmitter()
    agent = PersonalLangGraphAgent(event_emitter=emitter)

    messages = [
        {"role": "user", "content": "i am at gandhinagar, gujarat, india. buy me biscuit and chai"},
    ]

    result = agent.run(
        messages=messages,
        mandate_id="mandate-root-100",
        budget_limit_minor=1000000,
        budget_currency="INR",
        approval_required=True,
    )

    # 1. State must reflect approval_pending
    assert result.get("approval_pending") is True
    assert result.get("is_user_confirmed") is False

    # 2. Must emit approval.requested event with type budget_proposal
    approval_events = [e for e in emitter.events if e.get("event_type") == "approval.requested"]
    assert len(approval_events) == 1
    ev_payload = approval_events[0].get("payload", {})
    assert ev_payload.get("type") == "budget_proposal"
    assert ev_payload.get("currency") == "INR"
    assert ev_payload.get("rootBudgetMinor") == 1000000
    assert len(ev_payload.get("proposedAllocations", [])) >= 1

    # 3. Tasks must remain in authorization_pending status without executing payment
    tasks = result["subagent_tasks"]
    assert len(tasks) >= 1
    for t in tasks:
        assert t["status"] == "authorization_pending"
        assert t["phase"] == "authorization_pending"

    # 4. Results must NOT contain completed payments
    assert len(result.get("results", {})) == 0

    # 5. Synthesizer final response must prompt for human authorization
    final_text = result.get("final_response", "")
    assert "Human Authorization Required" in final_text or "Approve & Issue Cryptographic Mandates" in final_text


def test_human_approval_confirmation_flow() -> None:
    """When user replies 'okay delegate', orchestrator recognizes confirmation and proceeds to authorized execution."""
    class MockGateway(GatewayClient):
        def check_authority(self, *args, **kwargs) -> dict:
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-confirm-id"}}

    emitter = EventEmitter()
    agent = PersonalLangGraphAgent(gateway_client=MockGateway(), event_emitter=emitter)

    messages = [
        {"role": "user", "content": "i am at gandhinagar, gujarat, india. buy me biscuit and chai"},
        {
            "role": "assistant",
            "content": "Proposed Budget Allocation: MerchantAttach ₹70.00. Please approve or reject.",
        },
        {"role": "user", "content": "okay delegate"},
    ]

    result = agent.run(
        messages=messages,
        mandate_id="mandate-root-100",
        budget_limit_minor=1000000,
        budget_currency="INR",
        approval_required=True,
    )

    # Must proceed past authorization_pending to completion
    assert result.get("approval_pending") is False
    assert result.get("is_user_confirmed") is True
    tasks = result["subagent_tasks"]
    assert len(tasks) == 1
    assert tasks[0]["status"] == "completed"
    assert "merchant_attach" in result["results"]


def test_human_approval_confirmation_with_natural_payment_phrase() -> None:
    """When user replies 'okay these are the plan go and make the payment of these', orchestrator recognizes confirmation and proceeds to authorized execution."""
    class MockGateway(GatewayClient):
        def check_authority(self, *args, **kwargs) -> dict:
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-pay-id"}}

    emitter = EventEmitter()
    agent = PersonalLangGraphAgent(gateway_client=MockGateway(), event_emitter=emitter)

    messages = [
        {"role": "user", "content": "I need travel and hotel for my trip to Mumbai"},
        {
            "role": "assistant",
            "content": (
                "### 🛡️ PayGuardian Budget Allocation Proposal\n"
                "I've evaluated the quotes from our specialist subagents against your available mandate reserve.\n"
                "#### 📋 Proposed Specialist Delegations\n"
                "| Specialist Agent | Quoted Amount | Proposed Mandate | Estimated Purpose & Reasoning | Status |\n"
                "| **Travel Specialist** | ₹2,694.40 | ₹2,694.40 | Flight | `authorization_pending` |\n"
                "| **↳ Hotel (Sub-agent under Travel)** | ₹1,684.00 | ₹1,684.00 | Hotel | `authorization_pending` |\n"
                "> ⚠️ **Human Authorization Required**: To safeguard your funds, cryptographic child mandates have not been issued yet."
            ),
        },
        {"role": "user", "content": "okay these are the plan go and make the payment of these"},
    ]

    result = agent.run(
        messages=messages,
        mandate_id="mandate-root-100",
        budget_limit_minor=1000000,
        budget_currency="INR",
        approval_required=True,
    )

    # Must proceed past authorization_pending to completion without re-generating proposal
    assert result.get("approval_pending") is False
    assert result.get("is_user_confirmed") is True
    tasks = result["subagent_tasks"]
    assert len(tasks) >= 1
    assert tasks[0]["status"] == "completed"


def test_human_approval_rejection_flow() -> None:
    """When user replies with rejection ('reject'), orchestrator cleanly cancels without delegating funds."""
    emitter = EventEmitter()
    agent = PersonalLangGraphAgent(event_emitter=emitter)

    messages = [
        {"role": "user", "content": "i am at gandhinagar, gujarat, india. buy me biscuit and chai"},
        {
            "role": "assistant",
            "content": "Proposed Budget Allocation: MerchantAttach ₹70.00. Please approve or reject.",
        },
        {"role": "user", "content": "I reject the proposed budget allocation. Do not proceed."},
    ]

    result = agent.run(
        messages=messages,
        mandate_id="mandate-root-100",
        budget_limit_minor=1000000,
        budget_currency="INR",
        approval_required=True,
    )

    assert result.get("is_user_rejected") is True
    assert len(result.get("subagent_tasks", [])) == 0
    final_text = result.get("final_response", "")
    assert "rejected and cancelled" in final_text or "cancelled" in final_text


def test_budget_status_inquiry_does_not_create_subagents() -> None:
    """When user asks about allocations or remaining budget, no new purchase subagents are planned."""
    agent = PersonalLangGraphAgent()

    messages = [
        {"role": "user", "content": "i am planning to go goa and i want to make this trip cheaper so plan a budget"},
        {"role": "assistant", "content": "Here is the proposal: Travel ₹2,400, Food ₹2,690, Hotel ₹1,860."},
        {"role": "user", "content": "so how many amounts you have alocated to what and what we have left with"},
    ]

    result = agent.run(
        messages=messages,
        budget_limit_minor=1000000,
        budget_currency="INR",
        approval_required=True,
    )

    # Must NOT plan new subagents or require approval on an inquiry
    assert result.get("approval_pending") is False
    assert len(result.get("subagent_tasks", [])) == 0
    assert len(result.get("final_response", "")) > 0


def test_domain_isolation_and_clamping_prevents_negative_buffer() -> None:
    """Quotes must never produce a negative buffer, and over-budget quotes must be clamped."""
    agent = PersonalLangGraphAgent()

    result = agent.run(
        "Plan a budget for Goa trip including hotels, traveling, food, and activities",
        budget_limit_minor=1000000,  # ₹10,000.00
        budget_currency="INR",
        approval_required=True,
    )

    tasks = result.get("subagent_tasks", [])
    top_level_total = sum(t["amount_minor"] for t in tasks if not t.get("parent_task_id"))
    assert top_level_total <= 1000000

    # Ensure buffer is non-negative in the generated proposal response
    final_text = result.get("final_response", "")
    assert "₹-" not in final_text
    assert "Remaining Mandate Buffer" in final_text


def test_superseded_mandates_and_nested_delegations_are_not_double_counted() -> None:
    """Superseded mandate versions must not be counted, and nested child mandates must not be double counted against root."""
    class MockGateway(GatewayClient):
        def list_mandates(self, environment_id: str) -> list[dict]:
            return [
                {
                    "id": "root-1",
                    "budgetLimitMinor": 1000000,  # ₹10,000.00
                    "currency": "INR",
                    "state": "active",
                    "parentMandateId": None,
                },
                {
                    "id": "cm-merchant",
                    "holderAgentId": "merchant-agent",
                    "budgetLimitMinor": 7000,  # ₹70.00
                    "currency": "INR",
                    "state": "active",
                    "parentMandateId": "root-1",
                },
                # Version 1 of Food & Dining: SUPERSEDED
                {
                    "id": "cm-food-v1",
                    "mandateSeriesId": "series-food",
                    "version": 1,
                    "holderAgentId": "food-agent",
                    "budgetLimitMinor": 269000,  # ₹2,690.00
                    "currency": "INR",
                    "state": "superseded",
                    "supersededAt": "2026-11-10T12:00:00Z",
                    "parentMandateId": "root-1",
                },
                # Version 2 of Food & Dining: ACTIVE (topped up)
                {
                    "id": "cm-food-v2",
                    "mandateSeriesId": "series-food",
                    "version": 2,
                    "holderAgentId": "food-agent",
                    "budgetLimitMinor": 419000,  # ₹4,190.00
                    "currency": "INR",
                    "state": "active",
                    "parentMandateId": "root-1",
                },
                # Nested child mandate under Travel Concierge
                {
                    "id": "cm-hotel",
                    "holderAgentId": "hotel-agent",
                    "budgetLimitMinor": 186000,  # ₹1,860.00
                    "currency": "INR",
                    "state": "active",
                    "parentMandateId": "cm-travel",
                },
                # Travel Concierge under Root
                {
                    "id": "cm-travel",
                    "holderAgentId": "travel-agent",
                    "budgetLimitMinor": 240000,  # ₹2,400.00
                    "currency": "INR",
                    "state": "active",
                    "parentMandateId": "root-1",
                },
            ]

        def list_agents(self, environment_id: str) -> list[dict]:
            return [
                {"id": "merchant-agent", "name": "MerchantAttach"},
                {"id": "food-agent", "name": "Food & Dining Specialist"},
                {"id": "hotel-agent", "name": "Hotel Specialist"},
                {"id": "travel-agent", "name": "Travel Concierge"},
            ]

    agent = PersonalLangGraphAgent(gateway_client=MockGateway())
    messages = [
        {"role": "user", "content": "what is the current available budget we have?"}
    ]

    result = agent.run(
        messages=messages,
        budget_limit_minor=1000000,
        budget_currency="INR",
        environment_id="env-test",
    )

    final_text = result.get("final_response", "")
    # Superseded ₹2,690 must NOT appear as active
    assert "₹2,690.00" not in final_text
    # Direct allocations from root: 70 + 4190 + 2400 = 6660
    assert "₹6,660.00" in final_text
    # Remaining available reserve: 10000 - 6660 = 3340
    assert "₹3,340.00" in final_text
    # Hierarchical dynamic placement: Hotel Specialist is explicitly associated with Travel Concierge
    assert "Travel Concierge" in final_text and "Hotel Specialist" in final_text
    assert "₹1,860.00" in final_text


def test_proposal_explanation_query_does_not_retrigger_allocation_proposal() -> None:
    """When user asks how proposed amounts were determined, it must be treated as INFORMATION_QUERY and not re-propose."""
    from agent_runtime.context_compiler import ContextCompiler

    cc = ContextCompiler()
    messages = [
        {"role": "user", "content": "plan a 5 day budget trip to goa"},
        {
            "role": "assistant",
            "content": (
                "Proposed Specialist Delegations:\n"
                "Travel Specialist: ₹4,400.00\n"
                "Hotel Specialist: ₹4,400.00\n"
                "Would you like me to proceed with delegating this budget?"
            ),
        },
    ]

    question = "okay based on your proposal can you tell me more about how you come up with that proposed amount ??"
    intent, reasoning = cc.classify_intent(question, messages=messages)

    assert intent == "INFORMATION_QUERY"

    agent = PersonalLangGraphAgent()
    active_messages = messages + [{"role": "user", "content": question}]
    result = agent.run(
        messages=active_messages,
        budget_limit_minor=1000000,
        budget_currency="INR",
        approval_required=True,
    )

    # Must NOT re-trigger a new pending approval proposal
    assert result.get("approval_pending") is False
    # No new subagents scheduled for discovery
    assert len(result.get("subagent_tasks", [])) == 0
    # Orchestrator synthesizes explanatory response
    final_text = result.get("final_response", "")
    assert len(final_text) > 0


def test_quote_currency_minor_unit_scaling_for_inr() -> None:
    """When an LLM returns major units (e.g. 4400 for ₹4,400), it must be correctly scaled to 440000 paise."""
    from agent_runtime.personal_langgraph import dynamic_subagent_research_and_quote
    from unittest.mock import patch, MagicMock

    class MockProvider:
        def generate(self, *args, **kwargs):
            return MagicMock(
                content='{\n  "provider": "Goa Transit Express",\n  "reasoning": "Estimates based on typical budget intercity fares to Goa, keeping transport-only costs within the ₹4,400 ceiling",\n  "items": [{"name": "Train fare", "qty": 1, "unit_price_minor": 4400, "currency": "INR"}]\n}'
            )

    with patch("agent_runtime.llm_provider.LLMFactory.get_provider_for_model", return_value=(MockProvider(), "mock-model")):
        quote = dynamic_subagent_research_and_quote(
            agent_name="travel",
            prompt="plan a 5 day budget trip to goa with 10000 inr budget",
            currency="INR",
            budget_limit_minor=1000000,
        )

        # 4400 rupees must be scaled to 440000 paise (₹4,400.00), preventing the ₹44.00 decimal shift
        assert quote["total_minor"] == 440000
        assert quote["items"][0]["unit_price_minor"] == 440000


def test_available_reserve_calculation_and_banner_deducts_active_delegations() -> None:
    """When ₹44.00 is already delegated from ₹11,000.00, planning and proposal banner must use ₹10,956.00 available reserve."""
    class MockGateway(GatewayClient):
        def list_mandates(self, environment_id: str) -> list[dict]:
            return [
                {
                    "id": "root-11k",
                    "budgetLimitMinor": 1100000,  # ₹11,000.00
                    "currency": "INR",
                    "state": "active",
                    "parentMandateId": None,
                },
                # Already delegated Travel mandate
                {
                    "id": "cm-travel-prior",
                    "holderAgentId": "travel-agent",
                    "budgetLimitMinor": 4400,  # ₹44.00
                    "currency": "INR",
                    "state": "active",
                    "parentMandateId": "root-11k",
                },
            ]

        def list_agents(self, environment_id: str) -> list[dict]:
            return [
                {"id": "travel-agent", "name": "Travel Concierge"},
            ]

    agent = PersonalLangGraphAgent(gateway_client=MockGateway())
    result = agent.run(
        message="I need budget plan for traveling, sightseeing, street food and dinner",
        budget_limit_minor=1100000,
        available_reserve_minor=1095600,
        already_delegated_minor=4400,
        budget_currency="INR",
        approval_required=True,
        environment_id="env-11k",
    )

    final_text = result.get("final_response", "")
    assert result.get("approval_pending") is True

    # The proposal header MUST evaluate against the available reserve of ₹10,956.00
    assert "₹10,956.00" in final_text
    # Must NOT evaluate against the gross ₹11,000.00 as reserve
    assert "against your root mandate reserve of **₹11,000.00**" not in final_text
    assert "against your available mandate reserve of **₹10,956.00**" in final_text


def test_denied_approval_in_gateway_clears_pending_proposal_state() -> None:
    """When an approval proposal is rejected/denied in the dashboard, compile_operational_context
    must accurately reflect that the proposal was denied, not claim that a proposal is pending authorization."""
    from agent_runtime.context_compiler import ContextCompiler

    class MockGatewayWithRejection(GatewayClient):
        def list_approvals(self, environment_id: str, status: str | None = None) -> list[dict]:
            return [
                {
                    "id": "appr-123",
                    "status": "rejected",
                    "amountMinor": 332758,
                    "currency": "INR",
                }
            ]

        def list_mandates(self, environment_id: str) -> list[dict]:
            return [
                {
                    "id": "root-1",
                    "budgetLimitMinor": 1100000,
                    "currency": "INR",
                    "state": "active",
                }
            ]

    compiler = ContextCompiler(gateway_client=MockGatewayWithRejection())
    messages = [
        {"role": "user", "content": "plan a budget trip to pune"},
        {
            "role": "assistant",
            "content": (
                "Proposed Budget Allocation Proposal:\n"
                "Travel Specialist: ₹3,327.58\n"
                "Human authorization required. Please approve or reject."
            ),
        },
    ]

    # User returns to chat after clicking "Deny" in dashboard
    ctx = compiler.compile_operational_context(
        current_message="i want you to buy me cheap hotel room in pune",
        messages=messages,
        environment_id="env-test",
    )

    # Must NOT claim that an active proposal is pending authorization
    assert "PENDING_HUMAN_AUTHORIZATION" not in ctx
    assert "REJECTED / DENIED" in ctx

    # Also verify intent classification identifies payment execution
    intent, reasoning = compiler.classify_intent(
        "i want you to buy me cheap hotel room in pune",
        messages=messages,
    )
    assert intent == "PAYMENT_EXECUTION_INTENT"


def test_get_approval_status_mcp_tool() -> None:
    """PayGuardianMCPTools.get_approval_status retrieves approvals from Gateway."""
    from agent_runtime.mcp_tools import PayGuardianMCPTools

    class MockGatewayApprovals(GatewayClient):
        def list_approvals(self, environment_id: str, status: str | None = None) -> list[dict]:
            all_approvals = [
                {"id": "appr-1", "status": "pending", "amountMinor": 1000},
                {"id": "appr-2", "status": "rejected", "amountMinor": 2000},
            ]
            if status:
                return [a for a in all_approvals if a.get("status") == status]
            return all_approvals

        def get_approval(self, environment_id: str, approval_id: str) -> dict | None:
            if approval_id == "appr-1":
                return {"id": "appr-1", "status": "pending"}
            return None

    tools = PayGuardianMCPTools(
        gateway_client=MockGatewayApprovals(),
        environment_id="env-mcp",
    )

    res_all = tools.call_tool("get_approval_status", {})
    assert res_all["count"] == 2

    res_pending = tools.call_tool("get_approval_status", {"status": "pending"})
    assert res_pending["count"] == 1
    assert res_pending["approvals"][0]["id"] == "appr-1"

    res_single = tools.call_tool("get_approval_status", {"approval_id": "appr-1"})
    assert res_single["approval"]["id"] == "appr-1"








