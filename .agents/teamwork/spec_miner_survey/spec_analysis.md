# Comprehensive Frontend Specification & Architecture Analysis

## 1. Executive Summary & Authoritative Specification Sources

This document provides the authoritative specification mining analysis for the complete redesign of PayGuardian's frontend into a production-grade **Agent Workspace and Delegation Dashboard**.

### Authoritative Specification Sources Inspected
1. **Frontend Specification**: `docs/Frontend Specification Agent Workspace and Delegation Dashboard.md` (authoritative UI/UX, components, routes, node states, and sitemap).
2. **Project Specification & Checklist**: `docs/spec.md`, `input.md`, and `docs/checklist.md` (system invariants, authority rules, ledger accounting, payment states, and API contracts).
3. **Taste Skill Guidelines**: `/home/anas/.claude/skills/design-taste-frontend/SKILL.md` and `references/app-screens.md` (anti-slop art direction, app screen metrics, 23-screen study rules, layout and styling bans).
4. **Design Reference Syntheses**:
   - **TurboStarter** (`https://demo.turbostarter.dev`): Modular app shell, left rail navigation, top bar controls, responsive drawers/sheets, clear visual hierarchy.
   - **Efferd** (`https://efferd.com`): Refined design tokens, 1px subtle hairline borders, masked edges, flat surfaces with top-shade highlights, Geist Sans / Geist Mono typography.
   - **Ferrow** (`https://illos-ferrow-template.vercel.app`): 3D isometric multi-agent network visualization, node positioning, depth faces (`top`, `left`, `right`), color-mix lighting tokens, pulse/state animations, edge routing.
5. **Existing Codebase State**: `apps/web` (Next.js 16 + React 19 + AG Grid Community 36.2), `apps/api` (Fastify + Swagger + Supabase/In-memory stores for phases 1–6), `packages/*` (`domain`, `config`, `observability`, `auth`, `paypal`).

---

## 2. Taste Skill Design Principles & Aesthetic Rules

The Taste Skill (`design-taste-frontend`, especially `references/app-screens.md`) establishes a strict anti-slop doctrine derived from a study of 23 real product screens. To avoid generic "AI-generated template" aesthetics, the frontend redesign must conform to these concrete rules:

### 2.1 The Core Anti-Slop Principles
1. **Colour Goes on Data, Not Chrome**:
   - Median screen has ≤3% to 5% colored pixels.
   - Chrome (sidebars, nav items, top bar, borders) is neutral (grays, blacks, whites).
   - Accents belong on data (e.g. status dots, budget burn bars, selected trace step) and at most one primary control.
2. **Surfaces are Flat**:
   - No heavy drop shadows. Rest card elevation uses 1px hairline borders or a 1-step lightness change.
   - Shadows are reserved strictly for floating overlays (menus, dropdowns, toolbars, dialogs).
3. **Hairline 1px Borders**:
   - Card and panel borders must maintain a quiet 1.1–1.3:1 contrast against the ground (`#e5e7eb` on white; `#1a1a1a` on `#000` / `#2e2e2e` on `#111`).
   - A surface gets a border OR a shadow, never both.
4. **Tabular Numbers & Right Alignment**:
   - All financial figures, counts, and deltas must use monospace or tabular numerals (`font-variant-numeric: tabular-nums`).
   - Numbers in tables and summaries must align to the right digit-for-digit.
5. **No AI-Generated Dashboard Tells**:
   - **Banned**: Gradients on buttons/cards/backgrounds, glowing borders, frosted glass/backdrop-blur cards.
   - **Banned**: Icons inside colored circles on KPI cards.
   - **Banned**: Sparklines inside small metric tiles.
   - **Banned**: Emoji in headings, greeting titles ("Welcome back 👋"), nav, or empty states.
   - **Banned**: Rainbow charts (more than 4 hues).
   - **Banned**: Saturated status pills with white text (must use pale tint with dark text of the same hue).
   - **Banned**: Zebra striping and uppercase tracked table headers.
   - **Banned**: Floating-point display or arithmetic on financial balances.
6. **Responsive Layout Discipline**:
   - Desktop (≥1200px): Three-panel workspace (Sessions | 3D Graph & Activity | Chat & Verified Cards).
   - Tablet (641px–1199px): Two-panel layout or tabs, collapsible rail.
   - Mobile (≤640px): Full-screen views with folded 48px top bar or bottom bar; tabs for Chat, Graph, and Activity. Approvals are mobile-first with 44px+ touch targets.

---

## 3. Reference Synthesis Architecture

The redesigned UI synthesizes the three approved reference models:

