# Handoff Report: Survey of Screens 5–8 & Missing Endpoints

**Agent**: `explorer_survey_screens_5_8`  
**Date**: 2026-11-01T21:36:00Z  
**Target Repository**: `/home/anas/myspace/AI/PayGuardian`  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

1. **Screen Sequence & Scope**:
   - `ORIGINAL_REQUEST.md:19` (R2) states: *"Replace hardcoded data one screen at a time across the 8 screens in sequence: starting with the graph and budget bar, then the activity feed, approvals, payment trace, library, sessions, and memory."*
   - Peer explorer `explorer_survey_screens_1_4` surveyed: Screen 1: Workspace Graph and Budget Bar, Screen 2: Activity Feed, Screen 3: Approvals, Screen 4: Payment Trace (`explorer_survey_screens_1_4/DISPATCH.md:9-12`).
   - Monorepo UI components map directly to the 8 screens:
     - Screen 5: Payment Trace (`apps/web/components/traces/PaymentTraceView.tsx`)
     - Screen 6: Library (`apps/web/components/agents/AgentLibrary.tsx`)
     - Screen 7: Sessions (`apps/web/components/workspace/sessions-memory.tsx:55`, `components/chat/session-history.tsx:26`)
     - Screen 8: Memory (`apps/web/components/workspace/sessions-memory.tsx:200`, `components/cards/memory-card.tsx:22`)

2. **Screen 5 (Payment Trace) Observations**:
   - `apps/web/components/traces/types.ts:79–572` defines `DEFAULT_TRACES`, a 494-line mock object containing synthetic traces `"trace-pay-9018"`, `"trace-rej-7712"`, and `"trace-pend-4401"`.
   - `apps/web/components/traces/PaymentTraceView.tsx:42–45` executes zero network requests, reading directly from `DEFAULT_TRACES`:
     ```typescript
     const trace: PaymentTrace =
       DEFAULT_TRACES[effectiveTraceId] ??
       DEFAULT_TRACES["trace-pay-9018"] ??
       Object.values(DEFAULT_TRACES)[0];
     ```
   - Fastify Gateway route `GET /v1/environments/:environmentId/actions/:actionId/trace` (`apps/api/src/phase3-routes.ts:485–512`) returns `{ action, agent, mandateChain, rootMandate }`.
   - Backend `ActionTraceDto` completely lacks execution stages with latencies (`stages`), 5-point invariant verification checklist (`checklist`), and formatted recipient metadata.

3. **Screen 6 (Library) Observations**:
   - `apps/web/components/agents/types.ts:42–258` defines `CATALOG_AGENTS`, a 217-line static mock array of 6 specialist agents with hardcoded audit certificates and authority tiers.
   - `apps/web/components/agents/AttachAgentDialog.tsx:83–87, 111–143` computes fake 3D trigonometric node coordinates, generates a fake signature (`"0x7a89f921bc" + Math.random().toString(16).slice(2, 8)`), and modifies local React state (`workspaceStore.attachAgent`) without invoking any backend API.
   - Fastify Gateway exposes `POST /v1/environments/:environmentId/agents/children` (`apps/api/src/phase1-routes.ts:166`) and `POST /v1/mandates/:mandateId/delegations` (`phase2-routes.ts:109`), but Gateway has no endpoint serving catalog metadata (`GET /v1/agent-catalog` is MISSING). Python runtime `GET /agents` (`apps/agent-runtime/src/agent_runtime/main.py:49`) returns only a list of string names (`["personal", "travel", ...]`).

