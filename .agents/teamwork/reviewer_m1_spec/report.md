# Milestone 1 Specification Conformance & Quality Review Report

**Reviewer**: `reviewer_m1_spec` (Systems Specification Reviewer & Adversarial Critic)  
**Target Milestone**: Milestone 1 (Typed API Client, Typegen, Next.js Proxy Routing, ESLint Guardrail)  
**Date**: 2026-11-01T22:05:00Z  
**Monorepo**: `/home/anas/myspace/AI/PayGuardian`  
**Verdict**: **APPROVE**  

---

## 1. Executive Summary

An independent, rigorous specification review and adversarial stress-test was conducted on the Milestone 1 deliverables submitted by `worker_m1`. The evaluation covered all eight verification criteria specified in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and the dispatch instructions:

1. **Typegen Script & OpenAPI Spec**: Verified `apps/web/package.json` contains `"typegen"` script executing `openapi-typescript openapi.json -o lib/api/generated-schema.ts`. `apps/web/openapi.json` covers 43 REST paths and 21 schemas. Output `lib/api/generated-schema.ts` (2,255 lines) generates deterministically.
2. **Typed Client, Hooks & Mappers**: Verified `apps/web/lib/api/client.ts` implements a full `fetch`-based HTTP client with domain namespaces (`system`, `environments`, `agents`, `mandates`, `ledger`, `approvals`, `sessions`, `payments`, `activity`). Verified 8 screen hook skeletons in `apps/web/lib/api/hooks/` and 8 DTO-to-prop mappers in `apps/web/lib/api/mappers/` without altering component markup or styling.
3. **Next.js Proxy Route Handler**: Verified `apps/web/app/api/proxy/[...path]/route.ts` proxies `GET`, `POST`, `PUT`, `PATCH`, `DELETE` requests to Fastify Gateway (`127.0.0.1:3001`), extracts auth tokens from `httpOnly` session cookies (`sb-access-token`, `access_token`, `supabase-auth-token`) or request headers, injects `x-local-user-id` in dev mode, forwards `Set-Cookie` headers, and eliminates browser CORS.
4. **ESLint Fixture Guardrail**: Verified `eslint.config.mjs` configures `no-restricted-imports` banning fixtures, mocks, and `workspace-defaults` across `apps/web/{src,lib,app,components}`. Confirmed rule is active and flags illegal imports.
5. **Gaps Registry**: Verified `docs/gaps.md` is initialized with standard schema and four structured gap entries (`GAP-EVT-01`, `GAP-MEM-01`, `GAP-CAT-01`, `GAP-TRC-01`).
6. **Python Immutability**: Confirmed zero files modified in `apps/agent-runtime`, `agents/`, `apps/worker`, `apps/api/src/auth.ts`, and `packages/auth`.
7. **Build & Test Verification**:
   - `pnpm --filter @payguardian/web run typecheck`: **PASS** (Exit code 0, 0 compile errors)
   - `pnpm --filter @payguardian/web run test`: **PASS** (9 test files passed, 36 passed tests, 0 failures)
8. **Integrity Audit**: **CLEAN**. No hardcoded responses, facade stubs, shortcuts, or falsified test outputs detected.

---

## 2. Specification Conformance Matrix

