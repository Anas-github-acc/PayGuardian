# Comprehensive Survey Report: Screens 5–8 & Backend Integration Gaps

**Auditor**: `explorer_survey_screens_5_8` (Codebase Explorer)  
**Date**: 2026-11-01T21:35:00Z  
**Target Repository**: `/home/anas/myspace/AI/PayGuardian`  
**Reference Documents**:
- `docs/frontend-audit.md` (Frontend-to-Backend Integration Audit & Architecture Specification)
- `.agents/teamwork/ORIGINAL_REQUEST.md` (Integration Requirements R1–R5)
- Monorepo source files: `apps/web`, `apps/api`, `apps/agent-runtime`, `packages/contracts`

---

## Executive Summary & Screen Sequence Clarification

Requirement R2 specifies:
> *"Replace hardcoded data one screen at a time across the 8 screens in sequence: starting with the graph and budget bar, then the activity feed, approvals, payment trace, library, sessions, and memory."*

### Resolution of Screen Count and Sequence
Parsing the sequential list in R2 demonstrates that there are **8 discrete functional surfaces**:
1. **Screen 1**: Workspace Graph (3D Topology & Node Inspector)
2. **Screen 2**: Budget Bar (Budget Strip & KPI Telemetry)
3. **Screen 3**: Activity Feed (Micro-Feed & Recent Activity Panel)
4. **Screen 4**: Approvals (Approvals Inbox & Review Drawer)
5. **Screen 5**: Payment Trace (Forensic Audit & Settlement Verification)
6. **Screen 6**: Library (Specialist Agent Directory & Attach Modal)
7. **Screen 7**: Sessions (Thread History & Task Management)
8. **Screen 8**: Memory (Memory Vault)

In peer explorer dispatching (`explorer_survey_screens_1_4`), Workspace Graph and Budget Bar were grouped into "Screen 1", shifting Payment Trace into "Screen 4", and leaving Library, Sessions, and Memory as "Screens 5–7".

**Scope Commitment of this Survey**:
To guarantee 100% monorepo coverage without boundary gaps or ambiguity, this report provides exhaustive survey and architectural contracts for all four remaining screens:
- **Screen 5: Payment Trace** (also cross-referenced against Screen 4 in the grouped sequence)
- **Screen 6: Library** (Screen 5 in grouped sequence)
- **Screen 7: Sessions** (Screen 6 in grouped sequence)
- **Screen 8: Memory** (Screen 7 in grouped sequence)

---

## Screen Survey Matrix

| Screen | Target Files | Backend Endpoints | Status | Primary Integration Gap |
|---|---|---|---|---|
| **5. Payment Trace** | `apps/web/components/traces/PaymentTraceView.tsx`<br>`VerticalAuthChain.tsx`<br>`LifecycleTimeline.tsx`<br>`VerificationChecklist.tsx`<br>`types.ts` | `GET /v1/environments/:id/actions/:id/trace`<br>`GET /v1/environments/:id/actions/:id`<br>`GET /v1/environments/:id/payments/paypal/:id` | **PARTIAL** | Backend returns `{ action, agent, mandateChain }` but lacks 5-stage lifecycle latencies, 5-point verification checklist, and formatted recipient metadata. Component currently makes zero network requests. |
| **6. Library** | `apps/web/components/agents/AgentLibrary.tsx`<br>`AgentCard.tsx`<br>`AgentDetailDrawer.tsx`<br>`AttachAgentDialog.tsx`<br>`types.ts` | `GET /agents` (:8000)<br>`POST /v1/environments/:id/agents/children`<br>`POST /v1/mandates/:id/delegations`<br>`GET /v1/agent-catalog` (Gateway) | **PARTIAL** (Mutations FOUND; Catalog MISSING) | Agent creation & delegation endpoints exist in Fastify Gateway. Rich catalog metadata (`CATALOG_AGENTS`: audit certs, authority tiers, sample prompts) is hardcoded in frontend. Python runtime's `GET /agents` returns only string names. |
| **7. Sessions** | `apps/web/components/chat/session-history.tsx`<br>`apps/web/components/workspace/sessions-memory.tsx`<br>`workspace-defaults.ts`<br>`workspace-store.ts` | `POST /v1/environments/:id/sessions`<br>`GET /v1/environments/:id/sessions`<br>`PATCH /v1/environments/:id/sessions/:id`<br>`GET .../sessions/:id/messages` | **PARTIAL** (Sessions CRUD FOUND; Messages MISSING) | Session lifecycle endpoints exist in Phase 4 routes, but rely on volatile `InMemorySessionStore`. No endpoint exists to retrieve message history for a session (`GET .../messages`). Frontend creates fake IDs via `Date.now()`. |
| **8. Memory** | `apps/web/components/workspace/sessions-memory.tsx`<br>`apps/web/components/cards/memory-card.tsx`<br>`apps/web/components/workspace/workspace-defaults.ts` | `public.memories`<br>`GET/POST/REVOKE /v1/environments/:id/memories` | **MISSING** | **Zero representation across monorepo**: No database table, no domain model, no contracts, no API routes. Frontend manages memory 100% in local React state. Requires explicit "Unavailable" UI state and gap contract. |

