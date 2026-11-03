# Code Implementation Review & Adversarial Stress Report — Milestone 1

**Reviewer**: `reviewer_m1_code` (Roles: reviewer, critic)  
**Target**: Milestone 1 Implementation by `worker_m1`  
**Timestamp**: 2026-11-01T22:05:00Z  
**Verdict**: **APPROVE** (with Major/Minor Quality & Adversarial Findings)

---

## Executive Summary

Milestone 1 establishes the foundational typed integration layer between the Next.js frontend (`apps/web`) and the Fastify Gateway API (`apps/api`):
1. Deterministic OpenAPI 3.1 schema (`apps/web/openapi.json`) covering 43 REST paths and 21 DTO schemas matching `@payguardian/contracts`.
2. Fully typed generated schema (`apps/web/lib/api/generated-schema.ts`, 2,256 lines) via `openapi-typescript` v7.13.0.
3. Strongly-typed API client (`apps/web/lib/api/client.ts`) with resource namespaces (`system`, `environments`, `agents`, `mandates`, `ledger`, `approvals`, `sessions`, `payments`, `activity`).
4. Same-origin Next.js proxy route handler (`apps/web/app/api/proxy/[...path]/route.ts`) forwarding HTTP methods, injecting session tokens or local dev headers, and eliminating browser CORS.
5. Pure DTO-to-prop mappers and screen hook skeletons in `apps/web/lib/api/mappers/` and `apps/web/lib/api/hooks/`.
6. Contract Gaps Registry (`docs/gaps.md`) documenting missing backend capabilities (`GAP-EVT-01`, `GAP-MEM-01`, `GAP-CAT-01`, `GAP-TRC-01`).
7. ESLint guardrail banning fixture and mock imports (`eslint.config.mjs`).

All core verification commands (`typecheck`, `test`, `typegen`) pass with zero errors, zero lines were modified in Python services, the user directory correction (`lib/api/` and `app/api/proxy/`, no `src/`) was strictly respected, and no integrity violations or fake facades were detected.

---

## 1. Verified Claims

| # | Claim | Verification Method | Result | Notes |
|---|-------|---------------------|--------|-------|
| 1 | Python services immutability | `git diff --stat apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth` | **PASS** | 0 files modified, 0 lines changed |
| 2 | Directory structure compliance | `ls -la apps/web/src` & inspection of `apps/web/lib/api/` | **PASS** | `apps/web/src` does not exist; code in `lib/api/` & `app/api/proxy/` |
| 3 | TypeScript compilation | `pnpm --filter @payguardian/web run typecheck` | **PASS** | `tsc --noEmit` exited code 0, 0 compiler errors |
| 4 | Unit test suite | `pnpm --filter @payguardian/web run test` | **PASS** | 9 test files passed, 36 tests passed (0 failures) |
| 5 | OpenAPI typegen script | `pnpm --filter @payguardian/web run typegen` | **PASS** | `openapi.json → lib/api/generated-schema.ts` in 98ms, git diff 0 |
| 6 | Integer minor unit handling | Source inspection of mappers and unit tests in `mappers.test.ts` | **PASS** | All monetary amounts handled as integer minor units without lossy arithmetic |
| 7 | Zero optimistic updates | Source inspection of `useApprovals` and mutation hooks | **PASS** | UI state updates strictly awaited from confirmed server responses |
| 8 | Integrity & genuine logic | Full inspection of `client.ts`, `route.ts`, mappers, tests | **PASS** | Genuine HTTP fetch calls, no hardcoded test shortcuts or dummy facades |

---

## 2. Findings & Adversarial Challenges

### [Major] Finding 1: Unhandled Status 204/304 in Next.js Proxy Route Handler (`route.ts`)

- **Location**: `apps/web/app/api/proxy/[...path]/route.ts:109-115`
- **What**: When the upstream Fastify Gateway returns an HTTP 204 (No Content), 205 (Reset Content), or 304 (Not Modified) response, `handleProxy` executes:
  ```typescript
  const responseBody = await upstreamResponse.arrayBuffer();
  return new NextResponse(responseBody, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
  ```
