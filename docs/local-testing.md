# Local agent, worker, and service testing

Run these commands from the repository root. Keep `.env` local; never commit or
paste its values.

## Start the four local processes

### Terminal 1 — API with Supabase and worker mode

```bash
set -a
source .env
set +a
export NODE_ENV=development
export API_HOST=127.0.0.1
export API_PORT=3001
export ENABLE_LOCAL_DEV_AUTH=true
export DATABASE_MODE=supabase
export PAYPAL_EXECUTION_MODE=worker
export CORS_ORIGIN=http://localhost:3000
pnpm dev:api
```

### Terminal 2 — durable worker

```bash
set -a
source .env
set +a
export DATABASE_MODE=supabase
export PAYPAL_EXECUTION_MODE=worker
export WORKER_ID=local-worker
pnpm --filter @payguardian/api exec tsx ../worker/src/index.ts
```

The worker is a polling process and does not expose an HTTP port. It should stay
running until stopped with `Ctrl-C`.

### Terminal 3 — Python agent runtime

```bash
uv run --project apps/agent-runtime \
  uvicorn agent_runtime.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --app-dir apps/agent-runtime/src
```

### Terminal 4 — web dashboard

```bash
set -a
source .env
set +a
export NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
pnpm dev:web
```

Open `http://localhost:3000`, then sign up or sign in with Supabase Auth. Do not
use `NEXT_PUBLIC_LOCAL_USER_ID` with `DATABASE_MODE=supabase`; Supabase-backed
records require a real Supabase user UUID.

## Health checks

```bash
curl -sS http://127.0.0.1:3001/health
curl -sS http://127.0.0.1:3001/docs/json
curl -sS http://127.0.0.1:8000/health
curl -sS http://127.0.0.1:8000/agents
curl -sS -o /dev/null -w 'web HTTP %{http_code}\n' http://127.0.0.1:3000/
```

Expected results:

- API health: HTTP 200 and `service: "gateway-api"`.
- Agent health: HTTP 200 and `service: "agent-runtime"`.
- Agent catalog: `personal`, `travel`, `hotel`, `transport`, `food`, and
  `activities`.
- Web: HTTP 200.
- Worker: process remains running and polls without binding a port.

## Agent dry-run checks

```bash
curl -sS -w '\nHTTP %{http_code}\n' \
  -X POST http://127.0.0.1:8000/run \
  -H 'content-type: application/json' \
  --data '{"agent":"personal","message":"local smoke"}'
```

Expected: HTTP 200 with `status: "simulated"`, `authorityGranted: false`, and
`paymentExecuted: false`.

Real agent execution should remain disabled for now:

```bash
curl -sS -w '\nHTTP %{http_code}\n' \
  -X POST http://127.0.0.1:8000/run \
  -H 'content-type: application/json' \
  --data '{"agent":"personal","message":"local smoke","dry_run":false}'
```

Expected: HTTP 501.

## API authentication and control checks

Unauthenticated access must be rejected:

```bash
curl -sS -w '\nHTTP %{http_code}\n' \
  http://127.0.0.1:3001/v1/environments
```

Expected: HTTP 401 with `AUTHENTICATION_REQUIRED`.

For Supabase-backed manual testing, use the dashboard login flow. After login:

1. Create an environment.
2. Register the Personal Agent.
3. Register a child agent.
4. Inspect the Mandates and Activity sections.
5. Pause the environment and confirm new protected mutations are rejected.
6. Resume the environment and confirm allowed mutations work again.
7. Disable or revoke an agent and confirm descendants are blocked.
8. Revoke a mandate and confirm the activity record remains visible.

For a local endpoint smoke check, use a Supabase bearer token in a secret-managed
shell:

```bash
export SUPABASE_ACCESS_TOKEN='do-not-commit-this'
curl -sS \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  http://127.0.0.1:3001/v1/environments
```

## PayPal webhook checks

The local endpoint is:

```text
POST http://127.0.0.1:3001/v1/webhooks/paypal
```

Malformed events should fail safely:

```bash
curl -sS -w '\nHTTP %{http_code}\n' \
  -X POST http://127.0.0.1:3001/v1/webhooks/paypal \
  -H 'content-type: application/json' \
  --data '{}'
```

Expected: HTTP 400 with `PAYPAL_EVENT_INVALID`.

A real PayPal Sandbox webhook cannot reach `127.0.0.1` directly. Use a
reachable HTTPS tunnel or the deployed API and configure the matching PayPal
Sandbox webhook ID before testing real signature verification.

## Stop the processes

Press `Ctrl-C` in each terminal. If a process must be stopped from another
shell, identify it first with:

```bash
pgrep -af 'uvicorn agent_runtime|worker/src/index|tsx watch src/server|next dev'
```