---

## Detailed Survey: Screen 5 — Payment Trace

### 1. File Paths
- **Route / Tab Mount**: `apps/web/app/dashboard/page.tsx:31-34, 112-113`
- **Main Container**: `apps/web/components/traces/PaymentTraceView.tsx`
- **Subcomponents**:
  - `apps/web/components/traces/VerticalAuthChain.tsx` (Authorization & budget delegation hierarchy)
  - `apps/web/components/traces/LifecycleTimeline.tsx` (5-stage gateway execution timeline)
  - `apps/web/components/traces/VerificationChecklist.tsx` (5-point cryptographic verification matrix)
- **Types & Fixtures**: `apps/web/components/traces/types.ts`
- **Store Integration**: `apps/web/app/lib/workspace-store.ts:128, 282` (`selectedTraceId`, `setSelectedTraceId`)

### 2. Hardcoded Data, Mock Arrays, Synthetic Timers & Client Math
- **`types.ts:79–572`**: Complete mock fixture dictionary `DEFAULT_TRACES` defining 3 exhaustive scenarios:
  1. `"trace-pay-9018"`: Settled IndiGo flight ($245.00 USD) via PayPal Sandbox with 4 auth nodes, 5 lifecycle stages, 5 verification checks, and raw cryptographic hashes (`0x89f41b2a...c07d391e`).
  2. `"trace-rej-7712"`: Denied Grand Hyatt lodging ($5,000.00 USD) with $3,200 shortfall and policy rejection check.
  3. `"trace-pend-4401"`: Pending Hertz rental ($380.00 USD) with uncertain state notice.
- **`PaymentTraceView.tsx:39`**: Fallback trace ID: `effectiveTraceId = traceId ?? store.selectedTraceId ?? "trace-pay-9018"`.
- **`PaymentTraceView.tsx:42–45`**: Zero-network lookup:
  ```typescript
  const trace: PaymentTrace =
    DEFAULT_TRACES[effectiveTraceId] ??
    DEFAULT_TRACES["trace-pay-9018"] ??
    Object.values(DEFAULT_TRACES)[0];
  ```
- **`PaymentTraceView.tsx:55`**: Synthetic clipboard feedback timer: `setTimeout(() => setCopiedRecord(false), 2000)`.
- **`PaymentTraceView.tsx:86`**: Inline latency metric: `Latency: {trace.totalLatencyMs}ms`.
- **`LifecycleTimeline.tsx:32–36`**: Hardcoded title and string interpolation: `+${stage.latencyMs}ms`.
- **`VerificationChecklist.tsx:28–35`**: Hardcoded checklist badges: `"All 5 Checks Passed"`, `"${failedCount} Check Failed"`.

### 3. Backend Endpoints & Status
- `GET /v1/environments/:environmentId/actions/:actionId/trace` (`apps/api/src/phase3-routes.ts:485`) -> **PARTIAL**
  - Returns `{ action, agent, mandateChain, rootMandate }`.
  - **MISSING**: Gateway execution stages with latencies (`stages`), invariant verification matrix (`checklist`), and formatted merchant metadata (`recipient`, `merchantCategory`, `rail`).
- `GET /v1/environments/:environmentId/actions/:actionId` (`apps/api/src/phase3-routes.ts:463`) -> **FOUND** (returns `{ action, reservation }`).
- `GET /v1/environments/:environmentId/payments/paypal/:actionId` (`apps/api/src/paypal-routes.ts:487`) -> **FOUND** (returns `{ action, operation, reservation }`).
- `POST /v1/environments/:environmentId/actions/:actionId/capture` (`phase3-routes.ts:390`) -> **FOUND**.
- `POST /v1/environments/:environmentId/actions/:actionId/release` (`phase3-routes.ts:425`) -> **FOUND**.
- `POST /v1/environments/:environmentId/payments/paypal/:actionId/reconcile` (`paypal-routes.ts:600`) -> **FOUND**.

### 4. Missing Endpoints / Fields & "Unavailable" UI Rendering
When the backend returns an `ActionTraceDto` without execution stages or invariant checks:
- **Timeline Tab**: If `stages` is empty or omitted, do NOT render fake 5-stage cards. Render an explicit container:
  ```tsx
  <div className="rounded-lg border border-border bg-card p-6 text-center">
    <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
    <h4 className="text-sm font-semibold text-foreground">Lifecycle Stages Unavailable</h4>
    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
      Detailed stage latency breakdown is not provided by the gateway for this transaction.
    </p>
  </div>
  ```
