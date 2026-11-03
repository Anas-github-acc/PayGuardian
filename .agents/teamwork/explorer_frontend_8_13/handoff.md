# Handoff Report: Frontend Audit for Screens 8 through 13

**Agent**: `explorer_frontend_8_13`  
**Parent Conversation ID**: `57971ad2-470f-4720-8adb-764093659599`  
**Working Directory**: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_frontend_8_13/`  
**Report Artifact**: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_frontend_8_13/report.md`  
**Target Screens**: 8 (Approvals), 9 (Payment trace), 10 (Mandates), 11 (Audit grid), 12 (Security), 13 (Developers)

---

## 1. Observation

1. **Dashboard Route & Navigation Wiring**:
   - `apps/web/app/dashboard/page.tsx:93-154`: `UnifiedDashboard` dispatches views based on `activeTab` and `subTab` (`useDashboardNavigation` in `apps/web/app/lib/navigation.ts:50-78`).
   - Line 104-110: `case "approvals": return <ApprovalsInbox onViewTrace={handleViewTrace} onAmendLimit={() => navigateTab("tables", "policies")} />;`
   - Line 112-113: `case "traces": return <PaymentTraceView onClose={handleCloseTrace} />;`
   - Line 125-130: `case "tables": subTab === "mandates"` renders `<MandatesTable onViewTrace={handleViewTrace} onRevokeMandate={() => navigateTab("security")} />`
   - Line 131: `subTab === "activity"` renders `<ActivityAuditTable onViewTrace={handleViewTrace} />`
   - Line 137-138: `case "security": return <SecurityCenter onViewTrace={handleViewTrace} />;`
   - Line 143-144: `case "developer": return <DeveloperPortal />;`

2. **Hardcoded Fixture Arrays & Dictionaries**:
   - `apps/web/components/approvals/types.ts:41-184`: `DEFAULT_APPROVALS` holds 4 complete approval records (`appr-flight-901` $650, `appr-hotel-902` $4,500, `appr-sim-903` $85, `appr-reject-904` $1,200).
   - `apps/web/components/traces/types.ts:79-572`: `DEFAULT_TRACES` holds 3 full traces (`trace-pay-9018` $245, `trace-rej-7712` $5,000, `trace-pend-4401` $380) including 4-node auth chain, 5 lifecycle stages with ms latencies, and 5-point verification checklist.
   - `apps/web/components/tables/types.ts:54-150`: `DEFAULT_MANDATES` holds 5 mandate fixtures (`man-root-9081` $10,000, `man-travel-4001` $4,000, `man-hotel-4002` $4,000, `man-booking-gw-4003` $2,000, `man-flights-unfunded-4004` $0).
   - `apps/web/components/tables/types.ts:152-253`: `DEFAULT_ACTIVITY_EVENTS` holds 5 audit event fixtures (`evt-01` to `evt-05`).
   - `apps/web/components/security/types.ts:29-102`: `DEFAULT_SECURITY_EVENTS` holds 5 incident fixtures (`sec-evt-01` to `sec-evt-05`).
   - `apps/web/components/developer/types.ts:26-60`: `DEFAULT_API_KEYS` holds 3 fake keys (`pg_live_8f91...`, `pg_test_4b22...`, `pg_test_90cc...`).
   - `apps/web/components/developer/types.ts:62-88`: `DEFAULT_MCP_TOOLS` holds 5 fake tool schemas (`payguardian_request_budget`, `payguardian_execute_payment`, `payguardian_delegate_mandate`, `payguardian_query_balance`, `payguardian_check_policy`).

3. **Event Timers & Synthetic State**:
   - `apps/web/components/approvals/ApprovalCard.tsx:79`: `const interval = setInterval(updateCountdown, 1000);` running every second.
   - `apps/web/components/tables/ActivityAuditTable.tsx:116-162`: `setInterval(..., 3000)` running every 3 seconds for live polling.
   - `apps/web/components/security/EmergencyControls.tsx:47, 64`: `setTimeout(() => setFeedbackMessage(null), 5000)` feedback clear timer.
   - `apps/web/components/developer/ConnectionTester.tsx:45`: `useState<ProbeResult>({ ok: true, latencyMs: 14 })` hardcoding online status; line 61 probes `${API_BASE}/v1/environments` instead of `/v1/mcp`.
   - `apps/web/components/developer/KeyManager.tsx:57`: Local random hex key generation: `Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10)` with zero backend persistence.

4. **Fixture Merging / Prepending**:
   - `apps/web/components/approvals/ApprovalsInbox.tsx:92-94`: `const missing = DEFAULT_APPROVALS.filter((d) => !mapped.some((m) => m.id === d.id)); setApprovals([...mapped, ...missing]);`
   - `apps/web/components/tables/MandatesTable.tsx:86-87`: `const missing = DEFAULT_MANDATES.filter((d) => !mapped.some((m) => m.id === d.id)); setMandates([...mapped, ...missing]);`
   - `apps/web/components/tables/ActivityAuditTable.tsx:94-96`: `const missing = DEFAULT_ACTIVITY_EVENTS.filter((d) => !mapped.some((m) => m.id === d.id)); const combined = [...mapped, ...missing]; setEvents(combined);`

5. **Client-Side Calculations**:
   - `apps/web/components/tables/MandatesTable.tsx:65`: `const availableMinor = Math.max(0, budgetLimitMinor - allocatedMinor - spentMinor - reservedMinor);`
   - `apps/web/components/security/RevocationDialog.tsx:39-40`: `requiresInputMatch = impact.cascadeAgentsCount > 1; isInputValid = !requiresInputMatch || confirmInput.trim().toUpperCase() === "REVOKE";`

