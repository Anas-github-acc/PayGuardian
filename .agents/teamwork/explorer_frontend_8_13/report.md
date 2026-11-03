# Frontend Component & API Integration Audit: Screens 8 through 13

**Audit Date**: 2026-11-01  
**Auditor**: `explorer_frontend_8_13`  
**Workspace Target**: Next.js Web Frontend (`apps/web`)  
**Scope**: Screens 8 through 13:
8. Approvals (`/dashboard?tab=approvals`)
9. Payment trace (`/dashboard?tab=traces`)
10. Mandates (`/dashboard?tab=tables&sub=mandates`)
11. Audit grid (`/dashboard?tab=tables&sub=activity`)
12. Security (`/dashboard?tab=security`)
13. Developers (`/dashboard?tab=developer`)

---

## 1. Executive Summary

This audit examined the Next.js frontend application (`apps/web`) of PayGuardian across Screens 8 through 13 to support integration planning for real backend APIs.

### Core Discoveries:
1. **Navigation Architecture**:
   The frontend routes through a single unified dashboard route (`/dashboard`) driven by URL search params parsed via `useDashboardNavigation` (`apps/web/app/lib/navigation.ts:50-78`). The 6 audit screens correspond to tab parameters:
   - Screen 8: `?tab=approvals`
   - Screen 9: `?tab=traces`
   - Screen 10: `?tab=tables&sub=mandates`
   - Screen 11: `?tab=tables&sub=activity`
   - Screen 12: `?tab=security`
   - Screen 13: `?tab=developer`

2. **Hardcoded Data Prevalence**:
   Every one of the 6 screens relies heavily on hardcoded fixtures (`DEFAULT_APPROVALS`, `DEFAULT_TRACES`, `DEFAULT_MANDATES`, `DEFAULT_ACTIVITY_EVENTS`, `DEFAULT_SECURITY_EVENTS`, `DEFAULT_API_KEYS`, `DEFAULT_MCP_TOOLS`). In screens that make real backend calls (Approvals, Mandates, Activity), the frontend explicitly merges or prepends fixture items into the backend response to preserve rich demo presentations (`ApprovalsInbox.tsx:92-94`, `MandatesTable.tsx:86-87`, `ActivityAuditTable.tsx:94-96`).

3. **Backend Integration Status**:
   - **Screen 8 (Approvals)**: `PARTIAL`. Backend exposes `GET /v1/environments/:id/approvals`, `POST .../approve`, and `POST .../reject`. However, the backend `Approval` model lacks rich metadata consumed by the UI (`agentName`, `purpose`, `recipient`, `merchantCategory`, `reasonForSignOff`, `remainingBudgetAfterPaymentMinor`, `ancestorChain`, `agentSays`, `parameters`, `expiresAt`).
   - **Screen 9 (Payment Trace)**: `PARTIAL` to `MISSING`. The UI renders entirely from `DEFAULT_TRACES` in `apps/web/components/traces/types.ts:79-572`. While the backend exposes `GET /v1/environments/:id/actions/:actionId/trace` (`phase3-routes.ts:487`), it only returns `{ action, agent, mandateChain, rootMandate }`. It lacks the 5 execution lifecycle stages with stage latencies, execution payloads, and the 5-point verification checklist.
   - **Screen 10 (Mandates)**: `PARTIAL`. Backend provides `GET /v1/environments/:id/mandates` (`phase6-routes.ts:154`). However, available headroom (`availableMinor`) is computed purely on the client (`MandatesTable.tsx:65`), and `agentName` / `parentAgentName` require joins not present in the base authority entity.
   - **Screen 11 (Audit Grid)**: `FOUND` (with minor enrichments). Backend provides `GET /v1/environments/:id/activity?since=&limit=` with cursor pagination (`phase6-routes.ts:174`). Client polls every 3,000ms.
   - **Screen 12 (Security)**: `PARTIAL`. Backend provides `POST .../pause`, `POST .../resume`, `POST .../revoke` (`phase6-routes.ts:59-103`), and `POST /v1/mandates/:id/revocations` (`phase2-routes.ts:169`). However, security incident logs (`DEFAULT_SECURITY_EVENTS`), telemetry statistics (e.g., 4 blocked incidents), and revocation impact calculations are hardcoded on the client.
   - **Screen 13 (Developers)**: `MISSING`. The Model Context Protocol endpoint (`/v1/mcp`) does not exist on the backend. The connection tester pings `GET /v1/environments` as a surrogate, and the API Key Manager generates synthetic keys using `Math.random().toString(16)` stored purely in local component state with zero backend persistence.

---

## 2. Component & Route Mapping

| Screen | Route / URL Param | Top-Level Component | Primary Child Components | State Store / Hooks Used |
|---|---|---|---|---|
| **8. Approvals** | `/dashboard?tab=approvals` | `ApprovalsInbox` (`apps/web/components/approvals/ApprovalsInbox.tsx`) | `ApprovalCard`, `ApprovalDetailDrawer`, `Button`, `Badge`, `Input` | `useWorkspaceStore`, `workspaceStore`, `useDashboardNavigation`, `useState`, `useEffect`, `useCallback`, `useMemo` |
| **9. Payment Trace** | `/dashboard?tab=traces` (or `setSelectedTraceId(id)`) | `PaymentTraceView` (`apps/web/components/traces/PaymentTraceView.tsx`) | `VerticalAuthChain`, `LifecycleTimeline`, `VerificationChecklist`, `Badge`, `Button` | `useWorkspaceStore`, `workspaceStore`, `useState` |
| **10. Mandates** | `/dashboard?tab=tables&sub=mandates` | `MandatesTable` (`apps/web/components/tables/MandatesTable.tsx`) | `AgGridReact`, `Button`, `Input` | `useWorkspaceStore`, `useDashboardNavigation`, `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef` |
| **11. Audit Grid** | `/dashboard?tab=tables&sub=activity` | `ActivityAuditTable` (`apps/web/components/tables/ActivityAuditTable.tsx`) | `AgGridReact`, `Button`, `Input` | `useWorkspaceStore`, `workspaceStore`, `useDashboardNavigation`, `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef` |
| **12. Security** | `/dashboard?tab=security` | `SecurityCenter` (`apps/web/components/security/SecurityCenter.tsx`) | `EmergencyControls`, `RevocationDialog`, `SecurityEventLog`, `Button`, `Badge` | `useWorkspaceStore`, `workspaceStore`, `useState`, `useCallback`, `useMemo` |
| **13. Developers** | `/dashboard?tab=developer` | `DeveloperPortal` (`apps/web/components/developer/DeveloperPortal.tsx`) | `ConnectionTester`, `CodeSnippet`, `KeyManager`, `Card`, `Button`, `Dialog` | `useState`, `useCallback`, `useEffect` |

