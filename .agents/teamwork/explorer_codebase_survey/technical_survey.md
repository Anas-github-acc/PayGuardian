# Technical Survey: PayGuardian Codebase & Architecture Gap Analysis

**Date**: 2026-10-31  
**Author**: Teamwork Explorer (Codebase Architecture & Technical Integration)  
**Scope**: Codebase audit of `/home/anas/myspace/AI/PayGuardian`, reference synthesis (TurboStarter, Efferd, Ferrow), and roadmap for frontend redesign.

---

## Executive Summary

PayGuardian is an enterprise-grade agent delegation gateway designed to make invisible spending authority visible, bounded, and auditable. The backend infrastructure (`apps/api`, `packages/domain`, `packages/contracts`, `apps/agent-runtime`) provides robust primitives for hierarchical agent registration, root and child mandates, multi-tier ledger budgeting with atomic reservations/captures, human approvals, tamper-evident hash-chained audit logging, and PayPal sandbox payments.

The current frontend (`apps/web`) is a rudimentary single-page prototype that vertically stacks administrative cards and basic AG Grid tables. To fulfill the specification and requirements R1–R5, `apps/web` must be redesigned into a production-grade **Three-Panel Agent Workspace and Delegation Dashboard**. This redesign synthesizes:
1. **TurboStarter** for application shell structure, responsive multi-panel layouts, navigation, and interaction primitives.
2. **Efferd** for visual styling: restrained typography (Geist/Outfit), 1px precision borders, subtle top-shade card highlights, and high-contrast status colors on data rather than chrome.
3. **Ferrow** for an interactive 3D multi-agent architecture canvas featuring node positioning, depth, animated authority flows, payment pulses, rejection flashes, and revocation muting.

---

## 1. Codebase Inventory & Deep-Dive

### 1.1 Root Monorepo Architecture
- **Package Manager**: `pnpm@12.14.0` with `pnpm-workspace.yaml` configuring:
  - `apps/web` (Next.js frontend)
  - `apps/api` (Node.js + Fastify gateway)
  - `apps/worker` (Background job processor for PayPal reconciliation)
  - `apps/agent-runtime` (Python FastAPI + ADK agent runtime)
  - `packages/*` (`contracts`, `domain`, `config`, `paypal`, `observability`, `auth`, `db`, `ui`)
- **TypeScript**: Version `6.0.3` configured across packages with root `tsconfig.base.json`.
- **Validation & Readiness**: Root `scripts/release-readiness.mjs` enforces strict checks on database migrations, audit table RLS/hash triggers, and environment variables. `pnpm typecheck` compiles cleanly across all packages.

---

### 1.2 `apps/web` (Frontend Audit)
- **Framework & React**:
  - `next`: `16.4.2` (App Router, standalone output configured in `next.config.ts`)
  - `react`: `19.3.1`
  - `react-dom`: `19.3.1`
- **Dependencies Installed**:
  - `ag-grid-community`: `36.2.0`
  - `ag-grid-react`: `36.2.0`
  - `@supabase/supabase-js`: `2.99.2`
  - `devDependencies`: `@types/node` (26.6.5), `@types/react` (19.3.0), `@types/react-dom` (19.3.0), `vitest` (5.0.5)
- **Missing Dependencies for Target Design**:
  - **3D Canvas**: `three`, `@types/three` (and/or `@react-three/fiber`, `@react-three/drei`).
  - **Styling**: `tailwindcss`, `postcss`, `autoprefixer` (or `@tailwindcss/postcss`), `clsx`, `tailwind-merge`, `class-variance-authority`.
  - **Icons**: `lucide-react`.
  - **UI Primitives**: Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`, etc.) or Base UI.
- **Current Styling & Components**:
  - `app/globals.css`: 342 lines of vanilla CSS definitions (`.shell`, `.card`, `.auth-shell`, `.agent-grid`, `.action-row`, etc.) using basic CSS custom properties (`--background: #08111f`, `--panel: #101d30`, `--accent: #65e6b4`, `--border: rgba(...)`).
  - No CSS-in-JS or Tailwind utility classes are currently configured.