- **Verification Tab**: If `checklist` is omitted, render an explicit state:
  ```tsx
  <div className="rounded-lg border border-border bg-card p-6 text-center">
    <ShieldAlert className="mx-auto h-8 w-8 text-warning mb-2" />
    <h4 className="text-sm font-semibold text-foreground">Verification Checklist Unavailable</h4>
    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
      Cryptographic invariant checklist is not verified on this gateway endpoint. See docs/gaps.md.
    </p>
  </div>
  ```
- **Uncertain State Notice**: Rendered strictly when `reservation.state === "held"` and `operation.reconciliationState === "uncertain"`.

### 5. Proposed Contract for `docs/gaps.md`
**Endpoint**: `GET /v1/environments/:environmentId/actions/:actionId/forensic-trace`
```json
{
  "traceId": "trace-act-9018",
  "actionId": "act-9018",
  "environmentId": "env-sandbox-travel-01",
  "environmentName": "Travel & Hospitality",
  "transactionId": "txn_pp_982194820",
  "recipient": "IndiGo Airlines Ltd",
  "merchantCategory": "Airlines",
  "amountMinor": 24500,
  "currency": "USD",
  "rail": "PayPal",
  "status": "completed",
  "initiatedAt": "2026-10-31T13:45:00Z",
  "completedAt": "2026-10-31T13:45:02Z",
  "totalLatencyMs": 312,
  "requestingAgent": {
    "id": "agent-travel",
    "name": "Travel Subagent",
    "role": "subagent"
  },
  "authChain": [
    {
      "id": "agent-travel",
      "name": "Travel Subagent",
      "role": "subagent",
      "mandateId": "man-travel-4001",
      "allocatedMinor": 400000,
      "spentMinor": 125000,
      "reservedMinor": 50000,
      "availableMinor": 225000,
      "currency": "USD",
      "status": "active",
      "policyRule": "Max $500 per transaction without human approval",
      "depth": 2
    }
  ],
  "stages": [
    { "key": "initiated", "name": "Request Initiated", "description": "Agent issued procurement call", "status": "completed", "timestamp": "2026-10-31T13:45:00.100Z", "latencyMs": 14 },
    { "key": "mandate_evaluated", "name": "Mandate Evaluated", "description": "Verified cryptographic signature", "status": "completed", "timestamp": "2026-10-31T13:45:00.142Z", "latencyMs": 42 },
    { "key": "human_approved_bypass", "name": "Autonomous Threshold", "description": "$245.00 within $500 threshold", "status": "completed", "timestamp": "2026-10-31T13:45:00.153Z", "latencyMs": 11 },
    { "key": "paypal_captured", "name": "PayPal Capture", "description": "Captured via PayPal Sandbox API", "status": "completed", "timestamp": "2026-10-31T13:45:00.368Z", "latencyMs": 215 },
    { "key": "settled_reconciled", "name": "Settled & Committed", "description": "Ledger state updated to captured", "status": "completed", "timestamp": "2026-10-31T13:45:00.398Z", "latencyMs": 30 }
  ],
  "checklist": [
    { "id": "check-budget", "name": "Ancestor Budget Invariant", "description": "All parent allocations have sufficient headroom", "passed": true },
    { "id": "check-rail", "name": "Permitted Rail & Action", "description": "PayPal is permitted in mandate", "passed": true },
    { "id": "check-hash", "name": "Cryptographic Hash Chain", "description": "SHA-256 parameter digest verified", "passed": true },
    { "id": "check-ledger", "name": "Ledger Reservation", "description": "Funds transitioned from held to captured", "passed": true }
  ],
  "rawRecord": {
    "actionId": "act-9018",
    "requestHash": "0x89f41b2a...",
    "idempotencyKey": "idem-9018"
  }
}
```

### 6. Component Props vs API Shape & Mapper
- **Component Prop Interface**: `PaymentTrace` (`types.ts:52-77`).
- **Backend API Shapes**:
  - `ActionTraceDto`: `{ action, agent, mandateChain, rootMandate }`
  - `PayPalOperationSummaryDto`: `{ actionId, providerOrderId, status, captureId, reconciliationState, amountMinor, currency }`
  - `LedgerReservationDto`: `{ actionId, accountId, amountMinor, state }`
- **Required Mapper**: `mapBackendTraceToPaymentTrace(traceDto, paypalOp?, reservation?): PaymentTrace`
  - Derives `status`:
    - If `action.executionState === "captured"` -> `"completed"`
    - If `action.executionState === "failed"` or `"rejected"` -> `"rejected"`
    - If `reservation?.state === "held"` -> `"pending_capture"`
  - Derives `uncertainStateNotice`: set when `paypalOp?.reconciliationState === "uncertain"`.
  - Sets `stages: []` and `checklist: []` if not present in payload, triggering explicit "Unavailable" UI.

### 7. Mutations
- Tab switching & Developer mode toggle (client-only).
- Manual reconciliation command: `POST /v1/environments/:id/payments/paypal/:actionId/reconcile`. Must wait for 200 OK before updating UI.