| Dimension | Reference Source | Implementation in PayGuardian |
|---|---|---|
| **Structure & Navigation** | **TurboStarter** | Sticky app header with environment switcher, status pill, reconnect banner, quick-action controls; clean left sidebar navigation with environment scope validation; accessible sheets/drawers for node details and mobile drawers. |
| **Visual Identity & Tokens** | **Efferd** | Neutral background (`#08090a` dark / `#ffffff` light), 1px border lines (`border-border`), top-shade card highlights (`shadow-xs`), Geist Sans & Geist Mono typography, restrained pale status badges (`ReasonChip`, `StatusPill`). |
| **3D Agent Network Visualization** | **Ferrow** | Interactive 3D/isometric multi-agent architecture canvas; solid (funded) vs dashed (unfunded) nodes; isometric plates and node depth lighting (`top`, `left`, `right` faces using `color-mix`); animated budget flow along edges; pulse on payment, red flash on rejection, grey desaturation on revocation; plus keyboard-accessible list view fallback. |

---

## 4. Itemized Requirements Breakdown (R1 – R5) with P0 / P1 / P2 Prioritization

### Requirement R1: Design System & Reference Synthesis
*Establish a cohesive, premium design system synthesizing TurboStarter (structure), Efferd (visual tokens), and Ferrow (3D multi-agent canvas), compliant with Taste Skill rules, without unit tests.*

- **R1.1 [P0] Unified Design Tokens & Typography**:
  - CSS variables for neutral grounds, ink, borders, and functional data accents (active green `#1daf9c`, warning amber `#f59e0b`, danger red `#ef4444`, unfunded dashed muted `#6b7280`).
  - Font families: Geist Sans (primary UI), Geist Mono (amounts, IDs, hashes, tabular figures).
  - Strict compliance with Taste Skill: flat cards, hairline 1px borders, no neon glows, no gradient buttons.
- **R1.2 [P0] Component Catalog Foundation**:
  - `BudgetBar`: Single segmented bar displaying Spent, Reserved, and Available with minor-unit integer arithmetic.
  - `AuthorityBadge`: Solid vs. dashed indicator denoting effective authority.
  - `StatusPill`: Pale-tint badge with matching hue text for Active, Paused, Revoked, Expired, Exhausted, Pending.
  - `ReasonChip`: Plain-language denial chip with expand-for-details disclosure.
  - `LiveBanner`: Sticky notification banner for disconnected/reconnecting states and stale data indications.
  - `ConfirmDangerDialog`: Destructive action modal (revoke subtree, pause environment) showing precise impact preview.
- **R1.3 [P1] Theme Toggle & Motion Preferences**:
  - Support for dark and light themes conforming to Efferd contrast specifications.
  - Honor `prefers-reduced-motion` across all graph animations and pulse transitions.

---

### Requirement R2: App Shell, Authentication, and Environment Management
*Build application shell, environment switcher, status pill, live reconnect banner, passkey/fallback auth, and 5-step create environment wizard with dynamic mandate-derived consent text.*

- **R2.1 [P0] Top Bar App Shell**:
  - Environment switcher dropdown displaying active environments.
  - Environment status pill (`active`, `paused`, `closed`, `revoked`).
  - **Sandbox** indicator badge when running in simulation/sandbox mode.
  - Approvals notification bell with live pending count badge.
  - Quick-action **Pause Environment** button.
  - User profile menu with sign-out.
  - Live reconnect banner: When WebSocket / SSE connection drops, display persistent "Live updates paused, reconnecting" banner and mark on-screen data as stale.
- **R2.2 [P0] Left Navigation Rail**:
  - Navigation links: Workspace (`/e/:id`), Approvals (`/e/:id/approvals`), Mandates & Policies (`/e/:id/mandates`), Activity & Audit (`/e/:id/activity`), Security Center (`/e/:id/security`), Agent Library (`/library`), Developer Portal (`/developers`), Settings (`/settings`).
  - Automatic disabling of environment-scoped items when no environment is active.
- **R2.3 [P0] Environment Switching & Complete State Reset**:
  - Switching environments must **instantly and completely flush** chat messages, 3D graph selection, active session, and memory state. No cross-environment data leakage.
  - Environment name must be prominently displayed across all environment-scoped views.
- **R2.4 [P0] Authentication Flow**:
  - Passkey (WebAuthn) primary authentication with fallback email/password.
  - Session expiry displays an interactive modal prompt rather than blanking the screen or abrupt navigation.
- **R2.5 [P1] Re-Authentication for High-Risk Actions**:
  - Re-authentication challenge before executing destructive commands: Revoke All, Amend Limit, Rotate/Delete Credentials.
- **R2.6 [P0] Environment List View (`/environments`)**:
  - Cards per environment: Name, purpose, status pill, budget bar (spent/reserved/available), expiry date, agent count, pending approvals count.
  - "New Environment" action button.
  - Empty state with a single explanatory sentence and starter template.
- **R2.7 [P1] Environment List Separation**:
  - Collapsed secondary section for Closed and Revoked environments.
