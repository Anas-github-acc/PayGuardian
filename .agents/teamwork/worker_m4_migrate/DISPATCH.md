## 2026-11-01T23:02:09Z
You are worker_m4_migrate, an expert full-stack TypeScript/Next.js engineer.
Your working directory is: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m4_migrate/

Read your original request file: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/ORIGINAL_REQUEST.md
Also read:
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/PROJECT.md
- /home/anas/myspace/AI/PayGuardian/docs/frontend-audit.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_survey_screens_5_8/report.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m3_migrate/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

REMINDER ON DIRECTORY STRUCTURE:
The project uses Next.js App Router (`apps/web/app`, `apps/web/components`, `apps/web/lib`). There is NO `src/` directory. All API logic is in `apps/web/lib/api/` and `apps/web/app/api/proxy/`.

Your objective is Milestone 4: Migrate Screen 5 (Library), Screen 6 (Sessions), and Screen 7 (Memory) to live backend data, eliminate synthetic generation, delete remaining mock fixtures, document gaps, and implement UI states:

1. Screen 5 Migration (Library):
   - Components: `apps/web/components/agents/AgentLibrary.tsx`, `apps/web/components/agents/AttachAgentDialog.tsx`.
   - Wire `AgentLibrary.tsx` to `useAgentLibrary` (`apps/web/lib/api/hooks/use-agent-library.ts`).
   - Fastify Gateway lacks an agent catalog endpoint. Per R2 ("Never invent data"): Render an explicit "Agent Catalog Unavailable" container referencing `GAP-CAT-01` in `docs/gaps.md` rather than fabricating fake certified agents.
   - In `AttachAgentDialog.tsx`, replace synthetic math coordinates and `Math.random()` fake signatures with real sequential backend commands: `apiClient.agents.registerChild(envId, ...)` and `apiClient.mandates.delegate(mandateId, ...)`. Update UI state strictly upon confirmed server HTTP 201 response (no optimistic updates).
   - Delete mock fixtures: Remove `CATALOG_AGENTS` (217 lines in `components/agents/types.ts`).
   - Implement loading skeleton, empty state, and error state with retry.

2. Screen 6 Migration (Sessions):
   - Components: `apps/web/components/workspace/sessions-memory.tsx`, `apps/web/components/chat/session-history.tsx`.
   - Wire to `useSessions` (`apps/web/lib/api/hooks/use-sessions.ts`) fetching `/v1/environments/:id/sessions`.
   - In creation handlers (`sessions-memory.tsx:66-83` and `session-history.tsx:38-52`), replace client-side `Date.now()` fake session IDs with real `apiClient.sessions.create(envId, { title, purpose })`. Update UI strictly upon confirmed server response.
   - For missing message history on Gateway, display an explicit notice: "Session history persistence unavailable on gateway; starting new thread" and reference `GAP-SESS-01` in `docs/gaps.md`.
   - Delete mock fixtures: Remove `INITIAL_SESSIONS` from `components/workspace/workspace-defaults.ts`.
   - Implement loading skeleton, empty state, and error state with retry.

3. Screen 7 Migration (Memory):
   - Components: `apps/web/components/workspace/sessions-memory.tsx`, `apps/web/components/cards/memory-card.tsx`.
   - Wire to `useAgentMemory` (`apps/web/lib/api/hooks/use-agent-memory.ts`).
   - Per R2 ("Never invent data"): The Memory backend is 100% missing across database, models, and routes. The Memory Vault tab MUST render an explicit "Memory Vault Unavailable: Persistent backend storage for agent memories is not yet implemented" container with forget actions disabled.
   - Document proposed database migration (`public.memories`) and CRUD endpoints (`GET/POST/REVOKE /v1/environments/:id/memories`) in `docs/gaps.md` under `GAP-MEM-01`.
   - Delete mock fixtures: Remove `INITIAL_MEMORIES` from `components/workspace/workspace-defaults.ts`.

4. Workspace Defaults Final Cleanup:
   - Clean `apps/web/components/workspace/workspace-defaults.ts` so that all mock arrays (`DEFAULT_GRAPH_NODES`, `DEFAULT_GRAPH_EDGES`, `INITIAL_ACTIVITIES`, `INITIAL_SESSIONS`, `INITIAL_MEMORIES`) are removed. Only clean types/interfaces should remain, ensuring zero mock exports.

5. Verification:
   - Run `pnpm --filter @payguardian/web run typecheck` (must pass with 0 errors).
   - Run `pnpm --filter @payguardian/web run test` (must pass with 0 errors).
   - Confirm Python immutability constraint: `git diff -- apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth` remains completely empty.

STRICT CONSTRAINT:
Zero lines of code are modified in Python services (`apps/agent-runtime`, `agents/`, `apps/worker`, or auth backends).

Output instructions:
Write your handoff report to:
`/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m4_migrate/handoff.md`
Report verification commands and results clearly. When done, send a message back.