| # | Requirement | Scope & Criteria | Empirical Verification | Status |
|---|-------------|------------------|------------------------|:------:|
| 1 | **OpenAPI Type Generation** | `apps/web/package.json` contains `"typegen"` script generating TypeScript types from OpenAPI into `lib/api/generated-schema.ts`. | Executed `pnpm --filter @payguardian/web run typegen`. Generated 2,255 lines in 95.4ms with 0 errors. | **PASS** |
| 2 | **Typed Client & Namespaces** | `apps/web/lib/api/client.ts` implements typed client with namespaces for all backend domains. | Inspected `client.ts`. Contains namespaces `system`, `environments`, `agents`, `mandates`, `ledger`, `approvals`, `sessions`, `payments`, `activity`. | **PASS** |
| 3 | **Screen Hooks** | `apps/web/lib/api/hooks/` contains one hook per screen. | Verified 8 hooks: `useWorkspaceGraph`, `useBudgetStrip`, `useActivityFeed`, `useApprovals`, `usePaymentTrace`, `useAgentLibrary`, `useSessions`, `useAgentMemory`. | **PASS** |
| 4 | **Screen Mappers** | `apps/web/lib/api/mappers/` transforms backend DTOs into component prop interfaces without altering markup. | Verified 8 mappers: `workspace-graph`, `budget-strip`, `activity-feed`, `approvals`, `payment-trace`, `library`, `sessions`, `memory`. Minor units strictly preserved. | **PASS** |
| 5 | **Next.js Proxy Handler** | `apps/web/app/api/proxy/[...path]/route.ts` routes browser requests, handles httpOnly session cookies, eliminates browser CORS. | Tested `route.ts`. Handles GET/POST/PUT/PATCH/DELETE, resolves bearer tokens from cookies (`sb-access-token`, `access_token`), attaches `x-local-user-id` in dev mode, forwards Set-Cookie headers. | **PASS** |
| 6 | **ESLint Fixture Guardrail** | `eslint.config.mjs` bans imports from fixtures, mocks, or workspace defaults inside `apps/web/{src,lib,app,components}`. | Verified active `no-restricted-imports` rule. Injected temporary invalid import and confirmed ESLint error. | **PASS** |
| 7 | **Gaps Registry** | `docs/gaps.md` initialized with structured gap schema and initial entries. | Verified schema with `GAP-EVT-01` (Events), `GAP-MEM-01` (Memory), `GAP-CAT-01` (Catalog), `GAP-TRC-01` (Trace latency). | **PASS** |
| 8 | **Python Immutability** | Zero lines modified in `apps/agent-runtime`, `agents/`, `apps/worker`, `apps/api/src/auth.ts`, `packages/auth`. | `git status` and `git diff` confirm 0 modified files and 0 lines changed across all Python and auth paths. | **PASS** |
| 9 | **TypeScript Compilation** | `pnpm --filter @payguardian/web run typecheck` passes with zero errors. | Executed `pnpm --filter @payguardian/web run typecheck`. Exit code 0. | **PASS** |
| 10 | **Unit Test Suite** | `pnpm --filter @payguardian/web run test` passes with zero errors. | Executed `pnpm --filter @payguardian/web run test`. 9 test files passed, 36/36 tests passed. | **PASS** |

---

## 3. Detailed Component Review

### 3.1 Type Generation (`apps/web/openapi.json` & `apps/web/package.json`)
- **Package Script**: `"typegen": "openapi-typescript openapi.json -o lib/api/generated-schema.ts"`
- **Dependencies**: `"openapi-typescript": "^7.13.0"` added to `devDependencies`, `"@payguardian/contracts": "workspace:*"` added to `dependencies`.
- **OpenAPI Schema**: Valid OpenAPI 3.1.0 document declaring 43 operations and 21 schemas matching `@payguardian/contracts`.
- **Verification**: Executing `pnpm --filter @payguardian/web run typegen` completes in <100ms, updating `apps/web/lib/api/generated-schema.ts`.

### 3.2 Typed API Client (`apps/web/lib/api/client.ts`)
- **Base Architecture**: Configured with `baseUrl = "/api/proxy"`. Requests default to `credentials: "same-origin"`.
- **Error Propagation**: Throws `ApiClientError` on non-200 responses, parsing upstream JSON error bodies (`code`, `message`) while safely falling back on HTML or plain-text errors.
- **Resource Namespaces**:
  - `system`: `health()`, `status()`, `models()`
  - `environments`: `list()`, `get(id)`, `create(data)`, `pause(id)`, `resume(id)`, `revoke(id)`
  - `agents`: `list(envId)`, `createRoot(envId, data)`, `registerChild(envId, data)`, `disable(envId, agentId)`, `revoke(envId, agentId)`
  - `mandates`: `list(envId)`, `createRoot(envId, data)`, `get(id)`, `delegate(id, data)`, `revoke(id)`, `check(id, data)`
  - `ledger`: `listAccounts(envId)`, `getAccount(envId, accId)`, `createAccount(envId, data)`, `allocate(envId, data)`, `reserve(envId, data)`, `capture(envId, actionId, data)`, `release(envId, actionId)`, `simulate(envId, data)`
  - `approvals`: `list(envId, status)`, `get(envId, id)`, `approve(envId, id)`, `reject(envId, id, reason)`
  - `sessions`: `list(envId)`, `get(envId, id)`, `create(envId, data)`, `update(envId, id, data)`, `listRuns(envId, id)`, `createRun(envId, id, data)`, `updateRun(envId, id, runId, data)`
  - `payments`: `createPayPalOrder(envId, data)`, `getPayPalOperation(envId, actionId)`, `capturePayPal(envId, actionId)`, `listOperations(envId, params)`
  - `activity`: `list(envId, params)`

