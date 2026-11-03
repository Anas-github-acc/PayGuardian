# Infrastructure Survey Report: R1 & R5 (Frontend-to-Backend Integration)

**Date**: 2026-11-01  
**Author**: `explorer_survey_infra`  
**Target Repository**: `/home/anas/myspace/AI/PayGuardian`  
**Referenced Documents**: `ORIGINAL_REQUEST.md`, `docs/frontend-audit.md`, `docs/api.md`  

---

## Executive Summary

This survey provides the technical foundation for migrating `apps/web` from mock fixtures to live backend services under Requirements **R1** (Typed Client, OpenAPI Spec, Typegen, Next.js Routing & Auth) and **R5** (Lint Guardrails, Verification Scripts, E2E Testing).

### Primary Findings:
1. **OpenAPI Spec**: No static `openapi.json` exists in the codebase today. The Python Agent Runtime (`apps/agent-runtime`) dynamically produces OpenAPI 3.1.0 via FastAPI (`GET /openapi.json`), covering runtime endpoints (`/health`, `/agents`, `/tools`, `/run`). The Fastify Gateway API (`apps/api`) serves OpenAPI 3.0.3 at `GET /docs/json` via `@fastify/swagger`, but currently exports only 3 routes (`/health`, `/v1/system/status`, `/v1/models`) because the remaining 39+ phase routes in `phase1-routes.ts` through `phase6-routes.ts` lack Fastify `schema` objects. Complete DTO contracts are already maintained in `@payguardian/contracts` (`packages/contracts/src/index.ts`).
2. **Type Generation**: `openapi-typescript` (tested at version `7.13.0`) cleanly generates TypeScript interfaces from OpenAPI JSON in under 40ms. A regeneration script in `apps/web/package.json` can target a generated/committed OpenAPI specification.
3. **Directory Structure & Path Aliases**: `apps/web/src` does not currently exist; `apps/web` organizes code into `app/`, `components/`, and `lib/`, with path alias `"@/*": ["./*"]` in `apps/web/tsconfig.json`. Creating `apps/web/src/api/` with `tsconfig.json` path mapping `"src/*": ["./src/*"]` and `"@/src/*": ["./src/*"]` satisfies the requirement without breaking existing imports.
4. **Next.js Routing & Auth**: Currently, browser code calls Fastify directly on port 3001 with client-side header assembly. Creating a Next.js Route Handler at `apps/web/app/api/proxy/[...path]/route.ts` (or `/api/[...path]/route.ts`) keeps session cookies `httpOnly`, eliminates browser CORS, and handles fallback dev headers (`x-local-user-id: local-user`) transparently on the server side.
5. **Python Immutability Constraint**: `apps/agent-runtime/`, `agents/`, `apps/worker/`, and auth backends (`apps/api/src/auth.ts`, `packages/auth/`) must have **zero modified lines of code**. All work is restricted to `apps/web`, `docs/`, and ESLint configurations.
6. **ESLint Fixture Ban**: ESLint 10 Flat Config is at repository root (`eslint.config.mjs`). A `no-restricted-imports` rule must be added targeting `apps/web/src/**`, `apps/web/components/**`, and `apps/web/app/**` to ban imports matching `*fixture*`, `*mock*`, and `*workspace-defaults*`. Resolving 119 pre-existing lint errors (unused variables and missing `react-hooks` rule) is required for `npm run lint` to pass cleanly.
7. **E2E Test Infrastructure**: `apps/web` uses Vitest (`npm run test` currently passes: 6 files, 20 tests; `typecheck` passes with 0 errors). The monorepo also has a Puppeteer/CDP suite in `tests/cdp/` driving `/usr/bin/brave-beta`. A two-tiered verification strategy (a fast Vitest integration test in `apps/web` plus a CDP browser scenario in `tests/cdp/scenarios/13-backend-mutation-e2e.test.mjs`) ensures the required end-to-end backend mutation check passes cleanly across all environments.

---

