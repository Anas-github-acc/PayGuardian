# Project: PayGuardian Frontend-to-Backend Integration

## Architecture
- **Web Dashboard**: Next.js 16 (`apps/web`) in TypeScript / React 19 using App Router directory structure (`app/`, `components/`, `lib/`).
- **Typed Client Architecture**: `apps/web/lib/api/` (or `app/api/`) containing generated OpenAPI types (`generated-schema.ts`), base API client, screen-specific hooks (`useWorkspaceGraph`, `useActivityFeed`, `useApprovals`, `usePaymentTrace`, `useAgentLibrary`, `useSessions`, `useMemories`), and mappers converting backend DTOs to component prop interfaces without altering component styling or markup.
- **Next.js Routing Proxy**: Route Handler at `apps/web/app/api/proxy/[...path]/route.ts` (or rewrites) proxying requests to Fastify Gateway (`http://127.0.0.1:3001`), maintaining `httpOnly` session cookies and eliminating browser CORS issues.
- **Backend Authority**: Fastify Gateway (`apps/api`) on port 3001 is the exclusive authority and validation point.
- **Python Immutability**: Zero lines modified in `apps/agent-runtime`, `agents/`, `apps/worker`, or auth backends.
- **Financial Data Integrity**: Monetary amounts handled strictly as integer minor units plus currency; formatted for display only. No optimistic updates for money, authority, or approvals. Client-side permission/budget checks replaced by `allowed_actions`.
- **UI Resilience**: Loading skeletons, empty states, and error states with retry matching container dimensions without layout shift.
- **Gaps Registry**: Missing endpoints/fields rendered as explicit "unavailable" states and documented in `docs/gaps.md`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | OpenAPI Type Generation | Script in `apps/web/package.json` generating types via `openapi-typescript` | M1 | R1 |
| 2 | Typed API Client & Mappers | `lib/api/` client with hooks and mappers producing exact component props | M1 | R1 |
| 3 | Next.js API Proxy / Routing | Route Handler / rewrites forwarding to Gateway, preserving httpOnly cookies and no CORS | M1 | R1 |
| 4 | Lint Rule Guardrail | ESLint rule in `apps/web` banning fixture/mock imports inside `app/`, `components/`, `lib/` | M1 | R5 |
| 5 | Gaps Registry Setup | Initialize `docs/gaps.md` with schema for missing contracts | M1 | R2 |
| 6 | Screen 1: Workspace Graph & Budget Bar | Connect graph & budget to backend, remove fixtures (`DEFAULT_GRAPH_NODES`, etc.), wire revoke mutation | M2 | R2, R3 |
| 7 | Screen 2: Activity Feed | Connect feed to `GET .../activity`, integer minor units, short polling fallback, delete fixtures | M2 | R2, R4 |
| 8 | Screen 3: Approvals | Connect to `GET/POST .../approvals`, eliminate optimistic updates, use `allowed_actions`, delete fixtures | M3 | R2, R3 |
| 9 | Screen 4: Payment Trace | Connect to `GET .../actions/:id/trace`, render unavailable for missing stages/checklist, delete `DEFAULT_TRACES` | M3 | R2, R4 |
| 10 | Screen 5: Library | Connect to child agent & mandate mutations, render catalog unavailable state, delete `CATALOG_AGENTS` | M4 | R2, R3 |
| 11 | Screen 6: Sessions | Connect to `GET/POST .../sessions`, eliminate fake Date.now() IDs, render message history unavailable state, delete fixtures | M4 | R2, R3 |
| 12 | Screen 7: Memory | Explicit "Memory Vault Unavailable" container, disable forget buttons, delete `INITIAL_MEMORIES`, document in `docs/gaps.md` | M4 | R2 |
| 13 | E2E Integration Test | Automated test altering backend value and asserting UI reflects change | M5 | R5 |
| 14 | Workspace Validation Suite | `npm run typecheck`, `npm run lint`, and `npm run test` passing cleanly in `apps/web` | M5 | R5 |
| 15 | Forensic Integrity & Hardening | Zero mock imports, integer minor units, zero Python modifications, clean auditor verdict | M5 | R1-R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Typed Client, Typegen, Next.js Routing & Lint | R1 typegen script, `lib/api/` client scaffold, Next.js proxy route, ESLint fixture-banning rule, `docs/gaps.md` init | none | DONE |
| M2 | Screens 1 & 2: Graph & Budget Bar + Activity Feed | Wire Graph & Budget Bar and Activity Feed, mappers, delete fixtures, short polling, UI skeletons | M1 | DONE |
| M3 | Screens 3 & 4: Approvals & Payment Trace | Wire Approvals (no optimistic updates, `allowed_actions`) and Payment Trace (unavailable states), delete fixtures | M2 | DONE |
| M4 | Screens 5–8: Library, Sessions & Memory | Wire Library & Sessions, Memory explicit unavailable container, delete remaining fixtures, document gaps | M3 | DONE |
| M5 | E2E Test, Verification & Forensic Audit | E2E test, typecheck, lint, test in `apps/web`, Challenger & Forensic Auditor gates | M4 | DONE |

## Interface Contracts
### Client ↔ Gateway (via Next.js Proxy)
- Proxy Route: `POST/GET/PATCH/DELETE /api/proxy/[...path]` -> forwards to `http://127.0.0.1:3001/:path*` with `Content-Type: application/json` and credentials.
- In dev mode: attaches `x-local-user-id: local-user`. In auth mode: forwards `httpOnly` session cookies as Bearer tokens.

### Component Props ↔ API Mappers
- `mapWorkspaceGraph(agents, mandates, accounts) -> AgentNodeData[]`
- `mapBudgetBar(account, mandates) -> BudgetBarProps`
- `mapAuditEventToFeedItem(event) -> ActivityFeedItem`
- `mapApprovalDtoToItem(approval) -> ApprovalItem`
- `mapBackendTraceToView(trace) -> PaymentTrace`
- `mapCatalogDtoToAgent(catalogItem) -> CatalogAgent`
- `mapSessionDtoToItem(session) -> SessionItem`

## Code Layout
- `apps/web/lib/api/client.ts`: Base HTTP client routing through Next.js proxy
- `apps/web/lib/api/generated-schema.ts`: Generated OpenAPI TypeScript types
- `apps/web/lib/api/hooks/`: Screen-specific hooks (`useWorkspaceGraph`, `useActivityFeed`, etc.)
- `apps/web/lib/api/mappers/`: DTO-to-prop mappers
- `apps/web/app/api/proxy/[...path]/route.ts`: Next.js proxy route handler
- `docs/gaps.md`: Missing endpoints, fields, and proposed contracts
- `tests/e2e/` or `apps/web/tests/`: End-to-end integration test
