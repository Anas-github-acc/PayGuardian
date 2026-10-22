# PayGuardian

Delegation Gateway for bounded, auditable authority across Personal Agents and specialist agents.

## Current implementation status

This repository contains the Phase 0 scaffold plus locally tested Phase 1/2/3 domain slices:

- `apps/web`: Next.js dashboard shell
- `apps/api`: Fastify REST/OpenAPI gateway and Vercel entrypoint
- `apps/agent-runtime`: Python ADK-compatible dry-run service with six configured dummy agents
- `apps/worker`: Node.js durable provider-job worker with leases, retries, and recovery
- `packages/*`: shared domain, PayPal client, contracts, and infrastructure boundaries

The local development path supports environment creation, Personal Agent/child registration, deterministic mandate authority checks backed by either memory or Supabase, ledger account/allocation/reservation operations, PayPal operation visibility, and durable provider-job execution. PayPal worker mode requires Supabase so the API and worker share the same durable queue; inline mode remains available for simple local API testing.

## Prerequisites

- Node.js 22+
- pnpm 12+
- Python 3.11+
- uv 0.13+
- Docker is required for the Supabase local stack.

## Setup

```bash
cp .env.example .env
make install
```

The example environment file contains placeholders only. Replace values in your local secret store when a later phase requires them.

## Run locally

Use separate terminals:

```bash
make dev-web
make dev-api
make dev-agent
```

The default local endpoints are:

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/health`
- API OpenAPI: `http://localhost:3001/docs/json`
- Agent health: `http://localhost:8000/health`
- Agent dry run: `POST http://localhost:8000/run` with `{"agent":"personal","message":"demo"}`
- Agent catalog: `GET http://localhost:8000/agents`

Phase 3 ledger routes include account creation, nested allocation, action reservation, capture, and safe release under `/v1/environments/:environmentId/ledger` and `/v1/environments/:environmentId/actions`.

PayPal Sandbox provider payments use USD. Keep INR as simulation-only; no implicit currency conversion is performed. PayPal credentials belong only in the ignored local `.env` or deployment secret store and must never be committed, logged, or sent to browser/agent runtimes.

The server-only PayPal slice exposes:

```text
POST /v1/environments/:environmentId/payments/paypal/orders
POST /v1/environments/:environmentId/payments/paypal/:actionId/capture
GET  /v1/environments/:environmentId/payments/paypal/operations
```

Order creation reserves the authorized ledger amount and returns the PayPal approval URL. Capture is a separate step and only moves the ledger reservation to captured after PayPal reports `COMPLETED`. INR requests are rejected from this provider path.

Payment status and reconciliation are also available through:

```text
GET  /v1/environments/:environmentId/payments/paypal/:actionId
POST /v1/environments/:environmentId/payments/paypal/:actionId/reconcile
POST /v1/webhooks/paypal
```

Configure `PAYPAL_WEBHOOK_ID` before accepting live PayPal webhook events. Until it is configured, webhook verification fails closed.

For durable execution, configure:

```bash
PAYPAL_EXECUTION_MODE=worker
DATABASE_MODE=supabase
```

Then run the API and worker as separate processes. Worker-mode order, capture, reconciliation, and verified webhook requests return `202` after durable queue insertion; the worker performs the provider call and updates the operation. Keep `PAYPAL_EXECUTION_MODE=inline` for the existing synchronous local smoke flow.

The agent endpoint is simulation-only. It constructs configured ADK agents without calling Gemini and does not create agents, issue mandates, or execute payments.

For the local in-memory API flow, explicitly enable development authentication:

```bash
ENABLE_LOCAL_DEV_AUTH=true DATABASE_MODE=memory pnpm dev:api
```

The worker cannot share an in-memory queue across processes. Use the configured remote Supabase project for worker-mode local development until the local Supabase Docker networking restriction is resolved.

The web app sends the development-only `x-local-user-id` header when `NEXT_PUBLIC_LOCAL_USER_ID` is set. This path is disabled automatically when `NODE_ENV=production`.

## Supabase local stack

SQL migrations are in `supabase/migrations/`. They enable RLS on application tables without creating client-facing policies. Application mutations use the server-only service-role key and RPC functions for transactional operations. Never expose that key to the browser or agents.

After Docker and the Supabase CLI are available in the execution environment:

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

The sandbox Docker daemon is available, but Supabase's Docker network creation is blocked by the sandbox with `operation not permitted`. The remote Supabase project has been migrated and verified instead.

## Checks

```bash
make check
pnpm release:check
```

The check command runs formatting, TypeScript typechecking, ESLint, JavaScript tests/build, Python formatting/linting, and Python tests. `pnpm release:check` adds the Phase 7 repository gate for production configuration, audit integrity, migration inventory, and optional live API/agent health and migration-status checks. The deployment and recovery procedure is in `docs/release-readiness.md`.

## Planning references

The implementation order and acceptance gates are in `docs/phases.md`. Read `docs/standards.md` before adding application code and update `docs/checklist.md` only with verified completion evidence.
