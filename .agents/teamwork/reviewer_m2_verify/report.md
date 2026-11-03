# Milestone 2 Independent Review & Adversarial Quality Audit Report

**Reviewer**: `reviewer_m2_verify` (Roles: Reviewer, Critic)  
**Date**: 2026-11-01T22:36:00Z  
**Target Milestone**: Milestone 2 (Screen 1: Workspace Graph & Budget Bar; Screen 2: Activity Feed)  
**Verdict**: **APPROVE**

---

## 1. Executive Summary

Milestone 2 implementation was independently audited for functional correctness, structural layout preservation, financial integrity, security invariants, and adversarial robustness.

All requirements for Milestone 2 have been satisfied:
1. **Screen 1 (Workspace Graph & Budget Bar)**:
   - `useWorkspaceGraph` and `useBudgetStrip` hooks query real Fastify Gateway endpoints (`/agents`, `/mandates`, `/ledger/accounts`, `/environments`).
   - Agent revocation mutation strictly dispatches `apiClient.agents.revoke` and refreshes UI state **only** after confirmed HTTP response. Zero optimistic updates exist for authority or budget.
   - Deletion of fixtures verified: `DEFAULT_GRAPH_NODES`, `DEFAULT_GRAPH_EDGES`, `SPEND_SERIES`, `AGENT_AUTHORITY` are completely removed.
   - Resilient UI states: layout-matched loading skeleton, error state with retry, and empty state ("No child agents attached" with navigation CTA) are verified without layout shift.
   - Missing spend velocity backend endpoint is documented in `docs/gaps.md` (`GAP-SPEND-01`) and rendered as an explicit unavailable notice in `SpendChart`.

2. **Screen 2 (Activity Feed)**:
   - `useActivityFeed` polls `GET /v1/environments/:id/activity?since=...` at 3000ms short-polling interval using the latest event ISO timestamp as cursor.
   - Hardcoded static JSX cards in `recent-activity-panel.tsx` and fixtures (`INITIAL_ACTIVITIES`, `DEFAULT_ACTIVITY_EVENTS`) are completely deleted.
   - Integer minor units are strictly preserved (`amountMinor` from audit payload) and formatted only for display via `formatMinorUnits`.

3. **Proxy Route Handler Status 204/205/304 Fix**:
   - `apps/web/app/api/proxy/[...path]/route.ts` passes `null` body for status codes `101`, `204`, `205`, `304`, eliminating Next.js App Router `TypeError: Response constructor: Invalid response status code 204`.
   - `Set-Cookie` headers are preserved via `headers.getSetCookie()`.

4. **Python Backend Immutability**:
   - `git diff -- apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth` was executed and returned 0 lines changed.

5. **Test & Validation Suite**:
   - `pnpm --filter @payguardian/web run typecheck`: Exited with code 0.
   - `pnpm --filter @payguardian/web run test`: 9 test files passed, 37 tests passed, 0 failed.
   - Monorepo `pnpm test`: 11 packages passed (48 API tests, 7 worker tests, 37 web tests).

6. **Integrity Check**:
   - No hardcoded test results or fake implementations found. Real contracts and real network requests are wired throughout.

---

## 2. Detailed Findings by Review Area

### 2.1 Screen 1: Workspace Graph & Budget Bar
- **Hooks Checked**:
  - `apps/web/lib/api/hooks/use-workspace-graph.ts`: Calls `apiClient.agents.list`, `mandates.list`, `ledger.listAccounts`. Catches partial failures gracefully.
  - `apps/web/lib/api/hooks/use-budget-strip.ts`: Queries environment, ledger accounts, mandates, pending approvals, and agents.
- **Revocation Mutation**:
  - `revokeAgent` in `use-workspace-graph.ts:83-94`:
    ```ts
    const updated = await apiClient.agents.revoke(environmentId, agentId);
    await fetchData();
    return updated;
    ```
  - In `workspace-layout.tsx:62-78`, `handleRevokeNode` awaits `revokeAgent(nodeId)` and emits policy notification only upon success. In case of error, no optimistic UI mutation occurs.
- **Fixture Removal**:
  - Grep searches confirmed: `DEFAULT_GRAPH_NODES`, `DEFAULT_GRAPH_EDGES`, `SPEND_SERIES`, `AGENT_AUTHORITY` are zero-occurrence in `apps/web`.
