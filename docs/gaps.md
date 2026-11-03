# PayGuardian Backend Contract Gaps Registry

This document records missing backend endpoints, fields, and protocol capabilities discovered during frontend-to-backend integration (`apps/web` with `apps/api` Fastify Gateway), along with fallback UI behaviors and proposed API contracts.

---

## Gap Specification Schema

Each recorded gap follows this standard schema:

```markdown
### [GAP-ID]: Title of Gap

- **Screen / Feature**: Screen name or feature area
- **Category**: `Missing Endpoint` | `Protocol Gap` | `Missing Field` | `Schema Discrepancy`
- **Severity**: `Blocker` | `High` | `Medium` | `Low`
- **Current UI Behavior**: How the frontend handles this gap (e.g. renders explicit unavailable state, fallback short polling)
- **Backend Observation**: Current state of Fastify Gateway / Supabase / Python runtime
- **Proposed Contract**:
  - **Endpoint**: `METHOD /path`
  - **Headers**: Required authentication and context headers
  - **Request Body**: JSON schema or example
  - **Response (200/201)**: JSON schema or example
  - **Error Responses**: Expected error codes and status
- **Remediation Plan**: Recommended backend implementation
```

---

## Active Contract Gaps

### GAP-EVT-01: Real-Time Event Streaming (WebSocket / SSE)

- **Screen / Feature**: Global / Activity Micro-Feed / Workspace Live Graph
- **Category**: `Protocol Gap`
- **Severity**: `Medium`
- **Current UI Behavior**:
  - UI displays status pill `"Protocol: WebSocket + SSE"`, but active streaming is unavailable.
  - Active fallback: Cursor-based timestamp short-polling (`useActivityFeed` polls `GET /v1/environments/:id/activity?since=...` at configurable intervals).
- **Backend Observation**:
  - Neither Fastify Gateway (`apps/api`) nor Python Agent Runtime (`apps/agent-runtime`) implements WebSocket or Server-Sent Events (SSE) server handlers.
  - Audit trail is persisted to PostgreSQL (`public.audit_events`) and queried via REST cursor.
- **Proposed Contract**:
  - **Endpoint**: `GET /v1/environments/{environmentId}/events/stream`
  - **Headers**:
    - `Accept: text/event-stream`
    - `Authorization: Bearer <session_token>`
  - **Response (SSE)**:
    ```
    event: audit_event
    data: {"id":"evt_123","environmentId":"env_1","eventType":"mandate.delegated","actorType":"agent","outcome":"success","createdAt":"2026-11-01T21:00:00Z"}
    ```
- **Remediation Plan**:
  - Implement `@fastify/websocket` or Fastify SSE route plugin streaming PostgreSQL `LISTEN/NOTIFY` or Supabase Realtime CDC events to subscribed frontend clients.

---

### GAP-MEM-01: Agent Memory Vault Backend Representation

- **Screen / Feature**: Screen 7 (Memory Vault / `sessions-memory.tsx`, `memory-card.tsx`)
- **Category**: `Missing Endpoint`
- **Severity**: `High`
- **Current UI Behavior**:
  - UI renders an explicit `"Memory Vault Unavailable: Persistent backend storage for agent memories is not yet implemented"` container referencing `GAP-MEM-01`.
  - Forget/revoke buttons are disabled with warning state.
  - Hardcoded fixture array `INITIAL_MEMORIES` is completely deleted.
- **Backend Observation**:
  - Zero backend representation exists for persistent memory across database migrations (`supabase/migrations/`), domain models (`packages/domain/`), contracts (`packages/contracts/`), and gateway routes (`apps/api/`).
- **Proposed Database Migration** (`supabase/migrations/20261102000000_memories.sql`):
  ```sql
  CREATE TABLE public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('environment', 'session', 'agent')),
    key_name TEXT NOT NULL,
    value_text TEXT NOT NULL,
    context_snippet TEXT,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
  );

  CREATE INDEX idx_memories_env_cat ON public.memories(environment_id, category);
  ```
- **Proposed Contract**:
  - **List Memories**: `GET /v1/environments/{environmentId}/memories`
    - **Query**: `agentId?: string`, `category?: "session" | "environment" | "agent"`, `limit?: number`
    - **Response (200)**:
      ```json
      {
        "memories": [
          {
            "id": "mem_01hqz78",
            "environmentId": "env_travel_01",
            "sessionId": "sess_goa_01",
            "agentId": "agent_travel_02",
            "agentName": "Travel Subagent",
            "category": "environment",
            "key": "dietary_preference",
            "value": "Vegetarian meals only; window seat preference",
            "contextSnippet": "Configured by operator during onboarding",
            "isRevoked": false,
            "savedAt": "2026-10-30T10:15:00Z"
          }
        ]
      }
      ```
  - **Create Memory**: `POST /v1/environments/{environmentId}/memories`
    - **Body**:
      ```json
      {
        "agentId": "string",
        "sessionId": "string",
        "category": "agent",
        "keyName": "dietary_preference",
        "valueText": "Vegetarian meals only on all flight reservations",
        "contextSnippet": "Operator specified in chat"
      }
      ```
    - **Response (201)**: `{ "memory": { "id": "mem_01hqz78", "isRevoked": false } }`
  - **Revoke/Delete Memory**: `POST /v1/environments/{environmentId}/memories/{memoryId}/revoke`
    - **Response (200)**: `{ "memory": { "id": "mem_01hqz78", "isRevoked": true, "revokedAt": "2026-11-01T21:00:00Z" } }`