- **Existing Page Routes in `app/`**:
  - `app/layout.tsx`: Wraps app in `AuthProvider` and imports `globals.css`.
  - `app/page.tsx`: 511-line monolith rendering all dashboard sections vertically.
  - `app/login/page.tsx`: Simple email/password sign-in and sign-up form.
  - `app/paypal/return/page.tsx`: PayPal approval callback rendering `PayPalStatus`.
  - `app/paypal/cancel/page.tsx`: PayPal cancellation callback rendering `PayPalStatus`.
- **Existing Grid Components in `app/components/`**:
  - `agents-grid.tsx` & `agent-grid-data.ts`: AG Grid Community table listing registered agents.
  - `mandates-grid.tsx` & `mandates-grid-data.ts`: AG Grid table of mandate limits, spend, and permitted actions.
  - `approvals-grid.tsx` & `approvals-grid-data.ts`: AG Grid table with pending queue actions (Approve/Reject).
  - `activity-grid.tsx` & `activity-grid-data.ts`: AG Grid audit event list with sorting.
  - `payment-operations-grid.tsx` & `payment-operations-grid-data.ts`: AG Grid table of PayPal order states.
  - `paypal-status.tsx`: PayPal operation detail inspector with manual capture & reconcile triggers.
- **API Client & Authentication**:
  - `app/lib/api.ts`: Exports `buildApiHeaders` and `apiRequest<T>`. Handles Supabase JWT `Bearer` token or falls back to `x-local-user-id` header in development mode.
  - `app/auth-provider.tsx`: Context provider (`useAuth`) using Supabase client with local development auto-bypass when Supabase env variables are not set.
  - `app/lib/supabase-browser.ts`: Factory for `@supabase/supabase-js` browser client.

---

### 1.3 `apps/api` (Gateway API Audit)
- **Framework**: `fastify@5.12.7` with `@fastify/cors` and `@fastify/swagger` / `@fastify/swagger-ui`.
- **Authentication**:
  - `auth.ts` / `createPrincipalResolver`: Validates Supabase JWTs via `client.auth.getUser(token)`, verifies agent API keys (`pg_...`), or resolves `x-local-user-id` if `ENABLE_LOCAL_DEV_AUTH=true`.