### Auxiliary Grid Builders & Global Helpers:
- `apps/web/app/components/approvals-grid-data.ts`: AG Grid row builder `buildApprovalRows`.
- `apps/web/app/components/mandates-grid-data.ts`: AG Grid row builder `buildMandateRows`.
- `apps/web/app/components/activity-grid-data.ts`: AG Grid row builder `buildActivityRows`.
- `apps/web/app/components/payment-operations-grid-data.ts`: Row builder for PayPal operations.
- `apps/web/app/components/paypal-status.tsx`: PayPal callback, capture, and reconciliation view.
- `apps/web/app/lib/workspace-store.ts`: Global singleton store managing `currentEnvironment`, `graphNodes`, `selectedTraceId`, `user`, and `connectionStatus`.

---

## 3. Hardcoded Data Inventory (Requirement R2)

Below is the complete catalog of mock arrays, fixtures, inline amounts, timers, fake loading/states, and client-side logic across Screens 8 through 13:

| # | File Path | Line Number(s) | Category | Data Represented / Implementation Detail | Target Screen |
|---|---|---|---|---|---|
| 1 | `apps/web/components/approvals/types.ts` | 41–184 | Mock Fixture Array | `DEFAULT_APPROVALS`: 4 complete mock approval items (`appr-flight-901` $650.00, `appr-hotel-902` $4,500.00 over-limit, `appr-sim-903` $85.00 approved, `appr-reject-904` $1,200.00 rejected) with full ancestor chains, reasons, and parameters. | Screen 8: Approvals |
| 2 | `apps/web/components/approvals/ApprovalsInbox.tsx` | 29 | Fallback String | Hardcoded fallback environment ID: `"env-sandbox-travel-01"`. | Screen 8: Approvals |
| 3 | `apps/web/components/approvals/ApprovalsInbox.tsx` | 31 | State Initialization | `useState<ApprovalItem[]>(DEFAULT_APPROVALS)` initializes state directly from fixtures. | Screen 8: Approvals |
| 4 | `apps/web/components/approvals/ApprovalsInbox.tsx` | 51–90 | Synthetic Enrichment | Fallback to fixture data fields (`existing?.agentName`, `existing?.purpose`, `existing?.recipient`, `existing?.merchantCategory`, `existing?.reasonForSignOff`, etc.) when mapping backend items. | Screen 8: Approvals |
| 5 | `apps/web/components/approvals/ApprovalsInbox.tsx` | 92–94 | Mock Merging Logic | `const missing = DEFAULT_APPROVALS.filter((d) => !mapped.some((m) => m.id === d.id)); setApprovals([...mapped, ...missing]);` forces demo items into the queue even if backend is connected. | Screen 8: Approvals |
| 6 | `apps/web/components/approvals/ApprovalsInbox.tsx` | 122–141 | Client-Side State Logic | Optimistic approval status mutation and client-side decrement of `store.currentEnvironment.pendingApprovalsCount`. | Screen 8: Approvals |
| 7 | `apps/web/components/approvals/ApprovalsInbox.tsx` | 161–180 | Client-Side State Logic | Optimistic rejection status mutation and client-side decrement of `store.currentEnvironment.pendingApprovalsCount`. | Screen 8: Approvals |
| 8 | `apps/web/components/approvals/ApprovalsInbox.tsx` | 207–219 | Synthetic Metric / Timer | `avgResponseLabel`: hardcoded fallback operator response time `"1m 48s"` when no decisions exist. | Screen 8: Approvals |
| 9 | `apps/web/components/approvals/ApprovalCard.tsx` | 59–81 | Event Timer (`setInterval`) | Expiry countdown timer running every 1,000ms (`setInterval(updateCountdown, 1000)`) computing time until `expiresAt`. | Screen 8: Approvals |
| 10 | `apps/web/components/approvals/ApprovalCard.tsx` | 90 | Client Permission Guardrail | `if (approval.isHardLimitExceeded || !isPending || isProcessing) return;` prevents approval if client flag is true. | Screen 8: Approvals |
| 11 | `apps/web/components/approvals/ApprovalCard.tsx` | 187–207 | Inline Text & Amounts | Hardcoded warning text: `"Exceeds ancestor mandate budget — approval locked until the limit is amended."` and "Amend limit" button. | Screen 8: Approvals |
| 12 | `apps/web/components/approvals/ApprovalDetailDrawer.tsx` | 55 | Timer (`setTimeout`) | 2,000ms timer resetting clipboard copy state: `setTimeout(() => setCopiedHash(false), 2000)`. | Screen 8: Approvals |
| 13 | `apps/web/components/traces/types.ts` | 79–297 | Mock Fixture Dictionary | `DEFAULT_TRACES["trace-pay-9018"]`: Settled IndiGo flight ($245.00 USD) via PayPal with 4 vertical auth nodes, 5 lifecycle stages, 5 verification checks, and raw record. | Screen 9: Payment Trace |
| 14 | `apps/web/components/traces/types.ts` | 298–436 | Mock Fixture Dictionary | `DEFAULT_TRACES["trace-rej-7712"]`: Denied Grand Hyatt lodging ($5,000.00 USD) with $3,200 shortfall, 2 auth nodes, failed stage 2, and failed budget verification check. | Screen 9: Payment Trace |
| 15 | `apps/web/components/traces/types.ts` | 437–572 | Mock Fixture Dictionary | `DEFAULT_TRACES["trace-pend-4401"]`: Pending Hertz car rental ($380.00 USD) with uncertain state notice, active capture stage, and escrow hold details. | Screen 9: Payment Trace |
| 16 | `apps/web/components/traces/PaymentTraceView.tsx` | 39 | Fallback String | Hardcoded fallback trace ID: `"trace-pay-9018"`. | Screen 9: Payment Trace |
| 17 | `apps/web/components/traces/PaymentTraceView.tsx` | 42–45 | Zero-API Fixture Lookup | `trace = DEFAULT_TRACES[effectiveTraceId] ?? DEFAULT_TRACES["trace-pay-9018"] ?? Object.values(DEFAULT_TRACES)[0]`: Component makes no network request, reading 100% from fixtures. | Screen 9: Payment Trace |
| 18 | `apps/web/components/traces/PaymentTraceView.tsx` | 55 | Timer (`setTimeout`) | 2,000ms timer resetting raw record copied state: `setTimeout(() => setCopiedRecord(false), 2000)`. | Screen 9: Payment Trace |
| 19 | `apps/web/components/traces/PaymentTraceView.tsx` | 137–139 | Inline Notice Text | Hardcoded uncertain state text: `"Waiting for confirmation from payment provider. The money is held in reservation, not spent."` | Screen 9: Payment Trace |
| 20 | `apps/web/components/traces/VerticalAuthChain.tsx` | 28–33 | Inline Text & Logic | Hardcoded header `"Vertical Authorization & Budget Delegation Chain"` and `{nodes.length} hierarchy levels evaluated`. | Screen 9: Payment Trace |
| 21 | `apps/web/components/traces/LifecycleTimeline.tsx` | 32–36 | Inline Text & Metrics | Hardcoded title `"5-Stage Gateway Execution & Settlement Timeline"` and synthetic latencies (`+${stage.latencyMs}ms`). | Screen 9: Payment Trace |
| 22 | `apps/web/components/traces/VerificationChecklist.tsx` | 28–35 | Inline Badges | Hardcoded badges `"All 5 Checks Passed"` and `"${failedCount} Check Failed"`. | Screen 9: Payment Trace |
| 23 | `apps/web/components/tables/types.ts` | 54–150 | Mock Fixture Array | `DEFAULT_MANDATES`: 5 mock mandate records (`man-root-9081` $10,000, `man-travel-4001` $4,000, `man-hotel-4002` $4,000, `man-booking-gw-4003` $2,000, `man-flights-unfunded-4004` $0). | Screen 10: Mandates |
| 24 | `apps/web/components/tables/types.ts` | 255–308 | Mock Fixture Array | `DEFAULT_POLICIES`: 4 policy records defining single-action limits ($1,000, $500, $800, $200) and approval thresholds. | Screen 10 / Screen 8 (Policies) |
| 25 | `apps/web/components/tables/MandatesTable.tsx` | 40 | Fallback String | Hardcoded fallback environment ID: `"env-sandbox-travel-01"`. | Screen 10: Mandates |
| 26 | `apps/web/components/tables/MandatesTable.tsx` | 42 | State Initialization | `useState<MandateRow[]>(DEFAULT_MANDATES)` initializes state from fixtures. | Screen 10: Mandates |
| 27 | `apps/web/components/tables/MandatesTable.tsx` | 65 | Client Budget Logic | Client-side headroom calculation: `const availableMinor = Math.max(0, budgetLimitMinor - allocatedMinor - spentMinor - reservedMinor);`. | Screen 10: Mandates |
| 28 | `apps/web/components/tables/MandatesTable.tsx` | 86–87 | Mock Merging Logic | `const missing = DEFAULT_MANDATES.filter((d) => !mapped.some((m) => m.id === d.id)); setMandates([...mapped, ...missing]);` merges fixture mandates into live data. | Screen 10: Mandates |
| 29 | `apps/web/components/tables/types.ts` | 152–253 | Mock Fixture Array | `DEFAULT_ACTIVITY_EVENTS`: 5 mock audit events (`evt-01` IndiGo flight payment $245, `evt-02` approval created $650, `evt-03` Grand Hyatt denial $5,000, `evt-04` delegation $4,000, `evt-05` simulated attack blocked $8,000). | Screen 11: Audit Grid |
| 30 | `apps/web/components/tables/ActivityAuditTable.tsx` | 36 | Fallback String | Hardcoded fallback environment ID: `"env-sandbox-travel-01"`. | Screen 11: Audit Grid |
| 31 | `apps/web/components/tables/ActivityAuditTable.tsx` | 38 | State Initialization | `useState<ActivityAuditRow[]>(DEFAULT_ACTIVITY_EVENTS)` seeded from fixtures. | Screen 11: Audit Grid |
| 32 | `apps/web/components/tables/ActivityAuditTable.tsx` | 94–96 | Mock Merging Logic | `const missing = DEFAULT_ACTIVITY_EVENTS.filter((d) => !mapped.some((m) => m.id === d.id)); const combined = [...mapped, ...missing]; setEvents(combined);` forces fixtures into live event log. | Screen 11: Audit Grid |
| 33 | `apps/web/components/tables/ActivityAuditTable.tsx` | 116–162 | Event Timer (`setInterval`) | Live polling interval running every 3,000ms (`setInterval(..., 3000)`) fetching `?limit=20&since=...`. | Screen 11: Audit Grid |
| 34 | `apps/web/components/tables/ActivityAuditTable.tsx` | 430–442 | Inline State Toggle | "Live 3s Polling" vs "Polling Paused" pill with green animated pulse dot. | Screen 11: Audit Grid |
| 35 | `apps/web/components/security/types.ts` | 29–102 | Mock Fixture Array | `DEFAULT_SECURITY_EVENTS`: 5 security incident events (`sec-evt-01` overspend $5,000, `sec-evt-02` signature failure $8,000, `sec-evt-03` category mismatch $1,200, `sec-evt-04` replay attack $1,000, `sec-evt-05` autonomous bypass $245). | Screen 12: Security |
| 36 | `apps/web/components/security/SecurityCenter.tsx` | 38 | Fallback String | Hardcoded fallback environment ID: `"env-sandbox-travel-01"`. | Screen 12: Security |
| 37 | `apps/web/components/security/SecurityCenter.tsx` | 45–49 | Mock Agent Fallback | Fallback agents array when store graphNodes empty (`orchestrator-root` $10,000, `agent-travel` $4,000, `agent-hotel` $4,000). | Screen 12: Security |
| 38 | `apps/web/components/security/SecurityCenter.tsx` | 51–62 | Synthetic Impact Fixture | `handleOpenRevokeRoot` sets synthetic cascade impacts (`cascadeMandatesCount: 4`, `heldReservationsMinor: 150000`). | Screen 12: Security |
| 39 | `apps/web/components/security/SecurityCenter.tsx` | 64–76 | Synthetic Impact Fixture | `handleOpenRevokeAgent` sets synthetic impacts (`cascadeAgentsCount: 2`, `cascadeMandatesCount: 2`, `heldReservationsMinor: 50000`, child scraper names). | Screen 12: Security |
| 40 | `apps/web/components/security/SecurityCenter.tsx` | 119–150 | Hardcoded Telemetry Cards | 4 summary metric tiles displaying static strings: `"0 branches revoked"`, `"Fail-safe standing by"`, `"4 prevented"`, `"2 simulation vectors"`, `"100% Valid"`, `"Secp256k1 & Double-entry"`. | Screen 12: Security |
| 41 | `apps/web/components/security/EmergencyControls.tsx` | 46–47, 63–64 | Event Timer (`setTimeout`) | 5,000ms feedback message clear timers after pause/resume commands. | Screen 12: Security |
| 42 | `apps/web/components/security/EmergencyControls.tsx` | 45, 62 | Client Store Transition | Immediate optimistic update of `currentEnvironment.status` to `"paused"` or `"active"`. | Screen 12: Security |
| 43 | `apps/web/components/security/RevocationDialog.tsx` | 39–40 | Client Gatekeeper Logic | Client-side rule requiring user to type `"REVOKE"` in uppercase when `cascadeAgentsCount > 1`. | Screen 12: Security |
| 44 | `apps/web/components/security/RevocationDialog.tsx` | 69–81 | Hardcoded Invariant Warning | Mandatory truth-in-accounting warning banner: `"Revoking stops future actions immediately, but cannot undo completed external transactions."` | Screen 12: Security |
| 45 | `apps/web/components/security/SecurityEventLog.tsx` | 31 | State Initialization | `useState<SecurityEventItem[]>(DEFAULT_SECURITY_EVENTS)`: 100% fixture-backed, no API call performed. | Screen 12: Security |
| 46 | `apps/web/components/developer/types.ts` | 26–60 | Mock Fixture Array | `DEFAULT_API_KEYS`: 3 hardcoded API keys (`pg_live_8f91...3a9d`, `pg_test_4b22...8a41`, `pg_test_90cc...2e75`) with scopes and timestamps. | Screen 13: Developers |
| 47 | `apps/web/components/developer/types.ts` | 62–88 | Mock Fixture Array | `DEFAULT_MCP_TOOLS`: 5 hardcoded MCP tool manifests (`payguardian_request_budget`, `payguardian_execute_payment`, `payguardian_delegate_mandate`, `payguardian_query_balance`, `payguardian_check_policy`). | Screen 13: Developers |
| 48 | `apps/web/components/developer/DeveloperPortal.tsx` | 15–20 | Static Config Table | Hardcoded parameters: `"JSON-RPC 2.0 · MCP v1.4.0"`, `"Bearer API key"`, `"pg_test_ (sandbox) · pg_live_ (production)"`, `"TypeScript · Python ADK"`. | Screen 13: Developers |
| 49 | `apps/web/components/developer/DeveloperPortal.tsx` | 23 | Hardcoded Endpoint | Default endpoint URL: `"http://localhost:3001/v1/mcp"`. | Screen 13: Developers |
| 50 | `apps/web/components/developer/ConnectionTester.tsx` | 45 | Fake Seeded State | `useState<ProbeResult>({ ok: true, latencyMs: 14 })` seeds connection as permanently online with 14ms latency. | Screen 13: Developers |
| 51 | `apps/web/components/developer/ConnectionTester.tsx` | 53 | Timer (`setTimeout`) | 2,000ms timer resetting copied endpoint state. | Screen 13: Developers |
| 52 | `apps/web/components/developer/ConnectionTester.tsx` | 61–69 | Fake Handshake / Probe | Pings `GET ${API_BASE}/v1/environments` instead of `/v1/mcp`. On catch, returns fake latency `16ms`. Steps 2, 3, and 4 (handshake, tools, policy) are purely synthetic derivations of Step 1. | Screen 13: Developers |
| 53 | `apps/web/components/developer/KeyManager.tsx` | 25 | State Initialization | `useState<ApiKey[]>(DEFAULT_API_KEYS)` seeds key management exclusively in local state. | Screen 13: Developers |
| 54 | `apps/web/components/developer/KeyManager.tsx` | 53–76 | Client Key Generation | Generates synthetic API keys locally using `Math.random().toString(16)` with zero backend communication. | Screen 13: Developers |
| 55 | `apps/web/components/developer/KeyManager.tsx` | 78–100 | Client Key Rotation | Purely client-side key rotation replacing prefix/secret with freshly generated random hex. | Screen 13: Developers |
| 56 | `apps/web/components/developer/KeyManager.tsx` | 102–109 | Client Key Revocation | Purely client-side status flag update to `"revoked"`. | Screen 13: Developers |
| 57 | `apps/web/components/developer/KeyManager.tsx` | 115, 123 | Timers (`setTimeout`) | 2,000ms timers resetting clipboard copy notifications for keys. | Screen 13: Developers |
| 58 | `apps/web/components/developer/CodeSnippet.tsx` | 50–51 | Hardcoded Credentials | Default endpoint `"http://localhost:3001/v1/mcp"` and dummy API key `"pg_test_4b2210ef3998a41"`. | Screen 13: Developers |
| 59 | `apps/web/components/developer/CodeSnippet.tsx` | 57–167 | Hardcoded Code Snippets | 4 complete static code snippets for TypeScript SDK, Python ADK, Claude Desktop JSON config, and Cursor MCP config. | Screen 13: Developers |
| 60 | `apps/web/components/developer/CodeSnippet.tsx` | 175 | Timer (`setTimeout`) | 2,000ms timer resetting code copied feedback. | Screen 13: Developers |

