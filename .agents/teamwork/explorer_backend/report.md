# PayGuardian Backend Service Discovery, API Specification, and Architecture Report

**Explorer**: `explorer_backend`  
**Date**: 2026-11-01T20:53:00Z  
**Monorepo Root**: `/home/anas/myspace/AI/PayGuardian`  
**Working Directory**: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_backend`

---

## 1. Executive Summary

This investigation conducted a comprehensive, read-only audit of all backend services, API specifications, authentication flows, real-time mechanisms, and asynchronous worker queues across the PayGuardian repository. 

Key architectural discoveries:
1. **Service Topology**: The monorepo consists of five distinct operational units:
   - **Frontend Dashboard**: Next.js 16 (`apps/web`), running on port `3000`.
   - **Gateway API & Basic Auth Backend**: Fastify 5 (`apps/api`), running on port `3001` (Vercel serverless entrypoint in `apps/api/api/index.ts`).
   - **Delegation Engine & Agent Runtime**: Python 3.11+ FastAPI with Google ADK (`apps/agent-runtime`), running on port `8000`.
   - **Durable Payment Reconciliation Worker**: Node.js 22+ headless runner (`apps/worker`), polling Supabase PostgreSQL via RPC leasing.
   - **Specialist Python Agents**: 6 configured agents under `agents/` (`activities`, `food`, `hotel`, `personal`, `transport`, `travel`) and configured dummy definitions in `apps/agent-runtime/src/agent_runtime/agents.py`.
2. **Authority & Token Validation Architecture**:
   - The **Fastify Gateway API** (`apps/api/src/auth.ts`) is the **sole validation authority** for financial actions, ledger reservations, and mandates.
   - The **Python Agent Runtime** (`apps/agent-runtime`) **does NOT validate user sessions or grant authority**. It acts purely as a simulation or reasoning orchestrator that delegates protected operations downward to the Fastify Gateway via `GatewayClient` (`apps/agent-runtime/src/agent_runtime/gateway_client.py`).
   - Requests use Supabase Auth Bearer JWTs (`Authorization: Bearer <jwt>`), agent credentials (`Authorization: Bearer pg_<token>`), or local development headers (`x-local-user-id`).
3. **Real-Time and Messaging Infrastructure**:
   - **No WebSockets or Server-Sent Events (SSE)** exist in the backend services. The frontend status pill (`apps/web/components/shell/status-pill.tsx:115`) displays hardcoded text `"Protocol: WebSocket + SSE"`, but no WebSocket/SSE listener or emitter exists in backend code.
   - **No Redis broker is used**. Per architectural record `docs/tech.md:24`, the queue is built entirely on PostgreSQL outbox and job tables (`public.provider_jobs`) in Supabase using database-level lease fencing (`claim_provider_jobs`, `renew_provider_job`, `complete_provider_job`, `fail_provider_job`).
   - The worker **does not publish events** to an external pub/sub bus. It consumes jobs from `public.provider_jobs` and writes state changes directly to `public.provider_operations` and `public.ledger_reservations`.
4. **API Endpoint Catalog**:
   - 38 HTTP endpoints in Fastify Gateway API (`apps/api`).
   - 4 HTTP endpoints in Python Agent Runtime (`apps/agent-runtime`).
   - Total: 42 backend endpoints cataloged with parameter schemas, responses, and exact source citations.

---

## 2. Service Discovery and Startup Specifications (Requirement R1)

### 2.1 Next.js Frontend Dashboard (`apps/web`)
- **Repository Path**: `/home/anas/myspace/AI/PayGuardian/apps/web`
- **Primary Entry Points**:
  - Root redirect / landing: `apps/web/app/page.tsx:1`
  - Main Dashboard shell: `apps/web/app/dashboard/page.tsx:1`
  - Global Layout: `apps/web/app/layout.tsx:1`
  - Auth Provider: `apps/web/app/auth-provider.tsx:20`
  - API Client: `apps/web/app/lib/api.ts:24`
- **Startup Commands & Scripts**:
  - `pnpm dev:web` (from repository root, defined in `/home/anas/myspace/AI/PayGuardian/package.json:7`)
  - `make dev-web` (defined in `/home/anas/myspace/AI/PayGuardian/Makefile:21-22`)
  - `pnpm --filter @payguardian/web dev` -> executes `next dev --port 3000` (defined in `/home/anas/myspace/AI/PayGuardian/apps/web/package.json:6`)
  - Build command: `pnpm --filter @payguardian/web build` (`next build`)
- **Default Port & Host**: `http://localhost:3000`
- **Runtime & Engine**: Node.js 22+, Next.js 16.4.2, React 19.3.1
- **Configuration & Environment Variables**:
  - `NEXT_PUBLIC_API_BASE_URL` (default: `http://localhost:3001`, see `.env.example:3`)
  - `NEXT_PUBLIC_SUPABASE_URL` (see `apps/web/app/lib/supabase-browser.ts:8`)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `apps/web/app/lib/supabase-browser.ts:9`)
  - `NEXT_PUBLIC_ENABLE_LOCAL_DEV_AUTH` / `ENABLE_LOCAL_DEV_AUTH` (see `apps/web/app/lib/supabase-browser.ts:21-25`)
  - `NEXT_PUBLIC_LOCAL_USER_ID` (default: `local-user`, see `README.md:96`)
- **API Spec Location**: Consumes gateway contracts directly via TypeScript DTO types from `@payguardian/contracts` (`packages/contracts/src/index.ts`).

---

### 2.2 Basic Auth Backend & Gateway REST API (`apps/api`)
- **Repository Path**: `/home/anas/myspace/AI/PayGuardian/apps/api`
- **Primary Entry Points**:
  - Standalone Server: `apps/api/src/server.ts:23-34`
  - Fastify Application Builder: `apps/api/src/app.ts:32` (`buildApp()`)
  - Vercel Serverless Function Handler: `apps/api/api/index.ts:7-11`
- **Startup Commands & Scripts**:
  - `pnpm dev:api` (defined in `/home/anas/myspace/AI/PayGuardian/package.json:8`)
  - `make dev-api` (defined in `/home/anas/myspace/AI/PayGuardian/Makefile:24-25`)
  - `pnpm --filter @payguardian/api dev` -> executes `tsx watch src/server.ts` (defined in `apps/api/package.json:7`)
  - Build command: `pnpm --filter @payguardian/api build` -> executes `tsc --outDir dist --noEmit false`
- **Default Port & Host**:
  - Port: `3001` (configured via `process.env.API_PORT ?? 3001`, `apps/api/src/server.ts:25`)
  - Host: `127.0.0.1` (configured via `process.env.API_HOST ?? "127.0.0.1"`, `apps/api/src/server.ts:26`)
