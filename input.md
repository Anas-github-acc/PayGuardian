# Delegated Spending Authority for Agents

## Confirmed planning refinements

These user-confirmed refinements clarify the baseline below; unmodified requirements and security invariants remain in force.

- **Selected stack:** Next.js website, Node.js + Fastify + TypeScript gateway/API, Python ADK agents, Supabase PostgreSQL, Supabase Auth, and a monorepo. The website and gateway are intended for Vercel; dummy/ADK agents are intended for Render. Other Step 4 choices are proposals until approved.
- **Agent onboarding:** the user registers/connects a Personal Agent once. Authenticated parents may register the children needed for a task, subject to policy; users need not manually register every descendant. Registration alone never grants authority.
- **Example, not a fixed environment template:** a user authorizes a Personal Agent with ₹10,000. Personal delegates to Travel, Food, and Activities; Travel delegates to Hotel and Transport. Every allocation comes from its parent's available funds.
- **Initial ADK suite:** Personal, Travel, Hotel, Transport, Food, and Activities. Gemini is required for the platform's agent experience, not financial authorization decisions.
- **External root:** Claude Web may act as the connected Personal Agent while the platform ADK runtime executes specialist children. Caller-supplied agent names/IDs are not proof of identity.
- **APIMatic:** API documentation and contract validation are in initial scope; SDK generation is future scope, with versioned contracts and monorepo boundaries prepared now.
- **Still open:** demo inventory versus actual booking providers, and INR simulation versus a separate supported-currency PayPal Sandbox environment. No implicit FX conversion is approved.
- **Tracking:** `docs/checklist.md` uses `[*]` for pending and `[x]` only for actual completed work. Planning approval does not mark a feature implemented.

## 1. Problem we are solving
AI agents are starting to spend money for people. Payment protocols like AP2 handle one hop: a user authorizes an agent. But real agents don’t work alone. A Personal Agent hands work to a Travel Agent, which hands work to a Flight Agent. AP2 considers this agent-to-agent delegation possible but leaves it outside the specification.

Without a safe way to pass authority down the chain, today’s options are all bad:

Credential sharing: every subagent gets the same keys and the same full power.
Overspending: nothing stops the sum of the children’s spending from exceeding what the user approved.
Privilege escalation: a subagent can act outside the purpose, category or time window the user intended.
No revocation: the user cannot cut off one agent and everything beneath it.
No accountability: after a payment, nobody can prove who authorized it or why.


## 2. Objective and scope

**Objective:** Let users grant bounded authority to AI agents and subagents so they can perform authorized actions, while preventing unauthorized spending, privilege escalation and misuse of delegated permissions. The gateway enforces permissions, mandates, budgets, delegation limits, revocation and auditability. It never relies on an agent’s reasoning or promises.

**Deliverables:** A website for configuring and monitoring environments, a dashboard for agent activity, and an MCP interface plus documented REST API for external agents and frameworks. After this we created the SDKs as well to server external developer.

**In scope (initial release):** accounts, environments, sessions, agent registry, mandates, delegation, policies and approvals, protected actions with PayPal sandbox payments, budget ledger, revocation, audit trail, dashboard, MCP and REST integration, use ADK for creating agents, AG Grid (for dashboard like audit trail, ledger table, with sortable and filterable rows showing every approved and rejected action).

**Out of scope (initial release):** client SDK generation/publication, including APIMatic-generated SDKs. APIMatic documentation and contract validation remain in scope.

## 2. Glossary

| Term | Meaning |
| --- | --- |
| Principal | An authenticated actor: a user, a developer or an agent. |
| Environment | An isolated scope for one purpose (for example Travel) with its own budgets, mandates, policies, agents, sessions and activity. |
| Session | One task or workflow inside an environment. It carries context references and progress, never authority. |
| Mandate | A signed, bounded grant of authority: environment, holder, budget, scope, expiry, delegation rights and approval rules. A root mandate comes from a user. A child mandate comes from a delegation. |
| Delegation | An allocation of part of a parent mandate’s authority to a child agent. It moves budget; it does not copy it. |
| Reservation | Budget held for an in-flight protected action until the outcome is known. |
| Capture | A reservation converted into confirmed spend. |
| Effective authority | What an agent may actually do now: its mandate, valid and unrevoked at every level of its chain, within the remaining budget. |
| Protected action | Any operation that spends money, uses a restricted tool or changes authority. |
| Provider | An external system that executes actions, for example PayPal. |

