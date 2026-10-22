# Delegation Gateway checklist

## Assumptions and open questions
- Planning approvals do not mean features are implemented.
- Approved direction: keep INR for internal simulation and use USD for the PayPal Sandbox provider flow; no implicit FX conversion.
- Demo inventory versus real booking-provider integrations remains unconfirmed.
- Next.js, Node.js/Fastify/TypeScript, Python ADK, Supabase PostgreSQL, Supabase Auth, and a monorepo are selected. External deployment proof remains pending.

## Completion rules
- `[*]` = pending, including approved but not yet implemented work.
- `[x]` = actually completed, with evidence or a verification reference.
- Planning items are checked only when the named document/review exists and its stated gate is met.
- Implementation items require actual working behavior and the relevant passing checks, not merely a design, scaffold, or approval.
- Keep uncertain, blocked, or partially completed work pending. No implementation phase is complete until its tests have passed and results have been shown to the user.

## Planning and decision records
- [x] Read the existing requirements and build protocol. Evidence: `../input.md`, `../.personal-harness/rules/BUILD_PROTOCOL.md`.
- [x] Obtain requirements-baseline and delivery-format approval. Evidence: user confirmations in this planning conversation.
- [x] Obtain approval of Personal Agent root onboarding and automatic child registration. Evidence: user approval after the revised specification.
- [x] Obtain approval of the architecture direction. Evidence: user said they like the architecture and authorized Step 4.
- [x] Persist and verify the approved input, delivery, specification, and architecture records. Evidence: `input.md`, `delivery.md`, `spec.md`, `architecture.md`; documentation validation passed.
- [x] Create and verify this checklist file. Evidence: `checklist.md`; marker validation passed with all implementation items pending.
- [x] Write and verify Step 4 technology recommendations. Evidence: `tech.md`; official documentation reviewed and Markdown validation passed. Technology approval is still pending below.
- [x] Revise Step 4 for Node.js/Fastify/TypeScript gateway on Vercel and Python ADK agents on Render. Evidence: `tech.md`, `architecture.md`, `input.md`; deployment constraints documented and Markdown validation passed.
- [x] Obtain approval of remaining Step 4 technology choices. Evidence: user approved the revised Node.js/Fastify/TypeScript, Vercel, and Render deployment plan.
- [x] Write and validate the Step 5 engineering-standards draft. Evidence: `standards.md`; monorepo, security, financial-integrity, dependency, and quality-gate checks passed.
- [x] Resolve payment-demo currencies without implicit conversion. Evidence: user approved INR simulation plus USD PayPal Sandbox provider support.
- [*] Resolve inventory and booking-provider scope.
- [*] Choose and smoke-test an available Gemini model/free-tier configuration.
- [x] Propose and obtain approval of engineering standards (`standards.md`). Evidence: user approved Step 5 standards.
- [x] Draft shippable delivery phases (`phases.md`). Evidence: phase goals, dependencies, scope, and definitions of done documented; phase approval remains pending.
- [x] Define and obtain approval of shippable phases (`phases.md`). Evidence: user approved Step 6 delivery phases.
- [x] Draft and validate testing for every phase (`testing.md`). Evidence: automated and manual checks documented and user approved Step 7 testing.
- [x] Define automated checks and manual acceptance steps for every phase. Evidence: `testing.md`; all 8 phases have automated checks, manual acceptance, and gates.
- [*] Define structured logging, error tracking, and metrics last (`observability.md`).