## 1. Delegation API OpenAPI Specification Source

### 1.1 Existing Landscape
We conducted an exhaustive filesystem search across the monorepo for static OpenAPI specifications:
- `find_by_name` for `*openapi*`: **0 matches** (no static `openapi.json` or `openapi.yaml` exists).
- `find_by_name` for `*.json`: Checked all 27 JSON files; none is an OpenAPI spec.

### 1.2 Python Delegation Engine / Agent Runtime (`apps/agent-runtime`)
In `docs/frontend-audit.md` (lines 105, 671), `apps/agent-runtime` is designated as the **Python Delegation Engine API / Agent Runtime**:
- Entry point: `apps/agent-runtime/src/agent_runtime/main.py:15` (`app = FastAPI(...)`).
- OpenAPI Spec: Dynamic FastAPI OpenAPI 3.1.0 at `http://localhost:8000/openapi.json`.
- Interactive Swagger: `http://localhost:8000/docs`.
- Verified Generation: Running `PYTHONPATH=apps/agent-runtime/src uv run --project apps/agent-runtime python -c "from agent_runtime.main import app; import json; print(json.dumps(app.openapi()))"` succeeded and yielded valid OpenAPI 3.1.0 for all 4 routes:
  1. `GET /health`
  2. `GET /agents`
  3. `GET /tools`
  4. `POST /run` (with schema `RunRequest`)

### 1.3 Fastify Gateway REST API (`apps/api`)
The Fastify Gateway API (`apps/api`) is the central authority enforcement point hosting the 42 REST endpoints required by the 13 dashboard screens (`docs/api.md`, `docs/frontend-audit.md:68-104`):
- Entry point: `apps/api/src/app.ts:32` (`buildApp()`).
- Swagger Plugin: Registered at `apps/api/src/app.ts:55-66` via `@fastify/swagger` version `9.9.2`.
- OpenAPI Route: `app.get("/docs/json", async () => app.swagger())`.
- **Key Observation**: When `app.swagger()` is generated programmatically or via `GET /docs/json`, it produces OpenAPI 3.0.3 with **only 3 routes**:
  - `GET /health`
  - `GET /v1/system/status`
  - `GET /v1/models`
- **Root Cause**: In Fastify, `@fastify/swagger` inspects each route's `schema` definition. In `apps/api`, only `src/app.ts` (lines 87, 112, 137) provides route `schema` objects. The domain phase route files:
  - `src/phase1-routes.ts` (Environments, Agents)
  - `src/phase2-routes.ts` (Mandates, Delegations)
  - `src/phase3-routes.ts` (Ledger, Allocations)
  - `src/phase4-routes.ts` (Approvals, Simulations)
  - `src/paypal-routes.ts` (PayPal Sandbox orders, operations)
  - `src/phase6-routes.ts` (Revocations, Audit activity)
  rely on TypeScript generic request types (e.g. `app.post<{ Body: ... }>()`) and manual validation, rather than Fastify JSON schemas.

### 1.4 Canonical Contracts in `@payguardian/contracts`
All DTO contracts are already formalized in TypeScript at `/home/anas/myspace/AI/PayGuardian/packages/contracts/src/index.ts`:
- Environments: `EnvironmentDto`, `CreateEnvironmentRequest`
- Agents: `AgentDto`, `CreateRootAgentRequest`, `RegisterChildAgentRequest`
- Mandates: `MandateDto`, `CreateRootMandateRequest`, `DelegateMandateRequest`, `PolicyDecisionDto`
- Ledger: `LedgerAccountDto`, `ActionReserveRequest`, `ActionReserveResponse`
- Approvals: `ApprovalDto`
- Sessions: `SessionDto`, `SessionRunDto`
- PayPal: `PayPalOrderRequest`, `PayPalOperationSummaryDto`
- Audit: `AuditEventDto`