- **R2.8 [P0] 5-Step Create Environment Wizard (Core Steps 1, 2, 5)**:
  - **Step 1 (Basics)**: Environment name, purpose, and optional starter template (e.g. Vacation, Daily Operations).
  - **Step 2 (Budget & Time)**: Total limit in minor units (e.g. ₹10,000 = `1000000`), currency selector (INR for simulation, USD for PayPal), expiry date picker.
  - **Step 5 (Review & Approve)**: Dynamic consent text generated strictly from mandate parameters (never user-editable text):
    > *"You are allowing the Main Agent to spend up to ₹10,000 on travel until 12 Nov. It may share this with up to 2 levels of helper agents. You will be asked before any single payment over ₹3,000."*
  - Creation executes **only** on explicit final approval click.
- **R2.9 [P1] Create Environment Wizard (Advanced Steps 3 & 4)**:
  - **Step 3 (Agents)**: Pre-populates Personal/Main Agent; optional attachment of initial library agents (unfunded).
  - **Step 4 (Guardrails)**: Collapsed-by-default parameters: maximum share per agent, allowed category allowlist, per-payment human approval threshold, maximum delegation depth.

---

### Requirement R3: Three-Panel Workspace and Interactive 3D Agent Network Canvas
*Deliver the 3-panel workspace (Sessions, 3D Graph, Chat with verified cards & memory), node detail drawer, and accessible keyboard list view.*

- **R3.1 [P0] Desktop Three-Panel Workspace Layout (`/e/:id`)**:
  - Left panel: Sessions & Task Memory.
  - Center panel: 3D Agent Network Canvas with under-canvas Budget Strip and live Activity Feed ticker.
  - Right panel: Agent Chat with streaming responses and dedicated gateway-verified cards.
- **R3.2 [P0] Sessions Panel**:
  - List of sessions with title, status (`active`, `waiting for you`, `done`), last activity timestamp.
  - "New Session" button.
  - Selecting a session switches chat history; new session starts pristine with no context inheritance.
  - Strict invariant: A session never displays or alters budget directly.
- **R3.3 [P1] Sessions Enhancements**:
  - Session rename, close, reopen, and search.
  - Explicit "Attach Context" modal to reference prior session summaries without conversational history spillover.
- **R3.4 [P0] Chat Panel with Streaming & Verified Gateway Cards**:
  - Main Agent ready upon environment creation; streaming token output, stop streaming button, retry button.
  - Agent target selector: Main Agent by default, or any connected subagent selected from the graph.
  - "Waiting for you" banner displayed when an agent is blocked awaiting human approval, with a direct shortcut link to the approval modal.
- **R3.5 [P0] Dedicated Gateway-Verified Fact Cards (Distinct from Agent Chat)**:
  - `BudgetPlanCard`: Displays proposed split table, editable sub-allocation amounts, and gateway action buttons (**Approve Plan**, **Edit**).
  - `ApprovalRequestCard`: Live request details, amount, merchant, remaining balance after payment, and direct Approve/Reject actions.
  - `PaymentResultCard`: Lifecycle stage timeline with transaction ID, amount, and gateway confirmation status.
  - `RejectionCard`: Displays gateway refusal with machine-readable code translated into plain language (e.g. *"Hotel Agent asked for ₹5,000 but only has ₹200 left"*).
  - `DelegationCard`: Authority grant record (e.g. *"Main Agent delegated ₹4,000 to Hotel Agent"*).
  - `MemoryCard`: Displays newly saved durable memory with an instant **Undo** button.
  - Every card includes a "View Trace" button linking directly to the payment trace view (`/e/:id/activity` or drawer).
- **R3.6 [P0] Two Voices Architecture & Text Escaping**:
  - Agent-authored and external third-party text is strictly escaped via `AgentSays`. Agent text can never inject HTML, Markdown scripts, or fake a `VerifiedBlock` gateway card.
- **R3.7 [P0] Interactive 3D Agent Network Canvas (Ferrow Synthesis)**:
  - Isometric/3D hierarchical tree: Root user at apex → Personal/Main Agent → Specialist subagents.
  - Automatic tree layout with interactive orbit/pan/zoom and "Fit to Screen" button.
  - **Edge Semantics**:
    - *Dashed line*: Structural attachment (connected, but 0 authority).
    - *Solid line labeled with amount*: Delegated authority grant.
  - **3D Node Content**:
    - Depth plates (`top`, `left`, `right` faces with color-mix lighting tokens).
    - Node role icon, agent name, source badge (`platform`, `third-party`, `custom`).
    - Allocated, spent, reserved, and remaining amounts (minor units formatted).
    - Mini budget bar, status dot, and delegation depth marker.
  - **Drag-and-Drop & Node Actions**:
    - Drag agent from Library drawer onto a canvas node to attach (creates dashed, unfunded child).
    - Depth limit or non-delegable parent validation: Refuse drop with clear reason.
    - Detach unfunded node directly; detaching funded node prompts confirmation and returns unspent funds to parent.
    - Click node opens Node Detail Drawer.
  - **Live State Animations**:
    - Authority flow: Animated pulse traveling down edge upon delegation.
    - Payment: Soft node pulse on execution.
    - Rejection: Brief red flash on node when gateway rejects spend.
    - Revocation: Entire revoked branch desaturates to grey immediately.
