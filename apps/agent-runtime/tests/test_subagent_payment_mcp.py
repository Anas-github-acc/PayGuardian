"""Tests for Subagent Payment MCP Tools and Delegated Execution Architecture."""

from unittest.mock import MagicMock
from agent_runtime.mcp_tools import PayGuardianMCPTools
from agent_runtime.personal_langgraph import PersonalLangGraphAgent
from agent_runtime.gateway_client import GatewayClient


def test_subagent_mcp_tools_balance_and_payment() -> None:
    state = {
        "subagent_tasks": [
            {
                "id": "task_hotel_1",
                "agent": "hotel",
                "amount_minor": 25000,
                "currency": "USD",
                "child_mandate_id": "mandate-child-hotel-123",
                "status": "authorized",
            }
        ]
    }
    mock_gw = MagicMock(spec=GatewayClient)
    mock_gw.check_authority.return_value = {"decision": {"allowed": True, "code": "ALLOW"}}

    tools = PayGuardianMCPTools(state=state, gateway_client=mock_gw)

    # 1. get_delegated_balance
    bal = tools.get_delegated_balance("hotel")
    assert bal["allocated_budget_minor"] == 25000
    assert bal["available_budget_minor"] == 25000
    assert bal["child_mandate_id"] == "mandate-child-hotel-123"

    # 2. request_payment
    pay_res = tools.request_payment(
        agent_id="hotel",
        amount_minor=20000,
        currency="USD",
        recipient="Grand Hyatt Hotel",
        action="book_hotel",
    )
    assert pay_res["success"] is True
    assert pay_res["status"] == "authorized"
    assert pay_res["amount_minor"] == 20000
    assert pay_res["recipient"] == "Grand Hyatt Hotel"
    assert pay_res["child_mandate_id"] == "mandate-child-hotel-123"

    # Gateway authority checked with child mandate
    mock_gw.check_authority.assert_called_once_with(
        mandate_id="mandate-child-hotel-123",
        action="book_hotel",
        amount_minor=20000,
        currency="USD",
    )


def test_subagent_budget_increase_escalation() -> None:
    state = {
        "mandate_id": "mandate-root-1",
        "budget_limit_minor": 100000,  # $1000 root
        "subagent_tasks": [
            {
                "id": "task_hotel_1",
                "agent": "hotel",
                "amount_minor": 20000,  # $200 allocated
                "currency": "USD",
                "child_mandate_id": "mandate-child-hotel-123",
            }
        ]
    }
    tools = PayGuardianMCPTools(state=state)
    # Total allocated = $200, Root reserve = $800
    # Hotel needs $50 more because room is $250
    inc_res = tools.request_budget_increase(
        agent_id="hotel",
        additional_amount_minor=5000,
        reason="Upgraded ocean view room",
        currency="USD",
    )
    assert inc_res["success"] is True
    assert inc_res["status"] == "granted"
    assert inc_res["new_budget_limit_minor"] == 25000


def test_user_orders_subagent_to_buy_hotel() -> None:
    class MockGateway(GatewayClient):
        def check_authority(self, *args, **kwargs) -> dict:
            return {"decision": {"allowed": True, "code": "ALLOW"}}

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-mock-hotel"}}

    mock_gw = MockGateway()
    agent = PersonalLangGraphAgent(gateway_client=mock_gw)
    messages = [
        {"role": "user", "content": "Plan a weekend in Paris with hotel and flights"},
        {
            "role": "assistant",
            "content": "Proposed Budget Allocation: Travel Specialist ($300) and Hotel Specialist ($250).",
        },
        {"role": "user", "content": "buy me the hotel"},
    ]

    # User orders: "buy me the hotel"
    res = agent.run(messages=messages, mandate_id="mandate-test-123")
    assert "hotel" in res["results"]
    hotel_res = res["results"]["hotel"]
    assert hotel_res["status"] == "completed"
    assert "payment_status" in hotel_res["details"]