### 8. Loading Skeletons, Empty States & Error States
- **Loading Skeleton**: Container (max-w-[1200px]), header banner skeleton (h-36), tab pill strip skeleton (h-10), tab content skeleton (h-80), matching layout dimensions with zero shift.
- **Empty State**: Rendered when `actionId` returns 404: "Transaction trace not found or expired."
- **Error State with Retry**: Rendered on fetch failure: "Failed to load forensic trace" with "Retry" button.

### 9. Fixtures to Delete
- `DEFAULT_TRACES` in `apps/web/components/traces/types.ts:79–572` (494 lines).

---

## Detailed Survey: Screen 6 — Library (Agent Directory & Attach Modal)

### 1. File Paths
- **Route / Tab Mount**: `apps/web/app/dashboard/page.tsx:39-42, 140-141`
- **Main Directory**: `apps/web/components/agents/AgentLibrary.tsx`
- **Subcomponents**:
  - `apps/web/components/agents/AgentCard.tsx` (Individual agent card with status pill and attach/inspect actions)
  - `apps/web/components/agents/AgentDetailDrawer.tsx` (Slide-over drawer detailing permissions, security audit, sample prompts)
  - `apps/web/components/agents/AttachAgentDialog.tsx` (Modal configuring delegated budget, parent holder, and rails)
- **Types & Fixtures**: `apps/web/components/agents/types.ts`

### 2. Hardcoded Data, Mock Arrays, Synthetic Timers & Client Math
- **`types.ts:42–258`**: `CATALOG_AGENTS`: 6 static specialist agents:
  1. `agent-travel-concierge`: $2,500.00 recommended budget, PayPal/Simulation, certified by PayGuardian Security Labs.
  2. `agent-cloud-finops`: $15,000.00 recommended budget, Cloud infra procurement.
  3. `agent-procure-bot`: $5,000.00 recommended budget, Enterprise hardware & software.
  4. `agent-payroll-exec`: $25,000.00 recommended budget, Contractor disbursements.
  5. `agent-gateway-sentinel`: $1,000.00 recommended budget, Security monitor.
  6. `agent-audit-compliance`: $0.00 recommended budget, Read-only auditor.
- **`AgentLibrary.tsx:64–72`**: Hardcoded category filter list: `"All Agents"`, `"Logistics & Travel"`, `"Cloud Infra"`, `"Procurement"`, `"Finance & Payroll"`, `"API Gateway"`, `"Compliance"`.
- **`AgentLibrary.tsx:93`**: Synthetic notification clear timer: `setTimeout(() => setNotification(null), 4000)`.
- **`AttachAgentDialog.tsx:39–41`**: Hardcoded default form state: `$500` budget, parent `orchestrator-root`, rail `["PayPal"]`.
- **`AttachAgentDialog.tsx:83–87`**: Fake 3D trigonometric node coordinate math:
  ```typescript
  const angle = (nodeIndex * (2 * Math.PI)) / Math.max(1, nodeIndex + 1);
  const posX = Math.round(Math.cos(angle) * 140);
  const posY = Math.round(-30 - (nodeIndex % 2) * 50);
  const posZ = Math.round(Math.sin(angle) * 40);
  ```
- **`AttachAgentDialog.tsx:111–143`**: Client-side synthetic attachment mutating `workspaceStore.attachAgent(newNode, newEdge)` with random cryptographic signature `0x7a89f921bc + Math.random().toString(16).slice(2, 8)` with zero backend communication.

### 3. Backend Endpoints & Status
- `GET /agents` (`apps/agent-runtime/src/agent_runtime/main.py:49` on port 8000) -> **PARTIAL**
  - Returns raw names: `["personal", "travel", "hotel", "transport", "food", "activities"]`.
  - Omits all catalog metadata (tagline, authority tier, recommended budget, audit certificates).
- `GET /tools` (`apps/agent-runtime/src/agent_runtime/main.py:54`) -> **FOUND** (manifest of tools: `check_authority`, `simulate_action`, `request_approval`, `reserve_action`).
- `POST /v1/environments/:environmentId/agents/children` (`apps/api/src/phase1-routes.ts:166`) -> **FOUND** (registers child agent under parent).
- `POST /v1/mandates/:mandateId/delegations` (`apps/api/src/phase2-routes.ts:109`) -> **FOUND** (issues delegated spending mandate).
- `GET /v1/agent-catalog` (Gateway route) -> **MISSING**.

### 4. Missing Endpoints / Fields & "Unavailable" UI Rendering
- If `GET /v1/agent-catalog` is not implemented on the Gateway:
  - If the hook cannot reach a catalog API, render an explicit error banner:
    ```tsx
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-xs text-warning">
      <AlertCircle className="h-4 w-4 inline mr-2" />
      Agent catalog service unavailable. Official directory could not be reached.
    </div>
    ```
  - If fallbacking to Python runtime's `GET /agents`, cards render with an explicit `"Catalog metadata unavailable"` tag, and the security audit badge displays `"Self-declared / Uncertified"`.