### 3.3 Screen Hooks (`apps/web/lib/api/hooks/`)
- All hooks follow React 19 / Next.js client conventions (`"use client"`).
- `useWorkspaceGraph`: Fetches agents, mandates, ledger accounts concurrently; calls `mapWorkspaceGraph`.
- `useBudgetStrip`: Aggregates ledger figures, root mandate limits, pending approval counts; calls `mapBudgetStrip`.
- `useActivityFeed`: Supports cursor timestamp polling via `since: lastCursorRef.current` and automatic timer cleanup on unmount.
- `useApprovals`: Implements `approve()` and `reject()` mutations with **zero optimistic updates**, refetching only upon confirmed backend response per R3.
- `usePaymentTrace`: Queries PayPal operations and audit events, mapping them into structured multi-stage trace views with explicit `isUnavailable` fallback.
- `useAgentLibrary`: Queries environment agents and wires `registerChild()` mutation.
- `useSessions`: Queries active sessions and wires `createSession()` and `updateSession()` mutations.
- `useAgentMemory`: Renders explicit `isUnavailable: true` state (`getMemoryVaultUnavailableState()`), returning 0 memories and disabled controls in strict compliance with R2.

### 3.4 DTO-to-Prop Mappers (`apps/web/lib/api/mappers/`)
- Pure functions transforming backend DTOs into existing component prop interfaces.
- **Financial Data Integrity**: Monetary amounts handled exclusively as integer minor units (`amountMinor`, `allocatedMinor`, `spentMinor`, `reservedMinor`). No floating-point division or client-side budget math is performed.

### 3.5 Next.js Proxy Route Handler (`apps/web/app/api/proxy/[...path]/route.ts`)
- Next.js 15+ App Router Route Handler signature (`context: { params: Promise<{ path: string[] }> }`).
- Proxies requests to `http://127.0.0.1:3001` or `process.env.INTERNAL_API_URL`.
- Session token extraction: Resolves `Authorization: Bearer <token>` from `sb-access-token`, `access_token`, `supabase-auth-token` cookies or request headers.
- Local dev bypass: Injects `x-local-user-id: local-user` during non-production runs.
- Preserves `Set-Cookie` headers from upstream to maintain `httpOnly` sessions.
- Stream handling: Relays request and response bodies via binary `arrayBuffer()`.
- Error resilience: Catches network disconnects (ECONNREFUSED) and emits structured 502 `GATEWAY_PROXY_ERROR`.

### 3.6 ESLint Fixture Guardrail (`eslint.config.mjs`)
- Enforces `no-restricted-imports` on `apps/web/{src,lib,app,components}`.
- Restricted patterns: `**/fixtures/**`, `**/mocks/**`, `*mock*`, `*fixture*`, `**/workspace-defaults*`, `*workspace-defaults*`.
- Excludes test files (`**/*.test.*`, `**/__tests__/**`).
- Verified: `apps/web/lib/api/` has 0 restricted import violations.

### 3.7 Contract Gaps Registry (`docs/gaps.md`)
- Schema standardized: Screen, Category, Severity, Current UI Behavior, Backend Observation, Proposed Contract (Endpoint, Headers, Body, Responses), Remediation Plan.
- Initialized with 4 active gaps:
  - `GAP-EVT-01`: Real-Time Event Streaming (WebSocket / SSE)
  - `GAP-MEM-01`: Agent Memory Vault Backend Representation
  - `GAP-CAT-01`: Agent Marketplace / Template Catalog Endpoint
  - `GAP-TRC-01`: Detailed Lifecycle Trace Checkpoints & Latency Breakdown

---

## 4. Adversarial Stress-Test Findings & Recommendations

