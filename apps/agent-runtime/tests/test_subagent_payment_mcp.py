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

