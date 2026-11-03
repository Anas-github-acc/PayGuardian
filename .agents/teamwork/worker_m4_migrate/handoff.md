# Milestone 4 Handoff Report: Screens 5 (Library), 6 (Sessions), and 7 (Memory) Migration & Fixture Elimination

## 1. Observation

### Codebase & Mock Fixture State
1. **Screen 5 (Library)**:
   - `apps/web/components/agents/types.ts`: Previously exported `CATALOG_AGENTS: SpecialistAgent[]` spanning 217 lines of mock specialist agents (`agent-travel-concierge`, `agent-cloud-finops`, `agent-procure-bot`, `agent-payroll-exec`, `agent-gateway-sentinel`, `agent-audit-compliance`).
   - `apps/web/components/agents/AttachAgentDialog.tsx:83–143`: Previously calculated trigonometric coordinates (`angle = nodeIndex * (2 * Math.PI)...; Math.cos/sin`) and generated fake cryptographic signatures (`0x7a89f921bc + Math.random().toString(16).slice(2, 8)`), updating `workspaceStore` locally with zero backend communication.
   - `apps/web/components/agents/AgentLibrary.tsx`: Filtered purely from `CATALOG_AGENTS` without calling the backend.
   - Fastify Gateway Backend (`apps/api`): Lacks a global marketplace/template catalog endpoint (`GET /v1/agents/catalog` or `GET /v1/agent-catalog`). Python runtime `GET /agents` on port 8000 returns only string names (`["personal", "travel", ...]`), lacking catalog metadata.
2. **Screen 6 (Sessions)**:
   - `apps/web/components/workspace/workspace-defaults.ts`: Previously exported `INITIAL_SESSIONS: SessionItem[]` (29 lines of mock sessions: `sess-goa-01`, `sess-cloud-02`, `sess-tax-03`).
   - `apps/web/components/workspace/sessions-memory.tsx:67` and `apps/web/components/chat/session-history.tsx:38`: Previously created fake session IDs using `sess-new-${Date.now()}` with zero API calls.
   - Fastify Gateway Backend (`apps/api/src/phase4-routes.ts`): Provides session CRUD (`POST/GET/PATCH /v1/environments/:id/sessions`), but uses volatile `InMemorySessionStore` and lacks an endpoint to fetch session message history (`GET /v1/environments/:id/sessions/:sessionId/messages`).
3. **Screen 7 (Memory)**:
   - `apps/web/components/workspace/workspace-defaults.ts`: Previously exported `INITIAL_MEMORIES: MemoryItem[]` (29 lines of mock memories: `mem-01`, `mem-02`, `mem-03`).
   - `apps/web/components/cards/memory-card.tsx:22–30`: Previously fell back to hardcoded default mock strings (`mem-entry-819`, `dietary_preference`, `Vegetarian meals only...`).
   - `apps/web/components/workspace/sessions-memory.tsx:203–207`: `handleUndoMemory` mutated client-side React state without network communication.
   - Database, models, and routes: Memory persistence is 100% missing across `supabase/migrations/`, `packages/domain/`, `packages/contracts/`, and `apps/api/`.
4. **Workspace Defaults Final Mock Exports**:
   - `workspace-defaults.ts` previously also exported `DEFAULT_CHAT_MESSAGES` (56 lines of mock chat messages).
5. **Verification Command Results**:
   - `pnpm --filter @payguardian/web run typecheck`:
     ```
     $ tsc --noEmit
     Exit code: 0, 0 errors.
     ```
   - `pnpm --filter @payguardian/web run test`:
     ```
     Test Files  11 passed (11)
          Tests  52 passed (52)
       Duration  446ms
     Exit code: 0, 0 failures.
     ```
   - Workspace-wide tests (`pnpm test`):
     ```
     apps/api: 48 passed (48)
     apps/worker: 7 passed (7)
     apps/web: 52 passed (52)
     Total: 107 tests passed (0 failures)
     ```
   - ESLint on modified/touched components and api directories:
     Exit code: 0, 0 errors.
   - Python & auth immutability check (`git diff -- apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth`):
     Completely empty (0 lines changed).

---

## 2. Logic Chain

1. **Screen 5 (Library) Migration & GAP-CAT-01**:
   - `apps/web/components/agents/AgentLibrary.tsx` was wired directly to `useAgentLibrary(currentEnv?.id)`.
   - "Attached to this environment" renders authentic environment agents returned by `apiClient.agents.list(environmentId)` mapped via `mapAgentDtoToSpecialist`.
   - In accordance with Requirement R2 ("Never invent data"), because Fastify Gateway lacks a global template catalog endpoint, an explicit "Agent Catalog Unavailable" container is rendered under the catalog section, documenting `GAP-CAT-01` in `docs/gaps.md`.
   - Responsive loading skeleton, error state with retry, and empty state were added to prevent layout shift.
   - `CATALOG_AGENTS` (217 lines in `components/agents/types.ts`) was completely deleted.
2. **Sequential Real Commands in `AttachAgentDialog.tsx`**:
   - Removed synthetic angle/cos/sin math coordinates and fake `Math.random()` signatures.
   - Replaced with sequential real backend calls:
     1. `await apiClient.agents.registerChild(currentEnv.id, { parentAgentId, name, kind, capabilities })`.
     2. If `budgetMinor > 0`, retrieves active parent mandate and calls `await apiClient.mandates.delegate(parentMandate.id, { holderAgentId, budgetLimitMinor, currency, permittedActions, ... })`.
     3. State and graph store (`workspaceStore.attachAgent`) are updated **strictly upon confirmed HTTP response** (no optimistic updates for spending authority).