- **UI States**:
  - `delegation-topology.tsx`: Loading, error (with `onRetry`), and empty states all use fixed height `h-[520px]`, matching the canvas layout exactly.
  - `budget-strip.tsx`: Renders pulsing skeleton for loading, and error banner with retry. Available headroom calculated strictly using integer math `calculateAvailableMinor`.

### 2.2 Screen 2: Activity Feed
- **Hook Checked**:
  - `apps/web/lib/api/hooks/use-activity-feed.ts`:
    - Default polling interval: `3000ms`.
    - Cursor extraction: calculates `latestCreatedAt` from returned events, updates `lastCursorRef.current`.
    - Incremental polling: deduplicates by `e.id`, prepends new items, keeping newest-first order.
- **Removal of Static JSX & Fixtures**:
  - `recent-activity-panel.tsx`: Hardcoded 3 transaction cards replaced by dynamic `activities.map(...)`.
  - `INITIAL_ACTIVITIES` and `DEFAULT_ACTIVITY_EVENTS` completely eliminated from `workspace-defaults.ts` and `types.ts`.
- **Monetary Unit Handling**:
  - Mappers extract `payload.amountMinor` directly without floating point conversions.
  - All currency presentations utilize `formatMinorUnits`.

### 2.3 Proxy Route Handler
- `apps/web/app/api/proxy/[...path]/route.ts`:
  - `[101, 204, 205, 304].includes(upstreamResponse.status)` evaluates to `responseBody = null`.
  - Next.js route handler handles `DELETE` requests with 204 No Content smoothly without throwing `TypeError`.
  - Unit test in `apps/web/app/api/proxy/__tests__/route.test.ts:120-138` asserts 204 response behavior.

### 2.4 Integrity and Protected Code Boundaries
- **Python Immutability**:
  - Command: `git diff -- apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth`
  - Output: 0 lines changed.
- **Absence of Facades / Mocks**:
  - All data fed into Screen 1 & 2 flows through `apiClient` via Next.js proxy route.

---

## 3. Adversarial Analysis & Edge Cases

| Scenario / Attack Angle | Potential Vulnerability | Verified Mitigation | Status |
|---|---|---|---|
| **Client / Server Clock Skew** | Client timestamp could miss backend events if cursor was based on client `Date.now()`. | Cursor uses server-returned event `createdAt` (`latestCreatedAt`), completely immune to local client clock drift. | **PASS** |
| **Duplicate Event Polling** | Identical timestamps from concurrent actions could result in duplicated feed items. | `useActivityFeed` filters incremental updates using `Set(prev.map(a => a.id))`. | **PASS** |
| **Network Error during Revocation** | UI might show revoked state before server confirms, or leave stale state on network crash. | Strictly non-optimistic. Mutation awaits server response before refetching data and adding audit message. Network errors leave state unchanged. | **PASS** |
| **Layout Shift on State Transitions** | Loading skeletons jumping in height when data resolves. | Topology container maintains strict `h-[520px]` in loading, error, empty, and populated states. | **PASS** |
| **Missing Single Environment Route** | Gateway implements `GET /v1/environments` (list) but lacks `GET /v1/environments/:id`. | `apiClient.environments.get` catches 404 and resolves from list endpoint. | **PASS** |
| **Contract Gaps** | Fabricating synthetic spend velocity data. | Documented in `docs/gaps.md` (`GAP-SPEND-01`), explicit placeholder card rendered in `SpendChart`. | **PASS** |

---

## 4. Verification Evidence

### Automated Verification Logs
1. **Web App Typecheck**:
   ```bash
   pnpm --filter @payguardian/web run typecheck
   # Output: $ tsc --noEmit (Exit Code: 0)
   ```

2. **Web App Unit Tests**:
   ```bash
   pnpm --filter @payguardian/web run test
   # Output: 9 passed (9 files), 37 passed (37 tests), 0 failed
   ```

3. **Protected Path Integrity**:
   ```bash
   git diff -- apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth
   # Output: <empty> (Exit Code: 0)
   ```

4. **Monorepo Test Suite**:
   ```bash
   pnpm test
   # Output: 11 passed (48 api tests, 7 worker tests, 37 web tests)
   ```

---

## 5. Verdict

**Verdict**: **APPROVE**  
Milestone 2 implementation is verified, sound, and ready for integration into the orchestrator pipeline.