## Repository and developer setup — implementation pending
- [x] Create the approved polyglot monorepo and package boundaries. Evidence: `apps/`, `packages/`, `agents/`, and root workspace manifests created.
- [x] Add reproducible JavaScript and Python dependency locks. Evidence: `pnpm-lock.yaml`, `uv.lock`; installs completed locally.
- [x] Add local setup, configuration examples without secrets, and migration instructions. Evidence: `README.md`, `.env.example`, app examples, and `supabase/README.md`.
- [x] Configure linting, type checking, unit tests, and CI. Evidence: root scripts, package scripts, `.github/workflows/ci.yml`; targeted checks passed.
- [x] Verify a clean local startup and documented smoke checks. Evidence: web, API, and agent services started; health/OpenAPI/simulation smoke test passed.
- [x] Add non-secret Supabase local/project configuration. Evidence: `supabase/config.toml`; remote project verification is complete.
- [x] Verify the Next.js frontend through a Vercel production deployment. Evidence: `https://payguardian-web.vercel.app` returned HTTP 200 after the validated deployment.
- [x] Verify the Fastify API through a Vercel production deployment. Evidence: `https://payguardian-api.vercel.app/health` and `/docs/json` returned valid responses after the validated deployment.
- [*] Verify the Python ADK runtime through a Render deployment.
- [*] Start and verify the Supabase local stack after Docker and Supabase CLI are available.
- [x] Verify Supabase CLI invocation through `npx supabase`. Evidence: `npx supabase --version` returned `2.121.0`.
- [x] Apply all Phase 1–3 migrations to the configured Supabase project with `npx supabase db push`. Evidence: all three migration files applied successfully.
- [x] Verify live Supabase Auth and server-side persistence. Evidence: a temporary confirmed Auth user token was accepted by Fastify; environment, Personal Agent, and child Agent were created through RPC-backed Supabase access and read back successfully; temporary records were deleted.
- [x] Verify the requested RLS configuration. Evidence: PostgreSQL reported `relrowsecurity=true` for all ten application tables and `pg_policies` reported zero public application policies.
- [*] Start the full local Supabase stack. Docker is installed and `dockerd` runs in the sandbox, but Supabase network creation is blocked with `operation not permitted`; remote Supabase verification is complete.
- [x] Add Phase 1 local environment/agent registry API and dashboard slice. Evidence: API tests passed and a local smoke flow created an environment, Personal Agent, and child agent.
- [x] Add Phase 2 deterministic mandate/delegation/authority engine slice. Evidence: domain and API tests passed for scope narrowing, budget limits, expiry, approval state, and revocation.
- [x] Add Phase 2 Supabase authority persistence and transactional RPC path. Evidence: `SupabaseAuthorityStore`, root/delegation/revocation/ancestor-chain RPCs, content hashing, mode selection, and remote smoke flow passed; root and child authority were allowed before revocation and denied after descendant-aware revocation.
- [x] Add Phase 3 in-memory ledger accounting slice. Evidence: domain tests passed for nested allocation, conservation, idempotent reservations, capture, release safety, and overspending rejection.
- [x] Add Phase 3 persistent ledger slice. Evidence: `20261022000000_phase3_ledger_persistence.sql`, ledger store mode selection, account creation, idempotent allocation, action authorization/reservation, capture, release, and environment-scoped API routes are implemented; the remote Supabase migration and live smoke flow passed.

## Identity, accounts, and isolation — implementation pending
- [*] Implement Supabase user signup, login, logout, and account access.
- [*] Validate user tokens server-side and enforce tenant/environment access.
- [*] Register/connect the Personal Agent without requiring manual descendant registration.
- [*] Implement the platform/custom agent catalog, requested-permission display, and add-on enable/configure/disable/remove lifecycle.
- [*] Implement authenticated parent-driven child registration and secure runtime credential provisioning.
- [*] Implement credential expiry, rotation, revocation, and issuer/holder bindings.
- [*] Prove remote MCP discovery, OAuth/PKCE, consent, audience validation, and connection-to-agent binding with Claude Web.
- [*] Deny caller-supplied identity spoofing and cross-environment access.
- [*] Prevent browser/Data API access from bypassing protected gateway mutations.
- [*] Replace the local development principal with verified Supabase Auth users after local Supabase verification.
- [*] Complete Phase 1 against live local Supabase Auth/PostgreSQL after Docker is visible to this execution environment.