## 3. User Types

### User Type A: Individual User

A normal user who signs up on the website, creates isolated environments for different activities, configures budgets and permissions, connects supported coding agents through MCP, and monitors their activity using a web dashboard.

Examples:
- A user creating a Travel environment with a defined budget.
- A user creating a separate Daily Budget Management environment.
- A user connecting their coding agent to the gateway through MCP.
- A user enabling a prebuilt agent add-on or configuring a custom agent integration.

### User Type B: Developer / Agent Builder

A developer who builds or operates their own AI agents and wants to integrate the Delegation Gateway into their agent workflow.

The developer must be able to authenticate agents, request mandates, delegate limited authority to subagents, perform authorized actions through the gateway, retrieve results, and inspect audit records through MCP and documented APIs.

Developers may use their own agent frameworks and orchestration logic. The gateway must not require them to rebuild their existing agents or use a specific framework.

## 4. Functional Requirements

### FR-01: User Accounts and Access Control

1. Users must be able to sign up, log in, log out, and manage their accounts.
2. Users must only be able to access environments, mandates, agents, sessions, and audit information they are authorized to view.
3. The platform must support secure authentication for both website users and external agents or integrations.
4. Developers must be able to register or connect their agents and manage the credentials or keys required for integration.
5. Agent identity must be verified rather than trusting a caller-provided agent ID alone.
6. The platform must support credential rotation, revocation, and invalidation of compromised credentials.

### FR-02: Environment Management

1. Users must be able to create multiple environments for different purposes.
2. Each environment must have a name, purpose, owner, status, and configurable settings.
3. Environments must support separate budgets, mandates, policies, agent registrations or assignments, sessions, and activity records.
4. Users must be able to pause, resume, close, and revoke the authority associated with an environment.
5. Users must be able to inspect an environment's agent hierarchy, budget utilization, active sessions, recent actions, and security events.
6. Operations must be scoped to the correct environment. An agent authorized in one environment must not automatically gain access to another environment owned by the same user.
7. Environment creation must be an explicit setup operation or part of a deliberate onboarding flow. Routine API or MCP calls must not create new environments automatically.
8. Closing or revoking an environment must block future protected actions and handle pending operations according to their actual payment or execution state.

### FR-03: Session and Task Management

1. Each environment must support multiple independent sessions.
2. A session must represent a particular task or workflow, such as planning a trip, booking a hotel, or analyzing a budget.
3. Users and authorized agents must be able to create, inspect, resume, and close sessions.
4. Sessions must maintain task status, relevant context references, workflow progress, and associated activity records.
5. A new session must not automatically inherit the entire conversation or context of another session.
6. Authorized sessions may reference shared data explicitly when necessary, without unintentionally exposing unrelated conversation history.
7. Sessions must be associated with the correct environment and authenticated principal.
8. Sessions must not independently create, expand, or grant spending authority.
9. A new session must be able to reuse an existing valid mandate when its permissions and environment permit the requested action.
10. The platform must distinguish session state from mandate state and financial state.

### FR-04: Agent Registry and Agent Add-ons

1. The platform must provide a catalog of available agent add-ons.
2. The catalog must include prebuilt agents or agent templates for supported use cases, such as travel planning, budgeting, and task automation.
3. Users must be able to enable, configure, disable, and remove supported add-ons.
4. The platform must allow developers or users to connect custom agents developed using their own frameworks.
5. Custom agents must be registerable with an identifiable name, owner or publisher, capabilities, supported operations, and relevant metadata.
6. Each connected agent must have an identity that can be authenticated and associated with the appropriate environment and permissions.
7. Enabling an agent add-on must not automatically grant it access to a user's budget, credentials, or protected actions.
8. Agent permissions must be explicitly configured or granted through the mandate and policy system.
9. Agents must be able to operate as parent or child agents only when the relevant delegation permissions allow it.
10. The catalog must distinguish platform-provided agents from third-party or user-created integrations and communicate the permissions they request.

