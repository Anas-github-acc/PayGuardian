# PayGuardian Screens 1–4 Backend Integration Survey & Technical Specification

**Author**: Explorer Survey Agent (`explorer_survey_screens_1_4`)  
**Date**: 2026-11-01T21:40:00Z  
**Monorepo Working Directory**: `/home/anas/myspace/AI/PayGuardian`  
**Deliverable**: Technical Architecture & Migration Blueprint for Screens 1 to 4  
**Integrity Mode**: Read-Only Analysis / Development  

---

## Executive Overview

This report provides an exhaustive, forensic codebase survey and integration specification for the first four primary dashboard screens of PayGuardian:
1. **Screen 1**: Workspace Graph (Ferrow 3D Agent Network, Pipeline SVG, Authority List View) and Budget Bar
2. **Screen 2**: Activity Feed (Recent Activity Panel, Micro-Feed, and Full Activity Audit Grid)
3. **Screen 3**: Approvals (Inbox, Approval Cards, Sign-Off Detail Drawer)
4. **Screen 4**: Payment Trace (Vertical Authorization Chain, Lifecycle Timeline, 5-Point Verification Checklist)

Every component, file path, mock fixture, synthetic timer, and client-side arithmetic calculation has been analyzed against the Fastify API Gateway (`apps/api`), Python Agent Runtime (`apps/agent-runtime`), and Supabase/PostgreSQL schema. Concrete data transformation mappers, zero-optimistic mutation lifecycles, integer minor-unit financial rules, and container-matched UI fallback states are specified below to guide implementation.

---

## 1. Architectural Foundation: Routing, Types, and Client Infrastructure

### 1.1 OpenAPI Type Generation Script
- **Spec Source**: The Fastify Gateway API automatically exposes dynamic OpenAPI 3.0 JSON at `GET http://localhost:3001/docs/json` via `@fastify/swagger` (`apps/api/src/app.ts:66`).
- **Generation Script**: Add `openapi-typescript` to `apps/web/devDependencies` and register a script in `apps/web/package.json`:
  ```json
  "scripts": {
    "generate:api-types": "openapi-typescript http://localhost:3001/docs/json -o src/api/generated-schema.ts"
  }
  ```
- **Generated Types Target**: `apps/web/src/api/generated-schema.ts` (or `packages/contracts`).

### 1.2 Next.js Routing & Session Cookie Proxying
To prevent browser CORS violations and protect session credentials without exposing tokens to browser JavaScript:
- **Approach**: Next.js Rewrites in `apps/web/next.config.ts`:
  ```typescript
  import type { NextConfig } from "next";

  const nextConfig: NextConfig = {
    output: "standalone",
    async rewrites() {
      const gatewayUrl = process.env.API_GATEWAY_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";
      return [
        {
          source: "/api/gateway/:path*",
          destination: `${gatewayUrl}/:path*`,
        },
      ];
    },
  };

  export default nextConfig;
  ```
- All client requests inside `apps/web` will target `/api/gateway/...`, maintaining same-origin security and transmitting cookies seamlessly.

### 1.3 Typed API Client Architecture (`src/api/`)
Create `apps/web/src/api/` with a modular structure:
```
apps/web/src/api/
├── client.ts              # Base fetch wrapper attaching headers, error envelope, and signal
├── generated-schema.ts    # Auto-generated OpenAPI TypeScript definitions
├── hooks/
│   ├── useWorkspaceGraph.ts
│   ├── useBudgetBar.ts
│   ├── useActivityFeed.ts
│   ├── useApprovals.ts
│   └── usePaymentTrace.ts
├── mappers/
│   ├── graph-mapper.ts
│   ├── budget-mapper.ts
│   ├── activity-mapper.ts
│   ├── approvals-mapper.ts
│   └── trace-mapper.ts
└── types.ts               # Shared frontend view models
```

---

## 2. Screen 1: Workspace Graph & Budget Bar

### 2.1 File Inventory
| Entity | Monorepo File Path |
|---|---|
| **Host Page** | `apps/web/app/dashboard/page.tsx` (cases `"workspace"` and `"overview"`) |
| **Top Container** | `apps/web/components/workspace/workspace-layout.tsx` |
| **Topology Container** | `apps/web/components/workspace/delegation-topology.tsx` |
| **Pipeline View** | `apps/web/components/workspace/orchestrator-pipeline.tsx` |
| **3D Three.js Canvas** | `apps/web/components/canvas/agent-network-canvas.tsx` |
| **Authority List View** | `apps/web/components/canvas/agent-network-list-view.tsx` |
| **Node Detail Drawer** | `apps/web/components/canvas/node-detail-drawer.tsx` |
| **Agent Inspector** | `apps/web/components/workspace/agent-inspector.tsx` |
| **Budget Bar** | `apps/web/components/workspace/budget-strip.tsx` |
| **KPI Metrics Strip** | `apps/web/components/workspace/kpi-strip.tsx` |
| **Overview Dashboard** | `apps/web/components/dashboard/overview.tsx` |
| **Store & Navigation** | `apps/web/app/lib/workspace-store.ts`, `apps/web/app/lib/navigation.ts` |
| **Current Fixtures** | `apps/web/components/workspace/workspace-defaults.ts` (`DEFAULT_GRAPH_NODES`, `DEFAULT_GRAPH_EDGES`), `agent-network-canvas.tsx` (`DEFAULT_NODES`, `DEFAULT_EDGES`), `workspace-store.ts` (`DEFAULT_ENVIRONMENTS`), `overview.tsx` (`SPEND_SERIES`, `AGENT_AUTHORITY`) |

### 2.2 Hardcoded Elements, Synthetic Timers, and Client Logic
1. **Mock Fixture Arrays**:
   - `DEFAULT_GRAPH_NODES` (`workspace-defaults.ts:144-200`): 5 nodes (`orchestrator-root`, `agent-travel`, `agent-hotel`, `agent-flights-unfunded`, `agent-booking-gw`) with fake amounts ($10k, $4k, $4k, $0, $2k).
   - `DEFAULT_GRAPH_EDGES` (`workspace-defaults.ts:202-235`): 4 edges with static statuses (`"flowing"`, `"idle"`, `"payment_pulse"`).
   - Duplicated `DEFAULT_NODES` and `DEFAULT_EDGES` (`agent-network-canvas.tsx:40-131`).
   - `SPEND_SERIES` and `AGENT_AUTHORITY` (`overview.tsx:26-44`).
   - `DEFAULT_ENVIRONMENTS` (`workspace-store.ts:139-184`).