4. **Screen 7: (Sessions) Observations**:
   - `apps/web/components/workspace/workspace-defaults.ts:36–64` defines `INITIAL_SESSIONS`, 3 static mock sessions.
   - `apps/web/components/workspace/sessions-memory.tsx:55` and `apps/web/components/chat/session-history.tsx:26` initialize state with `useState(INITIAL_SESSIONS)`.
   - Creation handlers (`sessions-memory.tsx:66–83` and `session-history.tsx:38–52`) fabricate local IDs `sess-new-${Date.now()}` and clear chat messages without calling `POST /v1/environments/:id/sessions`.
   - Fastify Gateway exposes `POST /v1/environments/:environmentId/sessions` (`apps/api/src/phase4-routes.ts:271`) and `GET .../sessions` (`line 310`), but relies on volatile `InMemorySessionStore` (`apps/api/src/phase4.ts:289`). No route exists to fetch session message history (`GET .../sessions/:sessionId/messages` is MISSING).

5. **Screen 8: (Memory) Observations**:
   - `apps/web/components/workspace/workspace-defaults.ts:66–94` defines `INITIAL_MEMORIES` (3 static mock memories).
   - `apps/web/components/workspace/sessions-memory.tsx:200` initializes `useState(INITIAL_MEMORIES)`.
   - `sessions-memory.tsx:203–207` updates `isRevoked: true` purely in local React state.
   - `apps/web/components/cards/memory-card.tsx:22–30` hardcodes fallback props.
   - **Monorepo Backend Reality**: Zero database migrations in `supabase/migrations/` reference memory, zero models exist in `packages/domain/`, zero DTOs exist in `packages/contracts/`, and zero routes exist in `apps/api/` or `apps/agent-runtime/`.

---

## 2. Logic Chain

1. **Screen Count Reconciliation**:
   - Observation 1 notes that R2 specifies 8 screens in sequence: Graph, Budget Bar, Activity Feed, Approvals, Payment Trace, Library, Sessions, Memory.
   - By examining `explorer_survey_screens_1_4/DISPATCH.md:9-12`, the peer agent grouped Graph and Budget Bar into Screen 1, resulting in Payment Trace being assigned to Screen 4.
   - To ensure zero unanalyzed gaps between the two teams, surveying all four screens (Payment Trace, Library, Sessions, Memory) provides complete, unbroken coverage under both 8-screen and 7-grouped sequence interpretations.

2. **Screen 5 (Payment Trace) Integration Path**:
   - Observation 2 proves that `PaymentTraceView.tsx` currently performs no network calls and reads 100% from fixtures.
   - Backend `GET .../actions/:actionId/trace` provides the core relational link (action, agent, mandate chain), but lacks `stages` and `checklist`.
   - Under Requirement R2 ("Never invent data"), when `stages` or `checklist` are omitted, the component must render an explicit "Unavailable" UI container for those tabs rather than synthesizing fake latencies or checkmarks.
   - The gap contract `GET /v1/environments/:environmentId/actions/:actionId/forensic-trace` must be added to `docs/gaps.md`.

3. **Screen 6 (Library) Integration Path**:
   - Observation 3 shows that the backend already supports `POST /environments/:id/agents/children` and `POST /mandates/:id/delegations`.
   - The Attach modal's synthetic math coordinates and `Math.random()` signatures must be replaced with sequential backend mutations that update only upon HTTP 201 confirmation.
   - Rich catalog metadata is missing from the API; until `GET /v1/agent-catalog` is added to Gateway (documented in `docs/gaps.md`), the UI must display a clear "Catalog Unavailable" banner or fallback to minimal cards with uncertified security indicators.

4. **Screen 7 (Sessions) Integration Path**:
   - Observation 4 confirms that session creation, listing, updating, and task run spawning exist in `phase4-routes.ts`.
   - The client-side `Date.now()` generation must be replaced with `POST /v1/environments/:id/sessions`.
   - Because message history retrieval is missing (`GET .../sessions/:id/messages`), the Assistant chat window must display an explicit notice: "Session history persistence unavailable on gateway; starting new thread."
   - The contract for `GET .../sessions/:sessionId/messages` must be documented in `docs/gaps.md`.