### FR-05: Mandate Creation and Management

1. Users must be able to authorize a root mandate that defines the authority granted to an agent or agent system.
2. A mandate must support applicable constraints such as:
   - Environment and authorized agent identity.
   - Budget limit and currency.
   - Permitted action categories, tools, or operations.
   - Validity period and expiry.
   - Delegation permission and maximum delegation depth.
   - Approval requirements and other applicable policy constraints.
3. The platform must validate that the user or principal creating a mandate is authorized to grant the requested authority.
4. Mandates must have unique identifiers, explicit states, and traceable relationships to their issuers and parent mandates.
5. Mandates must be inspectable, revocable, and auditable.
6. Expired, revoked, invalid, or unauthorized mandates must not authorize new protected actions.
7. Mandate creation and use must be separate from session creation.
8. A new mandate must not silently reset spent budget or restore previously consumed authority.

### FR-06: Delegation and Subagent Authority

1. An authorized parent agent must be able to request delegation of a limited portion of its authority to a child agent.
2. The gateway must validate the delegation request before granting a child mandate.
3. A child mandate must be restricted to the authority that the parent is actually allowed to delegate.
4. Delegation must not increase the authorized budget, broaden permitted actions, extend the parent's effective expiry, bypass approval requirements, or exceed the permitted delegation depth.
5. The platform must support nested delegation where explicitly permitted.
6. Each delegation must be traceable to its parent mandate and authorized delegating principal.
7. The gateway must reject forged, altered, invalid, expired, revoked, or unauthorized delegation chains.
8. Delegation requests must account for previously allocated or reserved budgets to prevent multiple children from being granted the same available funds.
9. The gateway must allow the parent or authorized user to inspect the child agent's authority and remaining budget.
10. Agent creation or spawning by an external agent framework must not itself grant the new agent any permissions.

### FR-07: Policies and Approval Rules

1. Users must be able to configure applicable policies and rules for each environment.
2. Policies must support budget limits, allowed action categories, tool permissions, delegation restrictions, expiry, and approval thresholds.
3. Developers may propose budget allocations or policy settings, but the gateway must validate them against the authority already granted.
4. The platform must support human approval for operations that require consent or exceed the applicable automated approval threshold.
5. An approval must be bound to the relevant action and material details, such as amount, currency, recipient or merchant, and other applicable transaction details.
6. Human approval must not silently bypass the root mandate's hard limits. A request beyond those limits requires an authorized change to the governing authority before execution.
7. Unknown or ambiguous protected actions must be denied by default.
8. Policy decisions must return clear, machine-readable allow or deny results and useful rejection reasons.

### FR-08: Protected Actions and Payment Requests

1. The gateway must expose authenticated operations through MCP and documented APIs for requesting protected actions.
2. Operations may include requesting a payment, checking remaining authority, retrieving payment status, inspecting a mandate, requesting delegation, revoking authority, and retrieving permitted audit records.
3. Every protected action must be checked against the caller's identity, environment, applicable mandate chain, policy, scope, expiry, revocation state, and available budget.
4. The gateway must reject unauthorized actions before forwarding them to the relevant execution or payment provider.
5. Budget reservation and authorization must be safe under concurrent requests and must prevent double-spending.
6. Payment or action requests must support idempotency so retries do not unintentionally create duplicate operations.
7. The gateway must track the actual status of protected operations, including pending, successful, failed, and uncertain outcomes where applicable.
8. A timeout or ambiguous payment response must not cause a reservation to be released until the operation's outcome has been safely reconciled.
9. Payment credentials and provider secrets must remain protected and must not be exposed to external agents.
10. The gateway must distinguish its own authorization decision from the payment provider's decision or any required buyer approval.
11. Completed payments must not be represented as reversed merely because a mandate or environment is later revoked.
12. Where a payment provider is integrated, its supported authorization and execution flow must be respected.

