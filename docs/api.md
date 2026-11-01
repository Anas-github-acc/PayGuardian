# PayGuardian Gateway API Documentation

## Overview
The PayGuardian Gateway provides bounded, accountable financial authority for AI agents and descendants. The gateway strictly separates agent reasoning from financial authority: models cannot self-authorize actions, grant permissions, or bypass gateway denials.

Base URL (Local): `http://localhost:3001`
OpenAPI JSON: `GET /docs/json`

---

## Authentication & Multi-Tenancy
- **User Authentication:** Supabase Auth JWT in `Authorization: Bearer <token>` or `x-local-user-id: <user_id>` in local development mode.
- **Tenant Isolation:** Every environment, agent, mandate, ledger account, and action is strictly isolated. Attempting to access resources across environments or tenants returns `404 Not Found`.

---

## API Endpoints

### 1. Environments (`/v1/environments`)
- `POST /v1/environments`: Create an isolated environment.
  - Body: `{ name, purpose, currency, budgetLimitMinor }`
- `GET /v1/environments`: List user environments.
- `GET /v1/environments/:environmentId`: Get environment details.
- `POST /v1/environments/:environmentId/pause`: Emergency pause. Blocks new delegations, allocations, and protected actions.
- `POST /v1/environments/:environmentId/resume`: Resume a paused environment.
- `POST /v1/environments/:environmentId/revoke`: Irrevocably revoke an environment and all contained authority.

### 2. Agents (`/v1/environments/:environmentId/agents`)
- `POST /v1/environments/:environmentId/agents/root`: Register root Personal Agent.
- `POST /v1/environments/:environmentId/agents/children`: Parent-driven dynamic child agent registration (e.g. Travel, Food, Hotel, Transport).
- `GET /v1/environments/:environmentId/agents`: List agents.
- `POST /v1/environments/:environmentId/agents/:agentId/disable`: Disable an agent.
- `POST /v1/environments/:environmentId/agents/:agentId/revoke`: Irrevocably revoke an agent and descendants.

### 3. Mandates & Delegation (`/v1/environments/:environmentId/mandates`)
- `POST /v1/environments/:environmentId/mandates/root`: Create user-authorized root mandate.
  - Body: `{ holderAgentId, budgetLimitMinor, currency, permittedActions, expiresAt, canDelegate, maxDelegationDepth, approvalRequired }`
- `POST /v1/mandates/:mandateId/delegations`: Delegate narrower authority to a child agent.
- `POST /v1/mandates/:mandateId/revocations`: Revoke mandate. Revocation cascades immediately to all descendants.
- `POST /v1/mandates/:mandateId/check`: Evaluate effective authority across the ancestor chain without executing an action.

### 4. Ledger & Protected Actions (`/v1/environments/:environmentId/ledger`)
- `POST /v1/environments/:environmentId/ledger/accounts`: Create ledger account.
- `POST /v1/environments/:environmentId/ledger/allocations`: Transfer budget from parent account to child account (conservation of funds).
- `POST /v1/environments/:environmentId/actions/reserve`: Reserve budget for a protected action.
  - Body: `{ agentId, mandateId, ledgerAccountId, idempotencyKey, requestHash, action, amountMinor, currency, approvalId? }`
- `POST /v1/environments/:environmentId/actions/:actionId/capture`: Confirm reservation as spent.
- `POST /v1/environments/:environmentId/actions/:actionId/release`: Release held reservation back to account.
- `POST /v1/environments/:environmentId/actions/simulate`: Execute a non-payment simulation action (checks authority and returns simulated result without moving money).

### 5. Approvals Inbox (`/v1/environments/:environmentId/approvals`)
- `POST /v1/environments/:environmentId/approvals`: Submit an action for human approval.
- `GET /v1/environments/:environmentId/approvals`: List approval requests (`?status=pending`).
- `GET /v1/environments/:environmentId/approvals/:approvalId`: Inspect approval request details.
- `POST /v1/environments/:environmentId/approvals/:approvalId/approve`: User approves request (bound to requestHash).
- `POST /v1/environments/:environmentId/approvals/:approvalId/reject`: User rejects request.

### 6. Sessions & Runs (`/v1/environments/:environmentId/sessions`)
- `POST /v1/environments/:environmentId/sessions`: Create a task session carrying workflow context.
- `GET /v1/environments/:environmentId/sessions`: List sessions.
- `PATCH /v1/environments/:environmentId/sessions/:sessionId`: Update context or session status.
- `POST /v1/environments/:environmentId/sessions/:sessionId/runs`: Start or resume a run.
- `PATCH /v1/environments/:environmentId/sessions/:sessionId/runs/:runId`: Update checkpoint and status.

### 7. PayPal Sandbox Payments (`/v1/environments/:environmentId/payments/paypal`)
- `POST /v1/environments/:environmentId/payments/paypal/orders`: Create idempotent PayPal Sandbox order.
- `GET /v1/environments/:environmentId/payments/paypal/:actionId`: Inspect provider operation and reconciliation status.
- `POST /v1/environments/:environmentId/payments/paypal/:actionId/capture`: Capture approved PayPal order.
- `POST /v1/webhooks/paypal`: Deduplicated webhook handler for capture and authorization events.
- `GET /v1/environments/:environmentId/payments/paypal/operations`: Cursor-paginated operation monitoring.

### 8. Audit Trail (`/v1/environments/:environmentId/activity`)
- `GET /v1/environments/:environmentId/activity`: Retrieve tamper-evident hash-chained audit events.
  - Query parameters: `since` (cursor timestamp for live reconnect), `limit` (pagination).