- **Remediation Plan**:
  - Apply Supabase SQL migration creating `public.memories`, add domain entity and repository in `apps/api`, and register Fastify routes in `apps/api/src/phase4-routes.ts`.

---

### GAP-CAT-01: Agent Marketplace / Template Catalog Endpoint

- **Screen / Feature**: Screen 5 (Agent Library / `AgentLibrary.tsx`)
- **Category**: `Missing Endpoint`
- **Severity**: `Low`
- **Current UI Behavior**:
  - Screen 5 wires to live environment agents (`GET /v1/environments/:id/agents`).
  - For the global marketplace/catalog of unattached certified agent templates, Fastify Gateway lacks an agent catalog endpoint.
  - Per R2 ("Never invent data"): Renders an explicit `"Agent Catalog Unavailable"` container referencing `GAP-CAT-01` rather than fabricating fake certified agents.
  - Mock fixture array `CATALOG_AGENTS` is completely deleted.
- **Backend Observation**:
  - Fastify Gateway provides environment-scoped agent registration (`POST /v1/environments/:id/agents/children`), but lacks a global template catalog endpoint (`GET /v1/agents/catalog` or `GET /v1/agent-catalog`).
  - Python runtime has `GET /agents` on port 8000 returning only string name arrays (`["personal", "travel", ...]`), lacking catalog metadata (tagline, authority tier, recommended budget, audit certificates).
- **Proposed Contract**:
  - **Endpoint**: `GET /v1/agents/catalog`
  - **Headers**: `Authorization: Bearer <token>`
  - **Response (200)**:
    ```json
    [
      {
        "id": "tpl_travel_concierge",
        "name": "Travel Concierge",
        "tagline": "Autonomous flight booking and hotel procurement",
        "category": "logistics",
        "description": "Multi-leg flight routing and hotel procurement",
        "authorityTier": "Tier 2: Autonomous Micro-Transactions",
        "tierLevel": 2,
        "recommendedBudgetMinor": 250000,
        "currency": "USD",
        "supportedRails": ["PayPal", "Simulation"],
        "capabilities": ["flight.procure", "lodging.reserve"],
        "securityAudit": {
          "auditedBy": "PayGuardian Security Labs",
          "auditDate": "2026-10-20",
          "cveVulnerabilities": 0,
          "status": "certified",
          "signatureHash": "0x4f89b21a9c3d4e6f...",
          "sandboxTested": true
        }
      }
    ]
    ```
- **Remediation Plan**:
  - Expose static agent template definitions via Fastify Gateway endpoint `GET /v1/agents/catalog`.

---

### GAP-SESS-01: Session Message History Persistence Endpoint Missing on Fastify Gateway

- **Screen / Feature**: Screen 6 (Sessions / `sessions-memory.tsx`, `session-history.tsx`, `assistant-view.tsx`)
- **Category**: `Missing Endpoint`
- **Severity**: `Medium`
- **Current UI Behavior**:
  - UI displays an explicit notice: *"Session history persistence unavailable on gateway; starting new thread (GAP-SESS-01)"*.
  - New sessions call real `POST /v1/environments/:id/sessions` and update UI strictly on confirmed server HTTP 201 response.
  - When switching sessions, chat thread starts fresh with no inherited messages.
  - Mock fixture array `INITIAL_SESSIONS` is completely deleted.
- **Backend Observation**:
  - Fastify Gateway provides session CRUD (`POST/GET/PATCH /v1/environments/:id/sessions`), but relies on volatile `InMemorySessionStore` (`apps/api/src/phase4.ts:289`).
  - No endpoint exists to retrieve message history for a session (`GET /v1/environments/:id/sessions/:sessionId/messages`).
  - Any server restart purges all session objects and runs.
- **Proposed Contract**:
  - **Endpoint**: `GET /v1/environments/{environmentId}/sessions/{sessionId}/messages`
  - **Headers**: `Authorization: Bearer <token>`
  - **Response (200)**:
    ```json
    {
      "sessionId": "sess_goa_01",
      "messages": [
        {
          "id": "msg_001",
          "type": "agent_says",
          "sender": "Main Orchestrator",
          "timestamp": "2026-10-31T13:45:00Z",
          "text": "Goa Conference Logistics session initialized. Ready to procure travel."
        },
        {
          "id": "msg_002",
          "type": "verified_block",
          "cardType": "payment_result",
          "sender": "PayPal Rail Gateway",
          "timestamp": "2026-10-31T13:58:45Z",
          "verifiedAt": "2026-10-31T13:58:45Z",
          "gatewaySignature": "0x89f41b2ac07d391e...",
          "payload": {
            "transactionId": "txn_pp_982194820",
            "recipient": "IndiGo Airlines Ltd",
            "amountMinor": 24500,
            "currency": "USD",
            "rail": "PayPal"
          }
        }
      ]
    }
    ```
