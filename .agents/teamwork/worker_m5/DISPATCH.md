## 2026-10-31T17:35:51Z
You are a teamwork_worker subagent assigned to Milestone 5: Agent Library, Developer Connect, Attack Simulator, and Unified Page Assembly.

Read:
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/ORIGINAL_REQUEST.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/orchestrator_1/PROJECT.md
- Specification analysis: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/spec_miner_survey/spec_analysis.md
- Design synthesis: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_design_survey/design_synthesis.md
- UI primitives in apps/web/components/ui/
- Workspace store in apps/web/app/lib/workspace-store.ts
- Shell components in apps/web/components/shell/
- Workspace components in apps/web/components/workspace/
- Canvas components in apps/web/components/canvas/
- Chat components in apps/web/components/chat/
- Cards in apps/web/components/cards/
- Approvals components in apps/web/components/approvals/
- Traces components in apps/web/components/traces/
- Tables components in apps/web/components/tables/
- Security components in apps/web/components/security/

Your working directory is:
/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m5/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL TESTING CONSTRAINT:
Do NOT create any test files, unit tests, component tests, or end-to-end test specs. No Vitest test files, no Playwright test files. The user will test manually. Focus all effort on the actual implementation.

Your Scope & Write Ownership:
You exclusively own:
- apps/web/components/agents/* (AgentLibrary, AgentCard, AttachAgentDialog, types.ts, index.ts)
- apps/web/components/developer/* (DeveloperPortal, CodeSnippet, KeyManager, ConnectionTester, types.ts, index.ts)
- apps/web/components/simulator/* (AttackSimulator, AttackVectorCard, SimulationBadge, types.ts, index.ts)
- apps/web/app/page.tsx (Unified production-grade entry point assembling all panels and views)

Requirements to fulfill:
1. Agent Library (`apps/web/components/agents/`):
   - Specialist agent catalog grid (e.g. Travel Concierge, Cloud Cost Optimizer, Procurement Bot, Payroll Disburser, API Gateway Agent).
   - Agent cards displaying: Agent avatar/icon, name, specialty, role, recommended budget, supported payment rails (PayPal), and authority tier.
   - Detail inspection drawer showing agent permissions, sample prompt patterns, and security audit badge.
   - "Attach Agent to Environment" dialog: Sets delegated budget limit in minor units, selects parent mandate, specifies allowed rails, and attaches the agent to `workspaceStore` and 3D canvas.
2. Developer Portal (`apps/web/components/developer/`):
   - MCP (Model Context Protocol) server connection portal.
   - Displays MCP endpoint URL (`http://localhost:3001/mcp` or `/v1/mcp`) with one-click copy.
   - Setup code snippets in Python (`python-adk`) and TypeScript (`@payguardian/sdk`), formatted with syntax highlight styling and copy button.
   - API Key management: Lists agent API keys (`pg_live_...`, `pg_test_...`), key rotation trigger, and "Create Key" action.
   - Live "Test Connection" button: Executes connection handshake test against the gateway (or mock fallback if backend offline), displaying latency, supported tools list, and connection health status pill.
3. Sandbox Attack Simulator (`apps/web/components/simulator/`):
   - Active only when current environment is Sandbox (or warning banner if Production).
   - 5 Interactive simulated attack vectors:
     * Attack 1: Budget Overflow (Agent attempts to spend $500 when allocated limit is $100 -> triggers RejectionCard with `BUDGET_EXCEEDED` and red flash on node).
     * Attack 2: Disallowed Merchant (Agent attempts payment to an unauthorized casino/gambling merchant -> triggers RejectionCard with `UNAUTHORIZED_MERCHANT` and security incident log).
     * Attack 3: Threshold Bypass (Agent attempts a $75 transaction when human approval threshold is $25 -> routes action directly to Approvals Inbox with plain-language reason).
     * Attack 4: Stolen Token / Tampered Hash (Agent submits forged parameter hash -> triggers security alert and trace checklist failure).
     * Attack 5: Revoked Agent Attempt (Revoked agent attempts transaction -> immediate denial, grey strike-through event).
   - Each attack button streams the simulated event into the 3D canvas and activity feeds, explicitly tagged with a `[SIMULATION]` badge.
4. Unified Page Assembly (`apps/web/app/page.tsx`):
   - Completely replace the monolithic raw card prototype with the production-grade Agent Workspace and Delegation Dashboard.
   - Wrap page in `<AppShell>` (which mounts `AppHeader`, `StatusPill`, `ReconnectBanner`, `EnvironmentSwitcher`, `NavTabs`, and `PasskeyModal`).
   - Dynamically render the active view based on `activeNavTab` from `workspaceStore`:
     * `'workspace'`: Renders `<WorkspaceLayout />` (LeftPanel sessions/memory, Center BudgetStrip + Three.js 3D Canvas / Accessible ListView + ActivityMicroFeed, RightPanel ChatPanel).
     * `'approvals'`: Renders `<ApprovalsInbox />` with detail drawer.
     * `'traces'`: Renders `<PaymentTraceView />` with vertical auth chain, lifecycle timeline, and verification checklist.
     * `'tables'`: Renders sub-tabs for `<MandatesTable />`, `<ActivityAuditTable />`, and `<PoliciesTable />`.
     * `'security'`: Renders `<SecurityCenter />` (emergency controls, revocation center, security event log).
     * `'agents'`: Renders `<AgentLibrary />`.
     * `'developer'`: Renders `<DeveloperPortal />`.
     * `'simulator'`: Renders `<AttackSimulator />`.
   - Ensure responsive layout (desktop-first three panels, tablet/mobile folding), zero console errors, clean state management, and seamless tab transitions.
5. Verification:
   - Run `pnpm typecheck`
   - Run `pnpm --filter @payguardian/web build`
   - Confirm builds succeed cleanly with zero errors.
6. Write your completion report to `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m5/handoff.md` and send a message back with your verification results.