### 1.5 Recommended OpenAPI Strategy for R1
To provide an OpenAPI spec for type generation without violating backend immutability:
1. **Option A (Static Monorepo Spec)**: Provide a comprehensive `openapi.json` file at `apps/web/openapi.json` (or `packages/contracts/openapi.json`) reflecting the Gateway REST API defined in `docs/api.md` and `packages/contracts/src/index.ts`, combined with `apps/agent-runtime` schemas.
2. **Option B (FastAPI Agent Runtime Spec)**: Generate directly from `apps/agent-runtime` (`uv run ...`) into `apps/web/openapi.json` for the delegation engine, while importing Gateway contracts from `@payguardian/contracts`.
3. **Recommended Implementation**: Generate a static `apps/web/openapi.json` that represents the Gateway and Delegation APIs, ensuring offline reproducibility for `npm run build` and `npm run typegen` without requiring live backend processes.

---

## 2. Type Generation Tooling in `apps/web`

### 2.1 Tool Evaluation
- **Tool**: `openapi-typescript` (version `7.13.0`).
- **Verification**: Executed via `pnpm dlx openapi-typescript .agents/teamwork/explorer_survey_infra/openapi-agent-runtime.json -o .agents/teamwork/explorer_survey_infra/test-types.ts`.
- **Result**: Successfully generated clean TypeScript interfaces (`paths`, `components["schemas"]`, `operations`) in 35.2ms.
- **Benefits**:
  - Generates zero runtime dependencies.
  - Generates pure TypeScript interfaces and union types.
  - Native support for OpenAPI 3.0 and OpenAPI 3.1.

### 2.2 Configuration in `apps/web/package.json`
1. Add `openapi-typescript` to `devDependencies` of `apps/web/package.json`:
   ```json
   "devDependencies": {
     "openapi-typescript": "^7.13.0"
   }
   ```
2. Add the regeneration scripts to `apps/web/package.json`:
   ```json
   "scripts": {
     "typegen": "openapi-typescript ./openapi.json -o src/api/generated-types.ts",
     "typegen:remote": "openapi-typescript http://localhost:3001/docs/json -o src/api/generated-types.ts"
   }
   ```
3. The generated file `apps/web/src/api/generated-types.ts` is committed to git, ensuring that CI/CD, `pnpm typecheck`, and `next build` never fail due to unstarted backend services.

---

## 3. Typed Client Structure in `apps/web`

### 3.1 Directory and Path Alias Analysis
- **Current Directory Layout of `apps/web`**:
  ```
  apps/web/
  ├── app/                  # Next.js App Router (pages, layout, auth-provider)
  ├── components/           # UI components (workspace, canvas, tables, shell, etc.)
  ├── lib/                  # Shared utilities (api.ts, navigation.ts, workspace-store.ts)
  ├── package.json
  ├── next.config.ts
  └── tsconfig.json
  ```
- **Does `apps/web/src` exist?** No.
- **Path Aliases in `apps/web/tsconfig.json`**:
  - `tsconfig.json` defines `"paths": { "@/*": ["./*"] }`.
  - In `apps/web`, `@/` points to `./` (the root of `apps/web`). Therefore, `@/components/...` points to `apps/web/components/...`, and `@/lib/...` points to `apps/web/lib/...`.

### 3.2 Proposed Layout for `src/api/`
To fulfill the requirement `"Create a typed client in src/api/ with one hook per screen and mappers that turn API responses into the props the existing components already take, without altering component markup or styling."`:

1. Update `apps/web/tsconfig.json` paths to support both `@/*` and `src/*`:
   ```json
   "paths": {
     "@/*": ["./*"],
     "src/*": ["./src/*"]
   }
   ```