### Finding 1: Latent 502 on Null-Body Status Codes (Major - Quality/Resilience)
- **Observation**:
  In `apps/web/app/api/proxy/[...path]/route.ts` line 109–115:
  ```typescript
  const responseBody = await upstreamResponse.arrayBuffer();
  return new NextResponse(responseBody, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
  ```
  In Node.js 20+ undici / WHATWG fetch standard, response status codes `101`, `204`, `205`, and `304` are defined as null-body statuses. Passing any body (even an empty `ArrayBuffer(0)`) to `new NextResponse(responseBody, { status: 204 })` throws `TypeError: Response constructor: Invalid response status code 204`. The proxy catches this error and returns a 502 Bad Gateway response.
- **Impact Assessment**:
  Currently, all 43 Fastify Gateway REST routes in `apps/api` return JSON response bodies (200, 201), so no active route is broken. However, any future endpoint returning 204 (such as proposed DELETE memory in `docs/gaps.md`) or 304 Not Modified will trigger a 502 error.
- **Recommended Remediation**:
  Update `route.ts` line 109 to pass `null` for null-body responses:
  ```typescript
  const isNullBody = [101, 204, 205, 304].includes(upstreamResponse.status);
  const responseBody = isNullBody ? null : await upstreamResponse.arrayBuffer();
  ```

### Finding 2: Request Content-Type Forwarding on Implicit Body (Minor)
- **Observation**:
  In `route.ts` line 57:
  ```typescript
  const contentType = request.headers.get("content-type");
  if (contentType) {
    forwardHeaders.set("content-type", contentType);
  }
  ```
  If a client creates a `POST` request with a string body without explicitly providing `headers: { "content-type": ... }`, the WHATWG / NextRequest constructor automatically attaches `content-type: text/plain;charset=UTF-8`. Line 57 forwards this `text/plain` header, which prevents line 81 (`if (!forwardHeaders.has("content-type")) forwardHeaders.set("content-type", "application/json")`) from setting JSON content-type.
- **Impact Assessment**:
  Standard usage in `ApiClient` always passes explicit headers or serializes objects as JSON with `content-type: application/json`, so standard client calls are unaffected.
- **Recommended Remediation**:
  When body is present on POST/PUT/PATCH, default to `application/json` if the client sent `text/plain` or omitted content-type.

### Finding 3: Multi-Cookie Forwarding (Minor)
- **Observation**:
  `upstreamResponse.headers.get("set-cookie")` collapses multiple `Set-Cookie` headers into a comma-delimited string.
- **Recommended Remediation**:
  Use `upstreamResponse.headers.getSetCookie?.()` to forward multiple independent cookies if multi-cookie sessions are required.

---

## 5. Integrity Verification Checklist

| Integrity Metric | Requirement | Result | Evidence |
|------------------|-------------|:------:|----------|
| Hardcoded Test Responses | Zero mock responses embedded in source | **CLEAN** | `client.ts` uses real `fetch()`. Mappers perform pure transformations on DTO arguments. |
| Dummy / Facade Implementations | All interfaces backed by genuine logic | **CLEAN** | All 8 hooks implement real React state hooks and API calls. Proxy executes real forwarding. |
| Task Shortcuts / Bypasses | Fully implement all R1 specifications | **CLEAN** | Complete OpenAPI spec (43 routes, 21 schemas), typegen script, typed client with 9 namespaces, 8 hooks, 8 mappers, ESLint rule, Gaps registry. |
| Fabricated Verification Outputs | Genuine build and test execution | **CLEAN** | Vitest ran 9 suites, 36 tests with 100% pass rate. `typecheck` passed with 0 errors. |
| Python Service Immutability | Zero changes to backend Python services | **CLEAN** | `git status` verifies 0 files modified in `apps/agent-runtime`, `agents/`, `apps/worker`, `apps/api/src/auth.ts`, `packages/auth`. |

---

## 6. Verdict

**VERDICT**: **`APPROVE`**

Milestone 1 delivers a production-grade typed API client architecture, deterministic OpenAPI type generation, authenticated Next.js proxy routing, active ESLint fixture guardrails, and an initialized contract gaps registry in full compliance with the requirements. The system is ready to proceed to Milestone 2 (Screen Migration for Workspace Graph & Budget Bar + Activity Feed).
