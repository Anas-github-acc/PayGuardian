# Progress Tracking - Milestone 5

Last visited: 2026-10-31T17:46:00Z

## Status: COMPLETED

### Completed Tasks
1. **Agent Library (`apps/web/components/agents/`)**:
   - `types.ts`: Comprehensive types and 6 pre-audited catalog agents (Travel Concierge, Cloud Cost Optimizer, Procurement Bot, Payroll Disburser, API Gateway Agent, Tax Sentinel).
   - `AgentCard.tsx`: Catalog cards displaying avatar, name, specialty, role, recommended budget, supported rails, authority tier, and Inspect/Attach actions.
   - `AgentDetailDrawer.tsx`: Inspection drawer showing requested permissions, sample prompt patterns with one-click copy, and cryptographic security audit badge.
   - `AttachAgentDialog.tsx`: Dialog setting delegated budget limit in minor units, selecting parent mandate, specifying allowed rails, and attaching node/edge to `workspaceStore` and 3D canvas.
   - `AgentLibrary.tsx`: Search, category filtering, attached-only toggle, metric cards, and responsive catalog grid.
   - `index.ts`: Barrel exports.

2. **Developer Portal (`apps/web/components/developer/`)**:
   - `types.ts`: API keys, MCP connection status, and default tools data models.
   - `CodeSnippet.tsx`: Syntax-styled setup code snippets in TypeScript (`@payguardian/sdk`), Python (`python-adk`), Claude Desktop, and Cursor with copy buttons.
   - `KeyManager.tsx`: Credentials table showing agent API keys (`pg_live_...`, `pg_test_...`), key rotation trigger, revoke action, and "Create Key" dialog with one-time secret revelation.
   - `ConnectionTester.tsx`: Live MCP endpoint banner with one-click copy, live "Test Connection" handshake button measuring latency, online status pill, and expandable supported tools list.
   - `DeveloperPortal.tsx`: Unified developer portal view.
   - `index.ts`: Barrel exports.

3. **Sandbox Attack Simulator (`apps/web/components/simulator/`)**:
   - `types.ts`: Attack vector data model with 5 concrete attack vectors.
   - `SimulationBadge.tsx`: Reusable `[SIMULATION]` badge with amber/gold styling.
   - `AttackVectorCard.tsx`: Attack vector cards displaying severity, scenario, attacker, spend amount, policy rule, expected defense, and interactive execution button.
   - `AttackSimulator.tsx`:
     * Strict sandbox gating with production lock banner.
     * Attack 1 (Budget Overflow): $500 vs $100 allocated -> triggers RejectionCard with `BUDGET_EXCEEDED` and red flash on node.
     * Attack 2 (Disallowed Merchant): Casino/gambling -> triggers RejectionCard with `UNAUTHORIZED_MERCHANT` and security incident log.
     * Attack 3 (Threshold Bypass): $75 vs $25 threshold -> routes to Approvals Inbox and increments pending approvals count.
     * Attack 4 (Stolen Token / Tampered Hash): Forged parameter hash -> cryptographic signature failure and security alert.
     * Attack 5 (Revoked Agent Attempt): Revoked agent payment attempt -> immediate denial and canvas node grey strike-through.
     * Live execution log with [SIMULATION] tags.
   - `index.ts`: Barrel exports.

4. **Unified Page Assembly (`apps/web/app/page.tsx`)**:
   - Completely replaced legacy raw card prototype with production-grade unified dashboard.
   - Wrapped inside `<AppShell>` (mounting `AppHeader`, `StatusPill`, `ReconnectBanner`, `EnvironmentSwitcher`, `NavTabs`, `PasskeyModal`).
   - Dynamic view rendering on `activeNavTab`:
     * `'workspace'`: `<WorkspaceLayout />`
     * `'approvals'`: `<ApprovalsInbox />`
     * `'traces'`: `<PaymentTraceView />`
     * `'tables'`: sub-tabs for `<MandatesTable />`, `<ActivityAuditTable />`, `<PoliciesTable />`
     * `'security'`: `<SecurityCenter />`
     * `'agents'`: `<AgentLibrary />`
     * `'developer'`: `<DeveloperPortal />`
     * `'simulator'`: `<AttackSimulator />`

5. **Verification**:
   - `pnpm typecheck` passed (exit code 0).
   - `pnpm --filter @payguardian/web build` passed (exit code 0).
   - Zero test files created (respecting critical constraint).