2. Create `apps/web/src/api/` with the following modular directory layout:
   ```
   apps/web/src/api/
   ├── index.ts                     # Single entrypoint exporting all hooks, client, and mappers
   ├── client.ts                   # Base typed HTTP client routing through Next.js proxy
   ├── generated-types.ts          # Output of openapi-typescript
   │
   ├── mappers/                    # Pure deterministic transformation functions
   │   ├── workspace-graph.ts      # AgentDto[] + MandateDto[] + LedgerAccountDto[] -> AgentNodeData[], AgentEdgeData[]
   │   ├── budget-strip.ts         # EnvironmentDto + LedgerAccountDto + ApprovalDto[] -> BudgetStripProps, KpiProps
   │   ├── activity-feed.ts        # AuditEventDto[] -> ActivityFeedItem[]
   │   ├── approvals.ts            # ApprovalDto[] + AgentDto[] -> ApprovalCardProps
   │   ├── payment-trace.ts        # AuditEventDto[] + PayPalOperationSummaryDto -> PaymentTraceProps
   │   ├── library.ts              # AgentDto[] -> AgentCardProps / AgentLibraryProps
   │   ├── sessions.ts             # SessionDto[] -> SessionItem[]
   │   └── memory.ts               # Returns { isUnavailable: true, reason: "Memory API not yet implemented" }
   │
   ├── hooks/                      # Exactly one custom React hook per target screen
   │   ├── use-workspace-graph.ts  # Screen 1: Workspace graph
   │   ├── use-budget-strip.ts     # Screen 2: Budget bar / strip
   │   ├── use-activity-feed.ts    # Screen 3: Activity feed
   │   ├── use-approvals.ts        # Screen 4: Approvals
   │   ├── use-payment-trace.ts    # Screen 5: Payment trace
   │   ├── use-agent-library.ts    # Screen 6: Agent Library
   │   ├── use-sessions.ts         # Screen 7: Sessions
   │   └── use-agent-memory.ts     # Screen 8: Memory vault
   │
   └── __tests__/
       ├── mappers.test.ts         # Unit tests verifying contract-to-props fidelity
       └── hooks.test.ts           # Hook rendering tests
   ```

### 3.3 Strict Component Preservation Guarantee
The mappers guarantee that existing components (`components/workspace/workspace-layout.tsx`, `components/workspace/budget-strip.tsx`, `components/workspace/activity-micro-feed.tsx`, etc.) receive the **exact TypeScript prop shapes** they already expect (`AgentNodeData`, `AgentEdgeData`, `SessionItem`, `ActivityFeedItem`, etc.). **Zero component markup, layout structures, or Tailwind styling classes will be altered.**

---

## 4. Next.js Routing and Auth Flow

### 4.1 Current Architecture & Deficiencies
- Currently, `apps/web/app/lib/api.ts` builds headers in the browser and calls `http://localhost:3001` directly.
- This requires CORS headers from Fastify (`apps/api/src/app.ts:53`).
- In production, browser-held bearer tokens are exposed to JavaScript (`localStorage`/JS memory), violating the `httpOnly` cookie standard.

### 4.2 Auth Topology (from `docs/frontend-audit.md` Section 4)
- **Fastify Gateway (`apps/api/src/auth.ts:10-35`)**:
  - Checks `x-local-user-id` if `localDevAuthEnabled === true`.
  - Checks `Authorization: Bearer pg_<token>` for agent credentials.
  - Checks `Authorization: Bearer <jwt>` via Supabase `client.auth.getUser(token)`.
- **Python Agent Runtime (`apps/agent-runtime`)**:
  - Non-validating execution engine; all requests must be dispatched to Gateway for authority validation.

### 4.3 Next.js Proxy Routing Architecture
To eliminate browser CORS and enforce `httpOnly` session cookies:

1. **Next.js Route Handler Implementation**:
   Create `apps/web/app/api/proxy/[...path]/route.ts`:
   - Intercepts all browser requests to `/api/proxy/...`.
   - Reads `httpOnly` session cookies via Next.js `cookies()` (e.g. `sb-access-token` or custom session cookie).
   - If an `access_token` is present, sets `Authorization: Bearer <access_token>`.
   - If in local development mode (`process.env.NODE_ENV !== "production"` or `NEXT_PUBLIC_ENABLE_LOCAL_DEV_AUTH === "true"`) and no session cookie is present, sets `x-local-user-id: local-user`.
   - Forwards method, body, and query parameters to the internal Fastify Gateway URL (`process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001"`).
   - Returns the response to the browser with same-origin headers.