---

## 4. Per-Screen Deep-Dive Analysis

### Screen 8: Approvals
- **Component File**: `apps/web/components/approvals/ApprovalsInbox.tsx` (rendered in `apps/web/app/dashboard/page.tsx:104-110`).
- **Data Expectations & Props**:
  - `ApprovalsInboxProps`: `{ environmentId?: string; onViewTrace?: (traceId: string) => void; onAmendLimit?: (mandateId: string) => void; className?: string }`.
  - Consumes `ApprovalItem` (`types.ts:9-37`):
    `id`, `environmentId`, `mandateId`, `agentId`, `agentName`, `agentRole`, `action`, `purpose`, `recipient`, `merchantCategory`, `amountMinor`, `currency`, `requestHash`, `status`, `reasonForSignOff`, `remainingBudgetAfterPaymentMinor`, `parentMandateLimitMinor`, `isHardLimitExceeded`, `hardLimitExceededReason`, `expiresAt`, `createdAt`, `approvedBy`, `approvedAt`, `rejectionReason`, `ancestorChain` (`ApprovalAncestor[]`), `agentSays`, `parameters`.
- **Action Triggers & Commands**:
  - `Approve`: Triggers `POST /v1/environments/:environmentId/approvals/:id/approve` with header `x-local-user-id`. Optimistically updates UI state and decrements `pendingApprovalsCount` in `workspaceStore`.
  - `Reject`: Triggers `POST /v1/environments/:environmentId/approvals/:id/reject` with payload `{ reason: string }`.
  - `View Trace`: Invokes `onViewTrace(traceId)` or `workspaceStore.setSelectedTraceId(traceId)` + navigates to `"traces"`.
  - `Amend Limit`: Triggers `navigateTab("tables", "policies")`.
  - `Copy Request Hash`: Copies SHA-256 parameter hash to clipboard.