- **R3.8 [P0] Accessible Keyboard List View**:
  - Toggle between 3D Canvas and nested keyboard-navigable list view.
  - Arrow keys navigate between sibling and child nodes; Enter opens the Node Detail Drawer.
- **R3.9 [P1] Graph View Controls & Subtree Management**:
  - Collapse/expand subtrees, search node by name/role, canvas minimap.
  - View filters: Toggle "Structure" (attachments), "Authority" (allocations), or both.
  - Re-parenting: Drag node to new parent with ancestor-chain validation.
- **R3.10 [P2] History Replay**:
  - Interactive timeline scrubber to replay graph evolution, delegations, and spend over time.
- **R3.11 [P0] Node Detail Drawer**:
  - Slides out upon node selection with tabs:
    - **Overview**: Role, publisher source, active status.
    - **Authority**: Current limit, action scope, tool permissions, expiry, delegation rights, parent mandate ID. All values pulled directly from gateway state.
    - **Activity**: Filtered audit events for this specific agent.
    - **Chat**: Direct conversational interface with this agent (per OD-F1).
    - **Settings**: Configuration for custom/configurable agents (tools, roles).
  - Action buttons: Chat, Propose Allocation, Revoke (with subtree impact preview), Detach.
- **R3.12 [P0] Memory Panel**:
  - Three distinct memory tabs:
    - **Session Memory**: Ephemeral notes, task constraints, and scratchpad for the active session.
    - **Environment Memory**: Durable preferences (e.g. *"prefers morning flights"*, *"vegetarian"*).
    - **Agent Memory**: Role-specific facts retained by individual agents.
  - Item controls: Edit, delete, pin.
  - **Fixed Security Notice**: *"Memory never grants spending permission."* If memory text contains limits (e.g. "budget is 5000"), display explicit warning that memory cannot alter authority.
- **R3.13 [P1] Memory Controls**:
  - Per-environment memory enable/disable toggle, "Clear All Memory", memory export.

---

### Requirement R4: Approvals, Payment Traces, Mandates, and Activity Auditing
*Implement mobile-first approval inbox, payment trace visualization ("Why was this allowed?"), AG Grid tables for mandates, policies, and audit logs with server-side paging/filtering, and the security center.*

- **R4.1 [P0] Mobile-First Approval Inbox (`/e/:id/approvals`)**:
  - Optimized for smartphone usage (44px+ touch targets, clean single-column cards).
  - Filter tabs: Pending (with badge), Approved, Rejected, Expired.
  - **Approval Card Content**:
    - Requesting agent and ancestor chain breadcrumb (`You → Personal → Travel → Hotel`).
    - Action purpose, amount and currency formatted from minor units.
    - Merchant/recipient name.
    - Remaining budget calculation after payment.
    - Expiry countdown timer.
    - Isolated "Agent says" block with escaped text.
    - Primary **Approve** and **Reject** buttons.
  - **Hard Limit Exceeded Guardrail**: If request exceeds parent mandate limit, disable Approve button, display explanatory banner, and provide "Amend Limit" link (requiring re-authentication).
- **R4.2 [P0] Payment Trace View ("Why was this allowed?")**:
  - Accessible via "View Trace" on any chat card, approval, or activity row.
  - **Lifecycle Stages Timeline**:
    1. `Requested`
    2. `Authorized by Gateway`
    3. `Sent to Provider`
    4. `Provider Accepted`
    5. `Completed` (or `Failed`, or `Uncertain`).
  - **Vertical Authorization Chain**: Drawn vertically showing agent nodes, allocated limits, and remaining amounts at each level.
  - **Gateway Verification Checklist**:
    - [x] Cryptographic signatures valid.
    - [x] Within parent mandate limit.
    - [x] Mandate not expired.
    - [x] Mandate not revoked.
    - [x] Action in permitted scope/category.
    - [x] Budget available at every level of the chain.
    - [x] Human approval obtained (if required).
  - **Rejection Highlighting**: Highlight the exact failed check in red with plain-language explanation and recommended remediation.
  - **Uncertain State Notice**: For pending payment captures: *"Waiting for confirmation from payment provider. The money is held in reservation, not spent."*
- **R4.3 [P1] Developer Trace Mode**:
  - Toggle "Show Raw Record" revealing JSON payload, cryptographic hashes, mandate IDs, and previous hash chain.