2. **Browser Client Configuration**:
   - The typed client in `apps/web/src/api/client.ts` uses relative URLs (`/api/proxy/v1/...`).
   - Browser calls are 100% same-origin (`window.location.origin`), completely eliminating browser CORS preflight and headers.
   - Authentication cookies remain `httpOnly` and are attached automatically by the browser with `credentials: "same-origin"`.
3. **Next.js Config Rewrite Support**:
   In `apps/web/next.config.ts`, rewrites can also be defined as an operational fallback:
   ```typescript
   import type { NextConfig } from "next";

   const nextConfig: NextConfig = {
     output: "standalone",
     async rewrites() {
       return [
         {
           source: "/api/gateway/:path*",
           destination: `${process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001"}/:path*`,
         },
       ];
     },
   };

   export default nextConfig;
   ```
   *Note*: The Route Handler is the primary recommendation because it can dynamically attach server-side tokens and enforce `httpOnly` cookie decoding before forwarding requests to Fastify.

---

## 5. Python Service Immutability Rule

Per requirement constraints: **Zero lines of code may be modified in Python services or auth backends.**

### Strict Read-Only Boundaries:
| Prohibited Directory / File | Description | Action Allowed |
|---|---|---|
| `apps/agent-runtime/**` | Python FastAPI ADK agent runtime | **READ ONLY** — Do not edit any file. |
| `agents/**` | Python specialist agents (travel, hotel, food, etc.) | **READ ONLY** — Do not edit any file. |
| `apps/worker/**` | Durable payment reconciliation worker | **READ ONLY** — Do not edit any file. |
| `apps/api/src/auth.ts` | Fastify PrincipalResolver and auth verification | **READ ONLY** — Do not edit any file. |
| `packages/auth/**` | Monorepo auth package | **READ ONLY** — Do not edit any file. |

All implementation tasks for R1-R5 must be strictly localized to:
- `apps/web/**` (components, pages, `src/api/`, package.json, next.config.ts)
- `docs/**` (e.g. `docs/gaps.md`)
- `eslint.config.mjs` (monorepo root or `apps/web/eslint.config.mjs`)
- `tests/**` (e.g. `tests/cdp/scenarios/13-backend-mutation-e2e.test.mjs`)

---

## 6. Lint Rule Setup (Banning Imports from Fixtures or Mocks)

### 6.1 Existing ESLint State
- **Config File**: Monorepo root `eslint.config.mjs`.
- **Framework**: ESLint 10 Flat Config format using `typescript-eslint` 8.
- **Current Command**: `pnpm --filter @payguardian/web lint` runs `eslint .`.
- **Current Status**: **Fails with 119 errors**.
  - **Issue A**: `@typescript-eslint/no-unused-vars` flags 118 unused imports and variables across draft components.
  - **Issue B**: Definition for rule `'react-hooks/exhaustive-deps'` was not found at `apps/web/components/tables/ActivityAuditTable.tsx:337` (inline eslint disable comment without the plugin being registered).

### 6.2 Proposed ESLint Rule Configuration
To satisfy R5 (*"Add a lint rule banning imports from fixtures or mocks inside `src/`"*):
1. In `eslint.config.mjs`, add a dedicated rule block targeting `apps/web/src/**` (and production UI folders):
   ```javascript
   {
     files: [
       "apps/web/src/**/*.{ts,tsx}",
       "apps/web/app/**/*.{ts,tsx}",
       "apps/web/components/**/*.{ts,tsx}",
     ],
     ignores: [
       "**/*.test.{ts,tsx}",
       "**/*.spec.{ts,tsx}",
       "**/test/**",
     ],
     rules: {
       "no-restricted-imports": [
         "error",
         {
           patterns: [
             {
               group: [
                 "**/fixtures/**",
                 "**/mocks/**",
                 "*mock*",
                 "*fixture*",
                 "**/workspace-defaults*",
               ],
               message: "Imports from fixtures or mocks are banned in production code inside src/. Use real backend API clients.",
             },
           ],
         },
       ],
     },
   }
   ```
2. Configure `@typescript-eslint/no-unused-vars` to ignore variables prefixed with `_`:
   ```javascript
   "@typescript-eslint/no-unused-vars": [
     "error",
     {
       argsIgnorePattern: "^_",
       varsIgnorePattern: "^_",
       caughtErrorsIgnorePattern: "^_",
     },
   ]
   ```
3. Remove the unregistered `react-hooks/exhaustive-deps` comment or register the react hooks plugin, so `pnpm --filter @payguardian/web lint` passes with 0 errors.

---

## 7. End-to-End Test Infrastructure and Verification Scripts

### 7.1 Existing Validation Scripts in `apps/web`
We audited the three validation scripts specified in acceptance criteria:

| Script | Command | Current Status | Notes |
|---|---|---|---|
| `npm run typecheck` | `tsc --noEmit` | **PASS (0 errors)** | TypeScript compiles cleanly. |
| `npm run lint` | `eslint .` | **FAIL (119 errors)** | Due to unused vars & unregistered react-hooks comment. |
| `npm run test` | `vitest run --passWithNoTests --exclude 'dist/**'` | **PASS (6 files, 20 tests)** | Vitest suite executes cleanly. |

### 7.2 Existing Monorepo CDP Infrastructure (`tests/cdp/`)
- Tooling: `puppeteer-core` version `25.16.0` connecting to `/usr/bin/brave-beta` over Chrome DevTools Protocol (`http://localhost:9222`).
- 12 existing scenarios (`01-navigation-and-layout` to `12-human-approvals-inbox`).
- Harness (`tests/cdp/harness.mjs`) automatically checks/starts Fastify on port 3001, Next.js on port 3000, and Brave Beta.