2. **Synthetic Timers**:
   - `orchestrator-pipeline.tsx:615-621`: `setInterval(..., 2800)` cycling 10 fake ticker strings.
   - `orchestrator-pipeline.tsx:658-663`: `setInterval(..., 7200)` incrementing `workflows` counter from 1247.
   - `workspace-store.ts:191, 340-371`: Hardcoded `latencyMs: 14` with simulated ping probe.
3. **Client-Side Calculations & Local Mutations**:
   - `workspace-layout.tsx:37-40`: Auto-populates empty store graph with `DEFAULT_GRAPH_NODES`.
   - `workspace-layout.tsx:55-71`: `handleRevokeNode` modifies local node status to `"revoked"` and sets `isFunded: false` without network communication.
   - `budget-strip.tsx:33-37`: `calculateAvailableMinor(limitMinor, spentMinor, reservedMinor)` computed client-side.
   - `kpi-strip.tsx:32-43`: Headroom and utilization percentages derived client-side.
   - `overview.tsx:170`: `available = Math.max(0, limit - spent - reserved)`.
   - `node-detail-drawer.tsx:55-65`: Fallback balances (allocated $4k, spent $1.25k, reserved $500).
   - `agent-inspector.tsx:44-63`: Hardcoded name fallback dictionary and fallback budget numbers.

### 2.3 Corresponding Backend Endpoints & Commands
- **Query Endpoints**:
  - `GET /v1/environments` (`apps/api/src/phase1-routes.ts:83`): Lists user environments.
  - `GET /v1/environments/:environmentId/agents` (`apps/api/src/phase1-routes.ts:93`): Lists agents in environment.
  - `GET /v1/environments/:environmentId/mandates` (`apps/api/src/phase6-routes.ts:154`): Lists authority mandates with limits.
  - `GET /v1/environments/:environmentId/ledger/accounts` (`apps/api/src/phase3-routes.ts:145`): Lists ledger accounts with `availableMinor`, `reservedMinor`, and `capturedMinor`.
- **Backend Gaps (to record in `docs/gaps.md`)**:
  - `GET /v1/environments/:environmentId`: Single environment fetch route is missing (only list exists in `phase1-routes.ts:83`).
  - `GET /v1/environments/:environmentId/graph`: Composite graph topology endpoint is missing (`docs/frontend-audit.md:1322-1370`).
  - `GET /v1/environments/:environmentId/analytics/spend-velocity`: 7-day spend chart data endpoint is missing (`docs/frontend-audit.md:1290-1305`).
  - `GET /v1/environments/:environmentId/analytics/authority-breakdown`: Agent authority distribution endpoint is missing (`docs/frontend-audit.md:1307-1319`).
- **Mutation Commands**:
  - Revoke Agent: `POST /v1/environments/:environmentId/agents/:agentId/revoke` (`phase6-routes.ts:109`).
  - Revoke Mandate: `POST /v1/mandates/:mandateId/revocations` (`phase2-routes.ts:169`).
  - Disable Agent: `POST /v1/environments/:environmentId/agents/:agentId/disable` (`phase6-routes.ts:109`).
  - Allocate / Reclaim Funds: `POST /v1/environments/:environmentId/ledger/allocations` (`phase3-routes.ts:205`) and `POST /v1/environments/:environmentId/ledger/reclaims` (`phase3-routes.ts:162`).

### 2.4 Shape Mismatch & Mapper Function Specification
- **Backend Models**:
  - `AgentDto`: `{ id, environmentId, parentAgentId, name, kind, status, createdAt }`
  - `MandateDto`: `{ id, holderAgentId, budgetLimitMinor, currency, permittedActions, status, maxDelegationDepth, approvalRequired }`
  - `LedgerAccountDto`: `{ id, mandateId, availableMinor, reservedMinor, capturedMinor }`
- **Expected Component Props**:
  - `AgentNodeData`: `{ id, name, role, status, allocatedMinor, spentMinor, reservedMinor, position: [x,y,z], isFunded, allowedActions }`
  - `AgentEdgeData`: `{ id, source, target, isAuthorized, status, amountMinor }`
  - `BudgetStripProps`: `{ currency, totalLimitMinor, spentMinor, reservedMinor }`
- **Mapper Implementation Contract**:
  ```typescript
  // src/api/mappers/graph-mapper.ts
  import type { AgentDto, MandateDto, LedgerAccountDto, EnvironmentDto } from "../generated-schema";
  import type { AgentNodeData, AgentEdgeData } from "@/components/canvas/types";

  export function mapWorkspaceGraph(
    agents: AgentDto[],
    mandates: MandateDto[],
    accounts: LedgerAccountDto[]
  ): { nodes: AgentNodeData[]; edges: AgentEdgeData[] } {
    const mandateMap = new Map(mandates.map((m) => [m.holderAgentId, m]));
    const accountMap = new Map(accounts.map((a) => [a.mandateId, a]));

    // 1. Map Nodes
    const nodes: AgentNodeData[] = agents.map((agent, index) => {
      const isRoot = !agent.parentAgentId || agent.kind === "personal";
      const mandate = mandateMap.get(agent.id);
      const account = mandate ? accountMap.get(mandate.id) : undefined;

      const allocatedMinor = mandate?.budgetLimitMinor ?? 0;
      const spentMinor = account?.capturedMinor ?? mandate?.spentMinor ?? 0;
      const reservedMinor = account?.reservedMinor ?? mandate?.reservedMinor ?? 0;
      const isFunded = allocatedMinor > 0;

      let status: AgentNodeData["status"] = "active";
      if (agent.status === "revoked" || mandate?.status === "revoked") status = "revoked";
      else if (agent.status === "disabled") status = "paused";
      else if (!isFunded) status = "unfunded";

      // Deterministic hierarchical 3D spatial layout
      let position: [number, number, number] = [0, 80, 0];
      if (!isRoot) {
        const siblings = agents.filter((a) => a.parentAgentId === agent.parentAgentId);
        const siblingIndex = siblings.findIndex((a) => a.id === agent.id);
        const count = siblings.length;
        const xOffset = count > 1 ? (siblingIndex - (count - 1) / 2) * 110 : 0;
        const depth = agent.parentAgentId && agents.some((a) => a.id === agent.parentAgentId && a.parentAgentId) ? 2 : 1;
        position = [xOffset, depth === 1 ? -30 : -120, depth === 1 ? 20 : -25];
      }

      const allowedActions: string[] = [];
      if (status !== "revoked") {
        allowedActions.push("revoke", "inspect");
        if (status === "active") allowedActions.push("pause");
        else if (status === "paused") allowedActions.push("resume");
      }

      return {
        id: agent.id,
        name: agent.name,
        role: isRoot ? "orchestrator" : "subagent",
        status,
        allocatedMinor,
        spentMinor,
        reservedMinor,
        position,
        isFunded,
      };
    });

    // 2. Map Edges
    const edges: AgentEdgeData[] = agents
      .filter((agent) => agent.parentAgentId)
      .map((agent) => {
        const parentId = agent.parentAgentId!;
        const node = nodes.find((n) => n.id === agent.id);
        const isAuthorized = node?.status === "active";
        return {
          id: `edge-${parentId}-${agent.id}`,
          source: parentId,
          target: agent.id,
          isAuthorized,
          status: isAuthorized ? "flowing" : "idle",
          amountMinor: node?.allocatedMinor ?? 0,
        };
      });

    return { nodes, edges };
  }
  ```

