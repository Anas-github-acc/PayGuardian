# Step 6: delivery phases

## Assumptions and open questions
- Step 5 engineering standards are approved.
- These phases describe implementation order; no phase is complete until its tests pass and results are shown to the user.
- PayPal Sandbox currency, inventory/booking scope, exact Gemini model, MCP OAuth compatibility, and durable-worker hosting remain gates where stated.
- Initial deployment uses separate Vercel projects for `web` and `api`, Render for Python ADK agents, and Supabase for Auth/PostgreSQL.
- SDK generation remains future scope and is not a phase-completion requirement.

## Phase rules

- Work proceeds in order unless a dependency is explicitly marked as a parallel track.
- Each phase must produce a usable increment, passing automated checks, and a manual acceptance result.
- Security-critical failures block the phase; they are not deferred as polish.
- The checklist uses `[x]` only after the phase's definition of done and required tests pass. Approval of this document does not check implementation items.
- Every phase updates API contracts, docs, migrations, and security regression tests when those surfaces change.

## Phase 0 — Repository and deployment proof

### Goal
Create the reproducible polyglot monorepo and prove that the selected deployment boundaries work before building financial behavior.

### Scope
- Create `apps/web`, `apps/api`, `apps/agent-runtime`, `apps/worker`, `packages/*`, and Python agent directories from `standards.md`.
- Configure pnpm, uv, TypeScript, Python tooling, formatting, linting, and environment schemas.
- Add Next.js hello route and Fastify health/OpenAPI route.
- Add a minimal Python ADK agent health/run endpoint without payment authority.
- Deploy preview versions of the frontend and Fastify API to separate Vercel projects.
- Deploy a minimal ADK service to Render.
- Add Supabase local/project configuration without production secrets.

### Dependencies
None, except access to the selected Vercel, Render, and Supabase accounts when deployment proof is attempted.

### Definition of done
- A clean checkout installs with documented commands and lockfiles.
- Web, API, and agent services start locally with safe placeholder configuration.
- Vercel web/API previews and Render agent service can be reached through documented health checks.
- No feature claims are made from health routes; no secrets appear in source, logs, or preview output.
- TypeScript/Python quality checks pass.

## Phase 1 — Identity, environments, and agent registry

### Goal
Allow a user to authenticate, create isolated environments, connect one Personal Agent, and dynamically register child agents without granting authority implicitly.

### Scope
- Supabase Auth signup/login/logout and Fastify token verification.
- User, environment, integration connection, agent, credential, and membership models.
- Personal Agent root registration/connection flow.
- Authenticated parent-driven child registration for Travel, Food, Activities, Hotel, and Transport.
- Credential creation, hashing, expiry, rotation, revocation, and server-side identity resolution.
- Environment lifecycle: active, paused, closed, revoked.
- Basic dashboard onboarding and agent hierarchy view.
- Cross-environment and caller-supplied-identity denial behavior.

### Dependencies
Phase 0. The Claude Web/MCP OAuth spike may run in parallel, but production reliance on that flow is not required to complete the internal identity path unless chosen as the only root connection.

### Definition of done
- A user can create two environments and access only their own records.
- A Personal Agent can register a child through the API; manual descendant setup is not required.
- Child registration does not create a mandate, budget, session authority, or payment permission.
- Revoked/expired credentials and impersonated agent IDs are rejected.
- Auth, isolation, credential lifecycle, and registry checks pass.

## Phase 2 — Mandates, policy engine, delegation, and effective authority

### Goal
Implement deterministic authority enforcement before any payment provider integration.

### Scope
- Root mandates explicitly authorized by the user.
- Signed/hashed mandate contents and parent/child relationships.
- Scope, action categories, expiry, delegation rights, maximum depth, approvals, and environment bindings.
- Versioned policies with default deny and machine-readable decisions.
- Parent-driven delegation and nested delegation.
- Effective-authority evaluation across every ancestor.
- Mandate inspection, denial reasons, and revocation propagation.
- API/MCP policy-check and authority-inspection operations.

### Dependencies
Phase 1 identity and agent registry.

### Definition of done
- Personal can receive a root mandate and delegate only a narrower authority.
- Travel can delegate to Hotel and Transport only when its mandate permits it.
- Child scope, expiry, depth, approval requirements, and budget ceiling cannot exceed the valid parent chain.
- Forged, altered, expired, revoked, replayed, cross-environment, and self-authorized requests are rejected.
- Policy results are deterministic, machine-readable, auditable, and shared across REST/MCP.
- No protected payment provider call exists yet; policy decisions run in simulation mode.

## Phase 3 — Ledger, reservations, concurrency, and audit foundation

### Goal
Make budget allocation and protected-action accounting correct under concurrency and recovery.

### Scope
- Integer minor-unit balances and authoritative currency code.
- Allocation transfers from parent to child, reservations, captures, safe releases, and explicit reclaim.
- Protected action records with canonical request hashes and idempotency keys.
- PostgreSQL transactions, locking order, constraints, and outbox/job records.
- Append-only audit events, action-to-root traces, and tamper-evident chaining/checkpoints.
- Budget and audit inspection endpoints.
- Ledger, audit, and delegation-tree dashboard tables using AG Grid.

### Dependencies
Phase 2 effective-authority decisions. The durable worker placement must be selected before external payment execution, but the ledger can be tested with simulated jobs.

### Definition of done
- The 10,000-unit example conserves funding: Personal → Travel/Food/Activities; Travel → Hotel/Transport.
- Parent and child rollups never double-count money.
- Concurrent reservations cannot overspend or allocate the same available funds twice.
- Idempotent retries do not create duplicate actions or ledger entries.
- Crashes/retries leave recoverable states and never silently release uncertain reservations.
- Users can trace a child action to its root mandate in the dashboard.

