# Handoff Report: Backend Discovery, API Specs, and Architecture Exploration

**Agent**: `explorer_backend`  
**Working Directory**: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_backend`  
**Target Milestone**: `backend_discovery_and_api_spec`  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Service Entry Points and Ports**:
   - `apps/api/src/server.ts:25-26`:
     ```ts
     const port = Number(process.env.API_PORT ?? 3001);
     const host = process.env.API_HOST ?? "127.0.0.1";
     ```
   - `apps/api/api/index.ts:7-11`: Serverless Vercel handler wrapping `buildApp({ logger: false })`.
   - `apps/web/package.json:6`: `"dev": "next dev --port 3000"`
   - `package.json:9`: `"dev:agent": "uv run --project apps/agent-runtime uvicorn agent_runtime.main:app --app-dir apps/agent-runtime/src --reload"`
   - `README.md:46-51`: Web port `3000`, API port `3001`, Agent runtime port `8000`.
   - `apps/worker/src/index.ts:55-63`: Polling worker process that runs `createWorkerRuntime()` and does not bind an HTTP port.

2. **API Specifications**:
   - `apps/api/src/app.ts:66`: `app.get("/docs/json", async () => app.swagger());` (OpenAPI 3.0 via `@fastify/swagger`).
   - `apps/agent-runtime/src/agent_runtime/main.py:15`: `app = FastAPI(title="PayGuardian Agent Runtime", ...)` serving OpenAPI at `/openapi.json` and Swagger UI at `/docs`.
   - `packages/contracts/src/index.ts:1-258`: Shared TypeScript DTO contracts for all domain models and API endpoints.

3. **Authentication & Principal Validation**:
   - `apps/api/src/auth.ts:18-34`:
     - Checks `localUserId`: if `localAuthEnabled`, returns `{ userId: localUserId, kind: "user" }`.
     - Checks `Bearer pg_<secret>`: calls `registry.verifyAgentCredential(token)` to verify agent credential hash.
     - Checks standard `Bearer <jwt>`: calls `client.auth.getUser(token)` on Supabase client.
   - `apps/web/app/lib/api.ts:12-19`:
     ```ts
     if (session?.access_token) {
       headers.set("authorization", `Bearer ${session.access_token}`);
       headers.delete("x-local-user-id");
     } else if (!isProduction && localUserId) {
       headers.set("x-local-user-id", localUserId);
     }
     ```
   - `apps/agent-runtime/src/agent_runtime/main.py:141`:
     `"authorityGranted": False, # Gateway is the only authority source`
   - `apps/agent-runtime/src/agent_runtime/gateway_client.py:42-48`:
     `GatewayClient` adds `Authorization: Bearer <token>` or `x-local-user-id` in outbound HTTP headers to Gateway API.

4. **Real-Time and Queue Infrastructure**:
   - `apps/web/components/shell/status-pill.tsx:115`: `<span>Protocol: WebSocket + SSE</span>` (hardcoded UI copy).
   - Global repository search for `EventSource`, `text/event-stream`, and `@fastify/websocket` in `apps/api` and `apps/agent-runtime` yielded zero occurrences.
   - `docs/tech.md:24`:
     `"PostgreSQL outbox/job tables with leased workers, retries and idempotent consumers | No Redis initially; we own leasing/recovery/backoff and must test crash cases."`
   - `apps/worker/src/runner.ts:35-49`: `PollingWorker` claims jobs via `this.store.claim({ workerId, limit, leaseDurationMs })` which invokes Supabase Postgres RPC `claim_provider_jobs`.
   - `apps/worker/src/executor.ts:68-75`: Worker executes jobs for provider `paypal` with intents `create_order`, `capture_order`, `reconcile_order`, and `apply_event`. It writes results directly to `provider_operations` and `ledger_reservations`, publishing nothing to an external message bus.

5. **API Discrepancies**:
   - `docs/api.md:23` documents `GET /v1/environments/:environmentId`. Search in `apps/api/src/phase1-routes.ts` shows only `GET /v1/environments` (list) is implemented.
   - `apps/api/src/phase4.ts:281-289`: `createApprovalStore` and `createSessionStore` return `InMemoryApprovalStore` and `InMemorySessionStore` unconditionally, ignoring `_supabaseClient`.

---

## 2. Logic Chain