- **Backend API Mapping & Gaps**:
  - **Status**: `PARTIAL`.
  - **Existing Endpoints**:
    - `GET /v1/environments/:environmentId/approvals` (`apps/api/src/phase4-routes.ts:140`)
    - `POST /v1/environments/:environmentId/approvals/:id/approve` (`phase4-routes.ts:184`)
    - `POST /v1/environments/:environmentId/approvals/:id/reject` (`phase4-routes.ts:227`)
  - **Gap / Shape Differences**:
    The backend `Approval` type (`apps/api/src/phase4.ts:6-21`) contains only 13 raw fields (`id`, `environmentId`, `mandateId`, `agentId`, `action`, `amountMinor`, `currency`, `requestHash`, `status`, `approvedBy`, `approvedAt`, `rejectionReason`, `createdAt`, `updatedAt`).
    It completely lacks:
    1. `agentName` (requires agent registry lookup)
    2. `agentRole` (`"orchestrator"` vs `"subagent"`)
    3. `purpose` (human-readable justification for the payment)
    4. `recipient` (target merchant name)
    5. `merchantCategory`
    6. `reasonForSignOff` (explanation of why human sign-off was triggered)
    7. `remainingBudgetAfterPaymentMinor`
    8. `parentMandateLimitMinor`
    9. `isHardLimitExceeded` (boolean indicating if ancestor pool is violated)
    10. `hardLimitExceededReason`
    11. `expiresAt` (ISO expiration timestamp for the approval)
    12. `ancestorChain` (array of `{ id, name, role }` representing delegation path)
    13. `agentSays` (agent dialogue / rationale)
    14. `parameters` (action payload dictionary)

