## 2026-11-01T22:36:28Z

You are worker_m3_migrate, an expert full-stack TypeScript/Next.js engineer.
Your working directory is: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m3_migrate/

Read your original request file: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/ORIGINAL_REQUEST.md
Also read:
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/PROJECT.md
- /home/anas/myspace/AI/PayGuardian/docs/frontend-audit.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_survey_screens_1_4/report.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_survey_screens_5_8/report.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

REMINDER ON DIRECTORY STRUCTURE:
The project uses Next.js App Router (`apps/web/app`, `apps/web/components`, `apps/web/lib`). There is NO `src/` directory. All API logic is in `apps/web/lib/api/` and `apps/web/app/api/proxy/`.

Your objective is Milestone 3: Migrate Screen 3 (Approvals) and Screen 4 (Payment Trace) to live backend data, eliminate optimistic updates, enforce financial integrity, delete mock fixtures, and implement UI states:

1. Screen 3 Migration (Approvals):
   - Wire `apps/web/components/approvals/ApprovalsInbox.tsx`, `ApprovalCard.tsx`, and `ApprovalDetailDrawer.tsx` to `useApprovals` (`apps/web/lib/api/hooks/use-approvals.ts`).
   - CRITICAL REQUIREMENT R3: Eliminate optimistic updates in `handleApprove` and `handleReject`. The UI state and count MUST update ONLY upon receiving confirmed server HTTP 200 response from `apiClient.approvals.approve` / `reject`.
   - Remove client-side `isHardLimitExceeded` calculation in `ApprovalCard.tsx:90`. Use backend-provided `allowed_actions` / `allowedActions` to determine allowed button states.
   - Delete mock fixtures: Remove `DEFAULT_APPROVALS` from `components/approvals/types.ts` and `workspace-defaults.ts`.
   - Implement loading skeleton, empty state ("No pending approvals"), and error state with retry matching container dimensions without layout shift.

2. Screen 4 Migration (Payment Trace):
   - Wire `apps/web/components/traces/PaymentTraceView.tsx`, `VerticalAuthChain.tsx`, `LifecycleTimeline.tsx`, and `VerificationChecklist.tsx` to `usePaymentTrace` (`apps/web/lib/api/hooks/use-payment-trace.ts`).
   - Use `mapBackendTraceToView` in `apps/web/lib/api/mappers/payment-trace.ts` to map real action, agent, mandate chain, operation, and reservation data.
   - Per R2 ("Never invent data"): Since Fastify Gateway action trace lacks 5-stage latency metrics and 5-point checklist records, render explicit "Unavailable" state containers in those tabs rather than synthesizing fake data.
   - Ensure `GAP-TRC-01` is documented in `docs/gaps.md`.
   - Delete mock fixtures: Remove `DEFAULT_TRACES` (494 lines in `traces/types.ts`).
   - Implement loading skeleton, empty state, and error state with retry matching layout dimensions without layout shift.

3. Verification:
   - Run `pnpm --filter @payguardian/web run typecheck` (must pass with 0 errors).
   - Run `pnpm --filter @payguardian/web run test` (must pass with 0 errors).
   - Confirm Python immutability constraint: `git diff -- apps/agent-runtime agents apps/worker apps/api/src/auth.ts packages/auth` remains completely empty.

STRICT CONSTRAINT:
Zero lines of code are modified in Python services (`apps/agent-runtime`, `agents/`, `apps/worker`, or auth backends).

Output instructions:
Write your handoff report to:
`/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m3_migrate/handoff.md`
Report verification commands and results clearly. When done, send a message back.