- **Runtime & Engine**: Node.js 22+, Fastify 5.12.7, TypeScript 6.0.3, tsx 4.23.15
- **Configuration & Environment Variables** (`packages/config/src/index.ts:59-106`):
  - `NODE_ENV`: `development` | `test` | `production`
  - `API_PORT`: Port number (default `3001`)
  - `API_HOST`: Host address (default `127.0.0.1`)
  - `DATABASE_MODE`: `memory` | `supabase` (default `memory`, requires `supabase` in production)
  - `ENABLE_LOCAL_DEV_AUTH`: boolean (`true` enables `x-local-user-id` header bypass; prohibited in production)
  - `SUPABASE_URL`: Supabase project URL (HTTPS required in production)
  - `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key (server-only; prohibited in browser)
  - `CORS_ORIGIN`: CORS allowed origin (default `http://localhost:3000`, `apps/api/src/app.ts:53`)
  - `PAYPAL_EXECUTION_MODE`: `inline` | `worker` (default `inline`; requires `worker` in production)
  - `PAYPAL_BASE_URL`: e.g. `https://api-m.sandbox.paypal.com`
  - `PAYPAL_CLIENT_ID`: PayPal client ID
  - `PAYPAL_CLIENT_SECRET`: PayPal client secret
  - `PAYPAL_RETURN_URL`: Callback return URL (default: `http://localhost:3000/paypal/return`)
  - `PAYPAL_CANCEL_URL`: Callback cancel URL (default: `http://localhost:3000/paypal/cancel`)
  - `PAYPAL_WEBHOOK_ID`: PayPal webhook verification ID
  - `GEMINI_MODEL`: e.g. `gemini-2.5-flash` (`apps/api/src/app.ts:163`)
- **API Spec Locations**:
  - **Dynamic OpenAPI 3.0 JSON**: Served at `GET /docs/json` via `@fastify/swagger` (`apps/api/src/app.ts:55-66`).
  - **Canonical Markdown Documentation**: `docs/api.md:1-75`.
  - **Shared TypeScript DTO Contracts**: `packages/contracts/src/index.ts:1-258`.
  - **Fastify Inline Route Schemas**:
    - System schemas: `apps/api/src/app.ts:87-170`
    - Domain schemas: `apps/api/src/phase1-routes.ts`, `phase2-routes.ts`, `phase3-routes.ts`, `phase4-routes.ts`, `paypal-routes.ts`, `phase6-routes.ts`.

---

### 2.3 Python Delegation Engine API / Agent Runtime (`apps/agent-runtime`)
- **Repository Path**: `/home/anas/myspace/AI/PayGuardian/apps/agent-runtime`
- **Primary Entry Points**:
  - FastAPI Application: `apps/agent-runtime/src/agent_runtime/main.py:15` (`app = FastAPI(...)`)
  - ADK Agent Factory: `apps/agent-runtime/src/agent_runtime/agents.py:24` (`build_agent()`)
  - Gateway Client: `apps/agent-runtime/src/agent_runtime/gateway_client.py:27` (`GatewayClient`)
- **Startup Commands & Scripts**:
  - `pnpm dev:agent` (defined in `/home/anas/myspace/AI/PayGuardian/package.json:9`)
  - `make dev-agent` (defined in `/home/anas/myspace/AI/PayGuardian/Makefile:27-28`)
  - Exact command: `uv run --project apps/agent-runtime uvicorn agent_runtime.main:app --app-dir apps/agent-runtime/src --reload`
  - Render deployment startup (defined in `/home/anas/myspace/AI/PayGuardian/render.yaml:6`):
    `uv run --frozen --package payguardian-agent-runtime uvicorn agent_runtime.main:app --host 0.0.0.0 --port $PORT --app-dir apps/agent-runtime/src`
- **Default Port & Host**:
  - Port: `8000` (uvicorn default, see `README.md:49-51`)
  - Host: `127.0.0.1` locally; `0.0.0.0` on Render
- **Runtime & Engine**: Python 3.11+, FastAPI 0.140.0, uvicorn 0.54.0, google-adk 2.12.0
- **Configuration & Environment Variables**:
  - `GATEWAY_API_URL`: Fastify API Gateway URL (default `http://localhost:3001`, `gateway_client.py:36`)
  - `GATEWAY_AUTH_TOKEN`: Optional Bearer token for outbound Gateway API calls (`gateway_client.py:38`)
  - `GATEWAY_LOCAL_USER_ID`: Development local user header fallback (default `local-user`, `gateway_client.py:39`)
  - `GEMINI_MODEL`: Model name (default `gemini-2.5-flash`, `agents.py:34`)
  - `GOOGLE_API_KEY`: Google Gemini API key (optional for dry runs)
- **API Spec Locations**:
  - **Built-in FastAPI OpenAPI Spec**: `GET http://localhost:8000/openapi.json`
  - **FastAPI Interactive Swagger UI**: `GET http://localhost:8000/docs`
  - **FastAPI ReDoc**: `GET http://localhost:8000/redoc`
  - **Pydantic Schemas**: `apps/agent-runtime/src/agent_runtime/main.py:25-35` (`RunRequest`).

---

### 2.4 Durable Payment Reconciliation Worker (`apps/worker`)
- **Repository Path**: `/home/anas/myspace/AI/PayGuardian/apps/worker`
- **Primary Entry Points**:
  - Process Main: `apps/worker/src/index.ts:55-63` (`main()`)
  - Runtime Factory: `apps/worker/src/index.ts:14-35` (`createWorkerRuntime()`)
  - Polling Loop Runner: `apps/worker/src/runner.ts:24` (`PollingWorker`)
  - Job Executor: `apps/worker/src/executor.ts:49` (`ProviderJobExecutor`)
  - Supabase Store: `apps/worker/src/store.ts:114` (`SupabaseWorkerStore`)
- **Startup Commands & Scripts**:
  - Compilation: `pnpm --filter @payguardian/worker build` (`tsc --outDir dist --noEmit false`)
  - Execution: `node apps/worker/dist/index.js` or `pnpm --filter @payguardian/worker exec tsx src/index.ts`
  - *Note*: No dedicated `pnpm dev:worker` shortcut script is defined in root `package.json`.
