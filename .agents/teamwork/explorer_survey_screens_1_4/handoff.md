# Handoff Report: Screens 1–4 Backend Integration Survey

**Agent**: `explorer_survey_screens_1_4`  
**Date**: 2026-11-01T21:42:00Z  
**Type**: Hard Handoff (Investigation & Survey Complete)  
**Deliverable Path**: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_survey_screens_1_4/report.md`  

---

## 1. Observation

Direct code inspections of the PayGuardian monorepo revealed the following exact lines, files, and behaviors across Screens 1 through 4:

1. **Screen 1 (Workspace Graph & Budget Bar)**:
   - `apps/web/components/workspace/workspace-defaults.ts:144-235`: `DEFAULT_GRAPH_NODES` defines 5 static nodes (`orchestrator-root`, `agent-travel`, `agent-hotel`, `agent-flights-unfunded`, `agent-booking-gw`) and 4 static edges (`DEFAULT_GRAPH_EDGES`).
   - `apps/web/components/canvas/agent-network-canvas.tsx:40-131`: Exact duplicated `DEFAULT_NODES` and `DEFAULT_EDGES` embedded directly inside the Three.js canvas file.
   - `apps/web/components/workspace/workspace-layout.tsx:37-40`: Automatically calls `workspaceStore.setGraphData(DEFAULT_GRAPH_NODES, DEFAULT_GRAPH_EDGES)` if the store graph is empty.
   - `apps/web/components/workspace/workspace-layout.tsx:55-71`: `handleRevokeNode` executes purely in client React state (`updatedNodes = store.graphNodes.map(...)`, `status: "revoked"`, `isFunded: false`) with zero network API dispatch.
   - `apps/web/components/workspace/orchestrator-pipeline.tsx:615-621`: `setInterval(..., 2800)` cycles 10 hardcoded pipeline ticker messages.
   - `apps/web/components/workspace/orchestrator-pipeline.tsx:658-663`: `setInterval(..., 7200)` increments an arbitrary workflow counter initialized to 1247.
   - `apps/web/components/dashboard/overview.tsx:26-44`: `SPEND_SERIES` (7 days of daily spend) and `AGENT_AUTHORITY` (5 static agent budget bars) are hardcoded fixtures.
   - Backend routes: `GET /v1/environments/:id/agents` exists in `apps/api/src/phase1-routes.ts:93`, `GET /v1/environments/:id/mandates` exists in `phase6-routes.ts:154`, and `GET /v1/environments/:id/ledger/accounts` exists in `phase3-routes.ts:145`. However, composite graph topology route `GET /v1/environments/:id/graph` does NOT exist.

2. **Screen 2 (Activity Feed)**:
   - `apps/web/components/workspace/workspace-defaults.ts:96-142`: `INITIAL_ACTIVITIES` contains 4 static items with hardcoded trace IDs (`trace-pay-9018`, `trace-pay-9019`, `trace-att-1029`, `trace-rej-7712`).
   - `apps/web/components/workspace/recent-activity-panel.tsx:65-128`: The 3 transaction items ("Paid $245 Flight", "Blocked $5,000 Hotel", "Reserved $1,000 Hotel") are completely hardcoded JSX elements, ignoring incoming props entirely.
   - `apps/web/components/tables/ActivityAuditTable.tsx:94-96`: Explicit merge logic forces fixture items into live responses:
     `const missing = DEFAULT_ACTIVITY_EVENTS.filter((d) => !mapped.some((m) => m.id === d.id)); setEvents([...mapped, ...missing]);`.
   - `apps/web/components/tables/ActivityAuditTable.tsx:116-162`: Polls `GET /v1/environments/:environmentId/activity?limit=20&since=...` every 3,000ms.
   - Backend route: `GET /v1/environments/:environmentId/activity` exists in `apps/api/src/phase6-routes.ts:171` returning `{ events: AuditEventDto[], cursor }`. Audit events store amounts, currencies, and descriptions nested inside JSONB `payload`.

3. **Screen 3 (Approvals)**:
   - `apps/web/components/approvals/types.ts:41-184`: `DEFAULT_APPROVALS` defines 4 static approval fixtures.
   - `apps/web/components/approvals/ApprovalsInbox.tsx:92-94`: Forcibly appends missing fixtures: `setApprovals([...mapped, ...missing])`.
   - `apps/web/components/approvals/ApprovalsInbox.tsx:121-140` and `161-180`: **Optimistic update violations**: approving or rejecting modifies local state immediately (`status: "approved"`, `status: "rejected"`) and decrements `store.currentEnvironment.pendingApprovalsCount` before server confirmation.
   - `apps/web/components/approvals/ApprovalCard.tsx:90`: Client-side guardrail check `if (approval.isHardLimitExceeded || !isPending) return;`.
   - Backend routes: `GET /v1/environments/:id/approvals` (`phase4-routes.ts:140`), `POST .../approve` (`phase4-routes.ts:184`), and `POST .../reject` (`phase4-routes.ts:227`) exist. Backend `ApprovalDto` lacks rich UI fields (`agentName`, `purpose`, `recipient`, `expiresAt`, `ancestorChain`).

4. **Screen 4 (Payment Trace)**:
   - `apps/web/components/traces/types.ts:79-572`: `DEFAULT_TRACES` contains 493 lines of static mock traces.
   - `apps/web/components/traces/PaymentTraceView.tsx:42-45`:
     ```typescript
     const trace: PaymentTrace =
       DEFAULT_TRACES[effectiveTraceId] ??
       DEFAULT_TRACES["trace-pay-9018"] ??
       Object.values(DEFAULT_TRACES)[0];
     ```
     The component performs **zero network fetch calls**, reading 100% from `DEFAULT_TRACES`.
   - Backend routes: `GET /v1/environments/:id/actions/:actionId/trace` (`phase3-routes.ts:485`) and `GET .../payments/paypal/:actionId` (`paypal-routes.ts:487`) exist. They return `{ action, agent, mandateChain, rootMandate }` and PayPal `{ operation, reservation }`, but do NOT provide 5 discrete lifecycle stages or 5-point verification checks.

5. **Tool Execution Verification**:
   - `pnpm --filter @payguardian/web typecheck` exited with code 0.
   - `pnpm --filter @payguardian/web test` ran 6 test files (20 tests) and exited with code 0 in 325ms.

---

## 2. Logic Chain

1. **Step 1 (Real Endpoints vs Mock Fallback)**:
   Observations 1, 2, 3, and 4 establish that the Fastify Gateway API has functioning relational endpoints for environments, agents, mandates, ledger accounts, approvals, activity logs, and action traces. However, the frontend components were constructed with defensive fallbacks and explicit mock merges (`[...mapped, ...missing]`) so that the application could be demoed even when database tables were empty.
2. **Step 2 (Shape Discrepancies & Mappers)**:
   Backend DTOs (`AgentDto`, `MandateDto`, `AuditEventDto`, `ApprovalDto`, `ActionTraceDto`) are relational records storing IDs and database keys. Frontend components expect rich, flattened view models (`AgentNodeData`, `ActivityFeedItem`, `ApprovalItem`, `PaymentTrace`). Because modifying existing component markup and styles is forbidden by Requirement R1, pure mapper functions in `src/api/mappers/` must perform client-side joins (or synthetic derivations) to fulfill component props exactly.
3. **Step 3 (Financial Integrity & Optimistic Update Removal)**:
   Observation 3 shows that `ApprovalsInbox.tsx` optimistically decrements pending counts and marks approvals approved before server confirmation. Under financial and cryptographic requirements (R3), all state updates for money and approvals must be strictly confirmed by server responses. Furthermore, client-side permission checks (e.g. `isHardLimitExceeded`) must be superseded by `allowed_actions` returned or mapped from verified backend records.
4. **Step 4 (Live Updates & Polling Fallback)**:
   Observation 2 and Monorepo audit confirm that SSE/WebSockets are not implemented in the backend. Therefore, short polling (3s–8s) using `since` timestamp cursors is the necessary and compliant mechanism, with the SSE gap documented in `docs/gaps.md`.
5. **Step 5 (Fixture Deletion Scope)**:
   Once the hooks (`useWorkspaceGraph`, `useActivityFeed`, `useApprovals`, `usePaymentTrace`) and mappers are connected, all 8 fixture files cataloged in Section 1 can be cleanly deleted, and ESLint guardrail rules added to prevent re-introduction.

---

## 3. Caveats

1. **Composite Graph Endpoint Gap**: The Fastify Gateway API does not currently have `GET /v1/environments/:id/graph`. The frontend must fetch `agents`, `mandates`, and `ledger/accounts` concurrently and calculate 3D node positions client-side using the hierarchical layout algorithm specified in `report.md`.
2. **Single Environment Endpoint Gap**: In `apps/api/src/phase1-routes.ts:83`, only `GET /v1/environments` (list) exists; `GET /v1/environments/:id` is not declared. The client hook must fetch the list and find the matching environment ID.
3. **In-Memory Volatility**: Fastify stores Approvals (`phase4.ts:281`) in volatile in-memory maps (`InMemoryApprovalStore`). Restarting the Fastify API clears newly created approvals. Tests and mock-replacement must take this into account.
4. **Screens 5–8**: Screens 5 through 8 (Library, Sessions, Memory, etc.) are outside the scope of this survey and will be surveyed separately.

---

## 4. Conclusion

Screens 1 through 4 are fully mapped and ready for phased backend integration:
- **Screen 1**: Join `agents`, `mandates`, and `ledger/accounts` via `mapWorkspaceGraph`; replace client revocation with `POST .../agents/:agentId/revoke`; delete `DEFAULT_GRAPH_NODES` and `DEFAULT_GRAPH_EDGES`.
- **Screen 2**: Wire `useActivityFeed` to `GET /v1/environments/:id/activity`; parse nested amounts from `payload`; rewrite `RecentActivityPanel.tsx:65-128` to map over real events; delete `INITIAL_ACTIVITIES` and `DEFAULT_ACTIVITY_EVENTS`.
- **Screen 3**: Wire `useApprovals` to `GET /v1/environments/:id/approvals`; remove optimistic state changes in `handleApprove` and `handleReject`; replace client hard-limit checks with `allowedActions`; delete `DEFAULT_APPROVALS`.
- **Screen 4**: Connect `PaymentTraceView` to `GET .../actions/:actionId/trace` and `GET .../payments/paypal/:actionId`; synthesize 5 stages and 5 verification checks via `mapBackendTraceToView`; delete `DEFAULT_TRACES` (493 lines).

---

## 5. Verification Method

To independently verify these findings and check the current workspace state:

1. **Verify Existing Tests and Types**:
   ```bash
   pnpm --filter @payguardian/web typecheck
   pnpm --filter @payguardian/web test
   ```
2. **Inspect Fixtures and Hardcoded Merges**:
   - Inspect `apps/web/components/workspace/workspace-defaults.ts` lines 96–235 to verify `DEFAULT_GRAPH_NODES` and `INITIAL_ACTIVITIES`.
   - Inspect `apps/web/components/approvals/ApprovalsInbox.tsx` lines 92–94 and 121–140 to verify mock merging and optimistic update code.
   - Inspect `apps/web/components/traces/PaymentTraceView.tsx` lines 41–45 to verify the zero-API fixture lookup.
   - Inspect `apps/web/components/workspace/recent-activity-panel.tsx` lines 65–128 to verify hardcoded JSX transaction cards.
3. **Inspect OpenAPI Spec**:
   - Start Gateway: `pnpm dev:api`
   - Curl OpenAPI schema: `curl http://localhost:3001/docs/json | grep -o '"/v1/[^"]*"'`
4. **Invalidation Conditions**:
   - If `GET /v1/environments/:id/graph` is added to `phase1-routes.ts`, the frontend client-side node layout join can be bypassed.
   - If SSE or WebSocket transport is added to Fastify, short-polling fallback logic becomes obsolete.