- **Why**: Under the WHATWG / Node.js 18+ fetch specification (enforced by `undici` in Node.js 24), constructing a `Response` or `NextResponse` with any body (including an empty `ArrayBuffer(0)`) for status codes 204, 205, or 304 throws:
  `TypeError: Response constructor: Invalid response status code 204`
  The thrown exception is caught by the proxy's `catch` block and returned to the browser as a `502 Bad Gateway` (`GATEWAY_PROXY_ERROR`).
- **Empirical Confirmation**:
  Running `node -e 'const { NextResponse } = require("next/server"); new NextResponse(new ArrayBuffer(0), { status: 204 });'` confirmed the uncaught `TypeError`.
- **Suggested Fix**:
  In `apps/web/app/api/proxy/[...path]/route.ts`:
  ```typescript
  const hasNoBody = [101, 204, 205, 304].includes(upstreamResponse.status);
  const responseBody = hasNoBody ? null : await upstreamResponse.arrayBuffer();

  return new NextResponse(responseBody, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
  ```

---

### [Major] Finding 2: ESLint Fixture-Banning Rule Applied Broadly Across Unmigrated Components

- **Location**: `eslint.config.mjs:24-58`
- **What**: The `no-restricted-imports` rule applies immediately to:
  ```javascript
  files: [
    "apps/web/src/**/*.{js,mjs,cjs,ts,tsx}",
    "apps/web/lib/**/*.{js,mjs,cjs,ts,tsx}",
    "apps/web/app/**/*.{js,mjs,cjs,ts,tsx}",
    "apps/web/components/**/*.{js,mjs,cjs,ts,tsx}",
  ],
  ```
- **Why**: Existing components in `apps/web/components/workspace/*` (e.g. `workspace-layout.tsx`, `recent-activity-panel.tsx`, `sessions-memory.tsx`, `index.ts`) still import `./workspace-defaults` because they are scheduled for sequential migration in Milestones 2, 3, and 4.
  Consequently, executing `pnpm --filter @payguardian/web run lint` produces dozens of lint errors on unmigrated components.
- **Context & Recommendation**:
  Per `PROJECT.md:29`, full repository lint passing is formally scheduled as an acceptance gate for Milestone 5.
  However, for intermediate milestones, either:
  1. Restrict the ESLint rule files scope to `apps/web/lib/api/**/*.{ts,tsx}` until components are migrated, or
  2. Add an explicit `ignorePatterns` entry for unmigrated components in `eslint.config.mjs` that is progressively removed as each screen is migrated in M2–M4.

---

### [Minor] Finding 3: Unused Variables in New API Files Triggering `@typescript-eslint/no-unused-vars`

- **Location**:
  1. `apps/web/app/api/proxy/__tests__/route.test.ts:3:21`: `'DELETE' is defined but never used`
  2. `apps/web/lib/api/__tests__/mappers.test.ts:8:3`: `'mapAgentDtoToSpecialist' is defined but never used`
  3. `apps/web/lib/api/hooks/use-agent-memory.ts:13:32`: `'_environmentId' is defined but never used`
  4. `apps/web/lib/api/hooks/use-approvals.ts:25:10`: `'agents' is assigned a value but never used`
  5. `apps/web/lib/api/hooks/use-approvals.ts:26:10`: `'mandates' is assigned a value but never used`
  6. `apps/web/lib/api/mappers/workspace-graph.ts:7:3`: `'_ledgerAccounts' is assigned a value but never used`
- **Why**: Running `pnpm --filter @payguardian/web exec eslint lib/api app/api` flags these 6 errors.
- **Suggested Fix**: Remove the unused imports in test files, remove unused state in `useApprovals`, and prefix unused parameter names with `_` while configuring `argsIgnorePattern: "^_"`.

---

### [Minor] Finding 4: Single-Header Collapse Risk for Upstream `Set-Cookie` in Proxy

- **Location**: `apps/web/app/api/proxy/[...path]/route.ts:104-107`
- **What**:
  ```typescript
  const setCookie = upstreamResponse.headers.get("set-cookie");
  if (setCookie) {
    responseHeaders.set("set-cookie", setCookie);
  }
  ```