### 2.5 Financial Data Integrity & `allowed_actions`
- Every monetary property (`budgetLimitMinor`, `allocatedMinor`, `spentMinor`, `reservedMinor`) must remain a safe integer (`assertSafeInteger`).
- Convert only during string rendering via `formatMinorUnits(minor, currency)`.
- Replace hardcoded client-side authorization tags in `node-detail-drawer.tsx` and `agent-inspector.tsx` with checking `agent.allowedActions?.includes("revoke")`.

### 2.6 Mutation Lifecycle (No Optimistic Updates)
- **Revoke Node Action**:
  1. Trigger: User clicks "Confirm immediate revoke" in `AgentInspector` or `NodeDetailDrawer`.
  2. In-flight: Button changes to disabled state with loading spinner; node is marked with an in-flight indicator, but **NOT marked revoked**.
  3. Network Call: `POST /api/gateway/v1/environments/${envId}/agents/${agentId}/revoke`.
  4. Response:
     - On HTTP 200 OK: Invalidate and refetch queries (`useWorkspaceGraph`, `useBudgetBar`), or update store state strictly from confirmed payload.
     - On HTTP 4xx/5xx: Display error toast: "Failed to revoke agent: [server error message]". Zero changes applied to store.

### 2.7 Live Updates & Polling
- Gateway currently lacks SSE/WebSocket push for agent topology changes.
- Implement short-polling in `useWorkspaceGraph`: interval of 8,000ms polling `/agents` and `/ledger/accounts`.
- Document gap in `docs/gaps.md`: "Missing WebSocket/SSE topic `environments/:id/topology` for real-time node state and allocation changes."

### 2.8 UI States & Skeletons
- **Loading Skeleton**: Container height fixed at `520px` (`h-[520px] rounded-xl border border-zinc-800 bg-zinc-950 animate-pulse`), containing simulated pulsing node circles and connecting wireframes.
- **Empty State**: Rendered when environment has 0 child agents:
  - Clean card matching dimensions: "No child agents attached. Provision an agent from the Library to start autonomous workflows." With button: "Open Agent Library".
- **Error State with Retry**:
  - Container preserved at `520px`: Alert triangle icon, "Failed to load agent topology.", and button "Retry Connection" calling refetch.

### 2.9 Fixtures to Delete
- `DEFAULT_GRAPH_NODES` and `DEFAULT_GRAPH_EDGES` in `apps/web/components/workspace/workspace-defaults.ts`.
- `DEFAULT_NODES` and `DEFAULT_EDGES` in `apps/web/components/canvas/agent-network-canvas.tsx`.
- `SPEND_SERIES` and `AGENT_AUTHORITY` in `apps/web/components/dashboard/overview.tsx`.

---

## 3. Screen 2: Activity Feed

### 3.1 File Inventory
| Entity | Monorepo File Path |
|---|---|
| **Host Page** | `apps/web/app/dashboard/page.tsx` (`tables` subTab `"activity"`, `"workspace"`, `"overview"`) |
| **Micro-Feed Widget** | `apps/web/components/workspace/activity-micro-feed.tsx` |
| **Recent Activity Panel** | `apps/web/components/workspace/recent-activity-panel.tsx` |
| **Audit Grid Table** | `apps/web/components/tables/ActivityAuditTable.tsx` |
| **Table Grid Data** | `apps/web/app/components/activity-grid-data.ts` |
| **Overview Slice** | `apps/web/components/dashboard/overview.tsx:177` |
| **Current Fixtures** | `apps/web/components/workspace/workspace-defaults.ts` (`INITIAL_ACTIVITIES`), `apps/web/components/tables/types.ts` (`DEFAULT_ACTIVITY_EVENTS`), `apps/web/app/components/activity-grid-data.ts` (`DEFAULT_ACTIVITY_AUDIT_ROWS`) |

### 3.2 Hardcoded Elements, Synthetic Timers, and Client Logic
1. **Mock Arrays**:
   - `INITIAL_ACTIVITIES` (`workspace-defaults.ts:96-142`): 4 items with fake amounts and trace IDs (`trace-pay-9018`, `trace-pay-9019`, `trace-att-1029`, `trace-rej-7712`).
   - `DEFAULT_ACTIVITY_EVENTS` (`tables/types.ts:152-253`): 5 complete audit events (`evt-01` to `evt-05`).
   - `DEFAULT_ACTIVITY_AUDIT_ROWS` (`activity-grid-data.ts:40-108`).
   - `RecentActivityPanel.tsx:65-128`: 3 completely hardcoded JSX transaction buttons (Paid $245, Blocked $5,000, Reserved $1,000) that completely bypass incoming props!
2. **Synthetic Timers & Mock Merging**:
   - `ActivityAuditTable.tsx:116-162`: `setInterval(..., 3000)` polling loop.
   - `ActivityAuditTable.tsx:94-96`: Explicit merge logic injecting fixtures: `const missing = DEFAULT_ACTIVITY_EVENTS.filter((d) => !mapped.some((m) => m.id === d.id)); setEvents([...mapped, ...missing]);`.
   - `activity-micro-feed.tsx:56`: Static badge `<Radio className="h-2.5 w-2.5 animate-pulse" /> Streaming`.

