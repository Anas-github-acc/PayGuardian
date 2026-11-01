## 2026-10-31T16:52:22Z
You are a teamwork_worker subagent assigned to Milestone 3: Three-Panel Workspace and Interactive 3D Agent Network Canvas.

Read:
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/ORIGINAL_REQUEST.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/orchestrator_1/PROJECT.md
- Specification analysis: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/spec_miner_survey/spec_analysis.md
- Design synthesis: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_design_survey/design_synthesis.md
- UI primitives in apps/web/components/ui/
- Workspace store in apps/web/app/lib/workspace-store.ts
- Currency utilities in apps/web/app/lib/currency.ts

Your working directory is:
/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m3/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL TESTING CONSTRAINT:
Do NOT create any test files, unit tests, component tests, or end-to-end test specs. No Vitest test files, no Playwright test files. The user will test manually. Focus all effort on the actual implementation.

Your Scope & Write Ownership:
You exclusively own:
- apps/web/components/workspace/* (WorkspaceLayout, LeftPanel for sessions & memory, BudgetStrip, ActivityMicroFeed, index.ts)
- apps/web/components/canvas/* (AgentNetworkCanvas 3D Three.js canvas, AgentNetworkListView keyboard list, NodeDetailDrawer, types.ts, index.ts)
- apps/web/components/chat/* (ChatPanel, AgentSays escaped text, VerifiedBlock container, types.ts, index.ts)
- apps/web/components/cards/* (BudgetPlanCard, PaymentResultCard, RejectionCard, DelegationCard, MemoryCard, index.ts)

Requirements to fulfill:
1. Three-Panel Workspace Shell (`apps/web/components/workspace/`):
   - Left Panel (240px width, collapsible on mobile/tablet): Session management (session selector, + new session, session status), Memory list with "Undo" action, Quick stats.
   - Center Panel (Flex 1):
     * Top: `BudgetStrip` showing Allocated, Spent, Reserved, and Available balances formatted with `formatMinorUnits` from `currency.ts` (100% exact integer math).
     * Middle: The 3D Agent Network Canvas with view toggle (3D Canvas vs Accessible Keyboard List View).
     * Bottom: `ActivityMicroFeed` displaying streaming events with simulation badge support.
   - Right Panel (380px width, collapsible): Chat & Decision Stream with prompt input box, streaming typing animation, and Two-Voices rendering pipeline.
2. Interactive 3D Agent Network Canvas (`apps/web/components/canvas/`):
   - Built with Three.js (already installed: `three`, `@types/three`) in React 19 (`agent-network-canvas.tsx`).
   - Renders orchestrator root node and connected subagents with 3D positions, lighting, and camera orbit/pan/zoom controls.
   - CRITICAL VISUAL DISTINCTION:
     * Solid lines/strokes for authorized (funded) nodes and delegations.
     * Dashed lines/strokes (`stroke-dasharray` / `LineDashedMaterial` with `computeLineDistances()`) for unfunded structural attachments. This visual distinction MUST be strictly maintained across all graph states.
   - Live state micro-animations:
     * Authority flow: pulsing particles / moving dashes traveling along edges.
     * Payment pulse: emerald/mint ripple radiating from node on successful payment.
     * Rejection strobe: ruby/red strobe flash on policy violation / rejection.
     * Revocation strike: grey desaturation on revoked nodes.
   - Clicking a node opens `NodeDetailDrawer` showing agent mandate, budget, and live status.
   - Accessible List View (`agent-network-list-view.tsx`): 1:1 accessible alternative table/list with full keyboard navigation (Arrow Up/Down, Enter to select).
3. Two-Voices Chat Pipeline (`apps/web/components/chat/`):
   - Strict separation between what an agent says and what the gateway verified:
     * `AgentSays`: Renders agent conversational prose. Text MUST BE strictly escaped (plain string in text node or sanitized, ZERO `dangerouslySetInnerHTML`). Agent text can NEVER render gateway cards or inject HTML.
     * `VerifiedBlock`: Dedicated immutable component with hairline border, verified badge, and cryptographic timestamp.
4. Five Dedicated Gateway-Verified Cards (`apps/web/components/cards/`):
   - `BudgetPlanCard`: Displays proposed budget allocation, parent mandate, requested amount in minor units, and policy approval state.
   - `PaymentResultCard`: Displays successful transaction ID, recipient/merchant, amount formatted in minor units, rail (PayPal), authorization hash, and "View Trace" button.
   - `RejectionCard`: Displays policy violation reason in plain language (e.g. `BUDGET_EXCEEDED`, `UNAUTHORIZED_MERCHANT`, `THRESHOLD_EXCEEDED`), attempted action details, and policy rule reference.
   - `DelegationCard`: Displays parent agent, subagent, delegated budget limit, allowed rails, and expiry.
   - `MemoryCard`: Displays saved agent memory key/value, context snippet, and functional "Undo / Forget" button calling memory revocation.
5. Verification:
   - Run `pnpm typecheck`
   - Run `pnpm --filter @payguardian/web build`
   - Confirm builds succeed with zero errors.
6. Write your completion report to `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m3/handoff.md` and send a message back with your verification results.

Update progress.md regularly.
