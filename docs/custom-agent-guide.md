# Custom Agent Integration Guide

## Principles
1. **Framework Independent:** You can use Python ADK, LangChain, LlamaIndex, CrewAI, AutoGen, or a custom script. The Delegation Gateway provides standard REST and MCP tool interfaces.
2. **Credential Separation:** NEVER put API keys, bearer tokens, or database connection strings into model prompts or conversation histories. Tool wrappers attach credentials in HTTP headers.
3. **Gateway Authority:** The AI model cannot self-authorize actions. All policy checks, budget checks, and approvals are evaluated authoritatively by the Gateway.
4. **Idempotency & Replay Protection:** Every protected action includes a caller-supplied `idempotencyKey` and `requestHash`. Retried requests return identical results without duplicating spend.

---

## Tool Wrapper Pattern

```python
import httpx

class PayGuardianToolWrapper:
    def __init__(self, base_url: str, auth_token: str):
        self.base_url = base_url.rstrip("/")
        # Headers carry authentication OUTSIDE model prompt
        self.headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }

    def check_authority(self, mandate_id: str, action: str, amount_minor: int, currency: str = "USD") -> dict:
        """Call gateway to verify if action is permitted."""
        url = f"{self.base_url}/v1/mandates/{mandate_id}/check"
        payload = {"action": action, "amountMinor": amount_minor, "currency": currency}
        res = httpx.post(url, json=payload, headers=self.headers)
        return res.json()

    def simulate_booking(self, environment_id: str, agent_id: str, mandate_id: str, action: str, amount_minor: int, params: dict) -> dict:
        """Execute a non-payment simulation action."""
        url = f"{self.base_url}/v1/environments/{environment_id}/actions/simulate"
        payload = {
            "agentId": agent_id,
            "mandateId": mandate_id,
            "action": action,
            "amountMinor": amount_minor,
            "currency": "USD",
            "parameters": params
        }
        res = httpx.post(url, json=payload, headers=self.headers)
        return res.json()

    def reserve_action(self, environment_id: str, agent_id: str, mandate_id: str, account_id: str, idempotency_key: str, request_hash: str, action: str, amount_minor: int, approval_id: str = None) -> dict:
        """Reserve funds for protected execution."""
        url = f"{self.base_url}/v1/environments/{environment_id}/actions/reserve"
        payload = {
            "agentId": agent_id,
            "mandateId": mandate_id,
            "ledgerAccountId": account_id,
            "idempotencyKey": idempotency_key,
            "requestHash": request_hash,
            "action": action,
            "amountMinor": amount_minor,
            "currency": "USD"
        }
        if approval_id:
            payload["approvalId"] = approval_id
        res = httpx.post(url, json=payload, headers=self.headers)
        return res.json()
```

---

## Handling Denials & Approvals

When an action requires human approval or is denied, the gateway returns machine-readable error codes:

| Code | Meaning | Agent Action |
| --- | --- | --- |
| `APPROVAL_REQUIRED` | Human approval is required before execution. | Pause run, store `approvalId`, and notify the user via inbox. |
| `BUDGET_EXCEEDED` | Amount exceeds available mandate or ledger funds. | Suggest cheaper alternative or request higher budget from parent agent. |
| `ACTION_NOT_PERMITTED` | Action is outside permitted scope. | Do not retry; re-evaluate task plan or escalate to parent agent. |
| `MANDATE_REVOKED` | Mandate or environment was revoked. | Terminate task gracefully. |
| `MANDATE_EXPIRED` | Time window expired. | Request renewed mandate from parent. |

### Example: Approval Workflow Recovery
```python
result = tools.reserve_action(...)

if result.get("decision", {}).get("code") == "APPROVAL_REQUIRED":
    approval_id = result.get("approvalId")
    print(f"Action requires approval. Approval ID: {approval_id}")
    # Agent checkpoints state in session run and waits for user approval
    tools.update_run(session_id, run_id, status="paused", checkpoint={"approvalId": approval_id})
```