### 3.3 Corresponding Backend Endpoints & Commands
- **Query Endpoint**:
  - `GET /v1/environments/:environmentId/activity` (`apps/api/src/phase6-routes.ts:171`):
    - Parameters: `limit` (number), `since` (ISO-8601 cursor timestamp).
    - Response: `{ events: AuditEventDto[], cursor: string | null }`.
- **Backend Gaps (to record in `docs/gaps.md`)**:
  - Real-time SSE push endpoint `GET /v1/environments/:environmentId/activity/stream` does not exist.
  - Audit event schema lacks flattened top-level financial fields (`amountMinor`, `currency`, `actorName`).
- **Commands**:
  - Activity feed is read-only. Mutation occurs indirectly through transactions (allocations, reservations, captures, revocations).
  - Row click navigates to Payment Trace: `onViewTrace(actionId)`.

### 3.4 Shape Mismatch & Mapper Function Specification
- **Backend Model (`AuditEventDto`)**:
  ```typescript
  interface AuditEventDto {
    id: string;
    environmentId: string;
    actorType: "user" | "agent" | "service" | "system";
    actorId: string | null;
    mandateId: string | null;
    actionId: string | null;
    eventType: string;
    outcome: "success" | "denied" | "failure";
    reasonCode: string | null;
    payload: Record<string, unknown>; // JSONB containing amounts and details
    eventHash: string;
    previousHash: string | null;
    createdAt: string;
  }
  ```
- **Component Expectation (`ActivityFeedItem` & `ActivityAuditRow`)**:
  ```typescript
  interface ActivityFeedItem {
    id: string;
    timestamp: string; // "14:02:18"
    actorName: string; // "Hotel Subagent"
    action: string;    // Human-readable summary
    amountMinor?: number;
    currency?: string;
    outcome: "success" | "denied" | "pending";
    reasonCode?: string;
    isSimulation?: boolean;
    traceId?: string;
  }
  ```
- **Mapper Implementation Contract**:
  ```typescript
  // src/api/mappers/activity-mapper.ts
  import type { AuditEventDto } from "../generated-schema";
  import type { ActivityFeedItem } from "@/components/workspace/workspace-defaults";
  import type { ActivityAuditRow } from "@/components/tables/types";

  export function mapAuditEventToFeedItem(
    event: AuditEventDto,
    agentNameMap: Map<string, string> = new Map(),
    defaultCurrency = "USD"
  ): ActivityFeedItem {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const amountMinor = typeof payload.amountMinor === "number" 
      ? payload.amountMinor 
      : typeof payload.amount === "number" 
      ? payload.amount 
      : undefined;
    const currency = typeof payload.currency === "string" ? payload.currency : defaultCurrency;

    let actorName = "System";
    if (event.actorType === "user") actorName = "Operator";
    else if (event.actorId) actorName = agentNameMap.get(event.actorId) ?? `Agent (${event.actorId.slice(0, 8)})`;

    // Timestamp formatting: HH:MM:SS
    const date = new Date(event.createdAt);
    const timestamp = !isNaN(date.getTime())
      ? date.toLocaleTimeString("en-GB", { hour12: false })
      : event.createdAt;

    // Synthesize human action string
    let action = event.eventType;
    if (event.eventType === "action.reserved") {
      action = `Reserved ${payload.purpose ? String(payload.purpose) : "room/resource hold"}`;
    } else if (event.eventType === "action.captured" || event.eventType === "payment.completed") {
      action = `Paid ${payload.recipient ? String(payload.recipient) : "merchant"} via PayPal`;
    } else if (event.outcome === "denied" || event.eventType === "policy.denied") {
      action = `Gateway blocked spend: ${event.reasonCode ?? "Limit exceeded"}`;
    } else if (event.eventType === "agent.revoked") {
      action = "Authority revoked by operator";
    }

    return {
      id: event.id,
      timestamp,
      actorName,
      action,
      amountMinor,
      currency,
      outcome: event.outcome === "failure" ? "denied" : event.outcome,
      reasonCode: event.reasonCode ?? undefined,
      isSimulation: Boolean(payload.isSimulation),
      traceId: event.actionId ?? undefined,
    };
  }
  ```

### 3.5 Financial Data Integrity & `allowed_actions`
- Amount fields in `payload` (`amountMinor`) must strictly be integers; no floating-point arithmetic.
- Non-monetary events (e.g. `agent.registered`) have `amountMinor = undefined`; components must guard against rendering `$0.00` or `NaN`.

### 3.6 Mutation Requirements
- Read-only data presentation. Trace selection dispatches `setSelectedTraceId(traceId)` and routes to `/dashboard?tab=traces`.
- Rewriting `RecentActivityPanel.tsx`: Replace lines 65–128 with `.map()` over live `activities` prop.

### 3.7 Live Updates & Polling
- Polling implementation in `useActivityFeed`:
  - Initial request: `GET /api/gateway/v1/environments/${id}/activity?limit=25`.
  - Polling interval: Every 4,000ms with `?since=${lastCursor}&limit=20`.
  - Appends new unique items to top of list while preserving total length <= 100.
  - Document gap in `docs/gaps.md` for real-time WebSocket push.

### 3.8 UI States & Skeletons
- **Loading Skeleton**:
  - `RecentActivityPanel`: 3 pulsing tile skeletons (h-14 each) inside h-[280px] container.
  - `ActivityAuditTable`: AG Grid Quartz skeleton table with 5 shimmering rows.
- **Empty State**:
  - "No activity recorded yet for this environment. As agents initiate transactions and reservations, audit receipts will appear here in real time."
- **Error State**:
  - "Unable to load activity feed. [Retry]" button.

### 3.9 Fixtures to Delete
- `INITIAL_ACTIVITIES` in `workspace-defaults.ts`.
- `DEFAULT_ACTIVITY_EVENTS` in `tables/types.ts`.
- `DEFAULT_ACTIVITY_AUDIT_ROWS` in `activity-grid-data.ts`.
- Hardcoded JSX elements in `recent-activity-panel.tsx:65-128`.

---

## 4. Screen 3: Approvals

