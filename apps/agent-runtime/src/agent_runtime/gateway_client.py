"""Gateway client for ADK and specialist agents.

Attaches runtime credentials in HTTP headers OUTSIDE model prompts and conversation history.
No credentials ever appear in prompt content or model outputs.
"""

from __future__ import annotations

import os
import re
from typing import Any

import httpx

SENSITIVE_KEY_PATTERN = re.compile(
    r"(authorization|api[-_]?key|bearer|credential|password|secret|token)",
    re.IGNORECASE,
)


def assert_safe_prompt_content(content: str) -> None:
    """Validate that prompt or conversation text does not leak sensitive tokens."""
    if re.search(r"bearer\s+[a-z0-9_\-\.]+", content, re.IGNORECASE):
        raise ValueError("PROMPT_SENSITIVE_LEAK: Bearer token detected in prompt content.")


class GatewayClient:
    def __init__(
        self,
        base_url: str | None = None,
        auth_token: str | None = None,
        local_user_id: str | None = None,
        timeout: float = 10.0,
    ) -> None:
        self.base_url = (
            base_url or os.getenv("GATEWAY_API_URL") or "http://localhost:3001"
        ).rstrip("/")
        self.auth_token = auth_token or os.getenv("GATEWAY_AUTH_TOKEN")
        self.local_user_id = local_user_id or os.getenv("GATEWAY_LOCAL_USER_ID", "local-user")
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        elif self.local_user_id:
            headers["x-local-user-id"] = self.local_user_id
        return headers

    def check_authority(
        self,
        mandate_id: str,
        action: str,
        amount_minor: int,
        currency: str,
        approval_granted: bool = False,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/v1/mandates/{mandate_id}/check"
        payload = {
            "action": action,
            "amountMinor": amount_minor,
            "currency": currency.upper(),
            "approvalGranted": approval_granted,
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def list_mandates(self, environment_id: str) -> list[dict[str, Any]]:
        """Retrieve all active and child mandates for the given environment from the Gateway."""
        url = f"{self.base_url}/v1/environments/{environment_id}/mandates"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(url, headers=self._headers())
                if res.status_code == 200:
                    data = res.json()
                    return data.get("mandates", [])  # type: ignore[no-any-return]
        except Exception:
            pass
        return []

    def get_mandate(self, mandate_id: str) -> dict[str, Any] | None:
        """Fetch a specific mandate by ID from the Gateway."""
        url = f"{self.base_url}/v1/mandates/{mandate_id}"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(url, headers=self._headers())
                if res.status_code == 200:
                    return res.json()  # type: ignore[no-any-return]
        except Exception:
            pass
        return None

    def delegate_mandate(
        self,
        mandate_id: str,
        holder_agent_id: str,
        budget_limit_minor: int,
        currency: str = "USD",
        permitted_actions: list[str] | None = None,
        expires_at: str | None = None,
        can_delegate: bool = False,
        max_delegation_depth: int = 0,
        approval_required: bool = False,
        idempotency_key: str | None = None,
        grant_jti: str | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/v1/mandates/{mandate_id}/delegations"
        payload: dict[str, Any] = {
            "holderAgentId": holder_agent_id,
            "budgetLimitMinor": budget_limit_minor,
            "currency": currency.upper(),
            "permittedActions": permitted_actions or ["*"],
            "expiresAt": expires_at or "2099-01-01T00:00:00.000Z",
            "canDelegate": can_delegate,
            "maxDelegationDepth": max_delegation_depth,
            "approvalRequired": approval_required,
        }
        if idempotency_key:
            payload["idempotencyKey"] = idempotency_key
        if grant_jti:
            payload["grantJti"] = grant_jti
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def simulate_action(
        self,
        environment_id: str,
        agent_id: str,
        mandate_id: str,
        action: str,
        amount_minor: int,
        currency: str,
        parameters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/v1/environments/{environment_id}/actions/simulate"
        payload = {
            "agentId": agent_id,
            "mandateId": mandate_id,
            "action": action,
            "amountMinor": amount_minor,
            "currency": currency.upper(),
            "parameters": parameters or {},
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def request_approval(
        self,
        environment_id: str,
        mandate_id: str,
        agent_id: str,
        action: str,
        amount_minor: int,
        currency: str,
        request_hash: str,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/v1/environments/{environment_id}/approvals"
        payload = {
            "mandateId": mandate_id,
            "agentId": agent_id,
            "action": action,
            "amountMinor": amount_minor,
            "currency": currency.upper(),
            "requestHash": request_hash,
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def list_approvals(self, environment_id: str, status: str | None = None) -> list[dict[str, Any]]:
        query = f"?status={status}" if status else ""
        url = f"{self.base_url}/v1/environments/{environment_id}/approvals{query}"
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(url, headers=self._headers())
            if res.status_code == 200:
                data = res.json()
                return data.get("approvals", [])  # type: ignore[no-any-return]
            return []

    def get_approval(self, environment_id: str, approval_id: str) -> dict[str, Any] | None:
        url = f"{self.base_url}/v1/environments/{environment_id}/approvals/{approval_id}"
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(url, headers=self._headers())
            if res.status_code == 200:
                data = res.json()
                return data.get("approval")  # type: ignore[no-any-return]
            return None

    def reserve_action(
        self,
        environment_id: str,
        agent_id: str,
        mandate_id: str,
        ledger_account_id: str,
        idempotency_key: str,
        request_hash: str,
        action: str,
        amount_minor: int,
        currency: str,
        approval_id: str | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/v1/environments/{environment_id}/actions/reserve"
        payload: dict[str, Any] = {
            "agentId": agent_id,
            "mandateId": mandate_id,
            "ledgerAccountId": ledger_account_id,
            "idempotencyKey": idempotency_key,
            "requestHash": request_hash,
            "action": action,
            "amountMinor": amount_minor,
            "currency": currency.upper(),
        }
        if approval_id:
            payload["approvalId"] = approval_id
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def create_session(
        self,
        environment_id: str,
        name: str,
        agent_id: str | None = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/v1/environments/{environment_id}/sessions"
        payload = {
            "name": name,
            "agentId": agent_id,
            "context": context or {},
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def start_run(
        self,
        environment_id: str,
        session_id: str,
        agent_id: str,
        checkpoint: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url}/v1/environments/{environment_id}/sessions/{session_id}/runs"
        payload = {"agentId": agent_id, "checkpoint": checkpoint or {}}
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def update_run(
        self,
        environment_id: str,
        session_id: str,
        run_id: str,
        status: str | None = None,
        checkpoint: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        endpoint = f"/v1/environments/{environment_id}/sessions/{session_id}/runs/{run_id}"
        url = f"{self.base_url}{endpoint}"
        payload: dict[str, Any] = {}
        if status:
            payload["status"] = status
        if checkpoint is not None:
            payload["checkpoint"] = checkpoint
        with httpx.Client(timeout=self.timeout) as client:
            res = client.patch(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def get_catalog(self) -> list[dict[str, Any]]:
        """Retrieve the global catalog of specialist subagents from Gateway."""
        url = f"{self.base_url}/v1/agents/catalog"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(url, headers=self._headers())
                if res.status_code == 200:
                    data = res.json()
                    return data.get("catalog", [])  # type: ignore[no-any-return]
        except Exception:
            pass
        return []

    def list_agents(self, environment_id: str) -> list[dict[str, Any]]:
        """Retrieve registered agents in the environment."""
        url = f"{self.base_url}/v1/environments/{environment_id}/agents"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(url, headers=self._headers())
                if res.status_code == 200:
                    data = res.json()
                    return data.get("agents", [])  # type: ignore[no-any-return]
        except Exception:
            pass
        return []

    def register_child_agent(
        self,
        environment_id: str,
        parent_agent_id: str,
        name: str,
        kind: str = "custom",
        capabilities: list[str] | None = None,
    ) -> dict[str, Any]:
        """Register/attach a child subagent in the environment under the parent coordinator."""
        url = f"{self.base_url}/v1/environments/{environment_id}/agents/children"
        payload = {
            "parentAgentId": parent_agent_id,
            "name": name,
            "kind": kind,
            "capabilities": capabilities or [],
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def list_ledger_accounts(self, environment_id: str) -> list[dict[str, Any]]:
        """List ledger accounts in the environment."""
        url = f"{self.base_url}/v1/environments/{environment_id}/ledger/accounts"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(url, headers=self._headers())
                if res.status_code == 200:
                    data = res.json()
                    return data.get("accounts", [])  # type: ignore[no-any-return]
        except Exception:
            pass
        return []

    def create_ledger_account(
        self,
        environment_id: str,
        mandate_id: str,
        parent_account_id: str | None,
        currency: str = "USD",
        available_minor: int = 0,
    ) -> dict[str, Any]:
        """Create a child ledger account for a mandate."""
        url = f"{self.base_url}/v1/environments/{environment_id}/ledger/accounts"
        payload: dict[str, Any] = {
            "mandateId": mandate_id,
            "currency": currency.upper(),
            "availableMinor": available_minor,
        }
        if parent_account_id is not None:
            payload["parentAccountId"] = parent_account_id
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def allocate_ledger(
        self,
        environment_id: str,
        parent_account_id: str,
        child_account_id: str,
        amount_minor: int,
        idempotency_key: str,
        request_hash: str,
    ) -> dict[str, Any]:
        """Allocate budget from parent account to child account."""
        url = f"{self.base_url}/v1/environments/{environment_id}/ledger/allocations"
        payload = {
            "parentAccountId": parent_account_id,
            "childAccountId": child_account_id,
            "amountMinor": amount_minor,
            "idempotencyKey": idempotency_key,
            "requestHash": request_hash,
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def capture_action(self, environment_id: str, action_id: str) -> dict[str, Any]:
        """Capture a reserved action on the Gateway ledger, settling funds."""
        url = f"{self.base_url}/v1/environments/{environment_id}/actions/{action_id}/capture"
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def create_paypal_order(
        self,
        environment_id: str,
        agent_id: str,
        mandate_id: str,
        ledger_account_id: str,
        idempotency_key: str,
        request_hash: str,
        action: str,
        amount_minor: int,
        currency: str = "USD",
        approval_id: str | None = None,
        return_url: str | None = None,
        cancel_url: str | None = None,
    ) -> dict[str, Any]:
        """Create an authorized PayPal Sandbox order with an approval URL."""
        url = f"{self.base_url}/v1/environments/{environment_id}/payments/paypal/orders"
        payload: dict[str, Any] = {
            "agentId": agent_id,
            "mandateId": mandate_id,
            "ledgerAccountId": ledger_account_id,
            "idempotencyKey": idempotency_key,
            "requestHash": request_hash,
            "action": action,
            "amountMinor": amount_minor,
            "currency": currency.upper(),
        }
        if approval_id:
            payload["approvalId"] = approval_id
        if return_url:
            payload["returnUrl"] = return_url
        if cancel_url:
            payload["cancelUrl"] = cancel_url
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def capture_paypal_order(self, environment_id: str, action_id: str) -> dict[str, Any]:
        """Capture an approved PayPal order on the Gateway."""
        url = f"{self.base_url}/v1/environments/{environment_id}/payments/paypal/{action_id}/capture"
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def get_paypal_operation(self, environment_id: str, action_id: str) -> dict[str, Any]:
        """Fetch PayPal operation, action, and reservation details."""
        url = f"{self.base_url}/v1/environments/{environment_id}/payments/paypal/{action_id}"
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(url, headers=self._headers())
            return res.json()  # type: ignore[no-any-return]

    def post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(url, json=payload, headers=self._headers())
            if res.status_code >= 400:
                raise RuntimeError(f"Gateway POST {path} failed: {res.status_code} {res.text}")
            return res.json() if res.content else {}
