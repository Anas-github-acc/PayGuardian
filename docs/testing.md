# Step 7: testing plan

## Assumptions and open questions
- Step 6 delivery phases are approved.
- This document defines checks; no test has been run because the application has not been implemented yet.
- Test credentials, provider sandbox accounts, exact Gemini model, MCP OAuth client registration, and durable-worker deployment must be supplied or selected during the relevant phase.
- Tests must run against disposable data and sandbox/simulation providers only. Never use production payment credentials in automated or manual tests.

## Testing principles

1. Test the gateway's deterministic decisions independently from LLM behavior.
2. Exercise REST, MCP, and dashboard paths through the same application use cases and compare decisions.
3. Prefer real PostgreSQL integration tests for transactions, constraints, row locking, and recovery; mocks alone cannot prove financial integrity.
4. Use property-based and concurrency tests for accounting invariants.
5. Every security-critical bug receives a regression test before the fix is considered complete.
6. Keep test inputs synthetic and redact credentials, tokens, payment payloads, prompts, and personal data from test output.
7. A phase is complete only when its automated checks pass and its manual acceptance checklist has been performed and recorded.

## Test layers and ownership

| Layer | Purpose | Primary tools/proposed command |
| --- | --- | --- |
| Static | Types, lint, formatting, dependency/secret checks | `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, Python tooling, secret/dependency scans |
| Unit | Pure authority, policy, accounting, state transitions and redaction | Vitest; fast-check; pytest for Python agent code |
| Integration | Fastify routes, Supabase Auth verification, PostgreSQL transactions, outbox and provider adapters | Vitest + disposable PostgreSQL/Supabase environment; pytest for ADK integration |
| Contract | REST/OpenAPI schemas, MCP tool schemas, error codes and drift | OpenAPI validator, APIMatic validation, MCP client fixtures |
| Property/concurrency | Budget conservation, no overspending, idempotency, locking and replay resistance | fast-check plus concurrent integration workers against PostgreSQL |
| Browser E2E | Onboarding, dashboard, approvals, revocation and audit workflows | Playwright with seeded test users and sandbox data |
| Agent workflow | ADK orchestration, tool calls, retries, context isolation, quota failure | Python agent tests with gateway simulator and controlled Gemini calls |
| Performance | Authorization latency, dashboard event visibility, large-history query behavior | Reproducible benchmark scripts and documented workload |
| Recovery | Process interruption, lease expiry, webhook replay, uncertain provider outcome | Fault-injection integration tests and manual sandbox drills |

## Shared test fixtures

- `user_alice` owns `travel` and `daily-budget`; `user_bob` owns a separate environment.
- `personal_alice` receives a root mandate of 10,000 units for the travel example.
- `travel_alice` receives 6,000; `food_alice` 2,000; `activities_alice` 2,000.
- `hotel_alice` receives 4,000 and `transport_alice` 2,000 from Travel.
- Separate fixtures cover expired, revoked, altered, forged, cross-environment, disabled, and compromised credentials.
- A synthetic provider adapter supports deterministic success, denial, timeout, cancellation, duplicate event, delayed event, and uncertain outcome cases.
- PayPal Sandbox tests use isolated accounts/orders and a supported currency approved for the phase; INR examples remain simulation-only unless separately supported.

## Phase 0 — Repository and deployment proof

### Automated checks

- Verify clean install from `pnpm-lock.yaml` and `uv.lock`.
- Run TypeScript typecheck, lint, formatting, Python formatting/lint/type checks, and dependency/secret scans.
- Start web, API, agent, and database test services from a clean environment.
- Check Fastify health and OpenAPI endpoints; check the agent health endpoint.
- Validate that `.env.example` contains names/placeholders only and no known secret patterns.
- Run Vercel preview/API smoke tests and Render service health tests when deployment credentials are available.

### Manual acceptance

1. Clone the repository into a clean directory.
2. Follow the README setup commands without undocumented steps.
3. Start the local web, API, agent, and database services.
4. Open the web health page and API health endpoint.
5. Confirm the agent service responds but has no payment or mandate mutation capability.
6. Inspect logs for credentials, cookies, bearer tokens, or full request bodies.
7. Confirm preview deployments show the same health behavior.

### Gate

No feature phase begins if local setup is not reproducible or if a preview leaks secrets.

## Phase 1 — Identity, environments, and agent registry

### Automated checks

- User signup, login, logout, expired-token, malformed-token, wrong-issuer, and wrong-audience tests.
- User A cannot read or mutate User B's environments, agents, sessions, credentials, or audit records.
- Environment lifecycle transition tests, including invalid transitions.
- Root Personal Agent registration and duplicate-registration tests.
- Parent-driven child registration tests for allowed and disallowed parents.
- Caller-supplied agent ID spoofing tests.
- Credential creation, one-time secret display, hashing, expiry, rotation, overlap, and revocation tests.
- Browser session and API token tests use separate identities and cannot be substituted.

### Manual acceptance

1. Create two users and two environments with different purposes.
2. Connect a Personal Agent to User A's Travel environment.
3. Register Travel, Food, and Activities from the authenticated parent path.
4. Attempt to register Hotel from an unauthorized or revoked parent.
5. Attempt to use a valid User A agent credential against User B's environment.
6. Rotate a credential, verify the new credential works, and verify the old one fails.
7. Disable an agent and confirm new calls fail without deleting its historical audit records.

### Gate

No mandate or payment behavior proceeds if identity derives from caller-provided IDs or if cross-environment access succeeds.

## Phase 2 — Mandates, policies, delegation, and authority

### Automated checks

- Root mandate creation requires authorized human consent and exact environment/holder binding.
- Child mandate scope is a subset of every applicable parent constraint.
- Reject larger child budgets, broader tools/categories, later expiry, lower approval requirements, and excessive depth.
- Reject altered signatures/hashes, forged issuers, invalid parent IDs, replayed delegation requests, expired mandates, revoked ancestors, and disabled holders.
- Validate full ancestor chains on every protected operation, not only at mandate creation.
- Default-deny unknown action categories and malformed policy expressions.
- Verify policy version selection and immutable approval/action binding.
- Compare REST, MCP, and application-service decisions for the same fixtures.
- Prove session creation does not create or refresh authority.

### Manual acceptance

1. Authorize Personal with the 10,000-unit root mandate.
2. Delegate Travel, Food, and Activities within the root limit.
3. Delegate Hotel and Transport from Travel within Travel's allocation.
4. Try to delegate more than Travel has available and record the machine-readable denial.
5. Change an action amount after approval and verify the approval is invalid.
6. Revoke Travel and verify Hotel and Transport cannot authorize new protected actions.
7. Create a new session and confirm it receives no additional authority.

### Gate

No ledger or provider execution proceeds until scope narrowing, ancestor validation, default deny, and revocation propagation pass.

## Phase 3 — Ledger, reservations, concurrency, and audit

### Automated checks

- Property-test funding conservation across arbitrary valid allocation trees.
- Verify `available + reserved + captured` equals the authoritative funding envelope.
- Concurrent reservation tests at and around the exact remaining balance.
- Concurrent parent delegation tests that attempt to allocate the same funds twice.
- Idempotency tests for same request/same key and same key/different material request.
- State-transition tests for held, captured, released, cancelled, failed, pending, and uncertain reservations.
- Crash/fault tests between database commit, outbox creation, job claim, and state update.
- Append-only audit tests, hash-chain/checkpoint verification, and denied-attempt persistence.
- Pagination/filter/sort query tests over large synthetic audit and ledger datasets.
- Verify no secret, token, prompt, or unnecessary sensitive content is written to audit events.

### Manual acceptance

1. Build the complete 10,000-unit example and inspect each parent/child balance.
2. Submit two simultaneous requests that together exceed remaining funds.
3. Confirm only the permitted amount is reserved and the other request receives a safe denial.
4. Retry an accepted action with the same idempotency key.
5. Retry with the same key but altered amount and verify conflict rejection.
6. Kill the worker at each simulated state boundary and restart it.
7. Trace a child action through Travel and Personal to the root mandate in the audit UI.

### Gate

No real provider integration proceeds if any concurrent test permits overspending or if uncertain reservations can be released incorrectly.

## Phase 4 — Approvals, protected actions, and agent calls

### Automated checks

- Approval required/approved/rejected/expired state tests.
- Approval hash mismatch tests for amount, currency, merchant, recipient, category, and action scope changes.
- Render-to-Vercel service-auth tests with expired, revoked, wrong-audience, and wrong-agent credentials.
- Python ADK tool tests confirm credentials are injected outside model-visible prompts.
- Agent tests for Personal → Travel → Hotel/Transport and Personal → Food/Activities flows.
- Session context isolation and explicit-sharing tests.
- Gemini timeout, quota, malformed-output, and retry tests.
- Verify model output cannot call an unlisted tool or expand authority.
- Framework-independent REST client fixture completes the same allowed/denied flows.

### Manual acceptance

1. Start the Personal Agent workflow using the configured Gemini model.
2. Allow Personal to request Travel and its permitted children.
3. Request a protected simulated action requiring approval.
4. Approve the exact action, then alter its amount and confirm execution is blocked.
5. Deny an action and confirm the agent receives a safe machine-readable reason.
6. Force a Gemini timeout and confirm no budget is replenished or duplicated.
7. Inspect that credentials never appear in prompts, agent output, or logs.

### Gate

No payment execution proceeds if the agent runtime can bypass the gateway or if agent credentials are exposed to model context.

## Phase 5 — PayPal Sandbox and reconciliation

### Automated checks

- Provider adapter contract tests for create, approve, capture, query, cancel, and error responses.
- Supported/unsupported currency tests and explicit simulation-vs-provider separation.
- Provider idempotency and duplicate callback/event tests.
- Webhook signature/authentication, deduplication, replay, and out-of-order event tests.
- Timeout-after-provider-acceptance tests preserve reservations until reconciliation.
- Worker lease expiry, retry, backoff, and crash-recovery tests.
- Revoked-before-dispatch and revoked-after-dispatch tests.
- Verify browser/client never receives PayPal client secret or server credential.

### Manual acceptance

1. Create a USD sandbox protected action within available authority.
2. Complete the provider's required buyer approval flow.
3. Confirm gateway authorization, provider status, and ledger capture are separately visible.
4. Simulate denial, cancellation, timeout, duplicate event, and delayed event behavior.
5. Reconcile an uncertain operation before releasing its reservation.
6. Revoke the mandate after a completed payment and verify history remains truthful.
7. Confirm unsupported INR provider execution is rejected or routed to the explicitly approved simulation path. The current provider implementation uses USD; INR remains simulation-only.

### Gate

No production-like demo is accepted until provider credentials are server-only, duplicate execution is prevented, and uncertain outcomes are reconciled safely.

## Phase 6 — Dashboard and emergency controls

### Automated checks

- Playwright onboarding, environment creation, root authorization, child registration, and agent hierarchy flows.
- Dashboard authorization tests for User A/User B and environment switching.
- AG Grid sorting, filtering, pagination, column visibility, empty, loading, error, and large-data states.
- Approval inbox action-detail binding tests.
- Emergency pause, agent disablement, mandate revocation, and environment revocation browser tests.
- SSE authorization, reconnect, cursor catch-up, duplicate event, and stale snapshot tests.
- Accessibility checks for keyboard navigation, focus, labels, contrast, and table announcements.
- Responsive tests at supported desktop, tablet, and mobile viewports.

### Manual acceptance

1. Complete onboarding without reading internal IDs.
2. Inspect the delegation tree and compare displayed budgets with the ledger.
3. Filter audit events by agent, outcome, date, action, and environment.
4. Approve and reject actions from the dashboard.
5. Trigger emergency revocation and confirm descendants become blocked.
6. Disconnect/reconnect the browser and verify activity is not silently missed.
7. Use keyboard-only navigation through the critical flows.
8. Repeat the workflow on desktop and mobile-sized viewports.

### Gate

No release candidate proceeds if dashboard actions use different authorization rules than REST/MCP or if revocation controls are inaccessible/unreliable.

## Phase 7 — Contracts, security hardening, and release readiness

### Automated checks

- OpenAPI schema validation and APIMatic import/contract checks.
- Contract drift check between Fastify implementation and published schemas.
- MCP tool schema and error-code compatibility tests.
- Full regression suite across all prior phases.
- Dependency vulnerability and license checks.
- Secret scanning over history and current files.
- Threat-model test cases for spoofing, replay, privilege escalation, SSRF, injection, IDOR, CSRF, and sensitive-data leakage.
- Performance benchmark for authorization p95 below 100 ms excluding provider latency.
- Dashboard event visibility and large-history search/pagination benchmarks.
- Backup/restore and migration rehearsal in a disposable environment.

### Manual acceptance

1. Follow the external developer setup guide from a clean machine.
2. Connect an approved MCP client and complete the consent/authorization flow.
3. Use the REST example client to inspect authority, delegate, request an action, and handle rejection.
4. Review audit history for a complete child-to-root trace.
5. Run the documented rollback and recovery procedure.
6. Verify deployment configuration contains no committed secrets.
7. Review known gaps: inventory/booking scope, currency handling, exact Gemini limits, and future SDK generation.

### Gate

Release is blocked by failed security, contract, accounting, recovery, isolation, or required performance checks unless an explicit documented exception is approved.

## Test evidence format

For every completed phase, save a short result record containing:

```text
Phase:
Commit/build:
Environment:
Automated commands:
Automated result:
Manual checklist:
Manual result:
Known failures or exceptions:
Reviewer/date:
```

Store evidence in the repository's existing test/report location when implementation begins. Do not commit secrets, raw tokens, personal data, or unredacted provider payloads.
