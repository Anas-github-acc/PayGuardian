# Handoff Report: Infrastructure Survey for R1 & R5

**Agent Name**: `explorer_survey_infra`  
**Working Directory**: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_survey_infra/`  
**Date**: 2026-11-01  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

1. **OpenAPI Specification Absence & Sources**:
   - `find_by_name` for `*openapi*` in the monorepo yielded 0 files.
   - `apps/agent-runtime/src/agent_runtime/main.py:15` instantiates `FastAPI(...)` with 4 endpoints: `/health` (line 37), `/agents` (line 49), `/tools` (line 54), and `/run` (line 79).
   - Executing `PYTHONPATH=apps/agent-runtime/src uv run --project apps/agent-runtime python -c "from agent_runtime.main import app; import json; print(json.dumps(app.openapi()))"` produced valid OpenAPI 3.1.0 specifications.
   - `apps/api/src/app.ts:55-66` registers `@fastify/swagger` and `app.get("/docs/json", async () => app.swagger())`.
   - Running `app.swagger()` in Node via tsx yielded OpenAPI 3.0.3 with only 3 paths: `/health`, `/v1/system/status`, and `/v1/models`. Fastify routes in `phase1-routes.ts` through `phase6-routes.ts` do not define route `schema` objects and are therefore omitted from Fastify swagger output.
   - Complete TypeScript DTO types exist at `packages/contracts/src/index.ts:1-258` (`EnvironmentDto`, `AgentDto`, `MandateDto`, `LedgerAccountDto`, `ApprovalDto`, `SessionDto`, `AuditEventDto`).
2. **Type Generation Tooling**:
   - Tested `openapi-typescript` version `7.13.0` via `pnpm dlx openapi-typescript .agents/teamwork/explorer_survey_infra/openapi-agent-runtime.json -o .agents/teamwork/explorer_survey_infra/test-types.ts`. It executed in 35.2ms and produced clean TypeScript interfaces.
3. **`apps/web` Directory Layout & Paths**:
   - `apps/web` contains `app/`, `components/`, and `lib/`. `apps/web/src` does not exist.
   - `apps/web/tsconfig.json:4-6` defines `"paths": { "@/*": ["./*"] }`.
4. **Current Routing & Auth**:
   - `apps/web/app/lib/api.ts:24-42` defines `apiRequest<T>` which executes client-side fetch calls directly to `NEXT_PUBLIC_API_BASE_URL` (`http://localhost:3001`).
   - `apps/web/app/api/` does not currently exist.
   - `apps/api/src/auth.ts:17-35` defines `createPrincipalResolver` expecting `Authorization: Bearer <token>` or `x-local-user-id: <id>` (when `localDevAuthEnabled` is true).
5. **Python Service Immutability**:
   - Monorepo contains Python services in `apps/agent-runtime/` and `agents/`.
   - Payment worker is in `apps/worker/`.
   - Auth backend is in `apps/api/src/auth.ts` and `packages/auth/`.
6. **ESLint Status & Config**:
   - Root `eslint.config.mjs` defines ESLint 10 Flat Config using `typescript-eslint` 8.
   - Running `pnpm --filter @payguardian/web lint` failed with 119 errors:
     - 118 `@typescript-eslint/no-unused-vars` errors.
     - 1 error: `Definition for rule 'react-hooks/exhaustive-deps' was not found` at `apps/web/components/tables/ActivityAuditTable.tsx:337`.
7. **Workspace Validation Scripts & E2E Infra**:
   - `pnpm --filter @payguardian/web typecheck` exited with code 0 (0 errors).
   - `pnpm --filter @payguardian/web test` exited with code 0 (6 test files passed, 20 tests).
   - Monorepo CDP suite exists in `tests/cdp/run-all.mjs` with 12 scenario files driving `/usr/bin/brave-beta`.

---

## 2. Logic Chain

1. **OpenAPI Spec & Typegen (Observation 1 & 2)**:
   - Because no static OpenAPI spec exists on disk and Fastify route schemas are incomplete, relying on live server runtime reflection during build is fragile.
   - Therefore, a static `openapi.json` must be committed to `apps/web/openapi.json` (or `packages/contracts/openapi.json`) reflecting the Gateway and Agent Runtime APIs.
   - `openapi-typescript` generates pure TypeScript types without runtime baggage, enabling `pnpm --filter @payguardian/web typegen` to regenerate types deterministically.
2. **Directory Structure (Observation 3)**:
   - Because requirement R1 requests client code in `src/api/` and `apps/web/src` does not exist, creating `apps/web/src/api/` and adding `"src/*": ["./src/*"]` to `apps/web/tsconfig.json` satisfies the requirement without breaking existing `@/*` path aliases.
   - To prevent modifying component markup or styles, mappers in `src/api/mappers/` must convert backend DTOs into the existing component prop types (`AgentNodeData`, `ActivityFeedItem`, `SessionItem`, etc.).