## Phase 4 — Approvals, protected actions, and service-to-service agent calls

### Goal
Connect real agent workflows to the gateway while preserving the same authority path.

### Scope
- Approval inbox and action-detail-bound human approvals.
- Render-to-Vercel service authentication.
- ADK Personal, Travel, Hotel, Transport, Food, and Activities dummy agents using Gemini.
- Agent tool wrappers that attach credentials outside model prompts.
- Sessions, resumable runs, explicit context references, and run checkpoints.
- Protected non-payment simulation actions through REST and MCP.
- Agent failure, timeout, quota, and retry behavior.

### Dependencies
Phases 1–3. Exact Gemini model/free-tier configuration must be selected before deployment acceptance.

### Definition of done
- Personal can request permitted child registration/delegation through the gateway.
- Specialist agents can call gateway tools without direct database access.
- Gemini output cannot grant authority or bypass a denial.
- Retries preserve action identity and do not duplicate protected operations.
- A framework-independent custom-agent example can use the same REST contract.
- MCP OAuth compatibility is either proven for the selected root connection or a documented approved alternative is selected before production integration.

## Phase 5 — PayPal Sandbox and reconciliation

### Goal
Execute a safe, demonstrable sandbox payment with separate gateway authorization, buyer approval, provider execution, and accounting state.

### Scope
- PayPal server-only client and credential configuration.
- Approved supported-currency flow; INR simulation remains separate if PayPal Sandbox does not support INR.
- Order/approval/capture workflow.
- Provider idempotency keys and operation records.
- Webhook verification, deduplication, out-of-order handling, and reconciliation.
- Durable payment/reconciliation worker deployment.
- Pending, failed, cancelled, uncertain, captured, and safely released states.
- Payment status and recovery dashboard views.

### Dependencies
Phase 3 ledger/outbox and Phase 4 protected-action path. PayPal currency and durable-worker hosting decisions must be approved.

### Definition of done
- Unauthorized actions are rejected before PayPal calls.
- Sandbox success requires the provider's required buyer approval flow.
- Duplicate requests do not create duplicate provider operations.
- Timeouts/uncertain outcomes preserve reservations until safely reconciled.
- Verified provider events update the correct action and ledger state.
- Revocation does not falsely reverse a completed payment.
- Sandbox success, denial, cancellation, duplicate delivery, timeout, and recovery scenarios pass.

## Phase 6 — Dashboard completion, approvals, emergency controls, and live activity

### Goal
Deliver the user-facing operational dashboard for managing and monitoring the complete gateway.

### Scope
- Environment setup and policy configuration screens.
- Personal root mandate authorization flow.
- Agent catalog/add-on enablement and requested-permission display.
- Delegation tree with parent/child authority and budget details.
- Sessions/runs, approvals, payments, ledger, audit, and security events.
- Emergency pause, disablement, mandate revocation, environment revocation.
- AG Grid filtering, sorting, pagination, column management, and responsive layouts.
- Authenticated SSE or equivalent activity updates with snapshot/cursor recovery.
- Safe denial explanations and security warnings.

### Dependencies
Phases 1–5 and approved inventory/payment behavior.

### Definition of done
- A user can complete the onboarding-to-payment flow from the website.
- Revoking Travel blocks Hotel and Transport future actions while preserving truthful in-flight/completed state.
- Dashboard tables remain usable with large histories and on mobile/desktop sizes.
- Important recorded events appear through the live-update path or are recovered on reconnect.
- Accessibility and browser acceptance checks pass.

## Phase 7 — Contracts, documentation, security hardening, and release readiness

### Goal
Make the initial release reproducible, documented, observable, and ready for external developers.

### Scope
- Final versioned REST/OpenAPI contract and APIMatic documentation/validation.
- MCP tool documentation, Claude connection guide, custom-agent guide, and rejection/recovery examples.
- Security review of auth, credentials, tenant isolation, delegation, ledger, payments, and audit.
- Threat-model review and dependency/secret scans.
- Performance benchmark for authorization p95 <100 ms excluding provider latency.
- Dashboard event-visibility benchmark and large-history search/pagination benchmark.
- Deployment, rollback, backup/restore, incident, and recovery runbooks.
- Initial operational logs, health checks, metrics, and error tracking as defined in `observability.md`.

### Dependencies
Phases 0–6. Step 8 observability must be completed before final release sign-off.

### Definition of done
- Automated and manual acceptance evidence is attached to every completed phase.
- Published contracts match implementation and pass drift validation.
- Security, concurrency, recovery, payment, isolation, browser, and performance checks pass or have explicitly approved release exceptions.
- Deployment and recovery can be repeated from documented configuration without secrets in the repository.
- User receives a final validation report with known gaps and deferred SDK scope.

## Parallel tracks and gates

The following can proceed in parallel without changing the phase order:

- **Track A — MCP OAuth compatibility:** after Phase 0, before Phase 4 production integration.
- **Track B — ADK agent prototypes:** after Phase 0; they use mock gateway tools until Phase 4.
- **Track C — Dashboard visual shell:** after Phase 0; real data and mutations remain gated by Phases 1–3.
- **Track D — PayPal provider research:** before Phase 5; no live/sandbox provider call is implemented before ledger and authorization gates pass.

The release is blocked if any of these are unresolved:

- Agent identity cannot be verified independently of caller-supplied IDs.
- Delegation can broaden authority or duplicate available budget.
- Concurrent requests can overspend.
- Revocation does not reach descendants.
- Uncertain provider outcomes release reservations unsafely.
- REST, MCP, and dashboard paths use different enforcement logic.
- Secrets or sensitive prompt content appear in logs or audit records.