1. **Service Boundaries**:
   - Observations 1 & 2 establish that the repository separates the user-facing web dashboard (`apps/web`, port 3000), the central transactional authority gateway (`apps/api`, port 3001), the Python ADK simulation runtime (`apps/agent-runtime`, port 8000), and the background PayPal reconciliation daemon (`apps/worker`, headless).
2. **Authority & Security Invariant**:
   - Observation 3 shows that user authentication occurs via Supabase Auth in the browser or the `x-local-user-id` header in local development. When requests hit `apps/api`, `createPrincipalResolver` enforces authentication.
   - In contrast, `apps/agent-runtime` has no authentication middleware on its routes and explicitly delegates all authority checks (`check_authority`, `simulate_action`, `reserve_action`) to `apps/api` via `GatewayClient`.
   - Therefore: **The Fastify Gateway API (`apps/api`) is the sole enforcer of identity, mandates, ledger budgets, and spending authority.**
3. **Real-Time & Queue Mechanics**:
   - Observation 4 confirms that despite frontend copy referencing "WebSocket + SSE", neither WebSocket nor SSE servers exist. The only real-time mechanism currently supported is cursor-based timestamp polling (`GET /v1/environments/:id/activity?since=...`).
   - Furthermore, durable jobs rely entirely on PostgreSQL row locks and lease RPCs in Supabase (`public.provider_jobs`), without any Redis or external message broker dependency. The worker updates Postgres tables directly upon completing jobs without publishing events to any queue.
4. **Screen Mapping Completeness**:
   - Using the catalog of 38 Fastify endpoints and 4 FastAPI endpoints, 7 screens are completely backed (**FOUND**: Activity Feed, Sessions, Approvals, Payment Trace, Mandates, Audit Grid, Security), 5 screens have partial backing (**PARTIAL**: Workspace Graph, Budget Strip, Chat, Library, Developers), and 1 screen has no dedicated entity endpoint (**MISSING**: Memory).

---

## 3. Caveats

1. **In-Memory Volatility**:
   - As observed in `apps/api/src/phase4.ts:281-289`, Approvals and Sessions currently use `InMemoryApprovalStore` and `InMemorySessionStore`. Even when `DATABASE_MODE=supabase` is set, approvals and sessions will be lost on server restart until Supabase Postgres tables and stores are implemented for Phase 4.
2. **Local Dev Auth in Production**:
   - `apps/api/src/auth.ts:18` and `packages/config/src/index.ts:67-69` strictly forbid `ENABLE_LOCAL_DEV_AUTH` when `NODE_ENV=production`. In production, all calls must use valid Supabase Auth JWTs.
3. **PayPal Provider Restrictions**:
   - PayPal operations only support currency `"USD"`. Any INR transactions are rejected or marked simulation-only.

---

## 4. Conclusion

The PayGuardian backend is architecturally sound with a strict separation between agent reasoning (`apps/agent-runtime`) and financial authority enforcement (`apps/api`). All 42 backend endpoints have been enumerated with parameter and response schemas. The findings directly provide the necessary backend discovery, auth analysis, real-time assessment, and screen-to-API mapping required for the integration audit (`docs/frontend-audit.md`).

Detailed documentation has been compiled in:
`/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_backend/report.md`

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Services & Endpoints**:
   - Fastify Gateway routes: Inspect `apps/api/src/app.ts`, `phase1-routes.ts`, `phase2-routes.ts`, `phase3-routes.ts`, `phase4-routes.ts`, `paypal-routes.ts`, and `phase6-routes.ts`.
   - Dynamic OpenAPI endpoint: Start API (`pnpm dev:api`) and fetch `http://localhost:3001/docs/json`.
   - Python Agent Runtime routes: Inspect `apps/agent-runtime/src/agent_runtime/main.py`. Fetch `http://localhost:8000/openapi.json`.
2. **Verify Queue & Real-Time Claims**:
   - Check `grep -rn "redis" apps/ packages/` -> No application references found.
   - Check `grep -rn "websocket" apps/api/ apps/agent-runtime/` -> No occurrences found.
   - Inspect queue definitions in `supabase/migrations/20261022003000_provider_jobs.sql`.
   - Inspect worker polling loop in `apps/worker/src/runner.ts:35-49`.
3. **Run Project Test Commands**:
   - JS/TS Test Suite: `pnpm test`
   - Python Test Suite: `uv run --project apps/agent-runtime pytest apps/agent-runtime/tests`
   - Release Readiness Gate: `pnpm release:check`