- **Port & Host**: **None**. Headless background worker that runs a polling loop against Supabase Postgres; does not bind an HTTP socket.
- **Runtime & Engine**: Node.js 22+, TypeScript 6.0.3, `@supabase/supabase-js` 2.99.2
- **Configuration & Environment Variables** (`apps/worker/src/config.ts:16-41`):
  - `DATABASE_MODE`: Must be `supabase` (in-memory mode cannot be shared across processes; `apps/worker/src/config.ts:35`)
  - `SUPABASE_URL`: Required Supabase instance URL (`apps/worker/src/config.ts:17`)
  - `SUPABASE_SERVICE_ROLE_KEY`: Required Supabase service-role key (`apps/worker/src/config.ts:18`)
  - `WORKER_ID`: Worker identifier (default: `${hostname()}-${process.pid}`, `apps/worker/src/config.ts:30`)
  - `WORKER_BATCH_SIZE`: Number of jobs claimed per batch (default `5`, `apps/worker/src/config.ts:31`)
  - `WORKER_POLL_INTERVAL_MS`: Polling interval in ms (default `5000`, `apps/worker/src/config.ts:32`)
  - `WORKER_LEASE_DURATION_MS`: Job lease duration in ms (default `60000`, `apps/worker/src/config.ts:33`)
  - `WORKER_LEASE_RENEWAL_INTERVAL_MS`: Heartbeat lease renewal interval (default `30000`, `apps/worker/src/config.ts:34`)
  - `PAYPAL_RETURN_URL`: Return URL (default `http://localhost:3000/paypal/return`)
  - `PAYPAL_CANCEL_URL`: Cancel URL (default `http://localhost:3000/paypal/cancel`)
  - `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`: PayPal sandbox credentials
- **Queue / Job Specifications**:
  - PostgreSQL Table: `public.provider_jobs`
  - Supported Intents: `create_order`, `capture_order`, `reconcile_order`, `apply_event` (`apps/worker/src/executor.ts:68-75`)
  - Retry & Backoff Policy: `packages/domain/src/provider-jobs.ts:10-22` (default: 5 max attempts, 1000ms initial, exponential factor 2, 60000ms max delay, with jitter).

---

### 2.5 Python Specialist Agents (`agents/` & `apps/agent-runtime`)
- **Repository Paths**:
  - Top-level definitions: `/home/anas/myspace/AI/PayGuardian/agents/`
    - `agents/personal/agent.py` (`build_personal_agent`)
    - `agents/travel/agent.py` (`build_travel_agent`)
    - `agents/hotel/agent.py` (`build_hotel_agent`)
    - `agents/transport/agent.py` (`build_transport_agent`)
    - `agents/food/agent.py` (`build_food_agent`)
    - `agents/activities/agent.py` (`build_activities_agent`)
  - Runtime definitions: `apps/agent-runtime/src/agent_runtime/agents.py:10-17` (`AGENT_DEFINITIONS`)
- **Startup & Execution Mode**:
  - Agents are initialized on-demand inside `apps/agent-runtime` when `POST /run` is invoked or when imported as Python modules.
  - Simulation-only by default (`dry_run=True` in `RunRequest`, `main.py:28`). When `dry_run=False`, invokes `GatewayClient` methods (`simulate_action`, `check_authority`, `request_approval`, `reserve_action`).
- **Configuration**:
  - `GEMINI_MODEL`: `gemini-2.5-flash`
  - Invariant: Credentials are strictly passed in HTTP headers (`Authorization` or `x-local-user-id`) and **never injected into agent prompts** (`apps/agent-runtime/src/agent_runtime/gateway_client.py:21-25`, `assert_safe_prompt_content`).

---

## 3. Auth Flow and Real-Time Capabilities (Requirement R4)

### 3.1 Authentication and Session Architecture
The authentication and session mechanics operate across three tiers:

```
┌─────────────────────────┐          ┌───────────────────────────┐
│       apps/web          │          │         apps/api          │
│   (Next.js Frontend)    │          │     (Fastify Gateway)     │
└────────────┬────────────┘          └─────────────┬─────────────┘
             │                                     │
    1. Sign in via Supabase Auth                   │
       or local dev bypass                         │
             │                                     │
    2. API request with Headers:                   │
       - Authorization: Bearer <jwt>               │
       - x-local-user-id: <user_id> (dev only)     │
             │                                     │
             ├────────────────────────────────────►│
             │                                     │ 3. PrincipalResolver
             │                                     │    (apps/api/src/auth.ts:10)
             │                                     │    - If localUserId && localAuthEnabled:
             │                                     │      -> { userId, kind: "user" }
             │                                     │    - If token starts with "pg_":
             │                                     │      -> registry.verifyAgentCredential()
             │                                     │    - Else:
             │                                     │      -> supabase.auth.getUser(token)
             │                                     │
┌────────────┴────────────┐                        │
│   apps/agent-runtime    │                        │
│   (Python ADK API)      │                        │
└────────────┬────────────┘                        │
             │                                     │
             │ 4. Outbound Tool Call via           │
             │    GatewayClient (no user prompt    │
             │    credentials)                     │
             ├────────────────────────────────────►│ 5. Evaluates Mandates,
                                                        Ledger Accounts, and
                                                        Authority Constraints
```

#### Detailed Token & Session Mechanics:
1. **Frontend Session Management** (`apps/web/app/auth-provider.tsx:20-91`):
   - In production or when Supabase credentials are present, creates a browser client (`apps/web/app/lib/supabase-browser.ts:5`) using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Listens to session state via `supabase.auth.onAuthStateChange`.
   - When calling Gateway API (`apps/web/app/lib/api.ts:3-22`, `buildApiHeaders`), if `session?.access_token` is present, it attaches:
     `Authorization: Bearer <session.access_token>`
     and deletes `x-local-user-id`.
   - If no access token exists and `NODE_ENV !== "production"` with `localUserId` present, it attaches:
     `x-local-user-id: <localUserId>`
2. **Gateway Principal Resolution** (`apps/api/src/auth.ts:10-35`, `createPrincipalResolver`):
   - **Local Dev Mode**: If `localUserId` is present and `config.localDevAuthEnabled === true`, returns `{ userId: localUserId, kind: "user" }`. If `localUserId` is present but `config.localDevAuthEnabled === false` (e.g. in production), returns `null` (401 Unauthorized).
   - **Agent Credentials**: If `Authorization: Bearer pg_<token>`, verifies the secret hash against `public.agent_credentials` via `registry.verifyAgentCredential(token)`. If valid, returns `{ userId: verified.agent.ownerUserId, agentId: verified.agent.id, kind: "user" }`.
   - **User JWT**: If standard Bearer JWT, calls Supabase Auth `client.auth.getUser(token)`. If valid, returns `{ userId: data.user.id, kind: "user" }`.
3. **Delegation API Validation Responsibility**:
   - **Critical Architectural Finding**: **The Fastify Gateway API (`apps/api`) validates ALL requests and enforces all spending authority**.
   - The **Python Delegation API (`apps/agent-runtime`) does NOT validate user tokens, sessions, or authority**. Its FastAPI routes (`/health`, `/agents`, `/tools`, `/run`) have no authentication middleware. 
   - Furthermore, `apps/agent-runtime/src/agent_runtime/main.py:141` explicitly sets `"authorityGranted": False`, declaring that `"Gateway is the only authority source"`. When the runtime needs to perform actions, its `GatewayClient` calls the Fastify Gateway (`/v1/mandates/:mandateId/check`, `/v1/environments/:id/actions/simulate`, `/v1/environments/:id/actions/reserve`).