- **R4.4 [P0] Mandates Table (AG Grid Community)**:
  - Columns: Holder Agent, Parent Agent, State (`active`, `expired`, `revoked`), Limit, Spent, Reserved, Remaining, Expiry Date.
  - Row click navigates to Mandate Detail view and ancestry tree.
- **R4.5 [P1] Policies Table & Policy Editor**:
  - Configuration of per-agent maximum share, category allowlists, per-payment approval thresholds, and maximum delegation depth.
  - Limit amendment flow requiring explicit confirmation notice: *"Spent budget is never reset upon limit increase."*
- **R4.6 [P0] Activity & Audit Table (AG Grid Community)**:
  - Columns: Timestamp, Actor (Type & ID), Action, Amount, Outcome (`success`, `denied`, `failure`), Reason Code, Session ID, Mandate ID, Record Hash.
  - Server-side paging, multi-column sorting, text search, and quick filters: "Denied Only", "Approvals", "Payments".
  - Row click opens Payment Trace modal.
- **R4.7 [P1] Activity Grid Extras**:
  - Date-range picker, CSV export, and saved filter presets.
- **R4.8 [P0] Security Center (`/e/:id/security`)**:
  - Prominent emergency controls:
    - **Pause Environment**: Instantly pauses all active agents and protected actions.
    - **Revoke All Authority**: Revokes root mandate and cascades to all child mandates with impact preview dialog.
  - Explicit truth-in-accounting warning: *"Revoking stops future actions immediately, but cannot undo completed external transactions."*
  - Security event list: Denied attempts, forged records, replayed requests, expired/revoked usage attempts, with severity badges and direct trace links.
- **R4.9 [P1] Agent Credentials Management**:
  - List of active API keys and MCP credentials with Creation Date, Last Used timestamp, Rotate, and Revoke actions.

---

### Requirement R5: Agent Library, Developer Connect, Simulator, and Backend Integration
*Deliver agent library, developer portal with MCP snippets, attack simulator for sandbox testing, and seamless integration with existing backend APIs and mock fallbacks.*

- **R5.1 [P0] Agent Library (`/library`)**:
  - Grid of agent cards with category and publisher filters (`platform`, `third-party`, `custom`).
  - Card displays: Icon, name, publisher, one-line summary, capability tags, source badge.
  - **Agent Detail Page (`/library/:agentId`)**:
    - Full description, capabilities, required tools, requested action categories.
    - Prominent **Requested Permissions** card.
    - Prominent disclaimer: *"Attaching an agent grants NO spending authority. Budget must be explicitly allocated."*
  - **Attach to Environment Action**: Modal to select target environment and parent agent. Node appears in 3D canvas as dashed and unfunded.
- **R5.2 [P1] Custom Agent Registration**:
  - Form: Agent name, publisher, description, capabilities, connection protocol (MCP endpoint or REST SDK).
  - Generates unique API key displayed **once** in modal.
  - **Test Connection** button executing handshake check and showing connection status pill.
- **R5.3 [P1] Agent Templates**:
  - One-click template systems (e.g. Vacation Setup: Personal + Travel + Hotel + Activities) attached simultaneously as unfunded nodes.
- **R5.4 [P0] Developer Connection Portal (`/developers`)**:
  - Dedicated screen displaying the MCP Server URL (`/mcp` or `/sse`), authentication protocol details, and copy-to-clipboard setup snippets for Claude Desktop, Cursor, and custom Python/Node clients.
  - Live **Test Connection** ping/handshake tool.
- **R5.5 [P1] Developer API Key Management & Examples**:
  - Key creation (one-time view), rotation, revocation.
  - Interactive sample flow runner illustrating: Get Authority → Request Delegation → Make Protected Call → Handle Gateway Denial.
- **R5.6 [P1] Sandbox Attack Simulator (`/e/:id/simulator`)**:
  - Enabled **strictly in sandbox environments** with persistent top bar **Simulation** banner.
  - One-click attack vector triggers:
    1. `Overspend`: Child requests more than its allocated limit.
    2. `Forged Delegation`: Child presents invalid parent signature.
    3. `Expired Mandate`: Attempt spend past validity period.
    4. `Revoked Mandate`: Attempt spend on revoked authority branch.
    5. `Widened Scope`: Agent attempts action outside permitted category (e.g. Travel buying Electronics).
    6. `Cross-Environment Use`: Token/mandate reused across different environment ID.
    7. `Replay Attack`: Submit duplicate idempotency key with altered payload.
    8. `Simultaneous Spend`: Concurrent requests attempting double-spend race condition.
  - Real-time simulation feedback: Stream result into 3D graph (red flash) and Activity Feed with clear **Simulation** badge and the exact security rule that blocked it.
