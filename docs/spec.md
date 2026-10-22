# Step 2: project specification

## Assumptions and open questions
- Complete functional/non-functional requirements remain in `../input.md`; this is a concise flow and acceptance map, not a replacement.
- The agent hierarchy is one example of an environment, not a required shape for all environments.
- Booking/inventory integration and payment-demo currency decisions remain open.

## Status
Approved with the user's Personal Agent/automatic registration refinement and Claude-root/ADK-specialist execution model. Features are not implemented.

## User flows
1. **Onboarding:** authenticate, create an isolated environment, set its purpose/currency/policies, connect a Personal Agent, then explicitly authorize a root mandate. Neither environment creation nor agent connection grants authority implicitly.
2. **Task/session:** create or resume a task with explicit context references. Reuse a valid mandate when permitted; do not inherit unrelated conversation history or replenish authority.
3. **Dynamic delegation:** Personal chooses necessary specialist roles, registers authenticated children through the gateway, and requests bounded mandates. Travel can provision Hotel/Transport if permitted. Users need not manually register descendants.
4. **Protected action:** the acting agent requests an action; gateway validates identity, environment, complete authority chain, policy, budget and idempotency, obtains required human approval, then dispatches supported provider work.
5. **Payment:** distinguish gateway consent from provider buyer approval; reserve, execute, capture or safely release funds, and reconcile uncertain outcomes before release.
6. **Monitoring:** inspect hierarchy, sessions, runs, effective authority, budgets, approvals, transactions and traceable audit events using accessible dashboard views and AG Grid tables.
7. **Emergency control:** pause/revoke authority and block future use across descendants, while reconciling in-flight work without claiming completed payments were reversed.
8. **Developer integration:** authenticate an existing framework-independent agent via REST/MCP; inspect authority, delegate, request actions, handle rejection/pending states, and retrieve permitted audit records.

## Acceptance map — all implementation pending
| Baseline | Required acceptance evidence |
| --- | --- |
| FR-01–02 | Account lifecycle; verified identities; credential rotation/revocation; deliberate environment setup and strict isolation. |
| FR-03 | Independent/resumable sessions with explicit context sharing, no implicit authority or budget resets. |
| FR-04 | Catalog/add-ons and custom integrations; root onboarding plus automatic authenticated descendant registration; no implicit grants. |
| FR-05–06 | Signed root/child mandates; full-chain validation; scope/expiry/depth narrowing; allocation transfer; forged/expired/revoked requests rejected. |
| FR-07 | Default-deny policies; machine-readable decisions; human approvals bound to immutable details and unable to bypass hard limits. |
| FR-08–09 | Equivalent protected-action checks; integer accounting; concurrent reservation safety; idempotency; PayPal Sandbox flow and uncertainty reconciliation. |
| FR-10 | Mandate, agent and environment emergency controls; descendant enforcement and truthful in-flight/completed outcomes. |
| FR-11–12 | Traceable/tamper-evident audit; safe error details; AG Grid monitoring with sorting/filtering/pagination/column controls; responsive updates and layouts. |
| FR-13 | Versioned REST/MCP schemas, framework-independent examples, APIMatic docs/validation; future SDK contracts remain consistent. |
| FR-14 | Simulation and sandbox demonstrations; automated adversarial, concurrency, recovery and integration tests. |
| NFR-01–02 | Fail-closed security, exact accounting, no privilege expansion, secret isolation, idempotency and durable recovery. |
| NFR-03–04 | Measured internal authorization p95 <100 ms; normal recorded-event visibility within one second; defined workload and failure recovery. |
| NFR-05–08 | Tenant/context privacy, audit reconstruction, accessible guided flows, framework independence and versioned extension points. |
| NFR-09–10 | Reproducible checks/deployment, regression coverage, current contracts, secure configuration and observable failures. |

## Mandatory example
Personal receives 10,000 units; illustrative transfers are Travel 6,000, Food 2,000 and Activities 2,000. Travel transfers Hotel 4,000 and Transport 2,000. Aggregate available + reserved + spent remains 10,000; parent and child limits are never counted twice. Revoke Travel and show Hotel/Transport cannot authorize new actions.

The itemized implementation acceptance tracker is `checklist.md`; all ten critical product invariants in `../input.md` remain mandatory.