---

### 3.2 Real-Time Capabilities (SSE & WebSockets)
- **Investigation Finding**: **Neither Server-Sent Events (SSE) nor WebSockets are implemented in the backend services.**
- **Codebase Evidence**:
  - `apps/api`: Zero instances of `fastify-websocket`, `@fastify/websocket`, or `text/event-stream`.
  - `apps/agent-runtime`: Zero instances of WebSocket endpoints or EventSource stream generators.
  - `apps/web`: The component `apps/web/components/shell/status-pill.tsx:115` displays:
    ```html
    <span>Protocol: WebSocket + SSE</span>
    ```
    However, this is static mock telemetry UI copy; no WebSocket connection or `EventSource` instance is initialized in the frontend code.
- **Current Data Freshness Model**:
  - The frontend polls or queries endpoints on user action.
  - `GET /v1/environments/:environmentId/activity` (`apps/api/src/phase6-routes.ts:174`) supports timestamp cursor polling via query parameters `since` and `limit`.

---

### 3.3 Event Queues, Worker, and Broker Architecture
- **Event Queue / Broker**:
  - **No Redis, RabbitMQ, Kafka, or SQS broker is used in the repository.**
  - `docs/tech.md:24` documents the explicit architectural decision:
    > *"Jobs — recommended: PostgreSQL outbox/job tables with leased workers, retries and idempotent consumers. No Redis initially; we own leasing/recovery/backoff and must test crash cases."*
- **Durable Queue Implementation (`public.provider_jobs`)**:
  - Tables & RPCs defined in `supabase/migrations/20261022003000_provider_jobs.sql` and `20261022007000_provider_job_lease_fencing.sql`.
  - Stored fields: `id`, `provider`, `intent`, `dedupe_key`, `payload`, `status` (`queued` | `running` | `completed` | `failed`), `attempts`, `max_attempts`, `available_at`, `lease_owner`, `lease_token`, `lease_expires_at`, `last_error_code`, `last_error_message`, `completed_at`.
- **Worker Leases & Fencing**:
  - Worker runs `PollingWorker` (`apps/worker/src/runner.ts:24`).
  - Calls `claim_provider_jobs` RPC (`apps/worker/src/store.ts:143-154`).
  - Background renewal timer periodically calls `renew_provider_job` RPC (`runner.ts:85-99`).
  - On success, calls `complete_provider_job` RPC (`runner.ts:104-109`).
  - On error, calls `fail_provider_job` RPC (`runner.ts:112-128`) with retry delay calculated via `retryAtFor(job.attempts, ...)`.
- **Worker Intent Types (`apps/worker/src/executor.ts:68-75`)**:
  1. `create_order`: Calls `paypal.createOrder()`, records `providerOrderId` and `approvalUrl` in `provider_operations`.
  2. `capture_order`: Calls `paypal.captureOrder()`, transitions reservation to `captured` in the ledger, updates operation status to `COMPLETED`.
  3. `reconcile_order`: Queries PayPal status for pending order and syncs ledger reservation (`reconcileOrder`, `executor.ts:153-215`).
  4. `apply_event`: Applies verified incoming PayPal webhook events idempotently (`applyEvent`, `executor.ts:217-273`).
- **Worker Event Publishing**:
  - **The worker does NOT publish events to an external message broker or client bus**.
  - All state transitions are committed directly to Postgres (`provider_operations`, `provider_events`, `ledger_reservations`, `audit_events`).

---

## 4. Complete Backend API Catalog

### 4.1 Fastify REST API Gateway (`apps/api`)

#### System & Metadata Endpoints
1. **GET `/health`**
   - **Source**: `apps/api/src/app.ts:84-107`
   - **Auth**: None
   - **Parameters**: None
   - **Response Schema** (200):
     ```json
     {
       "status": "ok",
       "service": "gateway-api",
       "phase": "repository-and-deployment-proof"
     }
     ```

2. **GET `/docs/json`**
   - **Source**: `apps/api/src/app.ts:66`
   - **Auth**: None
   - **Parameters**: None
   - **Response**: Full OpenAPI 3.0 specification generated dynamically by `@fastify/swagger`.

3. **GET `/v1/system/status`**
   - **Source**: `apps/api/src/app.ts:109-132`
   - **Auth**: None
   - **Parameters**: None
   - **Response Schema** (200):
     ```json
     {
       "service": "gateway-api",
       "authorityEnforcement": "not-enabled",
       "message": "Phase 0 exposes health and contract proof only."
     }
     ```

4. **GET `/v1/models`**
   - **Source**: `apps/api/src/app.ts:134-171`
   - **Auth**: None
   - **Parameters**: None
   - **Response Schema** (200):
     ```json
     {
       "models": [
         { "id": "gemini-2.5-flash", "label": "Gemini 2.5 Flash", "provider": "Google Gemini", "default": true },
         { "id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro", "provider": "Google Gemini" },
         { "id": "gemini-2.5-flash-lite", "label": "Gemini 2.5 Flash Lite", "provider": "Google Gemini" }
       ]
     }
     ```

---

#### Environments (`apps/api/src/phase1-routes.ts`, `phase6-routes.ts`)
5. **POST `/v1/environments`**
   - **Source**: `apps/api/src/phase1-routes.ts:37-81`
   - **Auth**: Required (`Authorization: Bearer` or `x-local-user-id`)
   - **Body Schema**:
     ```json
     {
       "name": "string (min 1)",
       "purpose": "string (min 1)",
       "currency": "string (e.g. 'USD')",
       "budgetLimitMinor": "integer (>= 0)"
     }
     ```
   - **Response** (201): `{ "environment": EnvironmentDto }`

6. **GET `/v1/environments`**
   - **Source**: `apps/api/src/phase1-routes.ts:83-91`
   - **Auth**: Required
   - **Parameters**: None
   - **Response** (200): `{ "environments": EnvironmentDto[] }`

7. **POST `/v1/environments/:environmentId/pause`**
   - **Source**: `apps/api/src/phase6-routes.ts:64-103`
   - **Auth**: Required
   - **Params**: `environmentId: string`
   - **Response** (200): `{ "environment": EnvironmentDto }` (status: `"paused"`)

8. **POST `/v1/environments/:environmentId/resume`**
   - **Source**: `apps/api/src/phase6-routes.ts:64-103`
   - **Auth**: Required
   - **Params**: `environmentId: string`
   - **Response** (200): `{ "environment": EnvironmentDto }` (status: `"active"`)

