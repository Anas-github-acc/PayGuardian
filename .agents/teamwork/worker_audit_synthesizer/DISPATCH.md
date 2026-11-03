## 2026-11-01T20:57:18Z
You are worker_audit_synthesizer, a worker agent tasked with synthesizing the findings from three thorough exploratory audits into the authoritative, publication-grade audit document: /home/anas/myspace/AI/PayGuardian/docs/frontend-audit.md.

Working directory: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_audit_synthesizer/
Monorepo root: /home/anas/myspace/AI/PayGuardian
Target deliverable: /home/anas/myspace/AI/PayGuardian/docs/frontend-audit.md
Original request: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/ORIGINAL_REQUEST.md

READ /home/anas/myspace/AI/PayGuardian/.agents/teamwork/ORIGINAL_REQUEST.md BEFORE STARTING WORK.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Hard Constraints
- Exclusive write ownership: You are authorized to write ONLY to `/home/anas/myspace/AI/PayGuardian/docs/frontend-audit.md` and metadata files in your working directory (`/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_audit_synthesizer/`).
- Zero other repository files may be created or modified.
- Every citation, file path, and line number must be exact, concrete, and verifiable in the codebase. Never guess; if a detail cannot be determined, explicitly mark it as undetermined.

## Source Audit Reports to Read
You MUST read and synthesize findings from:
1. `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_backend/report.md` (Backend service discovery, startup commands, ports, auth validation chains, real-time/queue evaluation, 42-endpoint catalog)
2. `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_frontend_1_7/report.md` (Screens 1-7 component mapping, 90-row hardcoded data catalog, props, action triggers, API replacement schemas)
3. `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_frontend_8_13/report.md` (Screens 8-13 component mapping, 60-row hardcoded data catalog, props, action triggers, screen-to-API status, shape differences, missing endpoints)

## Required Structure of `docs/frontend-audit.md`
Your generated `docs/frontend-audit.md` MUST contain all 6 required sections:

### 1. Service Discovery and API Specs (Requirement R1)
- Document startup commands, entrypoint files, config files, default ports, and API spec locations (FastAPI /openapi.json, swagger, exported schemas, routes) for ALL 5 services:
  1. Next.js frontend (`apps/web`)
  2. Basic auth backend / Fastify gateway (`apps/api`)
  3. Python delegation engine API (`apps/agent-runtime`)
  4. Durable payment reconciliation worker (`apps/worker`)
  5. Python agents (`agents/`)

### 2. Hardcoded Data Inventory (Requirement R2)
- Comprehensive master catalog of EVERY place in the frontend that holds data a user reads across all 13 screens.
- Include mock arrays, fixtures, inline amounts, currency symbols with numbers, event timers (`setTimeout`, `setInterval`), fake loading states, and client-side budget/permission/state-transition logic.
- Format as structured Markdown tables containing: File Path, Line Number, What the Data Represents, Which Screen Uses It.
- Incorporate all 150+ cataloged entries from the explorer reports without omission.

### 3. Screen-to-API Mapping (Requirement R3)
- Exhaustive mapping covering all 13 screens:
  1. Workspace graph
  2. Budget strip
  3. Activity feed
  4. Chat
  5. Sessions
  6. Memory
  7. Library
  8. Approvals
  9. Payment trace
  10. Mandates
  11. Audit grid
  12. Security
  13. Developers
- For each screen:
  * Purpose and UI component files
  * Existing backend API endpoint(s) that could supply its data (method, path)
  * Commands/actions it should call
  * Status: mark strictly as FOUND, PARTIAL (shape differs), or MISSING

### 4. Auth Flow and Real-Time Capabilities (Requirement R4)
- Auth Flow:
  * Detail login, session, and token mechanics across frontend (`apps/web`), auth backend (`apps/api`), and delegation API (`apps/agent-runtime`).
  * Explicitly identify which service validates requests to the delegation API (Fastify gateway `apps/api/src/auth.ts` vs Python agent runtime; explain why agent-runtime does not validate user tokens).
- Real-Time Capabilities:
  * Detail SSE and WebSocket availability across backend services (confirming that status pills in UI are mock and backend lacks SSE/WS endpoints).
  * Document supported event types (or lack thereof).
  * Document worker publishing behavior (PostgreSQL outbox table `public.provider_jobs`, Supabase RPC leasing, absence of external event broker like Redis).

### 5. Shape Differences (Requirement R5)
- For every endpoint marked PARTIAL across all screens:
  * Show side-by-side contrast between backend API fields and the props/types expected by existing frontend components.
  * Explain transformation logic required.

### 6. Gaps (Requirement R5)
- For every screen or capability marked MISSING or having missing fields (e.g. Memory domain, Model Context Protocol `/v1/mcp`, API Key Management, Payment Trace verification tree, Revocation cascade impact preview):
  * Propose concrete request and response JSON schemas with detailed field types and semantics.