### 7.3 Implementation Plan for Requirement R5 E2E Test
Requirement R5 specifies:
> *"Add an end-to-end test that changes a value in the backend and asserts the UI shows it. Ensure existing workspace validation scripts (`npm run typecheck`, `npm run lint`, and `npm run test` in `apps/web`) and the end-to-end test pass cleanly."*

We recommend implementing a dual-verification strategy:

#### Tier 1: Vitest Backend Integration Test (`apps/web`)
- Location: `apps/web/src/api/__tests__/backend-mutation-e2e.test.ts`
- Runs as part of `pnpm --filter @payguardian/web test`.
- Mechanism:
  1. Bootstraps an in-memory Fastify Gateway instance (`buildApp({ logger: false })`).
  2. Creates an environment (`POST /v1/environments`) with an initial budget limit (e.g. $10,000.00 / `1000000` minor).
  3. Verifies initial state renders in the mapper/hook.
  4. Dispatches a backend mutation (`POST /v1/environments/:id/ledger/allocations` or environment update) changing the budget to $25,000.00 (`2500000` minor).
  5. Invokes the typed client/hook and asserts that the returned prop `budgetLimitMinor` and formatted currency strictly reflect `$25,000.00`.
- Benefit: Runs directly in `npm run test` in headless environments without requiring a browser or open network ports.

#### Tier 2: Real Browser CDP Scenario (`tests/cdp/scenarios/13-backend-mutation-e2e.test.mjs`)
- Location: `tests/cdp/scenarios/13-backend-mutation-e2e.test.mjs`
- Runs via `pnpm test:cdp`.
- Mechanism:
  1. Calls Gateway REST API `POST http://localhost:3001/v1/environments` with unique name `E2E-Mutation-Test-${Date.now()}` and budget `7500000`.
  2. Loads `http://localhost:3000/dashboard` in Brave Beta.
  3. Uses CDP to switch to the newly created environment.
  4. Mutates a value in the backend (e.g. submits an approval via `POST http://localhost:3001/v1/environments/:id/approvals`).
  5. Reloads/refreshes the dashboard and queries the DOM element (e.g. the budget bar ceiling or approval badge count).
  6. Asserts using Node.js `assert.equal()` that the UI text displays the updated value.

