## 2026-10-31T16:35:41Z
You are a teamwork_worker subagent assigned to Milestone 2: App Shell, Authentication, and Environment Management.

Read:
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/ORIGINAL_REQUEST.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/orchestrator_1/PROJECT.md
- Specification analysis: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/spec_miner_survey/spec_analysis.md
- UI primitives in apps/web/components/ui/

Your working directory is:
/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m2/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL TESTING CONSTRAINT:
Do NOT create any test files, unit tests, component tests, or end-to-end test specs. No Vitest test files, no Playwright test files. The user will test manually. Focus all effort on the actual implementation.

Your Scope & Write Ownership:
You exclusively own:
- apps/web/app/lib/workspace-store.ts (Central store with atomic resetWorkspace() preventing cross-environment leakage)
- apps/web/components/shell/* (AppHeader, EnvironmentSwitcher, StatusPill, LiveReconnectBanner, NavTabs)
- apps/web/components/auth/* (PasskeyModal, AuthCard with WebAuthn/passkey simulation & dev bypass fallback)
- apps/web/components/wizard/* (CreateEnvironmentWizard 5-step modal, dynamic consent text generation, review & explicit approval)

Requirements to fulfill:
1. Workspace Store & Atomic Environment Reset (`apps/web/app/lib/workspace-store.ts`):
   - Track: `currentEnvironmentId`, `currentEnvironment`, `environmentsList`, `connectionStatus` ('connected' | 'reconnecting' | 'offline'), `reconnectBannerVisible`, `activeNavTab` ('workspace' | 'approvals' | 'traces' | 'tables' | 'security' | 'simulator'), `chatMessages`, `gatewayCards`, `graphNodes`, `graphEdges`, `selectedNodeId`, `selectedTraceId`.
   - Implement `switchEnvironment(envId)` which executes an atomic `resetWorkspace()`: clears chat messages, gateway cards, graph state, selection state, and active trace, then fetches fresh environment data via `/v1/environments`. This guarantees ZERO cross-environment data leakage.
2. App Shell Components (`apps/web/components/shell/`):
   - `header.tsx`: TurboStarter-styled top navigation bar (obsidian background `#000000`, hairline bottom border `#ffffff1c`, height 56px / `h-14`), PayGuardian logo with status pill, breadcrumbs, environment switcher dropdown, nav tabs/pills, and user avatar / passkey indicator.
   - `environment-switcher.tsx`: Dropdown showing current environment name, badge (Sandbox/Production), budget indicator, other environments, and "+ New Environment" button opening the wizard.
   - `status-pill.tsx`: Live connection indicator with glowing micro-dot (emerald for connected, amber for reconnecting, ruby for offline), latency display (e.g. "12ms"), and tooltip.
   - `reconnect-banner.tsx`: Dismissible top alert banner displayed when `connectionStatus === 'reconnecting'` or offline, with manual "Retry Connection" button.
3. Authentication Flow (`apps/web/components/auth/`):
   - `passkey-modal.tsx`: Passkey authentication flow with WebAuthn simulation (`navigator.credentials.get` with mock fallback for dev), fingerprint/key icon, biometric prompt styling, and immediate fallback to dev local bypass header (`x-local-user-id`).
4. 5-Step Create-Environment Wizard (`apps/web/components/wizard/`):
   - Modal wizard with step indicator (1 to 5):
     * Step 1 (Identity): Name, Slug, Environment Type (Sandbox vs Production).
     * Step 2 (Root Mandate): Currency selector (USD, EUR, JPY), Budget limit (using `parseMajorToMinor` in `currency.ts`), Duration / Expiry.
     * Step 3 (Guardrails): Allowed payment rails (PayPal checkbox checked), Max per-action limit, Human approval required for amounts above threshold.
     * Step 4 (Dynamic Consent Generation): Dynamically compiles a human-readable legal & plain-language consent agreement from the values in Steps 1-3 (e.g., *"By proceeding, you grant authority to environment '[Name]' to initiate payments up to [Budget] via PayPal. Actions exceeding [Threshold] strictly require explicit human cryptographic sign-off. Authority expires on [Date]."*). Includes an explicit authorization checkbox.
     * Step 5 (Review & Confirm): Summary card with tabular layout of all configured policies, consent confirmation status, and "Authorize & Create Environment" action button.
   - On completion: Calls `POST /v1/environments` (or `/v1/environments/:id/mandates/root`), creates the environment, updates the workspace store, and switches into the new environment with clean state.
5. Verification:
   - Run `pnpm typecheck`
   - Run `pnpm --filter @payguardian/web build`
   - Confirm builds succeed with zero errors.
6. Write your completion report to `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m2/handoff.md` and send a message back with your verification results.

Update progress.md regularly.