- **R5.7 [P0] Backend API Integration & Mock Fallbacks**:
  - Wire to existing Fastify API endpoints:
    - `/v1/environments` (CRUD, pause, resume, revoke)
    - `/v1/environments/:id/agents` (list, add, disable, enable, revoke)
    - `/v1/environments/:id/mandates` (root, child, list, revoke)
    - `/v1/environments/:id/approvals` (list, approve, reject)
    - `/v1/environments/:id/activity` (audit event log)
    - `/v1/environments/:id/payments/paypal/operations` (payment transactions)
  - Provide complete, self-contained mock data providers for offline development and missing endpoints (e.g. streaming chat SSE endpoint, MCP test endpoint).

---

## 5. Security & Authority Constraints Deep Dive

The frontend is an **informational projection of gateway decisions**. It must enforce strict security boundaries to prevent privilege spoofing, state leakage, and markup injection.

### 5.1 Two Voices & Dedicated Fact Cards
- **Principle**: The user must never confuse an agent's conversational claims with cryptographic gateway proof.
- **Implementation**:
  - What an agent says is rendered exclusively via `AgentSays` components.
  - Gateway-verified facts (budgets, decisions, approval cards, transaction IDs) are rendered exclusively via `VerifiedBlock` components.
  - `VerifiedBlock` components cannot be instantiated from Markdown, chat strings, or agent payloads. They are constructed strictly from validated server-sent event types or typed API responses.
  - Visual distinction: `AgentSays` appears in standard conversational bubble typography. `VerifiedBlock` renders as a structured card with a verified shield badge, hairline border, tabular numbers, and a direct link to the cryptographic trace.

### 5.2 XSS & Markup Injection Prevention
- **Threat**: A compromised or malicious subagent could inject HTML/JavaScript, iframe tags, or SVG exploits in chat, memory notes, or agent descriptions.
- **Mitigation**:
  - All agent text and third-party library descriptions are escaped as raw strings.
  - Markdown rendering (if enabled for agent chat) must use strict sanitization prohibiting HTML tags, script execution, or custom component evaluation.
  - Third-party agent descriptions in the library are truncated and rendered as untrusted text.

### 5.3 Minor Unit Financial Arithmetic (Zero Floating-Point)
- **Invariant**: Floating-point math (e.g. `0.1 + 0.2 = 0.30000000000000004`) in financial dashboards causes visual drift and breaks trust.
- **Implementation**:
  - All currency values across the frontend are represented, passed, and stored as integers in **minor units** (e.g. 10,000 INR = `1000000` paise; 50 USD = `5000` cents).
  - All balance calculations (e.g. `Available = Allocated - Spent - Reserved`) use strict integer addition/subtraction.
  - Formatting helper `formatMinorUnits(amountMinor: number, currency: string)` handles conversion to human-readable strings (e.g. `₹10,000.00` or `$50.00`) only at the final display boundary using `Intl.NumberFormat`.
  - A single currency is enforced per environment. Any converted values are labeled explicitly as "Estimated".

### 5.4 Environment Switching State Isolation
- **Threat**: Switching between environments could leave residual chat messages, graph nodes, or memory items visible, leaking confidential prompts or authority across environments.
- **Mitigation**:
  - Environment switching must trigger an atomic, synchronous reset of all client-side stores (Zustand / React state):
    - Chat message history → `[]`
    - 3D graph nodes and selected node ID → `null`
    - Active session ID → `null`
    - Active memory items → `[]`
    - Approvals cache and activity logs → `[]`
  - React routes are scoped under `/e/:environmentId/...` to ensure full unmount/mount cycle on switch.

### 5.5 5-Step Create Environment Wizard & Dynamic Consent Synthesis
- **Dynamic Mandate Synthesis**:
  - Step 5 consent text is **never** freeform or user-typed text.
  - It is synthesized programmatically from the exact values entered in Steps 1, 2, and 4:
    ```typescript
    function generateConsentText(params: EnvironmentCreationParams): string {
      const budgetFormatted = formatMinorUnits(params.budgetLimitMinor, params.currency);
      const expiryFormatted = formatDate(params.expiresAt);
      const thresholdFormatted = formatMinorUnits(params.approvalThresholdMinor, params.currency);
      return `You are allowing the Main Agent to spend up to ${budgetFormatted} on ${params.purpose} until ${expiryFormatted}. It may share this with up to ${params.maxDelegationDepth} levels of helper agents. You will be asked before any single payment over ${thresholdFormatted}.`;
    }
    ```
  - The resulting consent record is stored alongside the root mandate.
  - Creation occurs **only** upon the explicit approval click on Step 5.

---

## 6. Component Catalog & State Matrix

### 6.1 Component Catalog