---

### Screen 9: Payment Trace
- **Component File**: `apps/web/components/traces/PaymentTraceView.tsx` (rendered in `apps/web/app/dashboard/page.tsx:112-113`).
- **Data Expectations & Props**:
  - `PaymentTraceViewProps`: `{ traceId?: string | null; onClose?: () => void; className?: string }`.
  - Consumes `PaymentTrace` (`types.ts:52-77`):
    `id`, `actionId`, `environmentId`, `environmentName`, `transactionId`, `recipient`, `merchantCategory`, `amountMinor`, `currency`, `rail`, `status`, `initiatedAt`, `completedAt`, `totalLatencyMs`, `requestingAgent` (`{ id, name, role }`), `authChain` (`TraceAuthNode[]`), `stages` (`TraceLifecycleStage[]`), `checklist` (`TraceVerificationCheck[]`), `rawRecord` (`Record<string, unknown>`), `uncertainStateNotice`.
- **Action Triggers & Commands**:
  - `Close Trace`: Closes trace view and navigates back to `"overview"`.
  - `Tab Switching`: Switches between `"chain"`, `"timeline"`, and `"checklist"`.
  - `Developer Mode`: Toggles JSON raw cryptographic record drawer.
  - `Copy Raw JSON`: Copies `trace.rawRecord` to clipboard.
- **Backend API Mapping & Gaps**:
  - **Status**: `PARTIAL` to `MISSING`.
  - **Existing Endpoints**:
    - `GET /v1/environments/:environmentId/actions/:actionId/trace` (`apps/api/src/phase3-routes.ts:487`) returns `{ action, agent, mandateChain, rootMandate }`.
    - `GET /v1/environments/:environmentId/payments/paypal/:actionId` (`apps/api/src/paypal-routes.ts:453`) returns `{ action, operation, reservation }`.
  - **Gap / Shape Differences**:
    The frontend component currently does not call any endpoint and reads exclusively from `DEFAULT_TRACES` dictionary in `types.ts:79-572`.
    To replace fixtures with backend data, a dedicated composite endpoint or aggregator is needed to provide:
    1. `stages`: 5 execution stages (`initiated`, `mandate_evaluated`, `human_approved_bypass`, `paypal_captured`, `settled_reconciled`) with millisecond latencies and payloads.
    2. `checklist`: 5-point verification matrix (`chk-budget`, `chk-rail`, `chk-merchant`, `chk-hash`, `chk-ledger`) with passed booleans and error codes.
    3. `authChain`: Hierarchy of evaluated nodes with allocated, spent, reserved, and available balances.
    4. `totalLatencyMs` and provider order/capture IDs.

---

### Screen 10: Mandates
- **Component File**: `apps/web/components/tables/MandatesTable.tsx` (rendered in `apps/web/app/dashboard/page.tsx:125-130`).
- **Data Expectations & Props**:
  - `MandatesTableProps`: `{ environmentId?: string; onRevokeMandate?: (mandateId: string, agentName: string) => void; onSelectMandate?: (mandateId: string) => void; onViewTrace?: (traceId: string) => void; className?: string }`.
  - Consumes `MandateRow` (`types.ts:1-19`):
    `id`, `holderAgentId`, `agentName`, `role`, `parentMandateId`, `parentAgentName`, `budgetLimitMinor`, `allocatedMinor`, `spentMinor`, `reservedMinor`, `availableMinor`, `currency`, `state`, `expiresAt`, `canDelegate`, `maxDelegationDepth`, `permittedActions`.