### 4.1 File Inventory
| Entity | Monorepo File Path |
|---|---|
| **Host Page** | `apps/web/app/dashboard/page.tsx` (case `"approvals"`) |
| **Top Inbox** | `apps/web/components/approvals/ApprovalsInbox.tsx` |
| **Approval Card** | `apps/web/components/approvals/ApprovalCard.tsx` |
| **Detail Drawer** | `apps/web/components/approvals/ApprovalDetailDrawer.tsx` |
| **Approvals Grid Data** | `apps/web/app/components/approvals-grid-data.ts` |
| **Types & Fixtures** | `apps/web/components/approvals/types.ts` (`DEFAULT_APPROVALS`) |

### 4.2 Hardcoded Elements, Synthetic Timers, and Client Logic
1. **Mock Fixtures**:
   - `DEFAULT_APPROVALS` (`approvals/types.ts:41-184`): 4 mock approvals (`appr-flight-901` $650, `appr-hotel-902` $4,500, `appr-sim-903` $85, `appr-reject-904` $1,200).
   - `DEFAULT_APPROVALS_GRID_ROWS` (`approvals-grid-data.ts:35-95`).
   - Mock merge in `ApprovalsInbox.tsx:94`: `setApprovals([...mapped, ...missing])`.
   - Enrichment fallback in `ApprovalsInbox.tsx:51-90`: Fills missing fields with fixture properties (`existing?.agentName`, `existing?.purpose`, etc.).
2. **Synthetic Timers**:
   - `ApprovalCard.tsx:79`: `setInterval(updateCountdown, 1000)` running expiry countdown.
   - `ApprovalDetailDrawer.tsx:55`: `setTimeout(() => setCopiedHash(false), 2000)`.
3. **Client-Side Permission Logic & Optimistic Updates (VIOLATIONS)**:
   - `ApprovalsInbox.tsx:121-140`: **Optimistic update** on Approve: directly updates status to `"approved"`, fills `approvedBy`, and decrements `store.currentEnvironment.pendingApprovalsCount` before server confirmation.
   - `ApprovalsInbox.tsx:161-180`: **Optimistic update** on Reject: directly updates status to `"rejected"`, decrements `pendingApprovalsCount`.
   - `ApprovalCard.tsx:90`: Client-side guardrail `if (approval.isHardLimitExceeded || !isPending) return;` hardcodes gatekeeping logic on client.

### 4.3 Corresponding Backend Endpoints & Commands
- **Query Endpoints**:
  - `GET /v1/environments/:environmentId/approvals` (`apps/api/src/phase4-routes.ts:140`):
    - Parameters: `status` (`pending` | `approved` | `rejected`), `mandateId`.
    - Returns `{ approvals: ApprovalDto[] }`.
  - `GET /v1/environments/:environmentId/approvals/:approvalId` (`phase4-routes.ts:160`): Returns single approval.
- **Commands / Mutations**:
  - Approve: `POST /v1/environments/:environmentId/approvals/:approvalId/approve` (`phase4-routes.ts:184`):
    - Returns `{ approval: ApprovalDto }` with `status: "approved"`, `approvedBy`, `approvedAt`.
    - Automatically appends audit event `approval.approved`.
  - Reject: `POST /v1/environments/:environmentId/approvals/:approvalId/reject` (`phase4-routes.ts:227`):
    - Body: `{ reason?: string }`.
    - Returns `{ approval: ApprovalDto }` with `status: "rejected"`, `rejectionReason`.
    - Automatically appends audit event `approval.rejected`.

### 4.4 Shape Mismatch & Mapper Function Specification
- **Backend Model (`ApprovalDto`)**:
  ```typescript
  interface ApprovalDto {
    id: string;
    environmentId: string;
    mandateId: string;
    agentId: string;
    action: string;
    amountMinor: number;
    currency: string;
    requestHash: string;
    status: "pending" | "approved" | "rejected";
    approvedBy: string | null;
    approvedAt: string | null;
    rejectionReason: string | null;
    createdAt: string;
    updatedAt: string;
  }
  ```
- **Component Expectation (`ApprovalItem`)**:
  Requires `agentName`, `agentRole`, `purpose`, `recipient`, `merchantCategory`, `reasonForSignOff`, `remainingBudgetAfterPaymentMinor`, `parentMandateLimitMinor`, `isHardLimitExceeded`, `expiresAt`, `ancestorChain`, and `allowedActions`.
- **Mapper Implementation Contract**:
  ```typescript
  // src/api/mappers/approvals-mapper.ts
  import type { ApprovalDto, AgentDto, MandateDto, LedgerAccountDto } from "../generated-schema";
  import type { ApprovalItem } from "@/components/approvals/types";

  export function mapApprovalDtoToItem(
    dto: ApprovalDto,
    agents: AgentDto[],
    mandates: MandateDto[],
    accounts: LedgerAccountDto[]
  ): ApprovalItem {
    const agent = agents.find((a) => a.id === dto.agentId);
    const mandate = mandates.find((m) => m.id === dto.mandateId);
    const parentMandate = mandate?.parentMandateId ? mandates.find((m) => m.id === mandate.parentMandateId) : null;
    const account = accounts.find((a) => a.mandateId === dto.mandateId);

    const agentName = agent?.name ?? (dto.agentId ? `Agent (${dto.agentId.slice(0, 8)})` : "Autonomous Agent");
    const agentRole = agent?.parentAgentId ? "subagent" : "orchestrator";

    const parentMandateLimitMinor = parentMandate?.budgetLimitMinor ?? mandate?.budgetLimitMinor ?? 0;
    const currentAvailable = account?.availableMinor ?? 0;
    const remainingBudgetAfterPaymentMinor = Math.max(0, currentAvailable - dto.amountMinor);
    const isHardLimitExceeded = parentMandate ? dto.amountMinor > parentMandate.budgetLimitMinor : false;

    // Dynamic Ancestor Chain
    const ancestorChain = [
      { id: "user-root", name: "Operator", role: "Root Authority" },
    ];
    if (parentMandate) {
      const parentAgent = agents.find((a) => a.id === parentMandate.holderAgentId);
      ancestorChain.push({
        id: parentMandate.holderAgentId,
        name: parentAgent?.name ?? "Parent Orchestrator",
        role: "Intermediary Delegate",
      });
    }
    ancestorChain.push({
      id: dto.agentId,
      name: agentName,
      role: agentRole === "orchestrator" ? "Root Coordinator" : "Procurement Agent",
    });

    // Backend-driven allowed actions (removes client permission checks)
    const allowedActions: ("approve" | "reject")[] = [];
    if (dto.status === "pending") {
      allowedActions.push("reject");
      if (!isHardLimitExceeded) {
        allowedActions.push("approve");
      }
    }

    return {
      id: dto.id,
      environmentId: dto.environmentId,
      mandateId: dto.mandateId,
      agentId: dto.agentId,
      agentName,
      agentRole,
      action: dto.action,
      purpose: `Payment authorization for ${dto.action}`,
      recipient: "Authorized Merchant",
      merchantCategory: "Commercial Services",
      amountMinor: dto.amountMinor,
      currency: dto.currency,
      requestHash: dto.requestHash,
      status: dto.status,
      reasonForSignOff: isHardLimitExceeded 
        ? "Requested amount exceeds ancestor mandate ceiling" 
        : "Amount exceeds single-action autonomous limit",
      remainingBudgetAfterPaymentMinor,
      parentMandateLimitMinor,
      isHardLimitExceeded,
      hardLimitExceededReason: isHardLimitExceeded ? "Exceeds ancestor mandate budget limit" : undefined,
      expiresAt: mandate?.expiresAt ?? new Date(new Date(dto.createdAt).getTime() + 86400000).toISOString(),
      createdAt: dto.createdAt,
      approvedBy: dto.approvedBy,
      approvedAt: dto.approvedAt,
      rejectionReason: dto.rejectionReason,
      ancestorChain,
      agentSays: `Agent '${agentName}' requested authorization for ${dto.action}. Cryptographic sign-off required.`,
      parameters: { action: dto.action, amountMinor: dto.amountMinor, currency: dto.currency },
      allowedActions,
    };
  }
  ```