### 5. Proposed Contract for `docs/gaps.md`
**Endpoint**: `GET /v1/agent-catalog`
```json
{
  "catalog": [
    {
      "id": "agent-travel-concierge",
      "name": "Travel Concierge",
      "tagline": "Autonomous flight booking, hotel procurement, and itinerary management",
      "description": "Specialist in multi-leg flight routing, lodging reservations, and corporate itinerary management.",
      "specialty": "Travel & Hospitality",
      "role": "subagent",
      "category": "logistics",
      "authorityTier": "Tier 2: Autonomous Micro-Transactions",
      "tierLevel": 2,
      "recommendedBudgetMinor": 250000,
      "currency": "USD",
      "supportedRails": ["PayPal", "Simulation"],
      "publisher": "Official PayGuardian",
      "avatarIcon": "plane",
      "permissions": ["flight.search", "flight.procure", "hotel.reserve"],
      "samplePrompts": ["Book direct flight to Mumbai on IndiGo under $300"],
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
}
```

### 6. Component Props vs API Shape & Mapper
- **Component Prop Interface**: `SpecialistAgent` (`types.ts:21-40`).
- **Backend API Shapes**:
  - `AgentDto` (`phase1-routes.ts`): `{ id, environmentId, parentAgentId, name, kind, capabilities, status, createdAt }`.
  - `CatalogAgentDto` (from proposed `/v1/agent-catalog`).
- **Required Mapper**: `mapCatalogDtoToSpecialistAgent(dto: CatalogAgentDto, attachedAgentIds: Set<string>): SpecialistAgent`.

### 7. Mutations
- **Attach Agent Mutation** in `AttachAgentDialog.tsx:72–152`:
  - Current: executes purely in React state with fake coordinates and random signature.
  - **Required Production Implementation**:
    1. Send `POST /v1/environments/:environmentId/agents/children` with payload:
       ```json
       {
         "parentAgentId": "selectedParentId",
         "name": "agent.name",
         "kind": "worker",
         "capabilities": agent.permissions
       }
       ```
    2. If `budgetMinor > 0`: Send `POST /v1/mandates/:parentMandateId/delegations` with payload:
       ```json
       {
         "holderAgentId": createdAgent.id,
         "budgetLimitMinor": budgetMinor,
         "currency": currency,
         "permittedActions": agent.permissions,
         "expiresAt": "2026-12-31T23:59:59Z",
         "canDelegate": false,
         "maxDelegationDepth": 0,
         "approvalRequired": false
       }
       ```
    3. Update local state and graph store **only after confirmed 201 responses**. Absolutely NO optimistic updates.

### 8. Loading Skeletons, Empty States & Error States
- **Loading Skeleton**: Title & description skeleton (h-14), search input and category chips (h-16), two section headers (h-6), 6-card grid (h-56 each) with avatar, title, description lines, tags, and action buttons.
- **Empty State**: Shown when filter/search produces 0 results: `<Bot /> No agents found` + "Reset Filters" button.
- **Error State with Retry**: "Failed to load agent library" + "Retry Connection" button.

### 9. Fixtures to Delete
- `CATALOG_AGENTS` in `apps/web/components/agents/types.ts:42–258` (217 lines).

---

## Detailed Survey: Screen 7 — Sessions (Thread History & Task Management)

### 1. File Paths
- **Route / Component Mounts**:
  - Sheet in Assistant View: `apps/web/components/chat/session-history.tsx` (`SessionHistoryPanel`)
  - Standalone Component: `apps/web/components/workspace/sessions-memory.tsx` (`SessionsGrid`, `SessionsPanel`)
  - Defaults / Fixtures: `apps/web/components/workspace/workspace-defaults.ts:36-64` (`INITIAL_SESSIONS`)
  - Store State: `apps/web/app/lib/workspace-store.ts:129, 283` (`activeSessionId`, `setActiveSessionId`)

### 2. Hardcoded Data, Mock Arrays, Synthetic Timers & Client Math
- **`workspace-defaults.ts:36–64`**: `INITIAL_SESSIONS`: 3 mock sessions:
  1. `sess-goa-01`: "Goa Tech Conference Logistics" (status: "waiting for you", 3 agents, 2 sign-offs waiting).
  2. `sess-cloud-02`: "AWS Cluster Scale Out" (status: "active", 2 agents).
  3. `sess-tax-03`: "Q3 Vendor Audit & Receipts" (status: "done", 1 agent).
- **`sessions-memory.tsx:55`**: `const [sessions, setSessions] = React.useState<SessionItem[]>(INITIAL_SESSIONS);`.
- **`sessions-memory.tsx:66–83`**: `handleCreateNewSession`:
  - Generates client ID: `sess-new-${Date.now()}`.
  - Clears chat messages locally without any API call: `workspaceStore.setChatMessages([])`.
