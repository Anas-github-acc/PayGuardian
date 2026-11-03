# Milestone 2 Handoff Report: Screens 1 & 2 Live Backend Migration

**Agent**: worker_m2 (implementer, qa, specialist)  
**Recipient**: Parent Agent (`b1fe192e-e662-4e1e-9dfb-84ff1309121d`)  
**Date**: 2026-11-01T22:30:00Z  
**Status**: Complete

---

## 1. Observation

### Codebase and Backend Discoveries
1. **Fastify Gateway Response Envelopes**:
   - `apps/api/src/phase1-routes.ts`, `phase2-routes.ts`, `phase3-routes.ts`, and `phase4-routes.ts` wrap list endpoints in object envelopes (`{ environments: [...] }`, `{ agents: [...] }`, `{ mandates: [...] }`, `{ accounts: [...] }`, `{ approvals: [...] }`, `{ events: [...] }`).
   - `apps/web/lib/api/client.ts` was enhanced with `unwrapArray` helper to handle both Fastify Gateway envelopes and raw arrays without regressions.

2. **Single Environment Fetch**:
   - Fastify Gateway in `phase1-routes.ts:83` implements `GET /v1/environments` (list) but lacks `GET /v1/environments/:id`.
   - `apiClient.environments.get(id)` catches 404 and transparently resolves from `this.environments.list()`.

3. **Proxy Route 204/205/304 Status Error**:
   - In Next.js App Router route handlers (`apps/web/app/api/proxy/[...path]/route.ts`), calling `new NextResponse(upstreamResponse.arrayBuffer(), { status: 204 })` threw `TypeError: Response constructor: Invalid response status code 204`.
   - Fixed by explicitly passing `null` body for status codes `101`, `204`, `205`, and `304`. Preserved `Set-Cookie` headers via `upstreamResponse.headers.getSetCookie()`.

4. **Activity Feed Payload Extraction**:
   - In `apps/web/lib/api/mappers/activity-feed.ts:39-44`, raw audit events store human-readable descriptions in `payload.purpose` (e.g. `"Paid IndiGo Flight 6E-204 via PayPal"`) or `payload.action`.
   - Mapping logic now extracts `payload.purpose` or `payload.action` as `action`, falling back to `event.eventType.replace(/_/g, " ")`.

5. **Relational Ledger Account Matching in Workspace Graph**:
   - `apps/web/lib/api/mappers/workspace-graph.ts` links `agents`, `mandates` (by `m.holderAgentId`), and `ledgerAccounts` (by `acc.mandateId`).
   - Correctly resolves `allocatedMinor` from mandate (`mandate.budgetLimitMinor`), `spentMinor` from `account.capturedMinor`, and `reservedMinor` from `account.reservedMinor`.
   - Assigns `status: "unfunded"` and `isFunded: false` when `(mandate?.budgetLimitMinor ?? 0) <= 0`.

6. **Deleted Mock Fixtures**:
   - Removed `DEFAULT_GRAPH_NODES`, `DEFAULT_GRAPH_EDGES`, `INITIAL_ACTIVITIES` from `apps/web/components/workspace/workspace-defaults.ts`.
   - Removed `SPEND_SERIES`, `AGENT_AUTHORITY`, `MAX_BAR` from `apps/web/components/dashboard/overview.tsx`.
   - Removed `DEFAULT_NODES`, `DEFAULT_EDGES` from `apps/web/components/canvas/agent-network-canvas.tsx`.
   - Removed `DEFAULT_ACTIVITY_EVENTS` from `apps/web/components/tables/types.ts` and `ActivityAuditTable.tsx`.
   - Deleted static hardcoded transaction cards (lines 65-128) in `apps/web/components/workspace/recent-activity-panel.tsx`.
   - Removed fake synthetic intervals (2.8s ticker and 7.2s counter) from `apps/web/components/workspace/orchestrator-pipeline.tsx`.

7. **Contract Gaps Documented**:
   - Added `GAP-SPEND-01: 7-Day Spend Velocity Analytics Endpoint` to `docs/gaps.md`. In `overview.tsx`, `SpendChart` renders an explicit placeholder card stating that 7-day spend velocity analytics endpoint is not implemented in Fastify Gateway.

---

## 2. Logic Chain

1. **Screen 2 (Activity Feed) Migration**:
   - `useActivityFeed` polls `GET /v1/environments/:id/activity?since=...` at 3000ms intervals using an incremental ISO timestamp cursor.
   - Activities deduplicate by ID and maintain newest-first chronological order.
   - Replaced static JSX cards in `recent-activity-panel.tsx` with live `useActivityFeed` stream, with layout-matched loading skeleton, empty state, and error state with retry.
   - Replaced `INITIAL_ACTIVITIES` in `activity-micro-feed.tsx` with live `useActivityFeed` hook.
   - Cleaned `ActivityAuditTable.tsx`: removed forced mock merging and direct localhost fetch, wired to `useActivityFeed`.
   - Currency display strictly formats integer minor units via `formatMinorUnits` without client-side floating-point math.