3. **CORS and httpOnly Cookies (Observation 4)**:
   - Because browser code currently fetches cross-origin `http://localhost:3001` directly, session tokens would have to be accessible in JavaScript.
   - Implementing a Next.js Route Handler at `apps/web/app/api/proxy/[...path]/route.ts` eliminates browser CORS and allows the Route Handler to attach `Authorization: Bearer <token>` from `httpOnly` cookies (or `x-local-user-id: local-user` during development) on the server.
4. **Backend Immutability (Observation 5)**:
   - The requirement explicitly forbids modifying Python services, worker, or auth backends.
   - Therefore, all adapters, mappers, route handlers, and typegen configurations must reside in `apps/web/` and `eslint.config.mjs`.
5. **Lint Rule (Observation 6)**:
   - Adding `no-restricted-imports` in `eslint.config.mjs` targeting `apps/web/src/**`, `apps/web/app/**`, and `apps/web/components/**` will prevent regressions by banning imports from `*fixtures*`, `*mocks*`, and `*workspace-defaults*`.
   - Bringing `pnpm --filter @payguardian/web lint` to 0 errors requires adjusting `@typescript-eslint/no-unused-vars` (or pruning unused imports) and fixing the missing `react-hooks` rule reference in `ActivityAuditTable.tsx:337`.
6. **E2E Test (Observation 7)**:
   - A two-tiered test strategy:
     - Tier 1: A Vitest test in `apps/web/src/api/__tests__/backend-mutation-e2e.test.ts` that mutates backend state (via in-memory Fastify app or client) and asserts the mapper/hook produces the updated value.
     - Tier 2: A Puppeteer/CDP scenario in `tests/cdp/scenarios/13-backend-mutation-e2e.test.mjs` driving the browser against the live UI.
   - This ensures `npm run test` in `apps/web` passes while verifying full backend-to-UI propagation.

---

## 3. Caveats

- Fastify Gateway API (`apps/api`) does not have route schemas on phase routes, so dynamic generation directly from Fastify's `/docs/json` yields only 3 routes. A static OpenAPI specification representing all gateway routes documented in `docs/api.md` and `packages/contracts/src/index.ts` should be maintained for type generation.
- Screen 6 (Memory) has zero backend endpoints or database tables (`docs/frontend-audit.md:25`). The mapper/hook for Memory must render an explicit "unavailable" state and record the gap in `docs/gaps.md`.
- No SSE or WebSocket servers exist in the backend (`docs/frontend-audit.md:23`). Real-time live updates must use timestamp cursor polling (`GET /v1/environments/:id/activity?since=`).

---

## 4. Conclusion

The infrastructure roadmap for R1 and R5 is clear and executable without modifying any Python service, worker, or auth backend:
1. **OpenAPI & Typegen**: Commit `apps/web/openapi.json` representing all Gateway DTOs and Agent Runtime endpoints. Add `openapi-typescript` and script `"typegen": "openapi-typescript ./openapi.json -o src/api/generated-types.ts"` to `apps/web/package.json`.
2. **Typed Client & Path Layout**: Add `"src/*": ["./src/*"]` to `apps/web/tsconfig.json`. Implement `apps/web/src/api/` containing `client.ts`, 8 screen hooks (`hooks/`), and contract-to-prop mappers (`mappers/`).
3. **Next.js Proxy Route Handler**: Create `apps/web/app/api/proxy/[...path]/route.ts` to proxy requests to Fastify Gateway, handling `httpOnly` cookies and removing browser CORS.
4. **Lint Guardrail**: Configure `no-restricted-imports` in `eslint.config.mjs` to ban fixture/mock imports inside `src/`. Clean up unused vars and `react-hooks` rule issue.
5. **E2E & Validation**: Add Vitest backend mutation test in `apps/web` and CDP scenario 13 in `tests/cdp/scenarios/`. Ensure `typecheck`, `lint`, and `test` in `apps/web` pass cleanly with 0 errors.

---

## 5. Verification Method

To independently verify all findings and configurations:

1. **Verify OpenAPI Generation**:
   ```bash
   PYTHONPATH=apps/agent-runtime/src uv run --project apps/agent-runtime python -c "from agent_runtime.main import app; import json; print(len(app.openapi()['paths']))"
   # Asserts 4 paths returned for Agent Runtime
   ```
2. **Verify Type Generation**:
   ```bash
   pnpm dlx openapi-typescript .agents/teamwork/explorer_survey_infra/openapi-agent-runtime.json -o .agents/teamwork/explorer_survey_infra/test-types.ts
   # Asserts test-types.ts generates without error
   ```
3. **Verify Typecheck**:
   ```bash
   pnpm --filter @payguardian/web typecheck
   # Asserts exit code 0
   ```
4. **Verify Vitest Suite**:
   ```bash
   pnpm --filter @payguardian/web test
   # Asserts 6 test files pass, 20 tests pass
   ```
5. **Inspect Full Survey Report**:
   ```bash
   view_file AbsolutePath="/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_survey_infra/report.md"
   ```