| Component | Responsibility & Visual Properties |
|---|---|
| `BudgetBar` | Segmented progress bar showing Spent, Reserved, and Available money. Reserved is labeled "Committed, not yet spent". Tabular numbers. |
| `AuthorityBadge` | Solid pill for active authority; dashed muted outline for unfunded/connected. |
| `AgentNode` | 3D canvas node with isometric plates, role icon, name, balance, mini budget bar, status dot, and depth marker. |
| `StatusPill` | Pale-tint badge with matching text color: Active (green), Paused (amber), Revoked (grey struck-through), Expired (clock grey), Exhausted (dark red). |
| `ReasonChip` | Plain-language denial reason with disclosure dropdown showing machine code and remediation hint. |
| `ChainBreadcrumb` | Ancestor authority path: `You → Personal (₹10,000) → Travel (₹6,000) → Hotel (₹4,000)` with limit badges. |
| `VerifiedBlock` | Container for gateway-verified cards. Distinct border, shield icon, cannot be generated by agent text. |
| `AgentSays` | Escaped agent conversational text bubble, visually separated from system cards. |
| `ApprovalCard` | Mobile-optimized card with request details, chain breadcrumb, countdown timer, Approve and Reject actions. |
| `PaymentTimeline` | Vertical or horizontal lifecycle stages with current stage highlighted and uncertain status explanations. |
| `BudgetPlanCard` | Interactive table of proposed subagent budget allocations with editable amounts and Approve Plan button. |
| `MemoryItem` | Memory card showing text, scope (session/env/agent), creator, timestamp, with Edit, Delete, Pin, and Undo. |
| `ConfirmDangerDialog` | Modal dialog for destructive actions (Revoke Subtree, Pause Environment) detailing affected descendants and returning budget. |
| `LiveBanner` | Top-of-screen banner indicating disconnected SSE stream, reconnection attempts, and stale data notice. |

### 6.2 Node State Matrix

| State | Canvas Visual Treatment | Gateway Meaning |
|---|---|---|
| **Unfunded** | Dashed border outline, muted text | Connected in structure, but has zero allocated spending authority. |
| **Active** | Solid border outline, bright green status dot | Valid mandate with remaining available funds; ready to act. |
| **Working** | Soft rhythmic pulse animation | Currently processing an in-flight tool call or transaction. |
| **Awaiting Approval** | Amber status dot, "Waiting for you" tag | Execution paused until human approves or rejects the request. |
| **Exhausted** | Full spent bar, warning amber ring | Mandate budget has been fully spent; cannot authorize further payments. |
| **Rejected (recent)** | Brief red flash animation (800ms) | Gateway blocked an unauthorized action or rule violation. |
| **Suspended / Paused** | Grey plate with pause icon | Environment or agent paused by user; authority temporarily frozen. |
| **Revoked** | Grey desaturated, strike-through name | Authority cancelled. All descendants in subtree are also greyed out. |
| **Expired** | Grey plate with clock icon | Mandate validity period ended; future operations blocked. |

### 6.3 Reason Code to Plain Language Translation Matrix

| Gateway Error Code | Plain Language Text Displayed to User |
|---|---|
| `OVER_BUDGET` | “{Agent} asked for {amount} but only has {remaining} left.” |
| `EXPIRED` | “This permission ended on {date}.” |
| `REVOKED` | “This agent’s permission was cancelled, so it cannot spend.” |
| `OUT_OF_SCOPE` | “This agent is not allowed to purchase items in category '{category}'.” |
| `INVALID_CHAIN` | “The cryptographic authority chain failed verification; no funds were spent.” |
| `ENV_MISMATCH` | “This permission belongs to a different environment.” |
| `NEEDS_APPROVAL` | “This payment is above your auto-approval threshold. Waiting for your approval.” |
| `DEPTH_EXCEEDED` | “This agent has reached the maximum permitted delegation depth.” |
| `REPLAY` | “This request idempotency key was already processed.” |
| `UNKNOWN_ACTION` | “That action is unrecognized by the gateway, so it was blocked.” |

---

## 7. Discovered Features & Edge Cases