### FR-09: Budget Accounting

1. Users must be able to inspect the budget limit, amount spent, amount reserved, pending amount where applicable, and remaining available budget.
2. The platform must prevent spending or delegation beyond the effective authorized limit.
3. Budget accounting must correctly handle child allocations, reservations, captures, failures, cancellations, and reconciliations.
4. The same amount must not be counted as newly available merely because it appears in multiple levels of the delegation hierarchy.
5. Failed or cancelled operations may release reservations only when their actual state makes release safe.
6. The platform must use a consistent authoritative currency for each budget ledger. Currency conversions must not silently change the authoritative budget.
7. Users must be able to view budget utilization by environment, mandate, agent, and session where relevant.

### FR-10: Revocation and Emergency Controls

1. Users must be able to revoke a mandate, disable an agent, pause an environment, or revoke the authority of an environment.
2. Parent agents must be able to request revocation of descendant authority when authorized to do so.
3. Revoking a mandate must prevent new protected actions using that mandate.
4. Revocation of a parent mandate must invalidate or block the effective authority of its descendants.
5. The platform must prevent revoked credentials or mandates from being used to obtain new authority.
6. The platform must handle in-flight operations and pending payments according to their actual state and the capabilities of the relevant provider.
7. Revocation must not be represented as automatically reversing completed external actions.
8. Emergency revocation must be available from the dashboard and supported API operations, subject to authentication and authorization.

### FR-11: Audit Trail and Activity Monitoring

1. The platform must maintain an auditable record of mandate creation, delegation, policy decisions, protected actions, payment state changes, approvals, and revocations.
2. Each relevant event must identify its environment, actor, associated session where applicable, mandate chain, action, timestamp, outcome, and rejection reason when relevant.
3. Users must be able to trace an action from a child agent through its delegation chain to the governing root authority.
4. Audit records must support searching, filtering, sorting, pagination, and time-based queries.
5. The audit trail must be tamper-evident, with appropriate controls preventing ordinary application operations from rewriting historical events.
6. Secrets, credentials, and unnecessary sensitive conversation content must not be written to audit records.
7. The platform must clearly distinguish requested actions from authorized actions, provider-accepted actions, and completed actions.

### FR-12: Web Dashboard

1. Users must have a website dashboard for creating and managing environments.
2. The dashboard must show the hierarchy of authorized agents and their delegated permissions.
3. Users must be able to inspect mandates, policies, budgets, sessions, activity history, and payment statuses.
4. The dashboard must display spent, reserved, pending where applicable, and available budget.
5. Users must be able to enable or configure supported agent add-ons and connect custom agents.
6. Users must be able to inspect and revoke agent authority, pause environments, and review security warnings.
7. The dashboard must display useful error details for denied operations without exposing sensitive information.
8. Important activity and status changes should appear promptly without requiring a full page reload.
9. Tables containing agents, mandates, transactions, or audit events must use AG Grid.
10. AG Grid-based views must support the filtering, sorting, pagination, column management, and data presentation capabilities needed for practical monitoring.
11. The dashboard must remain usable with large activity histories and on commonly used desktop and mobile screen sizes.

### FR-13: MCP and Developer Integration

1. The platform must expose documented MCP tools that external coding agents and supported agent frameworks can use.
2. MCP operations must support the relevant environment, session, mandate, delegation, policy-check, protected-action, budget-inspection, revocation, and audit workflows.
3. MCP calls must authenticate and authorize the caller. MCP connectivity alone must not confer authority.
4. Every protected call must enforce the same security and budget rules regardless of whether it originates from MCP, a REST API, or the website.
5. The platform must provide clear request and response schemas and machine-readable error responses.
6. Developers must be able to connect custom agents without being forced to adopt a particular agent framework.
7. The platform must provide developer documentation, setup instructions, example workflows, and testing guidance.
8. Use APIMatic for appropriate API description, contract validation, developer documentation, and SDK generation capabilities.
9. API definitions and generated documentation or SDKs must remain consistent with the implemented API contract.
10. Example integrations must clearly show how developers establish user-authorized authority, request delegation, perform a protected action, inspect results, and handle rejection.