9. **POST `/v1/environments/:environmentId/revoke`**
   - **Source**: `apps/api/src/phase6-routes.ts:64-103`
   - **Auth**: Required
   - **Params**: `environmentId: string`
   - **Response** (200): `{ "environment": EnvironmentDto }` (status: `"revoked"`)

*(Note: `GET /v1/environments/:environmentId` is NOT implemented in code; only list exists).*

---

#### Agents & Credentials (`apps/api/src/phase1-routes.ts`, `phase6-routes.ts`)
10. **GET `/v1/environments/:environmentId/agents`**
    - **Source**: `apps/api/src/phase1-routes.ts:93-112`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Response** (200): `{ "agents": AgentDto[] }`

11. **POST `/v1/environments/:environmentId/agents/root`**
    - **Source**: `apps/api/src/phase1-routes.ts:114-164`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**:
      ```json
      {
        "name": "string",
        "capabilities": ["string"]
      }
      ```
    - **Response** (201): `{ "agent": AgentDto, "credential": CreatedCredential }`

12. **POST `/v1/environments/:environmentId/agents/children`**
    - **Source**: `apps/api/src/phase1-routes.ts:166-225`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**:
      ```json
      {
        "parentAgentId": "string",
        "name": "string",
        "kind": "personal" | "travel" | "hotel" | "transport" | "food" | "activities" | "custom",
        "capabilities": ["string"]
      }
      ```
    - **Response** (201): `{ "agent": AgentDto, "credential": CreatedCredential }`

13. **POST `/v1/environments/:environmentId/agents/:agentId/credentials/rotate`**
    - **Source**: `apps/api/src/phase1-routes.ts:227-264`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `agentId: string`
    - **Response** (201): `{ "credential": CreatedCredential }`

14. **POST `/v1/environments/:environmentId/agents/:agentId/credentials/:credentialId/revoke`**
    - **Source**: `apps/api/src/phase1-routes.ts:266-307`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `agentId: string`, `credentialId: string`
    - **Response** (200): `{ "revoked": true }`

15. **POST `/v1/environments/:environmentId/agents/:agentId/disable`**
    - **Source**: `apps/api/src/phase6-routes.ts:109-152`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `agentId: string`
    - **Response** (200): `{ "agent": AgentDto }` (status: `"disabled"`)

16. **POST `/v1/environments/:environmentId/agents/:agentId/revoke`**
    - **Source**: `apps/api/src/phase6-routes.ts:109-152`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `agentId: string`
    - **Response** (200): `{ "agent": AgentDto }` (status: `"revoked"`)

---

#### Mandates & Delegation (`apps/api/src/phase2-routes.ts`, `phase6-routes.ts`)
17. **POST `/v1/environments/:environmentId/mandates/root`**
    - **Source**: `apps/api/src/phase2-routes.ts:38-107`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**:
      ```json
      {
        "holderAgentId": "string",
        "budgetLimitMinor": "integer (> 0)",
        "currency": "string",
        "permittedActions": ["string"],
        "expiresAt": "string (ISO date)",
        "canDelegate": "boolean",
        "maxDelegationDepth": "integer (>= 0)",
        "approvalRequired": "boolean"
      }
      ```
    - **Response** (201): `{ "mandate": MandateDto }`

18. **POST `/v1/mandates/:mandateId/delegations`**
    - **Source**: `apps/api/src/phase2-routes.ts:109-167`
    - **Auth**: Required
    - **Params**: `mandateId: string`
    - **Body Schema**: Same as `POST .../mandates/root` (must be subset of parent constraints)
    - **Response** (201 or 403): `{ "mandate"?: MandateDto, "decision": PolicyDecisionDto }`

19. **POST `/v1/mandates/:mandateId/revocations`**
    - **Source**: `apps/api/src/phase2-routes.ts:169-188`
    - **Auth**: Required
    - **Params**: `mandateId: string`
    - **Response** (200): `{ "mandate": MandateDto }`

20. **POST `/v1/mandates/:mandateId/check`**
    - **Source**: `apps/api/src/phase2-routes.ts:190-206`
    - **Auth**: Required
    - **Params**: `mandateId: string`
    - **Body Schema**:
      ```json
      {
        "action": "string",
        "amountMinor": "integer",
        "currency": "string",
        "approvalGranted": "boolean (optional)"
      }
      ```
    - **Response** (200 or 403): `{ "decision": PolicyDecisionDto }`

21. **GET `/v1/mandates/:mandateId/chain`**
    - **Source**: `apps/api/src/phase2-routes.ts:208-220`
    - **Auth**: Required
    - **Params**: `mandateId: string`
    - **Response** (200): `{ "chain": MandateDto[] }`

22. **GET `/v1/environments/:environmentId/mandates`**
    - **Source**: `apps/api/src/phase6-routes.ts:154-169`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Response** (200): `{ "mandates": MandateDto[] }`

---

#### Ledger & Protected Actions (`apps/api/src/phase3-routes.ts`, `phase4-routes.ts`)
23. **POST `/v1/environments/:environmentId/ledger/accounts`**
    - **Source**: `apps/api/src/phase3-routes.ts:46-116`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**:
      ```json
      {
        "mandateId": "string",
        "parentAccountId": "string | null (optional)",
        "currency": "string",
        "availableMinor": "integer"
      }
      ```
    - **Response** (201): `{ "account": LedgerAccountDto }`

24. **GET `/v1/environments/:environmentId/ledger/accounts`**
    - **Source**: `apps/api/src/phase3-routes.ts:145-160`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Response** (200): `{ "accounts": LedgerAccountDto[] }`

25. **GET `/v1/environments/:environmentId/ledger/accounts/:accountId`**
    - **Source**: `apps/api/src/phase3-routes.ts:118-143`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `accountId: string`
    - **Response** (200): `{ "account": LedgerAccountDto }`

26. **POST `/v1/environments/:environmentId/ledger/allocations`**
    - **Source**: `apps/api/src/phase3-routes.ts:205-246`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**:
      ```json
      {
        "parentAccountId": "string",
        "childAccountId": "string",
        "amountMinor": "integer",
        "idempotencyKey": "string",
        "requestHash": "string"
      }
      ```
    - **Response** (200): `{ "allocation": { "parentAccount": LedgerAccountDto, "childAccount": LedgerAccountDto } }`

27. **POST `/v1/environments/:environmentId/ledger/reclaims`**
    - **Source**: `apps/api/src/phase3-routes.ts:162-203`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**: Same as allocations
    - **Response** (200): `{ "reclaim": { "parentAccount": LedgerAccountDto, "childAccount": LedgerAccountDto } }`