- **Action Triggers & Commands**:
  - `Search Query & Status Filter`: In-memory filtering by query and status (`all`, `active`, `revoked`).
  - `Revoke Mandate`: Invokes `onRevokeMandate(item.id, item.agentName)` which routes to `/dashboard?tab=security`.
  - `View Trace`: Invokes `onViewTrace(item.id)` to inspect execution trace.
  - `Refresh`: Re-fetches `/v1/environments/:environmentId/mandates`.
- **Backend API Mapping & Gaps**:
  - **Status**: `PARTIAL`.
  - **Existing Endpoints**:
    - `GET /v1/environments/:environmentId/mandates` (`apps/api/src/phase6-routes.ts:154`) returns `{ mandates: Mandate[] }`.
    - `POST /v1/mandates/:mandateId/revocations` (`apps/api/src/phase2-routes.ts:169`) executes revocation.
  - **Gap / Shape Differences**:
    The backend `Mandate` object (`packages/domain/src/index.ts:15-25`) returns IDs (`holderAgentId`, `parentMandateId`) without resolving `agentName`, `role`, or `parentAgentName`.
    Furthermore, `availableMinor` is calculated purely on the client as `budgetLimitMinor - allocatedMinor - spentMinor - reservedMinor`.
    Missing mandates are backfilled from `DEFAULT_MANDATES` fixtures at line 86.

---

### Screen 11: Audit Grid
- **Component File**: `apps/web/components/tables/ActivityAuditTable.tsx` (rendered in `apps/web/app/dashboard/page.tsx:131`).
- **Data Expectations & Props**:
  - `ActivityAuditTableProps`: `{ environmentId?: string; onViewTrace?: (traceId: string) => void; className?: string }`.
  - Consumes `ActivityAuditRow` (`types.ts:21-38`):
    `id`, `actionId`, `environmentId`, `eventType`, `actorType`, `actorId`, `actorName`, `amountMinor`, `currency`, `outcome`, `reasonCode`, `eventHash`, `previousHash`, `createdAt`, `isSimulation`, `payload`.
- **Action Triggers & Commands**:
  - `Live 3s Polling Toggle`: Starts/stops `setInterval` timer polling every 3 seconds with cursor.
  - `Filter Pills`: Filters by `all`, `denied`, `payments`, `approvals`.
  - `Copy Record SHA-256`: Copies hash to clipboard.
  - `View Trace`: Calls `workspaceStore.setSelectedTraceId(actionId)` + navigates to `"traces"`.
  - `Search Query`: In-memory search by actor, event type, hash, or action ID.
- **Backend API Mapping & Gaps**:
  - **Status**: `FOUND` (with minor shape enrichments).
  - **Existing Endpoints**:
    - `GET /v1/environments/:environmentId/activity?since=&limit=` (`apps/api/src/phase6-routes.ts:174`) returns `{ events: AuditEvent[], cursor: string | null }`.
  - **Gap / Shape Differences**:
    Backend `AuditEvent` (`@payguardian/observability`) has `actorId` but no `actorName`. The frontend infers or defaults `actorName`. Also, `amountMinor` and `currency` are buried inside `payload` on the backend, requiring frontend extraction. Prepending of `DEFAULT_ACTIVITY_EVENTS` fixtures occurs at lines 94-96.

---

### Screen 12: Security
- **Component File**: `apps/web/components/security/SecurityCenter.tsx` (rendered in `apps/web/app/dashboard/page.tsx:137-138`).
- **Data Expectations & Props**:
  - `SecurityCenterProps`: `{ environmentId?: string; onViewTrace?: (traceId: string) => void; className?: string }`.
  - Consumes:
    - `EnvironmentStatus` from `workspaceStore.currentEnvironment.status`.
    - `SecurityEventItem` (`types.ts:3-17`): `id`, `severity`, `timestamp`, `agentId`, `agentName`, `ruleViolated`, `actionAttempted`, `amountMinor`, `currency`, `requestHash`, `traceId`, `isSimulation`, `details`.
    - `RevocationSubtreeImpact` (`types.ts:19-27`): `targetMandateId`, `targetAgentName`, `cascadeAgentsCount`, `cascadeMandatesCount`, `heldReservationsMinor`, `currency`, `childAgentNames`.
- **Action Triggers & Commands**:
  - `Pause Environment`: Dispatches `POST /v1/environments/:environmentId/pause`.
  - `Resume Environment`: Dispatches `POST /v1/environments/:environmentId/resume`.
  - `Revoke Environment Root`: Dispatches `POST /v1/environments/:environmentId/revoke`.
  - `Revoke Agent Branch`: Opens `RevocationDialog` with downstream impact, requiring `REVOKE` input confirmation before dispatching `POST /v1/mandates/:mandateId/revocations`.
  - `Forensic Trace`: Navigates to trace for violation incident.
- **Backend API Mapping & Gaps**:
  - **Status**: `PARTIAL`.
  - **Existing Endpoints**:
    - `POST /v1/environments/:environmentId/pause` (`apps/api/src/phase6-routes.ts:64`)
    - `POST /v1/environments/:environmentId/resume` (`phase6-routes.ts:64`)
    - `POST /v1/environments/:environmentId/revoke` (`phase6-routes.ts:64`)
    - `POST /v1/mandates/:mandateId/revocations` (`apps/api/src/phase2-routes.ts:169`)
  - **Gap / Shape Differences**:
    1. **Revocation Subtree Preview**: `MISSING`. Backend has no dry-run endpoint to calculate cascade impacts (`cascadeAgentsCount`, `cascadeMandatesCount`, `heldReservationsMinor`, `childAgentNames`). The frontend fabricates these numbers at lines 51-76.
    2. **Security Incident Stream**: `MISSING`. `SecurityEventLog` reads 100% from `DEFAULT_SECURITY_EVENTS` (`types.ts:29-102`). There is no backend endpoint returning filtered security violations with severity ratings.
    3. **Telemetry Statistics**: 4 stat cards in `SecurityCenter.tsx:118-150` display static hardcoded strings.

---

### Screen 13: Developers
- **Component File**: `apps/web/components/developer/DeveloperPortal.tsx` (rendered in `apps/web/app/dashboard/page.tsx:143-144`).
- **Data Expectations & Props**:
  - `DeveloperPortalProps`: `{ className?: string }`.
  - Consumes:
    - `ApiKey` (`types.ts:1-11`): `id`, `name`, `keyPrefix`, `secretMasked`, `environment`, `createdAt`, `lastUsedAt`, `scopes`, `status`.
    - `DEFAULT_MCP_TOOLS` (`types.ts:62-88`): `name`, `description`, `parameters`.
    - Code snippets in TypeScript, Python, Claude Desktop, and Cursor.