## Authority and accounting — implementation pending
- [*] Implement explicit user-authorized root mandates and signatures.
- [*] Validate full ancestor chains, scope narrowing, expiry, approval restrictions, and delegation depth.
- [*] Transfer budget on delegation rather than copying it.
- [*] Implement integer-minor-unit balances and a transactional ledger.
- [*] Implement reservations, capture, safe release, and explicit reclaim. Persistent reservation/capture/release are implemented; explicit reclaim, uncertain execution recovery, and outbox processing remain.
- [*] Prevent new mandates/sessions from resetting spent or allocated budgets.
- [*] Demonstrate the 10,000-unit Personal -> Travel/Food/Activities -> Hotel/Transport allocation tree.
- [*] Reject overspending, forged/altered mandates, unauthorized delegation, and replayed mutations.
- [*] Prove accounting invariants under concurrent requests and process interruption.
- [*] Implement human approvals bound to immutable action details without bypassing hard limits.
- [*] Implement explicit environment budget/policy configuration and versioned, default-deny policy evaluation.
- [*] Implement environment pause/closure, agent disablement, and descendant-aware revocation.
- [*] Test the revocation-versus-dispatch boundary and safe handling of in-flight operations.
- [x] Add deterministic authority and ledger domain tests before provider integration. Evidence: `packages/domain/src/index.test.ts`, `packages/domain/src/ledger.test.ts`; 7 domain tests passed.
- [*] Complete Phase 2/3 persistence/RPC integration and full-chain enforcement against live PostgreSQL. Core remote authority and ledger paths are verified; dedicated concurrency/recovery tests, policy-version evaluation, approval records, delegation idempotency, audit append, outbox recovery, and independently authenticated agent principals remain.

## Agent workflows and integrations — implementation pending
- [*] Implement Personal, Travel, Hotel, Transport, Food, and Activities ADK agents using Gemini.
- [*] Let permitted parents choose/register children and request bounded child mandates.
- [*] Keep runtime credentials out of model prompts and ordinary conversation history.
- [*] Implement resumable runs, explicit session context sharing, and session/authority separation.
- [*] Test Gemini quota exhaustion and failures without weakening enforcement.
- [*] Verify a framework-independent custom-agent integration.
- [*] Implement the approved inventory/booking integration scope without claiming simulated bookings are real.
- [x] Add local configured ADK dummy agents for Personal, Travel, Hotel, Transport, Food, and Activities. Evidence: `/agents` catalog and dry-run tests; 4 Python tests passed.
- [*] Execute real Gemini-backed agent runs after the model key/quota and protected gateway tool path are configured.

## Payments and recovery — implementation pending
- [*] Implement gateway authorization separately from PayPal buyer approval and provider execution.
- [x] Implement the initial supported PayPal Sandbox order flow and separate capture endpoint. Evidence: server-only Orders v2 client, USD order creation, approval URL handling, capture transition, and live Sandbox order smoke test returned a `CREATED` order with an approval URL.
- [x] Protect provider credentials and reject unsupported currency/action combinations. Evidence: credentials are read only by the API process; browser/agent code has no PayPal client; INR provider requests are rejected and remain simulation-only.
- [x] Persist action and provider-operation idempotency keys and request hashes. Evidence: `provider_operations` migration/store and repeated live order request returned the original provider operation without creating a second PayPal order.
- [x] Add PayPal operation status, browser return/cancel pages, provider-order reconciliation, and verified-event deduplication. Evidence: status/reconcile routes, `/paypal/return`, `/paypal/cancel`, provider-event persistence, duplicate-event handling, and mocked capture webhook tests pass.
- [*] Implement durable jobs/outbox delivery and crash-safe operation recovery. Evidence: `provider_jobs` persistence/RPCs, atomic Supabase action-operation-job enqueue, worker-mode PayPal queueing, lease/retry polling, stable provider request IDs, pending-operation recovery, lease-token fencing, and worker tests are implemented; live crash recovery remains pending.
- [*] Verify provider webhooks, deduplicate events, and tolerate out-of-order delivery. Event verification and deduplication are implemented; a configured `PAYPAL_WEBHOOK_ID`, reachable webhook endpoint, and live Sandbox signature/event drill remain.
- [*] Reconcile uncertain payment outcomes before releasing reservations. Evidence: worker reconciliation jobs retain pending/uncertain operations and use confirmed provider terminal states before capture/release; live timeout and provider-conflict drills remain pending.
- [*] Demonstrate sandbox success, denial, cancellation, timeout, and duplicate-delivery cases. Order creation, provider idempotency, status inspection, mocked capture webhook, and duplicate-event behavior are verified; live buyer approval, completed capture, timeout reconciliation, and cancellation drills remain.
- [*] Prove revocation does not falsely reverse completed payments.