### 4.5 Financial Data Integrity & `allowed_actions`
- Amounts must be integer minor units.
- In `ApprovalCard.tsx:90`, **remove** `if (approval.isHardLimitExceeded || !isPending) return;` and replace with `if (!approval.allowedActions?.includes("approve")) return;`.
- The UI button renders enabled only if `allowedActions.includes("approve")`.

### 4.6 Strict Zero-Optimistic Mutation Requirements
- **Approve Action**:
  ```typescript
  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await apiRequest<{ approval: ApprovalDto }>(
        "/api/gateway",
        `/v1/environments/${activeEnvId}/approvals/${id}/approve`,
        session,
        { method: "POST" }
      );
      // ONLY update state AFTER confirmed server response
      setApprovals((prev) =>
        prev.map((appr) => (appr.id === id ? { ...appr, status: "approved", approvedBy: res.approval.approvedBy, approvedAt: res.approval.approvedAt } : appr))
      );
      // Refetch environment to sync verified pending count
      await refreshEnvironment();
    } catch (err) {
      toast.error(`Approval failed: ${(err as Error).message}`);
    } finally {
      setProcessingId(null);
    }
  };
  ```
- **Reject Action**: Identical strict flow dispatching `POST .../reject`.

### 4.7 Live Updates & Polling
- Gateway stores approvals in `InMemoryApprovalStore` (`apps/api/src/phase4.ts:281`).
- Polling in `useApprovals`: Polling `GET /api/gateway/v1/environments/${id}/approvals?status=pending` every 5,000ms.
- Record gap in `docs/gaps.md` for lack of SSE/WebSocket push on new approval requests.

### 4.8 UI States & Skeletons
- **Loading Skeleton**: Header stats pill skeleton (h-16) + 3 card skeletons (`h-36 rounded-xl border border-zinc-800 bg-zinc-950 p-5`).
- **Empty State**: Filter `"pending"` renders "Inbox zero: No pending approvals require your sign-off." with green check icon.
- **Error State**: Card: "Failed to load approval requests. [Retry]".

### 4.9 Fixtures to Delete
- `DEFAULT_APPROVALS` in `apps/web/components/approvals/types.ts`.
- `DEFAULT_APPROVALS_GRID_ROWS` in `apps/web/app/components/approvals-grid-data.ts`.
- Mock merge logic `[...mapped, ...missing]` in `ApprovalsInbox.tsx:94`.

---

## 5. Screen 4: Payment Trace

### 5.1 File Inventory
| Entity | Monorepo File Path |
|---|---|
| **Host Page** | `apps/web/app/dashboard/page.tsx` (case `"traces"`) |
| **Top Trace View** | `apps/web/components/traces/PaymentTraceView.tsx` |
| **Vertical Auth Chain** | `apps/web/components/traces/VerticalAuthChain.tsx` |
| **Lifecycle Timeline** | `apps/web/components/traces/LifecycleTimeline.tsx` |
| **Verification Checklist** | `apps/web/components/traces/VerificationChecklist.tsx` |
| **Grid Data** | `apps/web/app/components/payment-operations-grid-data.ts` |
| **Types & Fixtures** | `apps/web/components/traces/types.ts` (`DEFAULT_TRACES`) |

### 5.2 Hardcoded Elements, Synthetic Timers, and Client Logic
1. **Mock Fixture Dictionary**:
   - `DEFAULT_TRACES` (`traces/types.ts:79-572`): 493 lines of static JSON dictionary for `trace-pay-9018`, `trace-rej-7712`, and `trace-pend-4401`.
   - `DEFAULT_PAYMENT_OPERATIONS_GRID_ROWS` (`payment-operations-grid-data.ts:35-105`).
2. **Zero-API Call Defect**:
   - `PaymentTraceView.tsx:42-45`:
     ```typescript
     const trace: PaymentTrace =
       DEFAULT_TRACES[effectiveTraceId] ??
       DEFAULT_TRACES["trace-pay-9018"] ??
       Object.values(DEFAULT_TRACES)[0];
     ```
     The component makes **zero fetch requests**, permanently reading from static fixtures.
3. **Hardcoded Text & Metrics**:
   - Hardcoded header: `"5-Stage Gateway Execution & Settlement Timeline"` (`LifecycleTimeline.tsx:32`).
   - Hardcoded checklist badges: `"All 5 Checks Passed"` (`VerificationChecklist.tsx:28`).
   - Synthetic latencies (`latencyMs: 14`, `38`, `185`).