3. **Screen 6 (Sessions) Migration & GAP-SESS-01**:
   - `apps/web/components/workspace/sessions-memory.tsx` and `apps/web/components/chat/session-history.tsx` were wired to `useSessions(currentEnv?.id)`.
   - Client-side `Date.now()` fake session IDs were replaced with real sequential calls to `apiClient.sessions.create(envId, { title, purpose, context })`. UI updates strictly upon confirmed server response.
   - Because message history retrieval is missing on Fastify Gateway, an explicit notice banner is rendered in both the sessions panel and chat view: *"Session history persistence unavailable on gateway; starting new thread (GAP-SESS-01)"*.
   - `INITIAL_SESSIONS` was removed from `workspace-defaults.ts`.
   - Loading skeletons, empty states, and error states with retry were implemented.
4. **Screen 7 (Memory) Migration & GAP-MEM-01**:
   - `MemoryVaultContent` was wired to `useAgentMemory(currentEnv?.id)`.
   - Because memory persistence has zero backend representation across database, domain models, and API routes, the tab renders an explicit container: *"Memory Vault Unavailable: Persistent backend storage for agent memories is not yet implemented"*, referencing `GAP-MEM-01`, with forget actions disabled.
   - Hardcoded mock strings were removed from `memory-card.tsx`.
   - `docs/gaps.md` was updated with the complete proposed database schema (`public.memories`) and CRUD endpoints (`GET/POST/REVOKE /v1/environments/:id/memories`).
   - `INITIAL_MEMORIES` was deleted from `workspace-defaults.ts`.
5. **Final Cleanup of `workspace-defaults.ts`**:
   - Removed all mock arrays (`INITIAL_SESSIONS`, `INITIAL_MEMORIES`, `DEFAULT_CHAT_MESSAGES`, `DEFAULT_GRAPH_NODES`, `DEFAULT_GRAPH_EDGES`, `INITIAL_ACTIVITIES`).
   - Preserved only clean TypeScript interfaces (`SessionItem`, `MemoryItem`, `ActivityFeedItem`), ensuring zero mock exports from the module.
   - Re-routed component type imports to `apps/web/lib/api/types` to comply with the ESLint `no-restricted-imports` rule.
6. **Unit & Contract Testing**:
   - Created `apps/web/lib/api/__tests__/screens-5-6-7.test.ts` with 7 tests validating `mapAgentDtoToSpecialist`, `mapSessionDtoToItem`, `getMemoryVaultUnavailableState`, zero mock array exports from `workspace-defaults.ts`, and deletion of `CATALOG_AGENTS`.

---

## 3. Caveats

1. **Phase 4 Session Storage Lifetime**:
   - Fastify Gateway implements sessions using `InMemorySessionStore` (`apps/api/src/phase4.ts:289`). Session records created via the UI are real and confirmed by the server, but will be lost if the API process restarts until persistent database tables are added (documented in `GAP-SESS-01`).
2. **Agent Template Directory (`GAP-CAT-01`)**:
   - The UI provides an "Attach Agent" action that registers child agents directly into the active environment on the gateway. Catalog browsing of unattached specialist agent templates displays the explicit unavailable container until the catalog endpoint is implemented on the backend.

---

## 4. Conclusion

Milestone 4 is fully complete and verified:
- Screen 5 (Library) is wired to `useAgentLibrary`, renders an explicit "Agent Catalog Unavailable" container for `GAP-CAT-01`, and executes real sequential child registration and mandate delegation commands in `AttachAgentDialog.tsx` with zero optimistic updates.
- Screen 6 (Sessions) is wired to `useSessions`, creates real sessions on the gateway, renders explicit notices for `GAP-SESS-01`, and has full skeleton/empty/error states.
- Screen 7 (Memory) renders an explicit "Memory Vault Unavailable" container with disabled forget actions, referencing `GAP-MEM-01`, and `docs/gaps.md` specifies the database migration and CRUD contracts.
- All remaining mock fixtures (`CATALOG_AGENTS`, `INITIAL_SESSIONS`, `INITIAL_MEMORIES`, `DEFAULT_CHAT_MESSAGES`) are 100% deleted.
- Python services, agent runtime, and auth backends have 0 modified lines.
- Typecheck (`tsc --noEmit`), Vitest suite (52 tests in web, 48 in api, 7 in worker), and ESLint pass cleanly with zero errors.

---

## 5. Verification Method

To independently verify this milestone from the workspace root:

1. **Verify TypeScript Compilation**:
   ```bash
   pnpm --filter @payguardian/web run typecheck
   ```
   *Expected Result*: Exits 0 with no errors.

2. **Verify Frontend Unit and Contract Tests**:
   ```bash
   pnpm --filter @payguardian/web run test
   ```
   *Expected Result*: 11 test files pass, 52 tests pass, 0 fail.

3. **Verify Workspace-Wide Tests**:
   ```bash
   pnpm test
   ```
   *Expected Result*: All workspace tests pass (107 tests total).

4. **Verify ESLint on Touched Components**:
   ```bash
   pnpm --filter @payguardian/web exec eslint components/agents/ components/chat/session-history.tsx components/workspace/sessions-memory.tsx components/workspace/workspace-defaults.ts components/cards/memory-card.tsx lib/api/
   ```
   *Expected Result*: Exits 0 with no errors.

5. **Verify Python & Auth Immutability Constraint**:
   ```bash
   git diff -- apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth
   ```
   *Expected Result*: Completely empty output (0 lines changed).

6. **Verify Mock Fixtures Deleted**:
   ```bash
   git grep -E "CATALOG_AGENTS|INITIAL_SESSIONS|INITIAL_MEMORIES|DEFAULT_CHAT_MESSAGES" apps/web/
   ```
   *Expected Result*: Zero occurrences found (exit code 1).