### FR-14: Testing and Security Demonstration

1. The platform must provide automated tests for mandate validation, delegation restrictions, budget accounting, revocation, authentication, and auditability.
2. Tests must cover overspending, concurrent requests, replayed requests, forged delegation records, altered mandate content, expired mandates, revoked authority, and cross-environment access.
3. Tests must verify that an agent cannot expand its own permissions or bypass the gateway through an alternate protected-operation path.
4. The platform must support a safe demonstration or simulation mode for testing allow and deny decisions without causing unintended real-world actions.
5. Test results must make it clear why an operation was accepted or rejected.
6. External payment integrations must support sandbox-based testing when the provider makes a sandbox available.

## 4. Non-Functional Requirements

### NFR-01: Security

- Use strong authentication and authorization for users, developers, and agents.
- Use cryptographically verifiable identities and delegation records where appropriate.
- Bind each delegation to its issuer, child identity, parent mandate, environment, permitted actions, budget, expiry, and unique identifier.
- Reject replayed, tampered, forged, unauthorized, and expired requests.
- Apply least-privilege permissions and secure secret management.
- Never expose payment-provider credentials to agents or browser clients.
- Treat external agent output, user-supplied tool descriptions, and third-party integration metadata as untrusted input.
- Fail closed when authorization cannot be verified.
- Enforce equivalent security checks across MCP, REST APIs, and dashboard-triggered operations.

### NFR-02: Correctness and Financial Integrity

- Budget calculations must be precise and must avoid floating-point errors for monetary values.
- Concurrent authorization and reservation operations must not permit overspending.
- All relevant state changes must preserve accounting invariants and be safely recoverable after failures.
- Repeated requests must be handled idempotently where applicable.
- Uncertain external payment outcomes must be reconciled before reserved funds are released.
- Authority must only be narrowed through delegation.
- Mandate revocation must be enforced consistently across descendants and protected operations.

### NFR-03: Performance

- Target a p95 latency below 100 ms for the gateway's internal authorization and budget-check path under the defined benchmark workload, excluding external provider latency.
- Establish and document benchmark workloads, concurrency levels, data volumes, and test environments.
- Dashboard activity updates should normally become visible within one second after the system records an event, excluding external provider delays.
- Search and pagination must remain responsive with large datasets.
- Performance must be measured rather than assumed.

### NFR-04: Availability and Recovery

- The platform must handle temporary failures of external providers without losing authorization or accounting integrity.
- Failed requests must not leave ambiguous budget reservations permanently invisible or silently release them when their outcome is uncertain.
- The platform must support recovery from process crashes and interrupted operations.
- Persisted mandates, audit records, accounting state, and payment status must remain consistent across recovery.
- The product must provide operational error reporting and meaningful service health information.

### NFR-05: Data Isolation and Privacy

- Users must not access another user's environments, sessions, agent records, mandates, payment details, or audit data.
- Every operation must be scoped to the authenticated principal and relevant environment.
- Cross-environment data access must be denied unless explicitly authorized.
- Session context must not be shared automatically between unrelated tasks.
- Collect and retain only the sensitive information necessary for the service's operation.
- Logs and audit data must be protected against accidental disclosure.

### NFR-06: Auditability and Traceability

- Security-relevant events must be recorded reliably and in a form suitable for investigation.
- The audit trail must make unauthorized attempts and enforcement failures observable.
- Historical records must be tamper-evident and access-controlled.
- The system must provide enough information to reconstruct the delegation path and outcome of a protected operation without requiring access to sensitive prompt content.

