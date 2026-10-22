# Step 5: engineering standards

## Assumptions and open questions
- Step 4 is approved: Next.js and Fastify/TypeScript deploy on Vercel; Python ADK/Gemini dummy agents deploy on Render; Supabase provides PostgreSQL and Auth.
- This document proposes standards; it does not create the monorepo or implement the application.
- Exact package versions, Gemini model, provider currency, inventory integrations, and durable-worker hosting remain setup or scope decisions.
- The initial release will use separate Vercel projects for `web` and `api`; Vercel Services is not a prerequisite.

## 1. Repository structure

Use one repository with clear runtime and ownership boundaries:

```text
payguardian/
├── apps/
│   ├── web/                         # Next.js dashboard; browser-facing UI only
│   ├── api/                         # Fastify REST + MCP gateway on Vercel
│   ├── agent-runtime/               # Python ADK Personal/specialist agents on Render
│   └── worker/                      # Node.js durable payment/reconciliation worker; hosting TBD
├── packages/
│   ├── contracts/                   # Versioned OpenAPI schemas, DTOs, error codes
│   ├── domain/                      # Pure TypeScript authority/policy/accounting logic
│   ├── db/                          # Drizzle schema, migrations, repositories
│   ├── auth/                        # Token/credential verification interfaces and adapters
│   ├── config/                      # Typed environment configuration loaders
│   ├── observability/               # Shared redaction, correlation and event helpers
│   └── ui/                          # Optional reusable dashboard components
├── agents/
│   ├── personal/
│   ├── travel/
│   ├── hotel/
│   ├── transport/
│   ├── food/
│   └── activities/
├── docs/                            # Approved plan, API guides and runbooks
├── infra/                           # Deployment manifests, Supabase config, scripts
├── scripts/                         # Repository-level checks and generators
├── package.json                     # Root pnpm scripts
├── pnpm-workspace.yaml
├── pyproject.toml                   # uv workspace configuration
├── uv.lock
├── pnpm-lock.yaml
├── Makefile
└── README.md
```

### Boundary rules

- `apps/web` may call `apps/api` or a deliberately thin Next.js proxy; it must not implement mandate, policy, ledger, payment, or revocation rules.
- `apps/api` owns transport adapters and calls `packages/domain`; route handlers must remain thin.
- `packages/domain` must not import Fastify, React, Supabase client UI code, Gemini, ADK, or PayPal SDKs.
- `packages/db` owns persistence details; domain services receive repositories or ports rather than constructing database clients directly.
- `apps/agent-runtime` and `agents/*` may request gateway operations, but must never write gateway tables directly.
- `apps/worker` owns asynchronous provider/reconciliation execution and must use the same domain/application services as the API.
- `packages/contracts` is the boundary for external request/response shapes; internal database records must not automatically become public API models.
- SDK-generation packages remain reserved for future work and are not part of the initial release.

## 2. TypeScript and Python conventions

### TypeScript

- Use strict TypeScript; do not disable `strict` or hide errors with `any`.
- Prefer named domain types and discriminated unions for action, authorization, execution, reservation, and mandate states.
- Use `unknown` at untrusted boundaries, then validate with the selected schema library before use.
- Use integer minor units and an explicit currency code for money; never use JavaScript floating-point arithmetic for balances.
- Keep side effects at application/service boundaries. Pure policy and accounting functions should be deterministic and independently testable.
- Use `camelCase` for variables/functions, `PascalCase` for types/classes, and `SCREAMING_SNAKE_CASE` only for constants.
- Use `async`/`await`; handle promise failures explicitly. Do not create detached promises in request handlers without a durable ownership model.
- Prefer small modules with one responsibility. Avoid barrel exports that hide dependency cycles in security-sensitive packages.

### Python agents

- Use Python type annotations and a formatter/linter selected during repository setup.
- Keep ADK prompts, tools, and orchestration separate from gateway-client transport code.
- Treat model output, tool descriptions, inventory data, and agent metadata as untrusted input.
- Never place gateway credentials in prompts, model context, logs, trace attributes, or generated agent text.
- Agent retries must preserve the original gateway idempotency key for the same protected action.
- An agent may propose or request delegation; only the gateway can register the child identity and issue the mandate.

### Naming and errors

- Use stable, opaque IDs for externally visible resources; do not expose sequential database IDs as authorization evidence.
- Use explicit status enums rather than overloaded booleans such as `isApproved` for multi-stage workflows.
- Use typed, machine-readable error codes such as `MANDATE_EXPIRED`, `BUDGET_EXCEEDED`, `CREDENTIAL_REVOKED`, and `APPROVAL_REQUIRED`.
- Error responses include a safe public message, code, request ID, and retry guidance where applicable; they exclude secrets, SQL, stack traces, prompts, and provider credentials.

## 3. API and MCP standards

- Version public REST paths under `/v1`.
- Generate the OpenAPI contract from the implemented Fastify routes/schemas, then validate it in CI and publish the approved contract through APIMatic.
- Require an idempotency key for payment and other non-repeatable protected actions.
- Bind an idempotency key to the authenticated principal, environment, operation, and canonical request hash. Same key with different material details is a conflict.
- Use standard authentication headers; never put bearer tokens, agent secrets, or OAuth authorization codes in URLs.
- Enforce request size, pagination, timeout, and rate limits at the API boundary.
- Validate path/resource ownership before returning existence-sensitive details. Use safe not-found/forbidden behavior consistently.
- MCP tools must call the same application use cases as REST. No MCP-only bypass, elevated tool, hidden mutation, or alternate ledger path is allowed.
- MCP tool descriptions are documentation, not authorization. The gateway checks the authenticated caller and mandate chain on every protected call.
- Keep external contracts backward compatible within a major version. Any breaking change requires a new version and a migration note.