28. **POST `/v1/environments/:environmentId/actions/reserve`**
    - **Source**: `apps/api/src/phase3-routes.ts:248-388`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**:
      ```json
      {
        "agentId": "string",
        "mandateId": "string",
        "ledgerAccountId": "string",
        "idempotencyKey": "string",
        "requestHash": "string",
        "action": "string",
        "amountMinor": "integer",
        "currency": "string",
        "approvalId": "string (optional)"
      }
      ```
    - **Response** (201): `ActionReserveResponse` (`{ "action": ..., "reservation": ... }`)

29. **POST `/v1/environments/:environmentId/actions/:actionId/capture`**
    - **Source**: `apps/api/src/phase3-routes.ts:390-423`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `actionId: string`
    - **Response** (200): `{ "reservation": { "actionId": "...", "state": "captured" } }`

30. **POST `/v1/environments/:environmentId/actions/:actionId/release`**
    - **Source**: `apps/api/src/phase3-routes.ts:425-461`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `actionId: string`
    - **Body Schema**: `{ "reason": "string" }`
    - **Response** (200): `{ "reservation": { "actionId": "...", "state": "released" } }`

31. **GET `/v1/environments/:environmentId/actions/:actionId`**
    - **Source**: `apps/api/src/phase3-routes.ts:463-483`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `actionId: string`
    - **Response** (200): `{ "action": ActionDto, "reservation": ReservationDto }`

32. **GET `/v1/environments/:environmentId/actions/:actionId/trace`**
    - **Source**: `apps/api/src/phase3-routes.ts:485-512`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `actionId: string`
    - **Response** (200): `{ "action": ActionDto, "agent": AgentDto, "mandateChain": MandateDto[], "rootMandate": MandateDto }`

33. **POST `/v1/environments/:environmentId/actions/simulate`**
    - **Source**: `apps/api/src/phase4-routes.ts:484-582`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**:
      ```json
      {
        "agentId": "string",
        "mandateId": "string",
        "action": "string",
        "amountMinor": "integer",
        "currency": "string",
        "parameters": "object (optional)"
      }
      ```
    - **Response** (200 or 403): `{ "allowed": boolean, "approvalRequired": boolean, "simulation": object }`

---

#### Approvals Inbox (`apps/api/src/phase4-routes.ts`)
34. **POST `/v1/environments/:environmentId/approvals`**
    - **Source**: `apps/api/src/phase4-routes.ts:68-138`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**:
      ```json
      {
        "mandateId": "string",
        "agentId": "string",
        "action": "string",
        "amountMinor": "integer",
        "currency": "string",
        "requestHash": "string"
      }
      ```
    - **Response** (201): `{ "approval": ApprovalDto }`

35. **GET `/v1/environments/:environmentId/approvals`**
    - **Source**: `apps/api/src/phase4-routes.ts:140-158`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Querystring**: `status?: "pending" | "approved" | "rejected"`, `mandateId?: string`
    - **Response** (200): `{ "approvals": ApprovalDto[] }`

36. **GET `/v1/environments/:environmentId/approvals/:approvalId`**
    - **Source**: `apps/api/src/phase4-routes.ts:160-182`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `approvalId: string`
    - **Response** (200): `{ "approval": ApprovalDto }`

37. **POST `/v1/environments/:environmentId/approvals/:approvalId/approve`**
    - **Source**: `apps/api/src/phase4-routes.ts:184-225`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `approvalId: string`
    - **Response** (200): `{ "approval": ApprovalDto }`

38. **POST `/v1/environments/:environmentId/approvals/:approvalId/reject`**
    - **Source**: `apps/api/src/phase4-routes.ts:227-268`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `approvalId: string`
    - **Body Schema**: `{ "reason": "string (optional)" }`
    - **Response** (200): `{ "approval": ApprovalDto }`

---

#### Sessions & Task Runs (`apps/api/src/phase4-routes.ts`)
39. **POST `/v1/environments/:environmentId/sessions`**
    - **Source**: `apps/api/src/phase4-routes.ts:271-308`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**: `{ "name": "string", "agentId": "string (optional)", "context": "object (optional)" }`
    - **Response** (201): `{ "session": SessionDto }`

40. **GET `/v1/environments/:environmentId/sessions`**
    - **Source**: `apps/api/src/phase4-routes.ts:310-325`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Response** (200): `{ "sessions": SessionDto[] }`

41. **GET `/v1/environments/:environmentId/sessions/:sessionId`**
    - **Source**: `apps/api/src/phase4-routes.ts:327-348`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `sessionId: string`
    - **Response** (200): `{ "session": SessionDto }`

42. **PATCH `/v1/environments/:environmentId/sessions/:sessionId`**
    - **Source**: `apps/api/src/phase4-routes.ts:350-382`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `sessionId: string`
    - **Body Schema**: `{ "status": "active" | "paused" | "completed" | "cancelled", "context": "object" }`
    - **Response** (200): `{ "session": SessionDto }`

43. **POST `/v1/environments/:environmentId/sessions/:sessionId/runs`**
    - **Source**: `apps/api/src/phase4-routes.ts:384-426`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `sessionId: string`
    - **Body Schema**: `{ "agentId": "string", "checkpoint": "object (optional)" }`
    - **Response** (201): `{ "run": SessionRunDto }`

44. **GET `/v1/environments/:environmentId/sessions/:sessionId/runs`**
    - **Source**: `apps/api/src/phase4-routes.ts:428-451`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `sessionId: string`
    - **Response** (200): `{ "runs": SessionRunDto[] }`

45. **PATCH `/v1/environments/:environmentId/sessions/:sessionId/runs/:runId`**
    - **Source**: `apps/api/src/phase4-routes.ts:453-481`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `sessionId: string`, `runId: string`
    - **Body Schema**: `{ "status": "running" | "paused" | "completed" | "failed", "checkpoint": "object" }`
    - **Response** (200): `{ "run": SessionRunDto }`

---

#### PayPal Provider Operations & Webhooks (`apps/api/src/paypal-routes.ts`)
46. **POST `/v1/environments/:environmentId/payments/paypal/orders`**
    - **Source**: `apps/api/src/paypal-routes.ts:234-451`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Body Schema**:
      ```json
      {
        "agentId": "string",
        "mandateId": "string",
        "ledgerAccountId": "string",
        "idempotencyKey": "string",
        "requestHash": "string",
        "action": "string",
        "amountMinor": "integer",
        "currency": "USD",
        "approvalId": "string (optional)",
        "returnUrl": "string (optional)",
        "cancelUrl": "string (optional)"
      }
      ```
    - **Response** (201 inline or 202 worker): `{ "action": ..., "operation": ..., "reservation": ..., "order"?: ..., "queued"?: boolean }`