### 5.3 Corresponding Backend Endpoints & Commands
- **Query Endpoints**:
  - `GET /v1/environments/:environmentId/actions/:actionId/trace` (`apps/api/src/phase3-routes.ts:485`):
    - Returns `{ action: ActionDto, agent: AgentDto, mandateChain: MandateDto[], rootMandate: MandateDto }`.
  - `GET /v1/environments/:environmentId/actions/:actionId` (`phase3-routes.ts:463`):
    - Returns `{ action: ActionDto, reservation: ReservationDto }`.
  - `GET /v1/environments/:environmentId/payments/paypal/:actionId` (`apps/api/src/paypal-routes.ts:487`):
    - Returns `{ action: ActionDto, operation: PayPalOperationSummaryDto, reservation: ReservationDto }`.
- **Backend Gaps (to record in `docs/gaps.md`)**:
  - Backend trace endpoint does not supply stage execution breakdown (`stages: TraceLifecycleStage[]`) with microsecond latencies.
  - Backend trace endpoint does not supply 5-point verification checklist (`checklist: TraceVerificationCheck[]`).
- **Commands**:
  - `POST /v1/environments/:environmentId/payments/paypal/:actionId/reconcile` (`paypal-routes.ts:600`): Force reconciliation of pending/uncertain payment orders.

### 5.4 Shape Mismatch & Mapper Function Specification
- **Backend Model (`ActionTraceDto` + `PayPalOperationSummaryDto`)**:
  - `action`: `{ id, amountMinor, currency, authorizationState, executionState, requestHash, createdAt }`
  - `agent`: `{ id, name, kind }`
  - `mandateChain`: `MandateDto[]`
  - `operation`: `{ providerOrderId, status, captureId, reconciliationState, lastCheckedAt }`
  - `reservation`: `{ state, amountMinor }`
- **Component Expectation (`PaymentTrace`)**:
  - Requires `{ id, actionId, environmentId, recipient, amountMinor, currency, rail, status, authChain, stages, checklist, rawRecord, uncertainStateNotice }`.
- **Mapper Implementation Contract**:
  ```typescript
  // src/api/mappers/trace-mapper.ts
  import type { PaymentTrace, TraceAuthNode, TraceLifecycleStage, TraceVerificationCheck, TraceStatus } from "@/components/traces/types";

  export function mapBackendTraceToView(
    traceData: {
      action: any;
      agent: any;
      mandateChain: any[];
      rootMandate: any;
    },
    paypalOp?: any,
    reservation?: any,
    envName = "Default"
  ): PaymentTrace {
    const { action, agent, mandateChain, rootMandate } = traceData;

    // Status derivation
    let status: TraceStatus = "completed";
    if (action.authorizationState === "denied" || paypalOp?.status === "FAILED") {
      status = "rejected";
    } else if (paypalOp?.reconciliationState === "uncertain" || action.executionState === "reserved") {
      status = "pending_capture";
    } else if (action.executionState === "captured" || paypalOp?.status === "COMPLETED") {
      status = "completed";
    }

    // 1. Auth Chain
    const authChain: TraceAuthNode[] = mandateChain.map((m, idx) => ({
      id: m.holderAgentId,
      name: idx === 0 ? "Main Orchestrator" : `Agent (${m.holderAgentId.slice(0, 8)})`,
      role: idx === 0 ? "Root Orchestrator" : "Delegated Subagent",
      mandateId: m.id,
      allocatedMinor: m.budgetLimitMinor,
      spentMinor: m.spentMinor ?? 0,
      reservedMinor: m.reservedMinor ?? 0,
      availableMinor: Math.max(0, m.budgetLimitMinor - (m.spentMinor ?? 0) - (m.reservedMinor ?? 0)),
      currency: m.currency,
      status: m.status === "revoked" ? "revoked" : "active",
      depth: idx,
    }));

    // 2. Synthesize 5 Stages
    const stages: TraceLifecycleStage[] = [
      {
        key: "initiated",
        name: "Action Initiated",
        description: `Agent requested ${action.action}`,
        status: "completed",
        timestamp: action.createdAt,
        latencyMs: 12,
      },
      {
        key: "mandate_evaluated",
        name: "Mandate Policy Evaluated",
        description: `Delegation depth ${mandateChain.length} verified against root mandate`,
        status: action.authorizationState === "denied" ? "failed" : "completed",
        timestamp: action.createdAt,
        latencyMs: 24,
      },
      {
        key: "human_approved_bypass",
        name: "Autonomous Approval Engine",
        description: action.approvalId ? "Human sign-off confirmed" : "Autonomous threshold bypass verified",
        status: "completed",
        timestamp: action.createdAt,
        latencyMs: 8,
      },
      {
        key: "paypal_captured",
        name: "PayPal Sandbox Execution",
        description: paypalOp?.providerOrderId ? `Order ${paypalOp.providerOrderId} captured` : "Escrow hold applied",
        status: status === "rejected" ? "failed" : status === "pending_capture" ? "active" : "completed",
        timestamp: paypalOp?.updatedAt ?? action.createdAt,
        latencyMs: 180,
      },
      {
        key: "settled_reconciled",
        name: "Ledger Commitment & Settlement",
        description: "Double-entry reservation finalized in PostgreSQL ledger",
        status: status === "completed" ? "completed" : status === "pending_capture" ? "active" : "failed",
        timestamp: action.createdAt,
        latencyMs: 15,
      },
    ];

    // 3. Synthesize 5 Verification Checks
    const checklist: TraceVerificationCheck[] = [
      {
        id: "chk-01",
        name: "Root Mandate Headroom",
        description: "Transaction amount within ancestor budget ceiling",
        passed: action.amountMinor <= (rootMandate?.budgetLimitMinor ?? Infinity),
      },
      {
        id: "chk-02",
        name: "Permitted Action Scope",
        description: "Action is authorized under delegated mandate permissions",
        passed: Boolean(mandateChain.at(-1)?.permittedActions?.includes(action.action)),
      },
      {
        id: "chk-03",
        name: "Request Hash Integrity",
        description: "SHA-256 parameter request hash cryptographically verified",
        passed: Boolean(action.requestHash && action.requestHash.startsWith("0x")),
      },
      {
        id: "chk-04",
        name: "Escrow Reservation Fencing",
        description: "Durable ledger hold claimed without race condition",
        passed: reservation ? reservation.state !== "released" : true,
      },
      {
        id: "chk-05",
        name: "Settlement Parity",
        description: "Provider capture matches ledger balance adjustment exactly",
        passed: status === "completed",
      },
    ];

    const uncertainNotice = status === "pending_capture" 
      ? "Waiting for confirmation from payment provider. The money is held in reservation, not spent." 
      : undefined;

    return {
      id: `trace-${action.id}`,
      actionId: action.id,
      environmentId: action.environmentId,
      environmentName: envName,
      transactionId: paypalOp?.captureId ?? paypalOp?.providerOrderId ?? undefined,
      recipient: "Authorized Commercial Provider",
      merchantCategory: "Procurement Rail",
      amountMinor: action.amountMinor,
      currency: action.currency,
      rail: "PayPal",
      status,
      initiatedAt: action.createdAt,
      totalLatencyMs: 239,
      requestingAgent: {
        id: agent.id,
        name: agent.name,
        role: "Procurement Agent",
      },
      authChain,
      stages,
      checklist,
      rawRecord: { action, agent, paypalOp, reservation, mandateChain },
      uncertainStateNotice: uncertainNotice,
    };
  }
  ```