def test_buy_hotel_triggers_gateway_approval_and_paypal_sandbox() -> None:
    class ApprovalGateway(GatewayClient):
        def check_authority(self, *args, **kwargs) -> dict:
            return {
                "decision": {
                    "allowed": False,
                    "code": "APPROVAL_REQUIRED",
                    "reason": "Human authorization is required by mandate policy.",
                }
            }

        def delegate_mandate(self, *args, **kwargs) -> dict:
            return {"mandate": {"id": "mandate-child-hotel-live"}}

        def request_approval(self, *args, **kwargs) -> dict:
            return {
                "approval": {
                    "id": "appr-gateway-sandbox-999",
                    "status": "pending",
                    "amountMinor": kwargs.get("amount_minor", 77490),
                }
            }

        def create_paypal_order(self, *args, **kwargs) -> dict:
            return {
                "action": {"id": "act-paypal-777"},
                "order": {
                    "id": "ORDER-SANDBOX-777",
                    "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-SANDBOX-777",
                },
            }

    mock_gw = ApprovalGateway()
    state = {
        "environment_id": "env-sandbox-1",
        "subagent_tasks": [
            {
                "id": "task_hotel_live",
                "agent": "hotel",
                "amount_minor": 25000,
                "currency": "USD",
                "child_mandate_id": "mandate-child-hotel-live",
                "status": "authorized",
            }
        ],
    }

    tools = PayGuardianMCPTools(
        state=state,
        gateway_client=mock_gw,
        environment_id="env-sandbox-1",
    )

    pay_res = tools.request_payment(
        agent_id="hotel",
        amount_minor=20000,
        currency="USD",
        recipient="Pune Boutique Inn",
        action="book_hotel",
    )

    assert pay_res["success"] is True
    assert pay_res["status"] == "awaiting_approval"
    assert pay_res["approval_id"] == "appr-gateway-sandbox-999"
    assert pay_res["approval_url"] == "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-SANDBOX-777"
    assert "Approval request appr-gateway-sandbox-999 registered on Gateway" in pay_res["message"]
    assert "PayPal Sandbox" in pay_res["message"]


def test_single_turn_buy_hotel_intent_classification() -> None:
    from agent_runtime.context_compiler import ContextCompiler
    compiler = ContextCompiler()
    intent, reasoning = compiler.classify_intent("buy me hotel room")
    assert intent == "PAYMENT_EXECUTION_INTENT"

    intent2, _ = compiler.classify_intent("Now buy the cheap hotel in pune")
    assert intent2 == "PAYMENT_EXECUTION_INTENT"


def test_mcp_payment_request_emits_approval_and_order_events() -> None:
    """Verify that request_payment emits approval.requested and payment.order_created to the event emitter."""
    mock_emitter = MagicMock()
    mock_gw = MagicMock(spec=GatewayClient)
    mock_gw.check_authority.return_value = {
        "decision": {
            "allowed": False,
            "code": "APPROVAL_REQUIRED",
            "reason": "Human approval required",
        }
    }
    mock_gw.request_approval.return_value = {
        "approval": {
            "id": "appr-12345",
            "status": "pending",
        }
    }
    mock_gw.create_paypal_order.return_value = {
        "action": {"id": "act-54321"},
        "order": {
            "id": "PAYPAL-ORDER-123",
            "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123",
        },
    }

    state = {
        "environment_id": "env-test",
        "subagent_tasks": [
            {
                "id": "task_hotel_evt",
                "agent": "hotel",
                "amount_minor": 15000,
                "currency": "USD",
                "child_mandate_id": "mandate-child-hotel-evt",
                "status": "authorized",
            }
        ],
    }

    tools = PayGuardianMCPTools(
        state=state,
        gateway_client=mock_gw,
        environment_id="env-test",
        event_emitter=mock_emitter,
        run_id="run-1",
        task_id="task-1",
    )

    tools.request_payment(
        agent_id="hotel",
        amount_minor=12000,
        currency="USD",
        recipient="Pune Central Hotel",
        action="book_hotel",
    )

    # Verify mock_emitter received approval.requested with correct payload
    emitted_types = [call.args[0] for call in mock_emitter.emit.call_args_list]
    assert "approval.requested" in emitted_types
    assert "payment.order_created" in emitted_types

    appr_call = next(c for c in mock_emitter.emit.call_args_list if c.args[0] == "approval.requested")
    payload = appr_call.kwargs.get("payload") or appr_call.args[1]
    assert payload["approvalId"] == "appr-12345"
    assert payload["approvalUrl"] == "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-123"
    assert payload["recipient"] == "Pune Central Hotel"
    assert payload["amountMinor"] == 12000
    assert payload["currency"] == "USD"
    assert payload["type"] == "action_approval"