### NFR-07: Usability

- New users must be able to create an environment, define authorized limits, and connect an agent through a guided flow.
- Security-sensitive settings must be understandable and must not be enabled implicitly.
- Permission denials must explain the reason and, where appropriate, how an authorized user can resolve the problem.
- Environment, session, mandate, and agent concepts must be clearly distinguished in the user interface.
- Tables must provide effective filtering, sorting, and navigation using AG Grid.
- The website must meet reasonable accessibility and responsive-design standards.

### NFR-08: Extensibility and Interoperability

- The gateway must be framework-agnostic and support external agents through documented interfaces.
- MCP tools and REST API contracts must be versioned and documented.
- Agent add-ons must be extensible without silently weakening authorization rules.
- New tools, action categories, and eligible provider integrations must be addable without changing the fundamental authority-enforcement requirements.
- APIMatic-generated API documentation and SDKs must accurately reflect supported contracts.
- Future integration changes must not break the validation of existing valid mandates without an explicit versioning or migration policy.

### NFR-09: Maintainability and Quality

- Requirements must be covered by automated unit, integration, and end-to-end tests as appropriate.
- Authorization, delegation, budget, and revocation logic must be independently testable.
- Changes to security-critical behavior must include regression tests.
- API contracts and user-facing documentation must be kept current.
- The codebase must support clear error reporting, structured operational logs, and reproducible development and test workflows.

### NFR-10: Deployment and Observability

- The platform must provide documented local setup, environment configuration, and deployment instructions.
- Secrets and environment-specific configuration must be supplied securely rather than embedded in source code.
- The product must expose useful operational metrics, including request latency, authorization denials, budget rejections, payment-state failures, and integration errors.
- Errors and provider outages must be observable without leaking credentials or sensitive user data.
- The deployment and recovery process must be repeatable and documented.

## 5. Critical Product Invariants

The following rules are mandatory and must not be relaxed during implementation:

1. An agent cannot grant itself authority.
2. A child agent cannot possess more authority than its valid parent delegation allows.
3. A new environment or session does not automatically create or replenish a budget.
4. A session does not confer financial permission.
5. An agent's existence, registration, or inclusion in an add-on catalog does not automatically authorize protected actions.
6. All protected actions must be verified by the gateway or an explicitly trusted enforcement mechanism.
7. No user or agent can spend more than the effective authorized budget, including under concurrent requests.
8. Revocation prevents future use of revoked authority but does not automatically undo completed external actions.
9. MCP is an integration interface, not a substitute for authentication, authorization, or budget enforcement.
10. The user's explicit authorization is the source of root spending authority; downstream agents may request only permitted delegation.

## 6. Expected Initial Validation Scenarios

Before considering the initial product complete, demonstrate these scenarios:

- A user creates separate Travel and Daily Budget environments and cannot access or use the authority of one from the other.
- A developer connects an existing agent through MCP without rewriting its orchestration logic.
- A root mandate authorizes a budget of ₹10,000 to Personal, which delegates within that limit to Travel, Food, and Activities; Travel delegates within its allocation to Hotel and Transport. This is a simulated INR scenario unless a supported payment-provider currency flow is separately approved.
- A child agent requesting more than its available authority is rejected before the protected action is executed.
- Two concurrent requests cannot spend or reserve the same remaining funds twice.
- An expired or revoked mandate and every descendant relying on revoked authority are prevented from authorizing new protected actions.
- A new session can resume a task with its necessary context without inheriting unrelated conversation history or receiving extra authority.
- A user can inspect the delegation tree, budget use, request outcomes, and audit trail from the website.
- A custom agent and a supported prebuilt agent are subject to the same authorization and budget enforcement rules.
- API contracts, API documentation, and supported SDKs are consistent with the actual service behavior.

Use these requirements as the product's requirements baseline. Identify ambiguities, dependencies, and decisions that still need confirmation before implementation planning. Do not silently omit a requirement, weaken a security invariant, or assume that an external payment provider supports a capability it does not provide.
