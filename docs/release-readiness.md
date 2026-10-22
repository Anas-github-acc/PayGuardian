# Phase 7 release and recovery runbook

This runbook covers the repository-verifiable release gate for the API, worker,
agent runtime, and Supabase migrations. It does not create or change Vercel,
Render, or Supabase project settings. Production secrets belong in the relevant
platform secret stores and must never be copied into this repository.

## Release inputs

Use a clean checkout of the release commit with the pinned toolchain:

- Node.js 22+
- pnpm 12.14.0
- Python 3.11+
- uv 0.13.0
- Supabase CLI 2.121.0 or a compatible later CLI

Install from both lockfiles:

```bash
pnpm install --frozen-lockfile
uv sync --all-packages --dev --frozen
```

For production API configuration, the loader requires all of the following:

```text
NODE_ENV=production
DATABASE_MODE=supabase
ENABLE_LOCAL_DEV_AUTH unset or false
PAYPAL_EXECUTION_MODE=worker
SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET
PAYPAL_RETURN_URL and PAYPAL_CANCEL_URL using HTTPS
PAYPAL_CURRENCY=USD
```

`PAYPAL_WEBHOOK_ID` is required before accepting PayPal webhook events, but the
API may start without it so health and non-webhook operations remain observable;
webhook verification fails closed until the ID is configured.

The service-role key, PayPal credentials, webhook ID, and any agent-to-gateway
secret are server-side values only. Browser bundles and agent prompts must not
receive them.

## Pre-release validation

Run the repository gate before deploying:

```bash
pnpm release:check
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm release:check` first tests its migration and health-response parsers, then
verifies the environment template, production configuration tests, audit-integrity
migration protections, migration filename inventory, and optionally live health
endpoints and applied migration history. Supabase migration status is compared by
the migration timestamps shown in the CLI's `LOCAL` and `REMOTE` columns; a
remote-only row is valid evidence that the timestamp is applied. It reports
external checks as unverified when their target is not supplied.

For a release candidate with reachable services and a database target, run the
strict form from a secret-managed shell. Do not place a database URL in a
committed script or log:

```bash
RELEASE_API_HEALTH_URL=https://api.example.invalid/health \
RELEASE_AGENT_HEALTH_URL=https://agent.example.invalid/health \
SUPABASE_MIGRATION_DB_URL="$RELEASE_DATABASE_URL" \
pnpm release:check -- --strict
```

The health checks expect HTTP 200 JSON with `status: "ok"` and the correct
service name. The API OpenAPI document is checked by the API test suite at
`/docs/json`.

## Migration release procedure

Use one migration history. Never edit a migration that has been applied; add a
forward migration and review its SQL before applying it.

1. Link the Supabase CLI using the project reference supplied by the operator:

   ```bash
   npx supabase link --project-ref <project-ref>
   ```

2. Inspect local and remote history:

   ```bash
    npx supabase migration list --linked
   ```

3. Review the dry run, then apply only the reviewed migrations:

   ```bash
   npx supabase db push --linked --dry-run
   npx supabase db push --linked
   npx supabase migration list --linked
   ```

4. Run `pnpm release:check -- --linked --strict` with the linked project
   available. The command must prove the repository migrations are applied;
   otherwise the release remains blocked.

For a disposable local stack, use `npx supabase start`,
`npx supabase db reset`, and `npx supabase migration list --local`. This
environment currently cannot create the Supabase Docker network, so local
stack results must not be inferred from the repository migration files.

## Deployment sequence

Deploy the exact validated commit through the already approved platform
projects, without changing their project settings as part of this runbook:

1. Apply and verify Supabase migrations before enabling worker-mode payment
   traffic.
2. Deploy the API and web services from the validated commit to their existing
   Vercel projects. Confirm the API `/health` and `/docs/json` endpoints. This
   repository currently verifies `https://payguardian-web.vercel.app` and
   `https://payguardian-api.vercel.app`.
3. Deploy the Python agent runtime using the committed `render.yaml`. Confirm
   its `/health` endpoint and keep it in simulation mode until the protected
   gateway path is approved.
4. Start the worker with `DATABASE_MODE=supabase` and
   `PAYPAL_EXECUTION_MODE=worker`. Confirm the worker process is running and
   that its queue/lease observations are visible through the existing worker
   checks.
5. Run the strict release gate again against the deployed API, agent health
   endpoint, and migration target.

The worker hosting decision and external deployment proof are still release
gates; this repository does not claim them as complete merely because the
manifests exist.

## Backup, rollback, and recovery

Backups must be written to an approved protected location outside the
repository. Before a release, capture the database artifact using the operator's
secret-managed connection:

```bash
npx supabase db dump --linked --file /secure/backups/payguardian-<timestamp>.sql
```

Record the commit, migration status, backup identifier, and operator in the
release record. Test restoration in a disposable project before relying on the
artifact for production recovery. Restore with the database provider's approved
process or an explicitly reviewed `psql` import; do not overwrite production
data from an unverified dump.

For an application rollback:

1. Stop or route away new protected traffic according to the incident plan.
2. Roll the API, web, agent, and worker processes back to the last validated
   commit.
3. Keep already-applied database migrations in place. Use a new forward
   migration for any required data correction.
4. Re-run migration status and all health checks.
5. For payment operations in `pending` or `uncertain`, reconcile with PayPal
   before capturing or releasing the ledger reservation. A process restart must
   not be treated as proof that an external provider call did not happen.
6. Preserve audit history. Corrections are new audit events; do not update or
   delete existing audit rows.

## Recovery evidence to record

Each release or recovery record should include:

```text
Commit:
Environment/target:
Migration status command and result:
Backup identifier and restore drill target:
API health result:
Agent health result:
Worker recovery result:
Failed checks or approved exceptions:
Operator/date:
```

## Current verified boundary

The repository contains automated checks for production configuration, API
health/OpenAPI, agent health, and audit-integrity SQL invariants. The 15 local
migrations, including the audit-integrity and audit-chain verification forward
migrations, are applied to the configured remote Supabase project, and the
deployed web/API health checks pass. Backup/restore, agent-runtime hosting,
worker hosting, live PayPal webhook, and full browser acceptance drills remain
pending until their evidence is recorded.