---

## 2. Logic Chain

1. **Premise**: Frontend components require real backend APIs to graduate from a prototype to production.
2. **Step 1 (Approvals)**: `ApprovalsInbox.tsx` calls `GET /v1/environments/:id/approvals`, but backend `Approval` (`apps/api/src/phase4.ts:6-21`) contains only 13 raw fields. The UI expects 25 fields (missing agent name, role, purpose, merchant, remaining headroom, hard limit flags, expiration, ancestor chain, parameters). Therefore, Screen 8 is `PARTIAL` and needs backend expansion.
3. **Step 2 (Payment Trace)**: `PaymentTraceView.tsx` executes zero API calls, reading from `DEFAULT_TRACES`. Backend `GET /v1/environments/:id/actions/:actionId/trace` (`phase3-routes.ts:487`) only provides `{ action, agent, mandateChain, rootMandate }`. It lacks execution stages, ms latencies, and verification matrices. Therefore, Screen 9 is `PARTIAL` to `MISSING`.
4. **Step 3 (Mandates)**: `MandatesTable.tsx` calls `GET /v1/environments/:id/mandates`. The backend returns raw `Mandate` entities without resolved agent names or parent agent names, and available balance is computed on the client. Therefore, Screen 10 is `PARTIAL`.
5. **Step 4 (Audit Grid)**: `ActivityAuditTable.tsx` calls `GET /v1/environments/:id/activity?since=&limit=` with cursor pagination and 3s polling. The core API exists (`FOUND`), needing minor property extraction (`actorName`, `amountMinor`).
6. **Step 5 (Security)**: `SecurityCenter.tsx` calls `pause`, `resume`, `revoke`, and `revocations` endpoints (`FOUND`). However, revocation cascade impact calculations and security violation feeds are completely fabricated on the client (`MISSING`).
7. **Step 6 (Developers)**: `DeveloperPortal.tsx` specifies `/v1/mcp` and API key operations. Neither the `/v1/mcp` route nor API key management exists anywhere in the repository (`MISSING`).

---

## 3. Caveats

- **No Code Modifications**: Per strict instructions, no files outside the agent's teamwork folder were altered or created.
- **Backend Service Context**: The Python agent-runtime (`apps/agent-runtime`) exposes `/run`, `/health`, `/agents`, and `/tools`, but does not implement MCP JSON-RPC 2.0 at `/v1/mcp`.
- **Policy Editing Scope**: `PoliciesTable.tsx` is accessible via `/dashboard?tab=tables&sub=policies` (and linked from Approvals "Amend Limit"). It edits policies purely in local component state (`apps/web/components/tables/PoliciesTable.tsx:39-51`) without backend persistence.

---

## 4. Conclusion

The Next.js frontend for Screens 8 through 13 is highly polished visually, but relies on pervasive client fixtures and mock prepending to maintain its appearance. To integrate with real backend services:
1. **Screen 8 (Approvals)**: Enrich `GET /v1/environments/:id/approvals` with agent metadata, action parameters, and ancestor hierarchy.
2. **Screen 9 (Payment Trace)**: Implement a composite trace endpoint providing the 5 execution stages, latencies, and 5-point verification matrix.
3. **Screen 10 (Mandates)**: Join agent names and parent names in `GET /v1/environments/:id/mandates` and provide server-computed `availableMinor`.
4. **Screen 11 (Audit Grid)**: Ensure `actorName` resolution and top-level amounts in `GET /v1/environments/:id/activity`.
5. **Screen 12 (Security)**: Add a dry-run revocation impact preview endpoint (`/v1/mandates/:id/revocation-impact`) and security event stream.
6. **Screen 13 (Developers)**: Implement the `/v1/mcp` JSON-RPC server and an API key management service (`/v1/api-keys`).

---

## 5. Verification Method

To independently verify these findings, inspect the following exact locations and run the project test commands:

1. **Verify Routes in Dashboard**:
   ```bash
   grep -n "case \"" apps/web/app/dashboard/page.tsx
   ```
2. **Verify Hardcoded Mock Fixtures**:
   - `apps/web/components/approvals/types.ts:41` (`DEFAULT_APPROVALS`)
   - `apps/web/components/traces/types.ts:79` (`DEFAULT_TRACES`)
   - `apps/web/components/tables/types.ts:54` (`DEFAULT_MANDATES`)
   - `apps/web/components/tables/types.ts:152` (`DEFAULT_ACTIVITY_EVENTS`)
   - `apps/web/components/security/types.ts:29` (`DEFAULT_SECURITY_EVENTS`)
   - `apps/web/components/developer/types.ts:26` (`DEFAULT_API_KEYS`)
   - `apps/web/components/developer/types.ts:62` (`DEFAULT_MCP_TOOLS`)
3. **Verify Fixture Merging in Frontend**:
   - `apps/web/components/approvals/ApprovalsInbox.tsx:93`
   - `apps/web/components/tables/MandatesTable.tsx:86`
   - `apps/web/components/tables/ActivityAuditTable.tsx:95`
4. **Verify MCP Endpoint Absence**:
   ```bash
   rg "/v1/mcp" apps/
   ```
   (Only appears in frontend files `DeveloperPortal.tsx`, `ConnectionTester.tsx`, `CodeSnippet.tsx`).
5. **Run Existing Tests**:
   ```bash
   pnpm test:run
   ```