def test_main_agent_delegates_to_hotel_when_subagent_has_funds_in_mandate() -> None:
    """When Hotel subagent already has funds in its child mandate, main agent delegates directly and reuses child mandate."""
    class FundedHotelGateway(GatewayClient):
        def list_mandates(self, environment_id: str) -> list[dict]:
            return [
                {
                    "id": "mandate-root-1",
                    "holderAgentId": "personal",
                    "budgetLimitMinor": 100000,
                    "currency": "USD",
                    "state": "active",
                },
                {
                    "id": "mandate-child-hotel-funded-99",
                    "holderAgentId": "agent-hotel-specialist",
                    "parentMandateId": "mandate-root-1",
                    "budgetLimitMinor": 30000,  # $300 funded in mandate
                    "spentMinor": 0,
                    "currency": "USD",
                    "state": "active",
                },
            ]

        def check_authority(self, *args, **kwargs) -> dict:
            return {"decision": {"allowed": True, "code": "ALLOW"}}

    mock_gw = FundedHotelGateway()
    agent = PersonalLangGraphAgent(gateway_client=mock_gw)
    messages = [
        {"role": "user", "content": "I want to book the boutique hotel for $250"},
        {"role": "assistant", "content": "The hotel quote is $250.00 and funds are allocated in your hotel mandate."},
        {"role": "user", "content": "make the payment for hotel"},
    ]

    res = agent.run(
        messages=messages,
        mandate_id="mandate-root-1",
        environment_id="env-test-hotel",
    )
    assert "hotel" in res["results"]
    hotel_res = res["results"]["hotel"]
    assert hotel_res["status"] == "completed"
    assert hotel_res["payment_authorization"]["mandate_id"] == "mandate-child-hotel-funded-99"


def test_main_agent_rejects_when_funds_insufficient() -> None:
    """When neither Hotel mandate nor reserve has funds, main agent refuses delegation with clear explanation."""
    class UnfundedGateway(GatewayClient):
        def list_mandates(self, environment_id: str) -> list[dict]:
            return [
                {
                    "id": "mandate-root-1",
                    "holderAgentId": "personal",
                    "budgetLimitMinor": 1000,  # Only $10
                    "currency": "USD",
                    "state": "active",
                },
                {
                    "id": "mandate-child-hotel-depleted",
                    "holderAgentId": "agent-hotel-specialist",
                    "parentMandateId": "mandate-root-1",
                    "budgetLimitMinor": 500,  # Only $5
                    "spentMinor": 500,
                    "currency": "USD",
                    "state": "active",
                },
            ]

        def check_authority(self, *args, **kwargs) -> dict:
            return {"decision": {"allowed": False, "code": "INSUFFICIENT_FUNDS"}}

    mock_gw = UnfundedGateway()
    agent = PersonalLangGraphAgent(gateway_client=mock_gw)
    messages = [
        {"role": "assistant", "content": "The hotel quote is $250.00."},
        {"role": "user", "content": "buy me the hotel"},
    ]

    res = agent.run(
        messages=messages,
        mandate_id="mandate-root-1",
        environment_id="env-test-unfunded",
        available_reserve_minor=0,
    )
    assert "hotel" not in res.get("results", {})
    assert any("Insufficient funds" in str(p) for p in res.get("plan", []))