- **Action Triggers & Commands**:
  - `Run Tests (ConnectionTester)`: Pings `${API_BASE}/v1/environments` and simulates MCP JSON-RPC 2.0 handshake, tool discovery, and policy checks.
  - `Create Key`: Opens dialog, creates synthetic key in client state with `Math.random().toString(16)`, displays secret revelation modal.
  - `Rotate Key`: Generates replacement secret in client state.
  - `Revoke Key`: Sets status to `"revoked"` in client state.
  - `Copy Snippets / Secrets / Endpoints`: Clipboard copies with 2s timeouts.
- **Backend API Mapping & Gaps**:
  - **Status**: `MISSING`.
  - **Existing Endpoints**: None.
  - **Gap / Shape Differences**:
    1. **MCP Endpoint**: The gateway exposes no JSON-RPC 2.0 endpoint at `/v1/mcp`.
    2. **API Key Management**: No endpoints exist for `GET /v1/api-keys`, `POST /v1/api-keys`, `POST /v1/api-keys/:id/rotate`, or `POST /v1/api-keys/:id/revoke`.

---

## 5. Screen-to-API Status & Missing Capabilities Summary

| Screen | Target Endpoint / Command | Status | Existing Backend Route | Critical Gaps & Missing Data |
|---|---|---|---|---|
| **8. Approvals** | List pending/all approvals | **PARTIAL** | `GET /v1/environments/:id/approvals` | Backend returns raw `Approval` lacking `agentName`, `purpose`, `recipient`, `merchantCategory`, `reasonForSignOff`, `remainingBudgetAfterPaymentMinor`, `ancestorChain`, `agentSays`, `parameters`, `expiresAt`. |
| **8. Approvals** | Approve request | **FOUND** | `POST /v1/environments/:id/approvals/:id/approve` | Matching route exists. Needs passkey credential verification in payload. |
| **8. Approvals** | Reject request | **FOUND** | `POST /v1/environments/:id/approvals/:id/reject` | Matching route exists with `{ reason }` body. |
| **9. Payment Trace** | Fetch execution trace details | **PARTIAL** | `GET /v1/environments/:id/actions/:actionId/trace` | Backend returns basic `{ action, agent, mandateChain, rootMandate }`. Missing 5 lifecycle stages with latencies, 5-point verification matrix, and raw cryptographic hashes. |
| **10. Mandates** | List environment mandates | **PARTIAL** | `GET /v1/environments/:id/mandates` | Returns raw `Mandate` list. Missing agent names, parent agent names, and server-side computed available headroom. |
| **10. Mandates** | Revoke mandate | **FOUND** | `POST /v1/mandates/:id/revocations` | Matching route exists in Phase 2 API. |
| **11. Audit Grid** | List activity audit events | **FOUND** | `GET /v1/environments/:id/activity` | Supported with `since` and `limit` query params. Minor gap: `actorName` and top-level amount formatting need resolution. |
| **12. Security** | Emergency pause environment | **FOUND** | `POST /v1/environments/:id/pause` | Route exists and transitions environment status to `paused`. |
| **12. Security** | Emergency resume environment | **FOUND** | `POST /v1/environments/:id/resume` | Route exists and transitions environment status to `active`. |
| **12. Security** | Emergency revoke environment | **FOUND** | `POST /v1/environments/:id/revoke` | Route exists and transitions environment status to `revoked`. |
| **12. Security** | Preview revocation subtree impact | **MISSING** | *None* | No dry-run endpoint to calculate cascade agents, affected child mandates, or held reservations. |
| **12. Security** | Security incident audit stream | **MISSING** | *None* | No dedicated endpoint for security policy violations with severity rankings (`CRITICAL`, `WARNING`). |
| **13. Developers** | MCP Gateway Server (`/v1/mcp`) | **MISSING** | *None* | No JSON-RPC 2.0 Model Context Protocol endpoint exposed on gateway. |
| **13. Developers** | API Key Management (`/v1/api-keys`) | **MISSING** | *None* | No database table or REST CRUD endpoints for agent API tokens. |

---

## 6. Proposed Request & Response Shapes for Gaps

### G1. Enriched Approval Item (`GET /v1/environments/:id/approvals`)
Proposed response addition to match `ApprovalItem`:
```json
{
  "approvals": [
    {
      "id": "appr-flight-901",
      "environmentId": "env-sandbox-travel-01",
      "mandateId": "man-travel-4001",
      "agentId": "agent-travel",
      "agentName": "Travel Subagent",
      "agentRole": "subagent",
      "action": "flight.procure",
      "purpose": "Round-trip direct flight Goa (GOI) to Mumbai (BOM) on IndiGo Airlines",
      "recipient": "IndiGo Airlines Ltd",
      "merchantCategory": "Airlines & Air Travel",
      "amountMinor": 65000,
      "currency": "USD",
      "requestHash": "0x7a39d841b52c0f68e919248560123fabce8765432109876543210fedcba98765",
      "status": "pending",
      "reasonForSignOff": "Amount $650.00 exceeds agent's single-action autonomous limit of $500.00",
      "remainingBudgetAfterPaymentMinor": 210000,
      "parentMandateLimitMinor": 400000,
      "isHardLimitExceeded": false,
      "hardLimitExceededReason": null,
      "expiresAt": "2026-11-01T21:30:00.000Z",
      "createdAt": "2026-11-01T20:30:00.000Z",
      "approvedBy": null,
      "approvedAt": null,
      "rejectionReason": null,
      "ancestorChain": [
        { "id": "user-root", "name": "You (Operator)", "role": "Root Authority" },
        { "id": "orchestrator-root", "name": "Main Orchestrator", "role": "Environment Overseer" },
        { "id": "agent-travel", "name": "Travel Subagent", "role": "Flight & Rail Procurement" }
      ],
      "agentSays": "I have located direct departure flight 6E-204 at 09:15 AM matching your morning schedule constraint.",
      "parameters": {
        "flightNumber": "6E-204",
        "departure": "GOI",
        "arrival": "BOM",
        "travelClass": "Business",
        "passenger": "Lead Operator",
        "fareBreakdownMinor": 65000
      }
    }
  ]
}
```