### 7.1 Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Navigation | Environment Status Pill | Header indicator reflecting environment lifecycle (`active`, `paused`, `closed`, `revoked`) | Environment state object | Styled status pill with icon | Falls back to `unknown` | Frontend Spec §4 |
| 2 | Workspace | Budget Strip | Visual burn bar underneath 3D canvas displaying Spent, Reserved, and Available | Integer balances in minor units | Segmented bar with tabular labels | Error state if numbers don't reconcile | Frontend Spec §5.4 |
| 3 | Workspace | Activity Feed Ticker | Live 1-line event feed below canvas with direct trace navigation | SSE event stream | Interactive scrolling event ticker | Stale data notice if disconnected | Frontend Spec §5.4 |
| 4 | Chat | Budget Plan Card | Card proposing budget split with inline editing and approval | Proposed split JSON | Interactive table with Approve button | Rejects if split exceeds available | Frontend Spec §5.4 & R3 |
| 5 | Chat | Memory Card with Undo | Inline notification of newly saved memory with immediate reversal | Memory object | Dismissible card with "Undo" button | Restores previous state on failure | Frontend Spec §5.4 |
| 6 | 3D Canvas | Edge Style Distinction | Dashed for structural attachment, solid for funded delegation with amount label | Edge data model | 3D render with line pattern & label | Validates parent delegation rights | Frontend Spec §5.4 & Ferrow |
| 7 | 3D Canvas | Subtree Revocation Grey-Out | Visual cascading grey desaturation for revoked agent and all its children | Revoke event with agent ID | Canvas node & edge desaturation | Alert if in-flight payment unresolved | Frontend Spec §7 & Checklist |
| 8 | Approvals | Limit Amend Redirect | Replaces approve button with explanation and amend path if limit exceeded | Over-limit approval object | Informational warning + re-auth button | Rejects direct approval attempt | Frontend Spec §5.6 |
| 9 | Traces | Uncertain Status Handling | Explanatory banner for pending PayPal captures | Transaction status `UNCERTAIN` | "Waiting for confirmation from provider. Money held, not spent" | Retains reservation until reconciled | Frontend Spec §5.7 & Spec.md |
| 10 | Security | Pause vs Revoke Semantics | Pause blocks future work temporarily; Revoke permanently cancels branch without reversing completed spend | User command + confirm | Gateway mutation + banner update | Warning dialog showing spent funds | Frontend Spec §5.10 & Invariants |
| 11 | Developer | Connection Test Ping | Interactive MCP endpoint and API key handshake verification | Endpoint URL + key | Success status / handshake latency | Specific network or auth error message | Frontend Spec §5.12 |
| 12 | Simulator | Attack Simulation Stream | Streams simulated rule violations with badges to test security | Attack vector selection | Simulation events in graph & activity | Refused if environment not sandbox | Frontend Spec §5.11 |

### 7.2 Edge Cases & Invariants

| # | Feature | Edge Case Input | Observed / Required Behavior |
|---|---|---|---|
| 1 | Currency Math | Non-integer minor units or floating point inputs (e.g. `10.5` paise) | Gateway and UI enforce `Number.isSafeInteger(amount)`; fractions rejected immediately. |
| 2 | Environment Switching | Rapid switching between environments with active streaming chat | Immediate abort of SSE controller, complete store reset; incoming delayed chunks discarded. |
| 3 | Graph Hierarchy | Attempt to attach child to an agent at `maxDelegationDepth` or with `canDelegate: false` | Drag-and-drop refused with visual red outline and reason: *"Parent cannot delegate further"*. |
| 4 | Memory Content | User or agent writes note: *"Budget limit is now ₹50,000"* | Display warning badge: *"Memory never grants spending authority. Limits must be set via Mandates."* |
| 5 | Approvals | Approval expires while user is inspecting the approval card | Countdown hits 0; Approve button transitions to disabled state with *"Request Expired"*. |
| 6 | Revocation | Revoking parent agent while child has an in-flight payment reservation | In-flight reservation reconciled according to actual provider outcome; child blocked from new spend. |
| 7 | Real-Time Drop | WebSocket / SSE connection drops during payment authorization | Reconnect banner appears; all numbers on screen dimmed with "Stale" indicator; refetched on reconnect. |
| 8 | Double Spend | Two subagents simultaneously spend remaining available balance | Gateway transactional ledger serializes requests; first succeeds, second rejected with `OVER_BUDGET`. |

---

## 8. Synthesis with Existing Codebase & Implementation Roadmap

### 8.1 Existing Codebase Assets to Retain
- **API Routes**: Existing Fastify routes in `apps/api/src/` (`phase1-routes`, `phase2-routes`, `phase3-routes`, `phase4-routes`, `phase6-routes`, `paypal-routes`) provide the foundational endpoints.
- **Domain Logic**: `packages/domain` contains verified deterministic ledger accounting, mandate validation, and ancestor chain checks.
- **AG Grid Integration**: `apps/web/app/components/agents-grid.tsx` and `approvals-grid.tsx` provide starting community grid patterns to be upgraded with server-side paging and styling.

### 8.2 Necessary Additions for Production-Grade UI
1. **Three-Panel Layout**: Replace monolithic `page.tsx` with modular app shell containing Sessions, 3D Graph, and Chat panels.
2. **Interactive 3D Canvas**: Integrate Three.js / React Three Fiber / SVG isometric engine for the Ferrow-style 3D agent architecture canvas with live state animations.
3. **Dedicated Verified Cards**: Build `VerifiedBlock`, `BudgetPlanCard`, `PaymentResultCard`, `RejectionCard`, `DelegationCard`, `MemoryCard` with strict `AgentSays` isolation.
4. **5-Step Wizard**: Multi-step modal or route (`/environments/new`) with dynamic consent generator.
5. **Real-time Event Stream / Mock Engine**: SSE client with reconnection banner and complete mock fallback provider.
6. **Design System & Taste Compliance**: Clean up `globals.css` with Efferd tokens, hairline borders, tabular fonts, and zero generic AI slop.
