# Milestone 5 Independent Review & Adversarial Critique Report

**Reviewer**: `reviewer_m5_verify`  
**Date**: 2026-11-01T23:45:00Z  
**Verdict**: **APPROVE**  
**Integrity Status**: **VERIFIED CLEAN (0 Integrity Violations)**

---

## 1. Executive Summary

Milestone 5 encompasses the End-to-End integration test, workspace validation suite, deterministic OpenAPI type generation, fixture import bans, legacy fixture deletion, contract gaps registry completeness, and Python immutability constraints.

An independent audit and adversarial stress test was conducted across all workspace packages and source files. All validation commands were executed independently. The findings confirm that the system meets all acceptance criteria with high architectural fidelity, zero facade implementations, and full test suite validation.

---

## 2. Quality Review

### 2.1 Correctness & Requirement Compliance

| Requirement | Acceptance Criteria | Verified Result | Status |
|-------------|---------------------|-----------------|--------|
| **R1: OpenAPI Typegen & Routing** | `pnpm --filter @payguardian/web run typegen` produces zero drift; Next.js Proxy route handler forwards requests without browser CORS; 0 lines modified in Python services. | `typegen` generated `lib/api/generated-schema.ts` with 0 diff; Next.js proxy route handler (`app/api/proxy/[...path]/route.ts`) verified; `git diff` against Python and auth services is completely empty. | **PASS** |
| **R2: Screen Migration & Fixtures** | All 8 target screens migrated to live API hooks; all 12 legacy fixtures completely deleted from `apps/web/`; missing backend capabilities rendered as explicit "unavailable" containers and catalogued in `docs/gaps.md`. | `git grep` for all 12 fixtures returned 0 occurrences across `apps/web/`; `docs/gaps.md` contains 6 complete gap specifications; explicit unavailable states in Memory, Catalog, Trace, and Spend analytics verified. | **PASS** |
| **R3: Mutations & Financial Integrity** | Actions call real backend commands; no optimistic updates for money, authority, or approvals; integer minor units preserved; client-side budget math removed in favor of `allowed_actions`. | `e2e-backend-mutation.test.ts` verified Scenario 1 (revocation) and Scenario 2 (approval) update strictly on confirmed HTTP responses; integer minor units (`24599` = $245.99) tested and preserved without float distortion; `allowedActions` verified. | **PASS** |
| **R4: Live Updates & UI Resilience** | Short polling fallback active with gap documented in `docs/gaps.md`; loading skeletons, empty states, and error states with retry implemented matching container dimensions. | `GAP-EVT-01` documented in `docs/gaps.md`; skeleton loaders, empty states, and error retries verified in `AgentLibrary`, `PaymentTraceView`, `sessions-memory`, `overview`, and `approvals`. | **PASS** |
| **R5: Guardrails & Test Validation** | ESLint rule bans fixture/mock imports; E2E integration test executes backend mutations and asserts UI reflection; `typecheck`, `test`, `lint` in `apps/web` pass with 0 errors. | ESLint `no-restricted-imports` rule verified with active violation test; E2E test passes 4/4 scenarios; `typecheck`, `test` (56/56), `lint` (0 errors, 0 warnings), and monorepo `pnpm test` (111/111) pass cleanly. | **PASS** |

### 2.2 Independent Verification Results

1. **TypeScript Typecheck (`pnpm --filter @payguardian/web run typecheck`)**:
   - Command: `tsc --noEmit`
   - Exit code: `0`
   - Diagnostic output: `0 errors`
2. **Web Package Test Suite (`pnpm --filter @payguardian/web run test`)**:
   - Command: `vitest run --passWithNoTests --exclude 'dist/**'`
   - Test Files: `12 passed (12)`
   - Tests: `56 passed (56)`
   - Exit code: `0`
3. **Web Package Lint Suite (`pnpm --filter @payguardian/web run lint`)**:
   - Command: `eslint .`
   - Diagnostic output: `0 errors, 0 warnings`
   - Exit code: `0`
4. **Workspace-Wide Test Suite (`pnpm test`)**:
   - Command: `pnpm -r --if-present test`
   - Scope: 11 of 12 workspace projects (`apps/web`, `apps/api`, `apps/worker`, `packages/*`)
   - Test Files: `25 passed (25)`
   - Tests: `111 passed (111)`
   - Exit code: `0`
5. **Deterministic OpenAPI Type Generation**:
   - Command: `pnpm --filter @payguardian/web run typegen`
   - Follow-up: `git diff apps/web/lib/api/generated-schema.ts`
   - Output: Empty (0 lines of drift)
6. **ESLint Fixture Import Ban Validation**:
   - Dynamic Node execution testing restricted import `'./fixtures'`:
   - Output: `Restricted import violation count: 1`
   - Rule message: `"Imports from fixtures, mocks, or workspace-defaults are banned. Use real backend API clients and mappers."`
7. **Deleted Fixture Verification**:
   - Command: `git grep -E "DEFAULT_GRAPH_NODES|DEFAULT_GRAPH_EDGES|SPEND_SERIES|AGENT_AUTHORITY|INITIAL_ACTIVITIES|DEFAULT_ACTIVITY_EVENTS|DEFAULT_APPROVALS|DEFAULT_TRACES|CATALOG_AGENTS|INITIAL_SESSIONS|INITIAL_MEMORIES|DEFAULT_CHAT_MESSAGES" apps/web/`
   - Exit code: `1` (0 occurrences found)
