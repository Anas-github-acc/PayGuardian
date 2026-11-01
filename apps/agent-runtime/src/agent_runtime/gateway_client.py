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