---

## 8. Screen Migration Summary Reference (8 Screens for R2)

| # | Screen | Key Backend Endpoints | UI Components | Integration Status | Fixture to Remove |
|---|---|---|---|---|---|
| 1 | **Workspace Graph** | `GET /v1/environments/:id/agents`<br>`GET /v1/environments/:id/mandates`<br>`GET /v1/environments/:id/ledger/accounts` | `workspace-layout.tsx`<br>`delegation-topology.tsx`<br>`agent-network-canvas.tsx` | PARTIAL | `DEFAULT_GRAPH_NODES`<br>`DEFAULT_GRAPH_EDGES` |
| 2 | **Budget Bar / Strip** | `GET /v1/environments`<br>`GET /v1/environments/:id/ledger/accounts`<br>`GET /v1/environments/:id/approvals?status=pending` | `budget-strip.tsx`<br>`kpi-strip.tsx`<br>`overview.tsx` | PARTIAL | `DEFAULT_ENVIRONMENTS`<br>`SPEND_SERIES` |
| 3 | **Activity Feed** | `GET /v1/environments/:id/activity?since=&limit=` | `activity-micro-feed.tsx`<br>`recent-activity-panel.tsx` | PARTIAL | `INITIAL_ACTIVITIES` |
| 4 | **Approvals** | `GET /v1/environments/:id/approvals`<br>`POST /v1/approvals/:id/approve`<br>`POST /v1/approvals/:id/reject` | `ApprovalsInbox.tsx`<br>`ApprovalCard.tsx` | PARTIAL | Hardcoded approval fixtures in `approvals-grid-data.ts` |
| 5 | **Payment Trace** | `GET /v1/environments/:id/activity`<br>`GET /v1/environments/:id/payments/paypal/:actionId` | `PaymentTraceView.tsx`<br>`LifecycleTimeline.tsx` | PARTIAL | Synthetic latency timer & static trace steps |
| 6 | **Library** | `GET /v1/environments/:id/agents`<br>`POST /v1/environments/:id/agents/children` | `AgentLibrary.tsx`<br>`AgentGrid.tsx` | PARTIAL | Static agent catalog cards |
| 7 | **Sessions** | `GET /v1/environments/:id/sessions`<br>`POST /v1/environments/:id/sessions`<br>`POST /v1/environments/:id/sessions/:id/runs` | `session-history.tsx`<br>`sessions-memory.tsx` | PARTIAL | `INITIAL_SESSIONS` |
| 8 | **Memory** | *None* (Backend endpoint missing) | `sessions-memory.tsx`<br>`memory-card.tsx` | **MISSING** | `INITIAL_MEMORIES` (render "unavailable" state) |

---

## 9. Next Steps for Implementation Team
1. **Infrastructure Prep**:
   - Install `openapi-typescript` into `apps/web`.
   - Update `apps/web/tsconfig.json` with path mapping for `src/*`.
   - Create `apps/web/src/api/` with typed client and proxy route handler (`apps/web/app/api/proxy/[...path]/route.ts`).
2. **ESLint Cleanup & Guardrail**:
   - Add the `no-restricted-imports` rule banning `fixtures`, `mocks`, and `workspace-defaults`.
   - Clean up unused variables and rule misconfigurations to bring `npm run lint` to 0 errors.
3. **Screen-by-Screen Migration**:
   - Implement one hook + mapper per screen in sequential order (1 to 8).
   - Delete fixtures from `apps/web` as each screen is integrated.
   - Record missing endpoints (e.g. Memory) in `docs/gaps.md`.
4. **Verification**:
   - Run `npm run typecheck`, `npm run lint`, and `npm run test` in `apps/web`.
   - Run the E2E backend mutation test.