- **Registered Routes**:
  - **Phase 1 (`phase1-routes.ts`)**:
    - `POST /v1/environments` — Create environment
    - `GET /v1/environments` — List user environments
    - `GET /v1/environments/:id/agents` — List agents
    - `POST /v1/environments/:id/agents/root` — Register Personal Agent
    - `POST /v1/environments/:id/agents/children` — Register subagent under active parent
    - `POST /v1/environments/:id/agents/:agentId/credentials/rotate` — Rotate credential
    - `POST /v1/environments/:id/agents/:agentId/credentials/:credentialId/revoke` — Revoke credential
  - **Phase 2 (`phase2-routes.ts`)**:
    - `POST /v1/environments/:id/mandates/root` — Create user-authorized root mandate
    - `POST /v1/mandates/:id/delegations` — Allocate child mandate
    - `POST /v1/mandates/:id/revocations` — Revoke mandate & subtree
    - `POST /v1/mandates/:id/check` — Evaluate potential action against mandate rules
    - `GET /v1/mandates/:id/chain` — Retrieve vertical mandate ancestor hierarchy
  - **Phase 3 (`phase3-routes.ts`)**:
    - `POST /v1/environments/:id/ledger/accounts` — Create ledger account
    - `GET /v1/environments/:id/ledger/accounts` & `.../:accountId` — Inspect accounts
    - `POST /v1/environments/:id/ledger/allocations` — Allocate budget from parent account
    - `POST /v1/environments/:id/ledger/reclaims` — Reclaim budget back to parent
    - `POST /v1/environments/:id/actions/reserve` — Reserve budget for protected action
    - `POST /v1/environments/:id/actions/:actionId/capture` — Capture reserved funds
    - `POST /v1/environments/:id/actions/:actionId/release` — Release reservation
    - `GET /v1/environments/:id/actions/:actionId/trace` — Vertical authorization trace
  - **Phase 4 (`phase4-routes.ts`)**:
    - `POST /v1/environments/:id/approvals` — Create human approval request
    - `GET /v1/environments/:id/approvals` & `.../:approvalId` — Query approvals inbox
    - `POST /v1/environments/:id/approvals/:approvalId/approve` — Approve request
    - `POST /v1/environments/:id/approvals/:approvalId/reject` — Reject request with reason
    - `POST /v1/environments/:id/sessions` & `GET .../sessions` — Manage workflow sessions
    - `POST /v1/environments/:id/sessions/:sessionId/runs` — Checkpoint agent task runs
    - `POST /v1/environments/:id/actions/simulate` — Non-payment rule simulation
  - **Phase 6 (`phase6-routes.ts`)**:
    - `POST /v1/environments/:id/pause` — Pause environment
    - `POST /v1/environments/:id/resume` — Resume environment
    - `POST /v1/environments/:id/revoke` — Revoke all environment authority
    - `POST /v1/environments/:id/agents/:agentId/disable` — Disable agent
    - `POST /v1/environments/:id/agents/:agentId/revoke` — Revoke agent & descendants
    - `GET /v1/environments/:id/mandates` — List all mandates for environment
    - `GET /v1/environments/:id/activity` — Query audit trail with `?since=` and `?limit=`
  - **PayPal Provider (`paypal-routes.ts`)**:
    - `POST /v1/environments/:id/payments/paypal/orders` — Create PayPal checkout order
    - `GET /v1/environments/:id/payments/paypal/operations` — List operations
    - `GET /v1/environments/:id/payments/paypal/:actionId` — Inspect PayPal order
    - `POST /v1/environments/:id/payments/paypal/:actionId/capture` — Execute capture
    - `POST /v1/environments/:id/payments/paypal/:actionId/reconcile` — Sync status
    - `POST /v1/webhooks/paypal` — Webhook ingestion
- **Mock & In-Memory Fallbacks**:
  - Full in-memory implementations exist for every store (`InMemoryRegistry`, `InMemoryAuthorityStore`, `InMemoryLedgerStore`, `InMemoryApprovalStore`, `InMemorySessionStore`, `InMemoryPayPalOperationStore`, `InMemoryAuditEventStore`). If `DATABASE_MODE=memory` or Supabase credentials are not configured, the API operates entirely in-memory with zero loss of functional validation.
- **Real-Time & Streaming Status**:
  - **SSE / Event-Stream endpoints are NOT yet implemented**.
  - Live activity currently relies on client-side polling of `/v1/environments/:id/activity?since=...` every 3 seconds.

---

### 1.4 `packages/contracts` and `packages/domain` (Data Models & Integrity)
- **Minor Unit Money Discipline**:
  - Both packages strictly represent money in integer minor units (e.g. paise for INR, cents for USD): `budgetLimitMinor`, `allocatedMinor`, `spentMinor`, `reservedMinor`, `amountMinor`.
  - All arithmetic strictly utilizes integer addition and subtraction (`Number.isSafeInteger`, strictly non-negative).
  - Floating-point calculations are prohibited except for display string formatting (e.g., `(amountMinor / 100).toFixed(2)`).
- **Mandate Invariants (`packages/domain/src/index.ts`)**:
  - Mandate constraints enforce: `canDelegate`, `maxDelegationDepth`, `permittedActions` (subset enforcement), `expiresAt`, `approvalRequired`.
  - Policy decisions return structured codes: `ALLOW`, `MANDATE_NOT_FOUND`, `MANDATE_REVOKED`, `MANDATE_EXPIRED`, `ACTION_NOT_PERMITTED`, `BUDGET_EXCEEDED`, `DELEGATION_NOT_PERMITTED`, `DELEGATION_DEPTH_EXCEEDED`, `CURRENCY_MISMATCH`, `APPROVAL_REQUIRED`.