- **`session-history.tsx:26`**: `const [sessions, setSessions] = React.useState<SessionItem[]>(INITIAL_SESSIONS);`.
- **`session-history.tsx:38–52`**: `handleNewSession`: Generates local `sess-new-${Date.now()}` without backend call.
- **`session-history.tsx:54–57`**: `handleSelectSession`: Only updates `activeSessionId` in store; does not fetch or reload message history.

### 3. Backend Endpoints & Status
- `POST /v1/environments/:environmentId/sessions` (`apps/api/src/phase4-routes.ts:271`) -> **FOUND** (creates session in environment).
- `GET /v1/environments/:environmentId/sessions` (`apps/api/src/phase4-routes.ts:310`) -> **FOUND** (lists sessions).
- `GET /v1/environments/:environmentId/sessions/:sessionId` (`apps/api/src/phase4-routes.ts:327`) -> **FOUND**.
- `PATCH /v1/environments/:environmentId/sessions/:sessionId` (`apps/api/src/phase4-routes.ts:350`) -> **FOUND** (updates status or context).
- `POST /v1/environments/:environmentId/sessions/:sessionId/runs` (`apps/api/src/phase4-routes.ts:384`) -> **FOUND**.
- `GET /v1/environments/:environmentId/sessions/:sessionId/runs` (`apps/api/src/phase4-routes.ts:428`) -> **FOUND**.
- `GET /v1/environments/:environmentId/sessions/:sessionId/messages` -> **MISSING**.
- **Storage Discrepancy**: Backend uses `InMemorySessionStore` (`apps/api/src/phase4.ts:289`). Any restart of `apps/api` purges session records.

### 4. Missing Endpoints / Fields & "Unavailable" UI Rendering
- **Session Message History**:
  When an operator clicks a historical session in `session-history.tsx`:
  - Because `GET .../sessions/:sessionId/messages` is MISSING, the Assistant chat window cannot load past conversation messages.
  - **Required Explicit UI State**:
    In `assistant-view.tsx`, render an informational notice banner at the top of the chat:
    ```tsx
    <div className="mx-auto max-w-xl rounded-md border border-border bg-secondary/80 p-3 text-xs text-muted-foreground flex items-center gap-2">
      <Info className="h-4 w-4 text-warning shrink-0" />
      <span>Session history persistence is not yet supported by the gateway. This thread is ready for new instructions.</span>
    </div>
    ```