5. **Screen 8 (Memory) Integration Path**:
   - Observation 5 confirms that the Memory domain is 100% missing from database to API routes.
   - Per Requirement R2, the UI must NOT invent or mock data. The Memory Vault must render an explicit, prominent "Memory Vault Unavailable: Persistent backend storage for agent memories is not yet implemented" state with all forget actions disabled.
   - The complete database schema (`public.memories`) and REST endpoints (`GET/POST/REVOKE /v1/environments/:id/memories`) must be logged in `docs/gaps.md`.

---

## 3. Caveats

1. **Volatile In-Memory Backend Stores**:
   - Both `createSessionStore` and `createApprovalStore` in `apps/api/src/phase4.ts:281–289` instantiate `InMemorySessionStore` and `InMemoryApprovalStore` regardless of `DATABASE_MODE`. Server restarts wipe live sessions and approvals. A future migration to PostgreSQL/Supabase backing will be required for production durability.
2. **Real-Time Push Absences**:
   - Neither WebSockets nor SSE are implemented in backend code. While `status-pill.tsx:115` displays `"Protocol: WebSocket + SSE"`, this is static copy. Sessions and traces must rely on explicit user actions or on-demand fetch.
3. **No Direct Code Modifications**:
   - As an explorer agent, no source code or fixtures were modified. All specifications, mapper definitions, and UI state requirements are documented in `report.md` for subsequent implementation phases.

---

## 4. Conclusion

1. **Sequence & Scope**: The 8-screen sequence is resolved. Screens 5 (Payment Trace), 6 (Library), 7 (Sessions), and 8 (Memory) are fully mapped.
2. **Missing Endpoints & Contracts**:
   - Screen 5: Forensic stages & checklist (`GET .../actions/:id/forensic-trace`) -> PARTIAL.
   - Screen 6: Catalog directory (`GET /v1/agent-catalog`) -> MISSING (Mutations FOUND).
   - Screen 7: Session message history (`GET .../sessions/:id/messages`) -> MISSING (Sessions CRUD FOUND).
   - Screen 8: Complete memory subsystem (`public.memories`, `GET/POST/REVOKE /v1/environments/:id/memories`) -> MISSING.
3. **Explicit "Unavailable" States**: Concrete JSX blueprints are provided in `report.md` for Memory Vault, Session message history, and Payment Trace checklist/stages to prevent data invention.
4. **Mutations**: Attach Agent and Create Session flows are redefined to dispatch real backend commands without optimistic updates.
5. **Fixtures to Delete**: Over 750 lines of static fixtures (`DEFAULT_TRACES`, `CATALOG_AGENTS`, `INITIAL_SESSIONS`, `INITIAL_MEMORIES`) are cataloged for deletion upon integration.

---

## 5. Verification Method

To independently verify the observations and findings in this report:

1. **Verify Fixture Locations & Line Counts**:
   ```bash
   # Verify DEFAULT_TRACES in traces/types.ts
   sed -n '79,85p' apps/web/components/traces/types.ts
   # Verify CATALOG_AGENTS in agents/types.ts
   sed -n '42,50p' apps/web/components/agents/types.ts
   # Verify INITIAL_SESSIONS and INITIAL_MEMORIES in workspace-defaults.ts
   sed -n '36,45p' apps/web/components/workspace/workspace-defaults.ts
   sed -n '66,75p' apps/web/components/workspace/workspace-defaults.ts
   ```

2. **Verify Zero-API Lookup in PaymentTraceView**:
   ```bash
   grep -n "DEFAULT_TRACES" apps/web/components/traces/PaymentTraceView.tsx
   ```

3. **Verify Absence of Memory Backend Representation**:
   ```bash
   # Check migrations for memories table
   find supabase/migrations -name "*memory*" -o -name "*memories*"
   # Check contracts for memory types
   grep -rn "MemoryDto" packages/contracts/
   # Check API routes for memory endpoints
   grep -rn "/memories" apps/api/src/
   ```

4. **Verify Project Test & Lint Commands**:
   ```bash
   # Run web app typecheck and lint
   pnpm --filter @payguardian/web run typecheck
   pnpm --filter @payguardian/web run lint
   ```