- **Remediation Plan**:
  - Add `public.session_messages` table in Supabase and expose `GET/POST /v1/environments/:id/sessions/:sessionId/messages` in `apps/api/src/phase4-routes.ts`.

---

### GAP-TRC-01: Detailed Lifecycle Trace Checkpoints & Latency Breakdown

- **Screen / Feature**: Screen 4 (Payment Trace / `PaymentTraceView.tsx`, `LifecycleTimeline.tsx`, `VerificationChecklist.tsx`)
- **Category**: `Missing Field`
- **Severity**: `Medium`
- **Current UI Behavior**:
  - UI constructs trace view from live action, agent, mandate chain, PayPal operation summary, and audit events.
  - Per R2 ("Never invent data"): Since Fastify Gateway action trace endpoint lacks 5-stage latency metrics and 5-point checklist records, explicit "Unavailable" state containers are rendered in the Lifecycle Stages and Verification Matrix tabs rather than synthesizing fake metrics or checklists.
  - Fixture dictionary `DEFAULT_TRACES` is completely deleted.
- **Backend Observation**:
  - `GET /v1/environments/:id/actions/:actionId/trace` returns `{ action, agent, mandateChain, rootMandate }` and `GET /v1/environments/:id/payments/paypal/:actionId` returns high-level reconciliation status, provider order ID, and timestamps. Microsecond stage latencies and 5-point verification matrix items are not exposed by the API Gateway.
- **Proposed Contract**:
  - **Endpoint**: `GET /v1/environments/{environmentId}/actions/{actionId}/trace`
  - **Response (200)**:
    ```json
    {
      "actionId": "act_123",
      "totalLatencyMs": 340,
      "stages": [
        { "stage": "initiated", "latencyMs": 15, "timestamp": "2026-11-01T21:00:00.000Z" },
        { "stage": "mandate_evaluated", "latencyMs": 25, "timestamp": "2026-11-01T21:00:00.015Z" },
        { "stage": "paypal_order_created", "latencyMs": 210, "timestamp": "2026-11-01T21:00:00.040Z" },
        { "stage": "paypal_captured", "latencyMs": 90, "timestamp": "2026-11-01T21:00:00.250Z" }
      ],
      "checks": [
        { "name": "mandate_headroom", "passed": true },
        { "name": "currency_match", "passed": true },
        { "name": "action_permitted", "passed": true }
      ]
    }
    ```
- **Remediation Plan**:
  - Expose lifecycle stage timings and verification checks from `apps/api/src/domain/action-lifecycle.ts` or audit payload indexing.

---

### GAP-SPEND-01: 7-Day Spend Velocity Analytics Endpoint

- **Screen / Feature**: Screen 1 & Dashboard (`overview.tsx`)
- **Category**: `Missing Endpoint`
- **Severity**: `Medium`
- **Current UI Behavior**:
  - In `SpendChart`, renders an explicit `"Spend velocity analytics unavailable"` placeholder container documenting that the 7-day spend velocity analytics endpoint is not implemented in Fastify Gateway.
  - Fixture array `SPEND_SERIES` is deleted.
- **Backend Observation**:
  - Fastify Gateway (`apps/api`) does not provide a daily time-series aggregation endpoint for historical spend and reservations over the past 7 days. Current endpoints only return point-in-time account totals (`/ledger/accounts`) and flat audit events (`/activity`).
- **Proposed Contract**:
  - **Endpoint**: `GET /v1/environments/{environmentId}/analytics/spend-velocity?days=7`
  - **Headers**: `Authorization: Bearer <token>`
  - **Response (200)**:
    ```json
    {
      "environmentId": "env_travel_01",
      "currency": "USD",
      "series": [
        { "date": "2026-10-26", "label": "Mon", "spentMinor": 32000, "reservedMinor": 12000 },
        { "date": "2026-10-27", "label": "Tue", "spentMinor": 18000, "reservedMinor": 9000 },
        { "date": "2026-10-28", "label": "Wed", "spentMinor": 46000, "reservedMinor": 21000 },
        { "date": "2026-10-29", "label": "Thu", "spentMinor": 51000, "reservedMinor": 18000 },
        { "date": "2026-10-30", "label": "Fri", "spentMinor": 62000, "reservedMinor": 24000 },
        { "date": "2026-10-31", "label": "Sat", "spentMinor": 21000, "reservedMinor": 15000 },
        { "date": "2026-11-01", "label": "Sun", "spentMinor": 15000, "reservedMinor": 51000 }
      ]
    }
    ```
- **Remediation Plan**:
  - Add a time-bucketed aggregation query on `audit_events` or `ledger_entries` in `apps/api` returning daily captured/reserved minor sums.