### 5. Proposed Contract for `docs/gaps.md`
**Endpoint**: `GET /v1/environments/:environmentId/sessions/:sessionId/messages`
```json
{
  "sessionId": "sess-goa-01",
  "messages": [
    {
      "id": "msg-001",
      "type": "agent_says",
      "sender": "Main Orchestrator",
      "timestamp": "2026-10-31T13:45:00Z",
      "text": "Goa Conference Logistics session initialized. Ready to procure travel."
    },
    {
      "id": "msg-002",
      "type": "verified_block",
      "cardType": "payment_result",
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

### 6. Component Props vs API Shape & Mapper
- **Component Prop Interface**: `SessionItem` (`workspace-defaults.ts:3–10`):
  ```typescript
  interface SessionItem {
    id: string;
    title: string;
    description?: string;
    status: "active" | "waiting for you" | "done";
    lastActivity: string;
    agentCount: number;
  }
  ```
- **Backend API Shape**: `SessionDto` (`packages/contracts/src/index.ts:186–196`):
  ```typescript
  interface SessionDto {
    id: string;
    environmentId: string;
    agentId: string | null;
    name: string;
    status: "active" | "paused" | "completed" | "cancelled";
    context: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }
  ```
- **Required Mapper**: `mapSessionDtoToSessionItem(dto: SessionDto): SessionItem`:
  ```typescript
  export function mapSessionDtoToSessionItem(dto: SessionDto): SessionItem {
    let status: SessionItem["status"] = "active";
    if (dto.status === "paused") status = "waiting for you";
    else if (dto.status === "completed" || dto.status === "cancelled") status = "done";

    return {
      id: dto.id,
      title: dto.name,
      description: typeof dto.context?.description === "string" 
        ? dto.context.description 
        : "Autonomous task session with delegated agent authority.",
      status,
      lastActivity: formatDistanceToNow(new Date(dto.updatedAt ?? dto.createdAt)),
      agentCount: Array.isArray(dto.context?.agents) 
        ? dto.context.agents.length 
        : (dto.agentId ? 1 : 0),
    };
  }
  ```

### 7. Mutations
- **Create New Session**:
  - Send `POST /v1/environments/:environmentId/sessions` with `{ name: title, context: {} }`.
  - On 201 Created: prepend confirmed `SessionItem` to state and set `workspaceStore.setActiveSessionId(confirmed.id)`.
  - Disallow optimistic creation.
- **Update Session Status**:
  - Send `PATCH /v1/environments/:environmentId/sessions/:sessionId` with `{ status: "paused" | "completed" }`.
  - Update local state only after 200 OK.

### 8. Loading Skeletons, Empty States & Error States
- **Loading Skeleton**: Section title skeleton (h-7), grid of 2–4 card skeletons (h-32) with icon tile, status pill, title bar, description lines, and footer metadata.
- **Empty State**: "No active task sessions in this environment. Click 'New session' to initialize an autonomous thread."
- **Error State with Retry**: "Failed to load sessions" with "Retry" button.

### 9. Fixtures to Delete
- `INITIAL_SESSIONS` in `apps/web/components/workspace/workspace-defaults.ts:36–64` (29 lines).

---

## Detailed Survey: Screen 8 — Memory (Memory Vault)

### 1. File Paths
- **Route / Component Mounts**:
  - Memory Sheet in Workspace Header: `apps/web/components/workspace/workspace-layout.tsx:96-104, 142-153` (`<MemoryVaultContent singleColumn showHeading={false} />`)
  - Standalone Grid: `apps/web/components/workspace/sessions-memory.tsx` (`MemoryVaultContent`, `MemoryGrid`)
  - Memory Card Component: `apps/web/components/cards/memory-card.tsx`
  - Assistant Composer Card Generator: `apps/web/components/chat/assistant-view.tsx:190–214`
  - Defaults / Fixtures: `apps/web/components/workspace/workspace-defaults.ts:66–94` (`INITIAL_MEMORIES`)

### 2. Hardcoded Data, Mock Arrays, Synthetic Timers & Client Math
- **`workspace-defaults.ts:66–94`**: `INITIAL_MEMORIES`: 3 mock memories:
  1. `mem-01`: "dietary_preference", Vegetarian meals only, Travel Subagent, 2026-10-30.
  2. `mem-02`: "hotel_proximity", Within 5km of stadium, Hotel Subagent, 2026-10-31.
  3. `mem-03`: "preferred_airline", IndiGo or Air India direct routes, Travel Subagent, 2026-10-29.
- **`sessions-memory.tsx:200`**: `const [memories, setMemories] = React.useState<MemoryItem[]>(INITIAL_MEMORIES);`.
- **`sessions-memory.tsx:203–207`**: `handleUndoMemory`:
  ```typescript
  const handleUndoMemory = (memId: string) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === memId ? { ...m, isRevoked: true } : m))
    );
  };
  ```
  Mutates local React state with zero API call.
- **`memory-card.tsx:22–30`**: Default fallback props: `mem-entry-819`, `dietary_preference`, `Vegetarian meals only...`.
- **`memory-card.tsx:36–40`**: `handleUndo`: Client-only `setIsUndone(true)` without network call.
- **`assistant-view.tsx:190–214`**: Chat regex keyword matcher (`"remember"`, `"vegetarian"`, `"preference"`) generates synthetic in-memory memory card.

### 3. Backend Endpoints & Status
- **COMPLETELY MISSING ACROSS MONOREPO**:
  - Database: ZERO migrations in `supabase/migrations/` create a `memories` table.
  - Domain models: ZERO domain models in `packages/domain/`.
  - Contracts: ZERO DTOs in `packages/contracts/`.
  - API Routes: ZERO routes in `apps/api/`.
  - Python Runtime: Non-existent as an isolated service or store.
  - Status: **MISSING** (100% simulated in client memory).

### 4. Missing Endpoints / Fields & "Unavailable" UI Rendering
Per Requirement R2:
> *"Never invent data: if an endpoint or field is MISSING, show a clear 'unavailable' state in the UI and list it in docs/gaps.md with the proposed request and response contract."*

Because backend memory persistence does not exist:
- **UI State in Memory Vault (`MemoryVaultContent`)**:
  Must render an explicit "Unavailable" state rather than displaying mock memories or an empty screen:
  ```tsx
  <div className="flex flex-col items-center justify-center rounded-lg border border-warning/30 bg-card p-8 text-center">
    <Bookmark className="h-10 w-10 text-warning mb-3 opacity-80" />
    <h3 className="text-sm font-semibold text-foreground">Memory Vault Unavailable</h3>
    <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
      Long-term memory persistence is not currently implemented on the backend gateway. Stored context, preferences, and agent constraints are unavailable.
    </p>
    <div className="mt-4 rounded border border-border bg-secondary/60 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
      Tracking in docs/gaps.md &bull; public.memories
    </div>
  </div>
  ```
- **"Undo / Forget" Action**:
  Disabled with tooltip: `"Unavailable: Memory backend not connected"`.
- **Mandatory Security Invariant Notice** (must remain visible):
  `"Security notice: Memory never grants spending permission. Authority can only be granted via signed cryptographic mandates."`

### 5. Proposed Contract for `docs/gaps.md`

#### Database Migration: `supabase/migrations/20261102000000_memories.sql`
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

#### API Endpoints:
1. **`GET /v1/environments/:environmentId/memories`**
   - Query: `category?: "environment" | "session" | "agent"`, `agentId?: string`
   - Response (200 OK):
     ```json
     {
       "memories": [
         {
           "id": "mem-019283",
           "environmentId": "env-sandbox-travel-01",
           "sessionId": "sess-goa-01",
           "agentId": "agent-travel",
           "agentName": "Travel Subagent",
           "category": "agent",
           "key": "dietary_preference",
           "value": "Vegetarian meals only on all flight reservations",
           "contextSnippet": "Operator instructed during session sess-goa-01",
           "isRevoked": false,
           "savedAt": "2026-10-31T12:00:00Z"
         }
       ]
     }
     ```
2. **`POST /v1/environments/:environmentId/memories`**
   - Body:
     ```json
     {
       "category": "agent",
       "keyName": "dietary_preference",
       "valueText": "Vegetarian meals only on all flight reservations",
       "contextSnippet": "Operator specified in chat",
       "agentId": "agent-travel",
       "sessionId": "sess-goa-01"
     }
     ```
   - Response (201 Created): `{ "memory": MemoryDto }`
3. **`POST /v1/environments/:environmentId/memories/:memoryId/revoke`**
   - Response (200 OK): `{ "memory": { "id": "mem-019283", "isRevoked": true, "revokedAt": "2026-11-01T21:05:00Z" } }`

### 6. Component Props vs API Shape & Mapper
- **Component Prop Interface**: `MemoryItem` (`workspace-defaults.ts:12–21`).
- **Proposed Backend Model**: `MemoryDto` (as shown above).
- **Required Mapper**: `mapMemoryDtoToMemoryItem(dto: MemoryDto): MemoryItem`.
  - Direct 1-to-1 field mapping.
- **Current Hook Implementation**:
  Until backend routes exist, `useMemory(environmentId)` returns `{ memories: [], isUnavailable: true, error: null }`.

### 7. Mutations
- **Revoke / Forget Memory**:
  - Must call `POST /v1/environments/:environmentId/memories/:memoryId/revoke`.
  - Update `isRevoked: true` strictly on 200 OK.
  - In current state without backend: action is disabled.

### 8. Loading Skeletons, Empty States & Error States
- **Loading Skeleton**: Category pills bar skeleton (h-7), 3 card skeletons with dashed/solid borders (h-32) matching Sheet / container width.
- **Empty State**: (Once backend connected): "No memories recorded in this vault."
- **Unavailable State**: Prominent warning banner and disabled card explaining backend gap.
- **Error State with Retry**: "Failed to load memory vault" with "Retry" button.

### 9. Fixtures to Delete
- `INITIAL_MEMORIES` in `apps/web/components/workspace/workspace-defaults.ts:66–94` (29 lines).
- Default mock props in `apps/web/components/cards/memory-card.tsx:22–30`.

---

## Architectural Guardrails for Screens 5–8

### 1. Integer Minor Units & Financial Integrity (Requirement R3)
- In Screen 5 (Payment Trace) and Screen 6 (Library):
  - All currency amounts are strictly stored and transmitted as **integer minor units** (e.g. `$245.00` = `24500`, `$2,500.00` = `250000`).
  - Formatting for display is performed solely via `formatMinorUnits(amountMinor, currency)` (`apps/web/app/lib/currency.ts:3`).
  - Client-side budget math (such as subtracting reservations from limits) is eliminated in favor of backend ledger balances (`availableMinor`).

### 2. Live Updates & Fallback Polling (Requirement R4)
- **Status Reality**: Neither WebSockets nor SSE are implemented in backend services.
- **Temporary Fallback Protocol**:
  - `PaymentTrace`: Queried on-demand when opening trace viewer.
  - `AgentLibrary`: Queried on mount.
  - `Sessions`: Refreshed on tab mount and after `POST /sessions` creation. Short polling interval of 10s can be enabled if background agent runs are active.
  - `Memory`: Explicitly unavailable.
  - All polling fallbacks must be logged in `docs/gaps.md`.

### 3. Fixtures Cleanup Plan
Upon completing integration for Screens 5–8:
1. `apps/web/components/traces/types.ts`: Delete lines 79–572 (`DEFAULT_TRACES`).
2. `apps/web/components/agents/types.ts`: Delete lines 42–258 (`CATALOG_AGENTS`).
3. `apps/web/components/workspace/workspace-defaults.ts`: Delete lines 36–64 (`INITIAL_SESSIONS`) and lines 66–94 (`INITIAL_MEMORIES`).
4. `apps/web/components/cards/memory-card.tsx`: Remove fallback default props on lines 22–30.
5. Add ESLint guardrail per R5 banning imports from `*mock*` or `*fixtures*` inside `apps/web`.