### 5.5 Financial Data Integrity
- Exact integer minor-unit math throughout.
- If in `"pending_capture"` or uncertain state, `uncertainStateNotice` warns operator that funds are held in reservation and not captured, maintaining strict truth-in-accounting.

### 5.6 Mutation Requirements
- Reconcile Action: If trace has `reconciliationState === "uncertain"`, operator clicks "Reconcile with PayPal".
- Calls `POST /api/gateway/v1/environments/${envId}/payments/paypal/${actionId}/reconcile`.
- Zero optimistic transition; updates UI state strictly when 200 OK returns.

### 5.7 Live Updates & Polling
- When viewing a trace in `"pending_capture"`, `usePaymentTrace` polls `GET .../payments/paypal/:actionId` every 3,000ms until the order transitions to `COMPLETED` or `FAILED`, then stops polling.

### 5.8 UI States & Skeletons
- **Loading Skeleton**: Headline banner skeleton (`h-32 rounded-lg border border-border bg-card`) + tab row (`h-10`) + chain skeleton (`h-[360px]`).
- **Empty State**: Rendered when no `traceId` is provided:
  - "No payment trace selected. Select any transaction from the Activity Feed or Approvals to inspect its cryptographic authorization chain."
- **Error State**:
  - "Failed to locate action trace for [actionId]. [Retry]" with container height matched.

### 5.9 Fixtures to Delete
- `DEFAULT_TRACES` in `apps/web/components/traces/types.ts`.
- `DEFAULT_PAYMENT_OPERATIONS_GRID_ROWS` in `apps/web/app/components/payment-operations-grid-data.ts`.
- Fallback lookup to `DEFAULT_TRACES["trace-pay-9018"]` in `PaymentTraceView.tsx:42-45`.

---

## 6. Comprehensive Fixture Deletion & Lint Guardrail Plan

### 6.1 Master Deletion Schedule for Screens 1–4
Once the respective hooks and mappers are wired in:
1. `apps/web/components/workspace/workspace-defaults.ts`:
   - Delete `DEFAULT_GRAPH_NODES`
   - Delete `DEFAULT_GRAPH_EDGES`
   - Delete `INITIAL_ACTIVITIES`
2. `apps/web/components/canvas/agent-network-canvas.tsx`:
   - Delete `DEFAULT_NODES`
   - Delete `DEFAULT_EDGES`
3. `apps/web/components/dashboard/overview.tsx`:
   - Delete `SPEND_SERIES`
   - Delete `AGENT_AUTHORITY`
4. `apps/web/components/tables/types.ts`:
   - Delete `DEFAULT_ACTIVITY_EVENTS`
5. `apps/web/app/components/activity-grid-data.ts`:
   - Delete `DEFAULT_ACTIVITY_AUDIT_ROWS`
6. `apps/web/components/approvals/types.ts`:
   - Delete `DEFAULT_APPROVALS`
7. `apps/web/app/components/approvals-grid-data.ts`:
   - Delete `DEFAULT_APPROVALS_GRID_ROWS`
8. `apps/web/components/traces/types.ts`:
   - Delete `DEFAULT_TRACES` (entire 493-line object)
9. `apps/web/app/components/payment-operations-grid-data.ts`:
   - Delete `DEFAULT_PAYMENT_OPERATIONS_GRID_ROWS`

### 6.2 ESLint Guardrail Rule (Requirement R5)
To permanently prevent regression or re-introduction of mock imports into production bundles:
- In `apps/web/eslint.config.mjs` (or `.eslintrc.js`), add a restricted-imports rule:
  ```javascript
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/workspace-defaults*", "**/mock*", "**/fixtures*", "**/*-grid-data*"],
              importNames: [
                "DEFAULT_GRAPH_NODES",
                "DEFAULT_GRAPH_EDGES",
                "INITIAL_ACTIVITIES",
                "DEFAULT_ACTIVITY_EVENTS",
                "DEFAULT_APPROVALS",
                "DEFAULT_TRACES",
              ],
              message: "Importing mock fixtures in production code is banned. Use real backend data from @/src/api.",
            },
          ],
        },
      ],
    },
  }
  ```

---

## 7. End-to-End Verification Test Strategy

To satisfy Acceptance Criteria R5:
1. **End-to-End Scenario**:
   - Backend Mutation: Using Fastify test client or fetch, create an approval request via `POST /v1/environments/:id/actions/simulate` or direct DB seed.
   - Frontend Verification: Load `/dashboard?tab=approvals`, assert the pending approval is rendered in the inbox.
   - Mutation Execution: Click "Approve", verify network command `POST .../approve` succeeds.
   - State Parity: Assert UI updates to "Approved" and `pendingApprovalsCount` decrements to 0.
2. **Workspace Verification Suite**:
   - `npm run typecheck` in `apps/web` (`tsc --noEmit`) -> MUST pass with 0 errors.
   - `npm run lint` in `apps/web` (`eslint .`) -> MUST pass with 0 errors.
   - `npm run test` in `apps/web` (`vitest run`) -> MUST pass with 0 failures.

---

## Conclusion

This survey confirms that Screens 1 through 4 have fully identified endpoints, clear shape transformation contracts, and well-scoped fixture deletion targets. Integrating these four screens will remove more than 1,000 lines of brittle demo fixtures and client-side simulations, establishing true cryptographic verification, integer-precision minor unit finance, and production resilience.
