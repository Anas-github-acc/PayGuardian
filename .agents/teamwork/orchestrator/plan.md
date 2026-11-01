# Orchestration Plan: PayGuardian Delegation Layer Verification & CDP Testing

## Mission Overview
Verify all phases in `docs/phases.md` for the Delegation layer (`docs/input.md`), apply any necessary code edits to ensure all components are functioning properly, and execute automated browser interaction testing on Brave Beta (`brave-beta --remote-debugging-port=9222`) against the Next.js development server at `http://localhost:3000`.

## Subagent Team Architecture (3 Workers)
Per user request ("spun 2 multi-agent doing checking stuff and making edit if neeed and 1 sub-agents testing it working"):

1. **Worker 1 (`worker_phases_0_to_3`)**:
   - Scope: Phases 0 through 3 from `docs/phases.md`.
     - Phase 0: Repository, monorepo configuration, packages, build tooling, deployment proof.
     - Phase 1: Identity, environments, agent registry, authentication, credentials, isolation.
     - Phase 2: Mandates, policy engine, delegation, ancestor chain, effective authority.
     - Phase 3: Ledger, integer minor-unit accounting, reservations, concurrency, audit foundation.
   - Task: Review existing implementation against `docs/phases.md` and `docs/input.md`, run tests/typechecks/builds, identify missing logic or broken tests, implement code edits/fixes, verify all tests pass.
   - Working Directory: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_phases_0_to_3/`

2. **Worker 2 (`worker_phases_4_to_7`)**:
   - Scope: Phases 4 through 7 from `docs/phases.md`.
     - Phase 4: Approvals, protected actions, ADK agent workflows (Personal, Travel, etc.).
     - Phase 5: PayPal Sandbox, order/capture, idempotency, webhook deduplication, reconciliation.
     - Phase 6: Operational dashboard, emergency pause/revocation controls, AG Grid views, live activity.
     - Phase 7: Contracts, documentation, security hardening, release readiness scripts.
   - Task: Review existing implementation against `docs/phases.md` and `docs/input.md`, run tests/typechecks/builds, identify missing logic or broken tests, implement code edits/fixes, verify all tests pass.
   - Working Directory: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_phases_4_to_7/`

3. **Worker 3 (`worker_cdp_testing`)**:
   - Scope: Next.js UI & CDP Testing on Brave Beta.
   - Task:
     - Ensure Next.js dev server is running on `http://localhost:3000` (start if not active).
     - Launch or verify Brave Beta with `--remote-debugging-port=9222`.
     - Establish CDP connection to `brave-beta`.
     - Execute automated CDP interaction tests across the Delegation layer interface:
       - Button clicks, navigation, forms, emergency controls, AG Grid interactions.
       - Mock wallet connections and RPC calls to deterministically test state transitions.
     - Ensure tests complete without unhandled exceptions or failed assertions.
   - Working Directory: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_cdp_testing/`

## Execution Steps
1. Create directories for all 3 subagents.
2. Initialize `plan.md` and `progress.md`.
3. Dispatch Worker 1, Worker 2, and Worker 3 in parallel.
4. Set up safety timer / periodic monitoring.
5. Review reports from all 3 workers and ensure all acceptance criteria are met.
6. Synthesize results and report final handoff.