8. **Python & Auth Immutability Verification**:
   - Command: `git diff HEAD -- apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth`
   - Output: Empty (0 lines modified)

---

## 3. Adversarial Review & Attack Surface Analysis

### Challenge 1: E2E Integration Test Fidelity & Mock Facades
- **Hypothesis**: The E2E integration test might use a stubbed HTTP interceptor or return canned responses rather than testing the real proxy and mapper pipeline.
- **Investigation**: Inspected `apps/web/lib/api/__tests__/e2e-backend-mutation.test.ts`. The test instantiates a genuine Node.js HTTP server (`node:http`) listening on ephemeral port `127.0.0.1:0`. Global `fetch` is hooked to route `/api/proxy/*` requests through the actual Next.js Route Handler (`apps/web/app/api/proxy/[...path]/route.ts`).
- **Mutation Verification**:
  - Scenario 1 mutates an in-memory `AgentDto` status to `"revoked"`, pushes an audit event to server state, and queries via `client.agents.list()`. The resulting DTO is fed into `mapWorkspaceGraph()`, which dynamically computes `isAuthorized: false` and `status: "revoked"`.
  - Scenario 2 mutates an `ApprovalDto` status to `"approved"`, which updates `mapApprovalsToItems()` resulting in `allowedActions: []`.
  - Scenario 3 tests integer minor units (`24599` = $245.99) submitted via HTTP POST, persisted, and read back without float truncation.
  - Scenario 4 verifies that an invalid agent revocation returns HTTP 404 `ApiClientError` with code `AGENT_NOT_FOUND` and leaves server state untouched.
- **Verdict**: **ROBUST**. Real network communication, real Next.js proxy route handler execution, real mapper evaluation, and genuine negative boundary handling.

### Challenge 2: Next.js Proxy Route Handler Environment Variable Leakage
- **Hypothesis**: If `INTERNAL_API_URL` is statically evaluated at module load time, tests running on dynamic loopback ports or deployment environments with runtime configs could fail or send requests to the default `http://127.0.0.1:3001`.
- **Investigation**: Inspected `apps/web/app/api/proxy/[...path]/route.ts`. The implementation uses a dynamic getter `getInternalApiUrl()` (lines 3–10) evaluated per request:
  ```typescript
  function getInternalApiUrl(): string {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://127.0.0.1:3001"
    );
  }
  ```
- **Verdict**: **RESILIENT**. Adapts dynamically to environment changes in test, CI, and serverless runtime.

### Challenge 3: Financial Precision & Minor Unit Leakage
- **Hypothesis**: Client code might perform floating-point budget calculations or roundtrip monetary values through division before persisting.
- **Investigation**: Grepped the entirety of `apps/web/` for division by 100 (`/ 100`). Found 12 occurrences across 8 files: all occurrences are strictly in leaf display formatting (`(amountMinor / 100).toFixed(2)` or input rendering). Domain DTOs, API payloads, state stores, and mappers consistently treat currency values as integer minor units (`allocatedMinor`, `spentMinor`, `reservedMinor`, `budgetLimitMinor`, `amountMinor`).
- **Verdict**: **COMPLIANT**. Zero client-side financial math; strict minor integer representation throughout the stack.

### Challenge 4: Absence of Fake Data / Contract Gaps Coverage
- **Hypothesis**: The frontend might invent fallback data when backend endpoints are missing (e.g. fabricating fake memories or synthetic 5-stage trace latencies).
- **Investigation**: Verified `docs/gaps.md` and UI components.
  - Memory vault (`GAP-MEM-01`): Renders explicit `"Memory Vault Unavailable"` container with disabled actions; `INITIAL_MEMORIES` fixture deleted.
  - Agent template catalog (`GAP-CAT-01`): Renders explicit `"Agent Catalog Unavailable"` container referencing `GAP-CAT-01`; `CATALOG_AGENTS` deleted.
  - Payment trace latency breakdown (`GAP-TRC-01`): `LifecycleTimeline` and `VerificationChecklist` render explicit unavailable containers citing `GAP-TRC-01`.
  - Spend velocity analytics (`GAP-SPEND-01`): `SpendChart` renders explicit unavailable placeholder container.
- **Verdict**: **COMPLIANT**. Zero invented data; all 6 contract gaps documented with complete request/response schemas.

---

## 4. Integrity Violation Check

Per instructions, the following checks were performed:
1. **Hardcoded test results or expected outputs embedded in source code**: **NONE FOUND**.
2. **Dummy or facade implementations that look correct but implement no real logic**: **NONE FOUND**.
3. **Shortcuts that bypass the intended task**: **NONE FOUND**.
4. **Fabricated verification outputs, logs, or attestation artifacts**: **NONE FOUND**.
5. **Evidence of self-certifying work without genuine independent verification**: **NONE FOUND**.

---

## 5. Review Findings & Verdict

- **Critical Findings**: 0
- **Major Findings**: 0
- **Minor Observations**: 0

**Final Verdict**: **APPROVE**