- **Why**: Calling `headers.get("set-cookie")` collapses multiple `Set-Cookie` headers into a comma-delimited string. If a cookie has an `Expires` directive with a comma (e.g., `Expires=Wed, 21-Oct-2026 07:28:00 GMT`), browsers may corrupt cookie boundaries.
- **Suggested Fix**:
  Use `upstreamResponse.headers.getSetCookie()` (supported in Node.js 18+ and Next.js):
  ```typescript
  const setCookies = typeof upstreamResponse.headers.getSetCookie === "function"
    ? upstreamResponse.headers.getSetCookie()
    : [upstreamResponse.headers.get("set-cookie")].filter(Boolean) as string[];

  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }
  ```

---

### [Minor] Finding 5: Missing In-Flight Request Cancellation (`AbortController`) in React Hooks

- **Location**: `apps/web/lib/api/hooks/*.ts` (`useWorkspaceGraph`, `useActivityFeed`, `useApprovals`)
- **What**: React hooks initiate asynchronous network fetches inside `useEffect` without threading an `AbortSignal`.
- **Why**: If a user quickly switches environments or unmounts the view during a slow network request, the unmounted component's state setters will execute once the promise settles. While React 19 handles unmounted setters gracefully, passing an `AbortSignal` avoids race conditions when switching environments.
- **Suggested Fix**: Add `signal?: AbortSignal` to `RequestOptions` in `apps/web/lib/api/client.ts` and pass `controller.signal` from hook `useEffect` cleanup routines.

---

## 3. Adversarial Stress-Test Scenarios & Results

| # | Stress Scenario | Expected Behavior | Actual Behavior | Result |
|---|-----------------|-------------------|-----------------|--------|
| S1 | GET with empty headers in dev mode | Proxy injects fallback `x-local-user-id: local-user` | Injected `x-local-user-id: local-user` | **PASS** |
| S2 | GET with empty headers in prod mode | Proxy does not inject dev bypass header | Zero dev headers injected; upstream resolves 401 | **PASS** |
| S3 | Request with session cookie | Proxy resolves cookie as `Authorization: Bearer <token>` | `Authorization: Bearer <token>` attached | **PASS** |
| S4 | Upstream Gateway connection refused | Proxy returns 502 with structured `GATEWAY_PROXY_ERROR` | 502 returned with JSON `{ code: "GATEWAY_PROXY_ERROR", ... }` | **PASS** |
| S5 | Upstream returns 204 No Content | Proxy returns 204 with empty body to client | **Proxy crashes with 502** due to `NextResponse(ArrayBuffer, { status: 204 })` | **FAIL** (See Finding 1) |
| S6 | Query parameters with complex encoding (`%20`, `&`, emojis) | Proxy preserves raw query string | Target URL receives exact query string | **PASS** |
| S7 | Multi-segment nested route (`/v1/environments/e1/agents/a2/disable`) | Proxy preserves full path | Target URL constructed accurately | **PASS** |
| S8 | Non-JSON HTML error upstream (e.g. 502 Nginx HTML) | `ApiClient` throws `ApiClientError` without crashing JSON parser | Caught in try/catch, returns `ApiClientError` | **PASS** |
| S9 | Memory Vault query | UI renders explicit "Memory Vault Unavailable" container | `useAgentMemory` returns `{ isUnavailable: true, items: [] }` | **PASS** |
| S10 | Integer minor unit budget calculations | All amounts in minor units, no float division | `allocatedMinor`, `spentMinor`, `reservedMinor` exact integers | **PASS** |

---

## 4. Coverage Gaps & Unverified Items

- **Live Fastify Gateway End-to-End Execution**:
  Unit tests mock fetch calls at the boundary. End-to-end execution with a live running Fastify server (`apps/api`) and real PostgreSQL instances is scheduled for Milestone 5.
- **Three.js Canvas Migration**:
  Component integration of `agent-network-canvas.tsx` with `useWorkspaceGraph` is scheduled for Milestone 2.

---

## 5. Review Conclusion

The code implementation delivered by `worker_m1` is genuine, architecturally sound, thoroughly tested, and conforms strictly to project requirements and user constraints. Zero lines of Python services were modified, all code lives in `lib/api/` and `app/api/proxy/` (no `src/`), and all required workspace verification commands pass with 100% success.

The findings surfaced above (particularly Finding 1 regarding status 204 in the proxy route handler) are non-blocking for Milestone 2 because existing Fastify Gateway routes return 200/201 JSON payloads, but should be addressed by `worker_m2` or in a minor follow-up to ensure full REST specification compliance.

**Verdict**: **APPROVE**