## 4. Authentication, authorization, and secrets

### Human users

- Supabase Auth is the source of user authentication for the website.
- Next.js handles browser sessions using the approved SSR pattern.
- Fastify verifies the token cryptographically and checks issuer, expiry, audience, subject, and required claims before creating request context.
- Never trust a user ID, agent ID, environment ID, role, or mandate ID supplied only in the request body.
- Every query and command is scoped by the authenticated principal and environment membership.

### Agents and integrations

- A connected integration is not automatically a Personal Agent, and a Personal Agent is not automatically authorized to spend.
- Store agent credentials hashed where possible; show plaintext secrets only at creation/rotation time.
- Bind credentials to agent identity, owner/integration, environment scope where applicable, issued time, expiry, status, and credential version.
- Support rotation with overlap only for a bounded transition period; revoke compromised credentials immediately.
- Resolve agent identity from verified credentials or a verified OAuth connection. Never authorize from a caller-provided agent name.
- A child credential is issued only after authenticated parent registration is accepted. The child mandate is a separate gateway decision.
- Service-to-service credentials between Render agents and Vercel API use a dedicated mechanism, separate from browser user sessions.

### Secrets and configuration

- Commit only `.env.example` files containing names, safe placeholders, and explanations—never values.
- Keep local secrets in ignored files or the platform secret manager; use separate credentials for local, preview, staging, and production.
- Required configuration fails closed at startup for protected services; optional integrations can be explicitly disabled.
- Never log environment variables, authorization headers, cookies, OAuth codes, refresh tokens, PayPal secrets, Gemini keys, or full request bodies by default.
- Rotate Supabase, PayPal, Gemini, deployment, and service-to-service credentials on an owner-defined schedule and after suspected exposure.
- Secret scanning must run in pre-commit/CI, and dependency lockfiles must be reviewed as code.

## 5. Data, database, and financial integrity

- PostgreSQL is authoritative for mandates, policy versions, balances, reservations, actions, provider operations, approvals, jobs, and audit events.
- Use one application migration history. Never edit an applied migration; add a forward migration and document data changes.
- Use foreign keys, unique constraints, check constraints, and explicit state-transition validation as defense in depth.
- Use transactions for allocation transfers, reservations, captures/releases, revocation state, action state, and outbox insertion.
- Acquire locks in a stable order and keep database transactions free of external provider HTTP calls.
- Store money as integer minor units plus an authoritative ISO currency code. Reject unsupported currency/provider combinations; never silently convert.
- Store canonical hashes of material mandate/action details so approvals and idempotency decisions can be verified.
- Append audit events rather than updating history in place. Corrections are new events linked to the original event.
- Do not use database triggers as the only authorization layer; application decisions must be explicit and tested.
- Test recovery after process termination at every state where an external call may have occurred.

## 6. Dependency hygiene

- Pin direct runtime dependencies with lockfiles for both pnpm and uv.
- Prefer maintained packages with clear licenses, active security practices, and minimal transitive dependency surface.
- Review new dependencies for credential access, network behavior, install scripts, license compatibility, and bundle/runtime cost.
- Run dependency audit/update checks in CI, but review updates before merging.
- Do not install a package solely to avoid writing a small, security-critical function that can be reviewed locally.
- Separate development, test, and production dependencies.
- Keep generated OpenAPI/client artifacts deterministic and review diffs; do not commit generated secrets or environment-specific URLs.

## 7. Git, review, and change control

- Use small conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`.
- A change to authorization, delegation, ledger, payment, credential, revocation, or audit code must include a focused regression test.
- Pull requests must describe the invariant affected, migration impact, security impact, and actual checks run.
- Require review from a second person for changes that can authorize spending or alter audit history when the collaboration setup supports it.
- Do not commit provider credentials, user data, production exports, private prompts, or real payment payloads.
- Keep unrelated formatting and generated-file churn out of security-critical changes.

## 8. Required pre-implementation gates

Before scaffolding the product, confirm:

1. Fastify/OpenAPI and the MCP TypeScript SDK work in the selected Vercel deployment shape.
2. Drizzle/driver connection and transaction behavior work with the selected Supabase connection mode.
3. Supabase Auth tokens can be verified by Fastify and the Claude Web/MCP OAuth compatibility spike has a defined result.
4. Render ADK services can authenticate to the Vercel API without exposing credentials to Gemini prompts.
5. The exact Gemini model and free-tier behavior are recorded in environment/config documentation.
6. The durable payment/reconciliation worker placement is selected before payment implementation.
7. The initial PayPal currency and inventory/booking scope are approved.

## Proposed quality gates

Every change must pass the smallest relevant checks locally. Before merging:

- TypeScript typecheck, lint, formatting, unit tests, and contract validation.
- Python formatting/linting/type checks and agent tests.
- PostgreSQL integration tests for transaction and authorization behavior.
- Security regression tests for identity spoofing, cross-environment access, replay, tampering, revocation, and over-budget requests.
- Browser tests for critical dashboard flows.
- Dependency and secret scans.

The exact commands will be recorded in `README.md` and `docs/phases.md` after this standards step is approved.