47. **GET `/v1/environments/:environmentId/payments/paypal/operations`**
    - **Source**: `apps/api/src/paypal-routes.ts:453-485`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Querystring**: `limit?: string`, `cursor?: string`
    - **Response** (200): `{ "operations": PayPalOperationSummaryDto[], "pagination": { "limit": number, "nextCursor": string | null } }`

48. **GET `/v1/environments/:environmentId/payments/paypal/:actionId`**
    - **Source**: `apps/api/src/paypal-routes.ts:487-511`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `actionId: string`
    - **Response** (200): `{ "action": ..., "operation": ..., "reservation": ... }`

49. **POST `/v1/environments/:environmentId/payments/paypal/:actionId/capture`**
    - **Source**: `apps/api/src/paypal-routes.ts:513-598`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `actionId: string`
    - **Response** (200 inline or 202 worker): `{ "action": ..., "operation": ..., "reservation": ..., "capture"?: ... }`

50. **POST `/v1/environments/:environmentId/payments/paypal/:actionId/reconcile`**
    - **Source**: `apps/api/src/paypal-routes.ts:600-663`
    - **Auth**: Required
    - **Params**: `environmentId: string`, `actionId: string`
    - **Response** (200 inline or 202 worker): `{ "action": ..., "operation": ..., "reservation": ..., "provider"?: ... }`

51. **POST `/v1/webhooks/paypal`**
    - **Source**: `apps/api/src/paypal-routes.ts:665-746`
    - **Auth**: PayPal Webhook Signature Header Verification (`paypal.verifyWebhook`)
    - **Body**: Raw PayPal Webhook Event JSON
    - **Response** (200 inline or 202 worker): `{ "received": true, "operation"?: ..., "queued"?: boolean }`

---

#### Audit Trail (`apps/api/src/phase6-routes.ts`)
52. **GET `/v1/environments/:environmentId/activity`**
    - **Source**: `apps/api/src/phase6-routes.ts:171-199`
    - **Auth**: Required
    - **Params**: `environmentId: string`
    - **Querystring**: `since?: string (ISO timestamp)`, `limit?: string`
    - **Response** (200):
      ```json
      {
        "events": [
          {
            "id": "string",
            "environmentId": "string",
            "actorType": "user" | "agent" | "service" | "system",
            "actorId": "string | null",
            "mandateId": "string | null",
            "actionId": "string | null",
            "eventType": "string",
            "outcome": "success" | "denied" | "failure",
            "reasonCode": "string | null",
            "payload": {},
            "previousHash": "string | null",
            "eventHash": "string",
            "createdAt": "string"
          }
        ],
        "cursor": "string | null"
      }
      ```

---

### 4.2 Python Agent Runtime API (`apps/agent-runtime`)

1. **GET `/health`**
   - **Source**: `apps/agent-runtime/src/agent_runtime/main.py:37-46`
   - **Auth**: None
   - **Response** (200):
     ```json
     {
       "status": "ok",
       "service": "agent-runtime",
       "phase": "approvals-and-agent-workflows",
       "adkAvailable": true,
       "configuredAgents": ["personal", "travel", "hotel", "transport", "food", "activities"],
       "authorityEnforcement": "gateway-enforced"
     }
     ```

2. **GET `/agents`**
   - **Source**: `apps/agent-runtime/src/agent_runtime/main.py:49-51`
   - **Auth**: None
   - **Response** (200):
     ```json
     {
       "agents": ["personal", "travel", "hotel", "transport", "food", "activities"],
       "authorityEnforcement": "gateway-enforced"
     }
     ```

3. **GET `/tools`**
   - **Source**: `apps/agent-runtime/src/agent_runtime/main.py:54-76`
   - **Auth**: None
   - **Response** (200):
     ```json
     {
       "tools": [
         { "name": "check_authority", "description": "Check whether an action is permitted by a mandate." },
         { "name": "simulate_action", "description": "Execute a non-payment simulation action through the gateway." },
         { "name": "request_approval", "description": "Submit a protected action for human approval." },
         { "name": "reserve_action", "description": "Reserve ledger budget for an authorized protected action." }
       ],
       "credentialsInPrompts": false
     }
     ```

4. **POST `/run`**
   - **Source**: `apps/agent-runtime/src/agent_runtime/main.py:79-143`
   - **Auth**: None on endpoint itself (validates safe prompt via `assert_safe_prompt_content`)
   - **Body Schema** (`RunRequest`, `main.py:25-34`):
     ```json
     {
       "agent": "string (default: 'personal')",
       "message": "string (1-4000 chars)",
       "dry_run": "boolean (default: true)",
       "environment_id": "string (optional)",
       "mandate_id": "string (optional)",
       "action": "string (optional)",
       "amount_minor": "integer (optional)",
       "currency": "string (default: 'USD')",
       "parameters": "object (optional)"
     }
     ```
   - **Response** (200):
     ```json
     {
       "status": "simulated" | "executed",
       "agent": "personal",
       "message": "...",
       "adkAgentConfigured": true,
       "adkAgentConstructed": true,
       "authorityGranted": false,
       "paymentExecuted": false,
       "gatewayResult": "object (when dry_run=false)"
     }
     ```

---

## 5. Screen-to-Backend API Mapping Analysis

Below is the exhaustive mapping across all 13 frontend screens to existing backend endpoints, noting whether the backing API is **FOUND**, **PARTIAL**, or **MISSING**, and identifying shape differences.