- **Ledger Invariants (`packages/domain/src/ledger.ts`)**:
  - Double-entry accounting invariants: Total child allocations cannot exceed parent available balance; reservations lock funds until captured or released.

---

## 2. Components & Logic to Preserve and Reuse

| File / Component | Purpose | Reuse Strategy |
|---|---|---|
| `app/lib/api.ts` (`apiRequest`, `buildApiHeaders`) | Gateway HTTP request layer with token handling & dev bypass | Preserve intact; export typed helper functions for all API resources. |
| `app/auth-provider.tsx` | Supabase auth management, session state, and dev auto-login | Preserve context API (`useAuth`, `AuthBoundary`); upgrade UI login view. |
| `app/lib/supabase-browser.ts` | Browser Supabase client initialization | Preserve intact. |
| `app/components/*-grid-data.ts` | Data mappers converting API minor units & ISO timestamps to table rows | Reuse and expand for AG Grid tables across all views. |
| `packages/contracts` | Canonical DTO definitions | Import directly into `apps/web` components to prevent contract drift. |
| `packages/domain` | Validation rules & policy codes | Re-use code enums and reason strings in UI chips (`ReasonChip`). |
| Emergency control handlers in `app/page.tsx` | Pause/resume/revoke environment & agent status calls | Extract into dedicated `useEnvironmentControls` hook. |
| Approvals handling in `app/page.tsx` | Approve and reject API calls | Extract into dedicated `useApprovals` hook. |
| PayPal status handling in `paypal-status.tsx` | Capture and reconcile handlers | Re-use in Payment Trace modal and PayPal status views. |

---

## 3. Gap Analysis: Current Codebase vs. Requirements R1–R5

### R1. Design System and Reference Synthesis
- **Current State**:
  - Custom CSS classes in `globals.css` with a basic dark theme.
  - No Tailwind CSS, no component library primitives, no iconography package.
- **Requirement Gap**:
  - **TurboStarter synthesis**: Clean app shell, navigation drawer, sticky blurred header, segmented panels, data-orientation dividers, responsive breakpoints.
  - **Efferd synthesis**: Restrained typography (Geist/Outfit), 1px precision borders (`border-border/50`), top-shade card highlights, subtle radial gradients on dark grounds, color applied strictly to data rather than chrome.
  - **Ferrow synthesis**: Multi-agent network visualization with node positioning, depth, animated edges, status illumination.
  - **Taste Skill compliance**: Follow `design-taste-frontend/references/app-screens.md`: no icon-in-colored-circle badges on KPIs, no vanity charts, high-density useful data, accessible focus states.

### R2. App Shell, Authentication, and Environment Management
- **Current State**:
  - Header is a simple flexbox with title and sign-out button.
  - Create-environment is a single 3-field form creating an active environment without consent generation.
  - Environment selection is a simple bulleted list on the main page.
- **Requirement Gap**:
  - Top bar with environment switcher dropdown, status pill (Active, Paused, Closed, Revoked), Sandbox mode badge, approvals notification bell with pending count, emergency "Pause environment" button, and user menu.
  - Live reconnect banner: "Live updates paused, reconnecting" when connection drops, marking on-screen data stale.
  - 5-step Create-Environment Wizard:
    1. Basics (name, purpose, template)
    2. Budget & Time (amount, currency, expiry)
    3. Agents (pre-select Main Agent; attach library agents as unfunded)
    4. Guardrails (spending limits, category allowlists, approval threshold, delegation depth)
    5. Review & Approve (plain-language consent generated dynamically from mandate values; explicit approve to persist)
  - Strict environment switching isolation: resetting chat history, agent graph, selection, and memory to prevent cross-tenant data leakage.

### R3. Three-Panel Workspace & Interactive 3D Agent Network Canvas
- **Current State**:
  - Single vertical dashboard. No 3-panel workspace, no chat, no sessions, no memory, no 3D canvas.