2. **Screen 1 (Workspace Graph & Budget Bar) Migration**:
   - `useWorkspaceGraph` calls `GET /v1/environments/:id/agents`, `GET /v1/environments/:id/mandates`, and `GET /v1/environments/:id/ledger/accounts`.
   - `mapWorkspaceGraph` maps relational data into `AgentNodeData` and edge topology, correctly determining funded (solid) and unfunded (dashed) agents based on live mandate budget limits.
   - `useBudgetStrip` calculates available headroom via `calculateAvailableMinor` on live account numbers.
   - `workspace-layout.tsx` coordinates `useWorkspaceGraph`, syncing live graph topology to `workspaceStore` when loaded.
   - Agent revocation is wired to `apiClient.agents.revoke(environmentId, agentId)`. It updates UI ONLY after confirmed HTTP 200/201 server response. Strictly ZERO optimistic updates are performed for authority or budget.
   - `delegation-topology.tsx` handles `isLoading` (animated pulsing skeleton container), `error` (warning banner with retry button), and empty state ("No child agents attached" with CTA to open Agent Library), all matching the 520px container height without layout shift.
   - `budget-strip.tsx` handles loading skeleton, error state with retry, and empty state matching container dimensions.
   - `overview.tsx` consumes live `useWorkspaceGraph` for authority bars and live `useActivityFeed` for recent actions table and activity card.

3. **Verification and Clean Up**:
   - `route.test.ts` includes a unit test for 204 No Content response via DELETE.
   - `workspace.test.tsx` test cases were updated to test live mappers with strictly typed contract objects matching `AgentDto`, `MandateDto`, and `AuditEventDto`.
   - Cleaned up unused imports and variables across touched files.

---

## 3. Caveats

- **Historical Spend Velocity (GAP-SPEND-01)**: The Fastify Gateway does not currently provide a 7-day time-series aggregation endpoint for historical spend velocity. Per requirement R2, this is explicitly documented in `docs/gaps.md` and `SpendChart` renders a dedicated gap notice container rather than fabricating synthetic data.
- **WebSocket Streaming (GAP-EVT-01)**: Live activity feed currently uses 3000ms timestamp cursor short-polling because WebSocket/SSE streaming is not implemented in the backend gateway.

---

## 4. Conclusion

Milestone 2 is complete. Screen 1 (Workspace Graph & Budget Bar) and Screen 2 (Activity Feed) are fully migrated to live backend endpoints. All mock fixtures (`DEFAULT_GRAPH_NODES`, `DEFAULT_GRAPH_EDGES`, `SPEND_SERIES`, `AGENT_AUTHORITY`, `INITIAL_ACTIVITIES`, `DEFAULT_ACTIVITY_EVENTS`) have been removed from default exports and components. Agent revocation mutation is strictly synchronous with confirmed server response. Zero lines of code were modified in Python or auth backend services.

---

## 5. Verification Method

### Automated Commands
1. **Web TypeScript Typecheck**:
   ```bash
   pnpm --filter @payguardian/web run typecheck
   ```
   *Result*: 0 errors (`tsc --noEmit` exited with code 0).

2. **Web Vitest Unit Tests**:
   ```bash
   pnpm --filter @payguardian/web run test
   ```
   *Result*: 9 test files passed, 37 tests passed, 0 failed.

3. **Workspace Full Vitest Suite**:
   ```bash
   pnpm test
   ```
   *Result*: All 11 workspace packages pass (48 API tests, 7 worker tests, 37 web tests).

4. **Protected Services Integrity Diff**:
   ```bash
   git diff -- apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth
   ```
   *Result*: 0 lines modified (completely empty output).

### Key Files Modified
- `apps/web/app/api/proxy/[...path]/route.ts` & `__tests__/route.test.ts`
- `apps/web/lib/api/client.ts`
- `apps/web/lib/api/hooks/use-activity-feed.ts`
- `apps/web/lib/api/hooks/use-workspace-graph.ts`
- `apps/web/lib/api/hooks/use-budget-strip.ts`
- `apps/web/lib/api/mappers/activity-feed.ts`
- `apps/web/lib/api/mappers/workspace-graph.ts`
- `apps/web/components/workspace/workspace-layout.tsx`
- `apps/web/components/workspace/delegation-topology.tsx`
- `apps/web/components/workspace/budget-strip.tsx`
- `apps/web/components/workspace/orchestrator-pipeline.tsx`
- `apps/web/components/workspace/recent-activity-panel.tsx`
- `apps/web/components/workspace/activity-micro-feed.tsx`
- `apps/web/components/workspace/agent-inspector.tsx`
- `apps/web/components/workspace/workspace-defaults.ts`
- `apps/web/components/workspace/index.ts`
- `apps/web/components/workspace/workspace.test.tsx`
- `apps/web/components/canvas/agent-network-canvas.tsx`
- `apps/web/components/canvas/agent-network-list-view.tsx`
- `apps/web/components/canvas/node-detail-drawer.tsx`
- `apps/web/components/dashboard/overview.tsx`
- `apps/web/components/tables/ActivityAuditTable.tsx`
- `apps/web/components/tables/types.ts`
- `apps/web/app/lib/workspace-store.ts`
- `docs/gaps.md`