| # | Screen | Status | Existing API Endpoints | Commands / Mutations Available | Gaps / Missing Capabilities |
|---|---|---|---|---|---|
| 1 | **Workspace Graph** | **PARTIAL** | `GET /v1/environments/:id/agents`<br>`GET /v1/environments/:id/mandates`<br>`GET /v1/environments/:id/ledger/accounts` | `POST .../agents/children`<br>`POST .../mandates/:id/delegations`<br>`POST .../ledger/allocations`<br>`POST .../agents/:id/revoke`<br>`POST .../mandates/:id/revocations` | No single composite graph endpoint. Frontend currently maintains 3D positions `[x,y,z]` and mock edges in `workspaceStore`. Backend has pure relational trees. |
| 2 | **Budget Strip** | **PARTIAL** | `GET /v1/environments`<br>`GET /v1/environments/:id/ledger/accounts` | `POST .../ledger/allocations`<br>`POST .../ledger/reclaims` | `GET /v1/environments/:id` is missing in code. To get environment summary (`spent`, `reserved`, `available`), client must filter `GET /v1/environments` list or inspect root ledger account in `/ledger/accounts`. |
| 3 | **Activity Feed** | **FOUND** | `GET /v1/environments/:id/activity?since=&limit=` | Appends automatically on all actions | Complete match for event list and cursor polling. Real-time push (SSE/WS) is missing; client must poll. |
| 4 | **Chat (Assistant)** | **PARTIAL** | `POST /run` (Agent Runtime :8000)<br>`POST .../actions/simulate` | `POST /run`<br>`POST .../actions/simulate` | Missing chat message persistence on Gateway API. Missing token-streaming SSE/WebSocket endpoint. Missing Gateway chat proxy route. |
| 5 | **Sessions** | **FOUND** | `GET .../sessions`<br>`GET .../sessions/:id`<br>`GET .../sessions/:id/runs` | `POST .../sessions`<br>`PATCH .../sessions/:id`<br>`POST .../sessions/:id/runs`<br>`PATCH .../runs/:id` | Full session and checkpoint lifecycle exists in Gateway API (Phase 4). *Caveat*: Stored in-memory in `apps/api`. |
| 6 | **Memory** | **MISSING** | Context field in `POST/PATCH .../sessions` | Context update in `PATCH .../sessions/:id` | No dedicated `/v1/environments/:id/memory` endpoint for environment or agent-level facts, pinning, or deletion. |
| 7 | **Library (Agents)**| **PARTIAL** | `GET /agents` (:8000)<br>`GET /tools` (:8000)<br>`GET .../agents` (:3001) | `POST .../agents/children` | Rich agent metadata (publisher, descriptions, requested permissions, categories) is hardcoded in frontend. No endpoint to register custom MCP/SDK agents. |
| 8 | **Approvals** | **FOUND** | `GET .../approvals`<br>`GET .../approvals/:id` | `POST .../approvals`<br>`POST .../approvals/:id/approve`<br>`POST .../approvals/:id/reject` | Full CRUD and decision lifecycle exists in Gateway API. *Caveat*: Stored in-memory in `apps/api`. |
| 9 | **Payment Trace** | **FOUND** | `GET .../actions/:id/trace`<br>`GET .../actions/:id`<br>`GET .../payments/paypal/:actionId` | `POST .../actions/:id/capture`<br>`POST .../actions/:id/release`<br>`POST .../payments/paypal/:actionId/reconcile` | Trace endpoint returns full ancestor mandate chain, agent info, and verification state. PayPal operation endpoint returns provider order & capture details. |
| 10 | **Mandates** | **FOUND** | `GET .../mandates`<br>`GET /v1/mandates/:id/chain` | `POST .../mandates/root`<br>`POST .../mandates/:id/delegations`<br>`POST .../mandates/:id/revocations`<br>`POST .../mandates/:id/check` | Full mandate grid data and actions supported. |
| 11 | **Audit Grid** | **FOUND** | `GET .../activity?since=&limit=` | Audit events appended immutably via Postgres digest / sha256 | Complete match with cryptographic hash chaining (`eventHash`, `previousHash`, `reasonCode`, `outcome`). |
| 12 | **Security** | **FOUND** | `GET .../activity` (filtered for denied/security events) | `POST .../pause`<br>`POST .../resume`<br>`POST .../revoke`<br>`POST .../agents/:id/disable`<br>`POST .../agents/:id/revoke`<br>`POST .../credentials/rotate`<br>`POST .../credentials/:id/revoke` | Complete emergency lifecycle controls and credential rotation/revocation endpoints are implemented. |
| 13 | **Developers** | **PARTIAL** | `GET /health`<br>`GET /docs/json`<br>`GET /v1/system/status` | `POST .../credentials/rotate`<br>`POST .../credentials/:id/revoke` | OpenAPI spec and agent credential generation exist. Missing Model Context Protocol (MCP) server endpoint and tenant-level API key management. |

---

## 6. Undetermined Items, Code Inconsistencies, and Discrepancies

1. **`GET /v1/environments/:environmentId` Discrepancy**:
   - `docs/api.md:23` states: `GET /v1/environments/:environmentId: Get environment details.`
   - In actual code (`apps/api/src/phase1-routes.ts`), only `GET /v1/environments` (list) is registered. The single-environment GET route does not exist.
2. **In-Memory Storage for Approvals and Sessions**:
   - While environments, agents, credentials, mandates, and ledger accounts support persistent PostgreSQL storage in `DATABASE_MODE=supabase`, `apps/api/src/phase4.ts:281-289` initializes `InMemoryApprovalStore` and `InMemorySessionStore` unconditionally (`void _supabaseClient`). Any server restart will wipe approval requests and session task runs.
3. **Dead Environment Variable in `.env.example`**:
   - Line 6 of `.env.example` lists `AGENT_RUNTIME_SHARED_SECRET=replace-with-a-local-only-value`.
   - Grep search confirms this variable is never loaded or referenced anywhere in application code.
4. **Agent Runtime Isolation**:
   - `apps/api` does not invoke `apps/agent-runtime` (port 8000). The agent runtime is an autonomous client that calls the gateway API, or a standalone sandbox for local ADK dry runs.
5. **Worker Execution Mode Dependency**:
   - As observed in `apps/worker/src/config.ts:35`, the worker requires `DATABASE_MODE=supabase`. If `DATABASE_MODE=memory` is set, the worker cannot function because in-memory maps cannot be shared between separate Node.js processes.

---

## 7. Evidence Citations and File Verification

| Finding | File Path | Line Range | Verbatim / Evidence Snippet |
|---|---|---|---|
| Gateway Port & Host | `apps/api/src/server.ts` | 25-26 | `const port = Number(process.env.API_PORT ?? 3001); const host = process.env.API_HOST ?? "127.0.0.1";` |
| Agent Runtime Port | `README.md` | 49 | `Agent health: http://localhost:8000/health` |
| Agent Runtime Command | `package.json` | 9 | `"dev:agent": "uv run --project apps/agent-runtime uvicorn agent_runtime.main:app --app-dir apps/agent-runtime/src --reload"` |
| Swagger JSON Spec | `apps/api/src/app.ts` | 66 | `app.get("/docs/json", async () => app.swagger());` |
| Principal Resolution | `apps/api/src/auth.ts` | 18-34 | Evaluates `x-local-user-id`, `pg_` agent tokens, and `client.auth.getUser(token)`. |
| Agent Runtime Non-Auth | `apps/agent-runtime/src/agent_runtime/main.py` | 141 | `"authorityGranted": False, # Gateway is the only authority source` |
| No Redis Architecture | `docs/tech.md` | 24 | `PostgreSQL outbox/job tables with leased workers... No Redis initially;` |
| Worker Lease Polling | `apps/worker/src/runner.ts` | 35-40 | `const jobs = await this.store.claim({ workerId: ..., limit: ..., leaseDurationMs: ... });` |
| Mock Telemetry Copy | `apps/web/components/shell/status-pill.tsx` | 115 | `<span>Protocol: WebSocket + SSE</span>` |
| Phase 4 In-Memory Factory | `apps/api/src/phase4.ts` | 281-289 | `createApprovalStore: return new InMemoryApprovalStore();` |