- **Requirement Gap**:
  - **Left Panel**: Sessions list (active, waiting, done; context attach) + Memory panel (Session, Environment, Agent tabs with editable entries, pin, undo, and explicit notice "Memory never grants spending authority").
  - **Center Panel (Interactive 3D Agent Network Canvas)**:
    - Renders orchestrator (You ₹10,000 -> Personal Agent) and attached subagents (Travel, Hotel, Food, etc.).
    - Ferrow-inspired 3D visualization: spatial node positioning, depth layering, perspective, zoom/pan/fit controls.
    - Edges: Dashed line for unfunded attachment, solid line labeled with allocation amount for authorized delegation.
    - Live animations: Budget slice flowing down edge on delegation, pulse on payment, red flash on rejection, grey struck-through on revocation.
    - Drag-and-drop or modal attach/detach from Agent Library with guardrail validation.
    - Node detail drawer on selection (Overview, Authority, Activity, Chat, Settings).
    - Keyboard-friendly accessible List View toggle alternative.
    - Budget Strip (spent / reserved / available) and live Activity Feed directly beneath canvas.
  - **Right Panel (Chat Workspace)**:
    - Main Agent chat by default, or subagent target selector.
    - Streaming message responses.
    - Gateway-verified factual cards (Budget Plan Card with Approve/Edit, Payment Result Card with timeline, Rejection Card with plain-language reason, Delegation Card, Memory Card with Undo).
    - Strict security separation: Agent text is escaped; gateway cards render only through verified system components.

### R4. Approvals, Payment Traces, Mandates, and Activity Auditing
- **Current State**:
  - Approvals rendered as a simple list inside `app/page.tsx`.
  - Mandates and Activity rendered in basic AG Grid Community tables.
  - Payment Trace is not implemented in UI (only API endpoint exists).
- **Requirement Gap**:
  - Mobile-first Approval Inbox with request card details, vertical authority chain, remaining budget impact, plain-language reason, and bound Approve/Reject actions.
  - Dedicated Payment Trace view ("Why was this allowed?"):
    - Lifecycle timeline: Requested -> Authorized -> Sent to provider -> Provider accepted -> Completed / Uncertain / Failed.
    - Vertical chain visualization with limits and remaining funds at each level.
    - Gateway verification checklist (signatures valid, within parent limits, unexpired, unrevoked, budget available).
    - Plain-language explanation for rejections with recommended remedy.
  - AG Grid tables for Mandates, Policies, and Activity Audit Trail:
    - Server-side paging, sorting, filtering, and column visibility.
    - Row-click navigation directly opening Payment Trace.
  - Security Center screen with emergency Pause Environment, Revoke All Authority with impact preview, and security alert log.

### R5. Agent Library, Developer Connect, Simulator, and Backend Integration
- **Current State**:
  - Agent creation only exists via child agent API endpoint.
  - No Agent Library UI, no Developer Portal UI, no Attack Simulator UI.
- **Requirement Gap**:
  - Agent Library page/drawer: grid of agent cards (platform, third-party, custom), capability filters, permission breakdown, and "Attach unfunded" action.
  - Developer Portal: MCP endpoint configuration snippets (Claude, Cursor, Windsurf), API key generation (shown once), rotation, revocation, and live connection test handshake.
  - Sandbox Attack Simulator: Interactive scenario runner triggering rule violations (overspend, forged delegation, expired mandate, revoked mandate, cross-env spend, replay attacks) streaming results into graph and feed with distinct "Simulation" badges.

---

## 4. Technical Recommendations

### 4.1 3D Multi-Agent Network Visualization
- **Architecture**:
  - Ferrow utilizes a spatial isometric/3D projection with lighting, depth, animated edge pulses, and clean node styling.
  - In React 19 / Next.js 16, `@react-three/fiber` v9 or a native Three.js WebGL canvas wrapper inside a React component (`useEffect` + `useRef`) can be employed.
  - **Recommended Approach**: Direct Three.js integration wrapped in a custom `<AgentNetworkCanvas />` component.
    - Avoids React 19 peer-dependency conflicts with R3F libraries.
    - Lightweight, maximum performance, complete control over WebGL rendering context.
    - Scene graph contains:
      - Orthographic/Perspective camera with smooth pan/zoom/orbit controls.
      - Ambient + directional lighting emphasizing depth and elevation layers.
      - 3D Node meshes: Rounded cylinders/hexagons with status materials (emerald for active, amber for awaiting approval, grey for paused/revoked, dashed outline for unfunded).
      - HTML/SVG overlay labels or Sprite text rendering agent names, roles, and budget bars.
      - Edges: Spline curves with shader-based particle pulses flowing along edges when delegation or payment occurs.
      - Pulse animations on payment events; brief red emissive flashes on rejection; immediate grey desaturation on revocation.
  - **Accessibility Requirement**: Include an accessible, keyboard-navigable `<AgentNetworkListView />` toggle that mirrors the graph hierarchy for screen readers and keyboard users (WCAG 2.1 AA).