## REST, MCP, and contracts — implementation pending
- [*] Implement versioned REST resources and consistent machine-readable errors.
- [*] Implement MCP tools for sessions, agent runs, authority, delegation, actions, budgets, revocation, and audit.
- [*] Prove website, REST, and MCP use equivalent enforcement.
- [*] Publish and validate the OpenAPI contract through the approved APIMatic workflow.
- [*] Add external-agent setup instructions, examples, and rejection/recovery guidance.
- [*] Verify API behavior against the published contract; keep SDK generation deferred.

## Dashboard and audit — implementation pending
- [*] Implement environment setup, root authorization, and agent connection flows.
- [*] Display agent/delegation hierarchy, sessions, runs, mandates, policies, and budgets.
- [*] Implement approval inbox, security warnings, and emergency revocation controls.
- [x] Add authenticated emergency environment/agent controls, mandate listing/revocation, and an activity snapshot. Evidence: `apps/api/src/phase6-routes.ts`, `apps/api/src/phase6.test.ts`, and the dashboard controls; live browser acceptance and SSE recovery remain pending.
- [*] Use AG Grid for agent, mandate, transaction, ledger, and audit tables. Evidence: registered-agent and PayPal operation monitoring grids are implemented; mandate, transaction, ledger, and audit grids remain pending.
- [x] Add the first AG Grid Community monitoring view for registered agents. Evidence: `apps/web/app/components/agents-grid.tsx`; sorting, filtering, pagination, resizing, responsive sizing, and custom column visibility controls are wired without an Enterprise license key.
- [*] Add a PayPal operation monitoring view. Evidence: environment-scoped operation collection endpoint, safe state-separated DTO, cursor pagination, and `PaymentOperationsGrid`; provider event timeline and worker-job controls remain pending.
- [*] Implement filtering, sorting, pagination, and usable column management within the selected license.
- [*] Display authorization, execution, and accounting states distinctly.
- [*] Deliver access-controlled activity updates with reconnect/recovery behavior.
- [*] Implement append-only, tamper-evident audit history and action-to-root tracing.
- [*] Record denials reliably without exposing secrets or unnecessary prompt content.
- [*] Verify accessibility, mobile/desktop behavior, and large-history usability.

## Release verification and operations — implementation pending
- [x] Add a repeatable Phase 7 release-readiness gate for production configuration, audit integrity, migration inventory, and health endpoint validation. Evidence: `scripts/release-readiness.mjs`, `scripts/release-readiness.test.mjs`, `packages/config/src/index.test.ts`, `apps/api/src/app.test.ts`, `apps/agent-runtime/tests/test_main.py`, and `.github/workflows/ci.yml`; repository checks pass, while external targets remain explicitly unverified when not supplied.
- [x] Document reproducible deployment, migration, backup, rollback, and recovery steps. Evidence: `docs/release-readiness.md`; commands use the pinned lockfiles and fail-closed production configuration requirements without embedding secrets.
- [*] Pass unit, integration, property/concurrency, contract, and browser tests required by each phase.
- [*] Complete documented manual acceptance checks and show actual results before advancing phases.
- [*] Measure authorization p95 against the <100 ms target with a defined workload.
- [*] Measure recorded-event-to-dashboard latency against the normal one-second target.
- [*] Verify crash recovery, isolation, backups/restoration, and secret handling.
- [*] Implement approved operational logs, error tracking, health checks, and metrics.
- [*] Deploy the approved services and document a reproducible release/recovery workflow.

## Future scope — not part of initial-release completion
- [*] Generate, test, and publish client SDKs when separately approved.