### G2. Enriched Composite Payment Trace (`GET /v1/environments/:id/actions/:actionId/trace`)
Proposed response matching `PaymentTrace`:
```json
{
  "trace": {
    "id": "trace-pay-9018",
    "actionId": "act-pay-9018-ind",
    "environmentId": "env-sandbox-travel-01",
    "environmentName": "Travel & Hospitality",
    "transactionId": "txn_pp_982194820",
    "recipient": "IndiGo Airlines Ltd",
    "merchantCategory": "Airlines & Air Travel",
    "amountMinor": 24500,
    "currency": "USD",
    "rail": "PayPal",
    "status": "completed",
    "initiatedAt": "2026-10-31T13:58:12Z",
    "completedAt": "2026-10-31T13:58:45Z",
    "totalLatencyMs": 330,
    "requestingAgent": {
      "id": "agent-travel",
      "name": "Travel Subagent",
      "role": "Flight & Rail Procurement"
    },
    "authChain": [
      {
        "id": "node-root",
        "name": "Lead Operator (You)",
        "role": "Root User Authority",
        "mandateId": "man-root-9081",
        "allocatedMinor": 1000000,
        "spentMinor: 245000,
        "reservedMinor": 150000,
        "availableMinor": 605000,
        "currency": "USD",
        "status": "active",
        "policyRule": "Root Environment Budget: $10,000.00 max cap",
        "depth": 0
      }
    ],
    "stages": [
      {
        "key": "initiated",
        "name": "1. Request Initiated",
        "description": "Agent signed call with canonical SHA-256 hash & idempotency key",
        "status": "completed",
        "timestamp": "2026-10-31T13:58:12.100Z",
        "latencyMs": 14,
        "details": { "idempotencyKey": "idem-fly-6e204-981" }
      },
      {
        "key": "mandate_evaluated",
        "name": "2. Mandate Evaluated",
        "description": "Authority tree evaluated across 3 levels",
        "status": "completed",
        "timestamp": "2026-10-31T13:58:12.145Z",
        "latencyMs": 45
      },
      {
        "key": "human_approved_bypass",
        "name": "3. Autonomous Bypass",
        "description": "Spend is below threshold",
        "status": "completed",
        "timestamp": "2026-10-31T13:58:12.155Z",
        "latencyMs": 10
      },
      {
        "key": "paypal_captured",
        "name": "4. PayPal Rail Captured",
        "description": "Dispatched order to PayPal REST API v2",
        "status": "completed",
        "timestamp": "2026-10-31T13:58:12.380Z",
        "latencyMs": 225
      },
      {
        "key": "settled_reconciled",
        "name": "5. Settled & Hash Chained",
        "description": "Reservation debited to spent",
        "status": "completed",
        "timestamp": "2026-10-31T13:58:12.430Z",
        "latencyMs": 50
      }
    ],
    "checklist": [
      {
        "id": "chk-budget",
        "name": "Budget Limit Check",
        "description": "Verifies requested spend does not exceed allocated pool",
        "passed": true,
        "details": "Available: $2,250.00 >= Requested: $245.00"
      },
      {
        "id": "chk-rail",
        "name": "Rail Allowance Check",
        "description": "Confirms target payment rail is permitted",
        "passed": true,
        "details": "PayPal rail is active"
      },
      {
        "id": "chk-merchant",
        "name": "Merchant Category Check",
        "description": "Ensures recipient category exists on allowlist",
        "passed": true,
        "details": "Category matches"
      },
      {
        "id": "chk-hash",
        "name": "Parameter Hash Integrity Check",
        "description": "Validates canonical payload hash matches digest",
        "passed": true,
        "details": "Cryptographic digest match"
      },
      {
        "id": "chk-ledger",
        "name": "Double-Entry Conservation Check",
        "description": "Ensures sum of debit entries precisely equals credit entries",
        "passed": true,
        "details": "Debits = Credits"
      }
    ],
    "rawRecord": {
      "traceId": "trace-pay-9018",
      "actionId": "act-pay-9018-ind",
      "environmentId": "env-sandbox-travel-01",
      "amountMinor": 24500,
      "currency": "USD"
    }
  }
}
```

### G3. Revocation Subtree Impact Dry-Run (`GET /v1/mandates/:mandateId/revocation-impact`)
Proposed dry-run endpoint:
```json
{
  "targetMandateId": "man-travel-4001",
  "targetAgentName": "Travel Subagent",
  "cascadeAgentsCount": 2,
  "cascadeMandatesCount": 2,
  "heldReservationsMinor": 50000,
  "currency": "USD",
  "childAgentNames": [
    "Flight Scraper",
    "Booking Gateway"
  ]
}
```

### G4. API Key Management Endpoints (`/v1/api-keys`)
Proposed CRUD operations for agent credentials:
- `GET /v1/api-keys`: List masked keys for environment.
- `POST /v1/api-keys`: Create a new key.
  Request:
  ```json
  {
    "name": "Travel Concierge Micro-Worker",
    "environment": "sandbox",
    "scopes": ["payments:create", "mandates:read", "traces:read"]
  }
  ```
  Response:
  ```json
  {
    "key": {
      "id": "key-sbx-02",
      "name": "Travel Concierge Micro-Worker",
      "keyPrefix": "pg_test_4b22",
      "secret": "pg_test_4b2210ef3998a41",
      "secretMasked": "pg_test_4b22••••••••••••••••••••8a41",
      "environment": "sandbox",
      "scopes": ["payments:create", "mandates:read", "traces:read"],
      "createdAt": "2026-11-01T20:50:00Z",
      "status": "active"
    }
  }
  ```
- `POST /v1/api-keys/:id/rotate`: Invalidates old secret and returns new secret token.
- `POST /v1/api-keys/:id/revoke`: Permanently invalidates credential.

### G5. Model Context Protocol Server Endpoint (`POST /v1/mcp`)
Standard MCP JSON-RPC 2.0 endpoint handling:
- `initialize` (protocol version `2024-11-05` / `1.4.0`, capabilities).
- `tools/list` (returning gateway tools: `payguardian_request_budget`, `payguardian_execute_payment`, `payguardian_delegate_mandate`, `payguardian_query_balance`, `payguardian_check_policy`).
- `tools/call` (invoking protected actions with mandate evaluation).