### 4.2 AG Grid Integration
- **Installed Version**: `ag-grid-community@36.2.0` and `ag-grid-react@36.2.0`.
- **Implementation Strategy**:
  - Register modules with `ModuleRegistry.registerModules([AllCommunityModule])`.
  - Apply `themeQuartz` with CSS variable overrides aligned to Efferd's dark aesthetic (`--ag-background-color: #0b1322`, `--ag-border-color: rgba(255,255,255,0.08)`, `--ag-header-background-color: #0e182a`, `--ag-foreground-color: #e2e8f0`).
  - Implement AG Grid server-side pagination datasource for `/v1/environments/:id/activity` using `since` and `limit` query parameters.
  - Attach `onRowClicked` handler to open the Payment Trace modal for any payment or denial event.

### 4.3 Real-Time Streaming & Resilience
- **Transport**:
  - The frontend specification recommends Server-Sent Events (SSE) for one-way updates.
  - In `apps/api`, implement `GET /v1/environments/:id/events` returning `Content-Type: text/event-stream`.
  - In `apps/web`, create a resilient `useEnvironmentEvents(environmentId)` hook:
    - Listens to SSE event stream.
    - If connection drops, display the "Live updates paused, reconnecting" banner.
    - Fall back automatically to cursor-based polling (`/v1/environments/:id/activity?since=...`) every 3 seconds.
    - On reconnect, refetch current environment state to guarantee no stale tree or budget drift.

### 4.4 State Management & Security Invariants
- **Workspace State Management**:
  - Use lightweight Zustand or modular React Context stores:
    - `useWorkspaceStore`: Active environment ID, active session ID, selected agent node, active workspace view (`graph` vs `list`).
    - `useApprovalStore`: Pending approvals queue and count for the header bell badge.
    - `useTraceModalStore`: Trace modal open state and active action ID.
  - **Security Invariant**: Environment switching must execute an atomic state wipe (`resetWorkspace()`), ensuring chat messages, graph nodes, and cached selections are purged immediately.
- **Authority & Minor Units**:
  - Keep all financial calculations in integer minor units. Zero floating-point arithmetic.
  - Gateway cards (Budget Plan, Payment Result, Rejection, Delegation) must be rendered strictly via hard-coded React components (`<VerifiedBlock />`, `<BudgetPlanCard />`) driven by gateway payloads. Free agent text cannot inject markup or render verified cards.

### 4.5 Styling & Design System (TurboStarter + Efferd + Taste Skill)
- **CSS Setup**:
  - Install and configure `tailwindcss` and `lucide-react` in `apps/web`.
  - Establish a cohesive design token set in CSS:
    - Backgrounds: Dark slate/navy (`#060d17`, `#0b1322`, `#101b2e`), with subtle radial gradient highlights.
    - Borders: 1px subtle rules (`rgba(255, 255, 255, 0.08)`).
    - Top-shade cards: Subtle top border/inner shadow providing tactile depth without heavy drops.
    - Accents: Emerald (`#10b981`) for active/authorized, Amber (`#f59e0b`) for approval required, Rose/Red (`#ef4444`) for denied/revoked, Sky/Blue (`#0ea5e9`) for sessions.
    - Typography: Geist Sans or Inter, with font size hierarchy strictly capped (no oversized hero text in dashboard screens, per Taste Skill `references/app-screens.md`).
