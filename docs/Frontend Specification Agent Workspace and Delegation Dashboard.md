# Frontend Specification: Agent Workspace and Delegation Dashboard

*What the user sees, clicks and trusts. It covers the workspace (main-agent chat, sessions, memory, agent graph), the agent library, and every screen that makes delegated authority visible.*

## 1. The idea in plain words

A user creates an environment for something they care about, say a Goa trip with a ₹10,000 budget. The moment it exists, they have a main agent to talk to, with no setup. From an agent library they can attach more agents (travel, hotel, shopping, or their own) and shape the whole system as a graph they can see and edit. Behind the scenes a delegation engine decides who may spend what, so the user can let the system work without handing it a blank cheque.

The frontend has one job: **make invisible authority visible**. Nobody can see signatures or ledger checks, so the screens must show money flowing down a tree, narrowing at each step, and being stopped when it shouldn’t pass.

| Layer | What the user sees |
| --- | --- |
| Workspace | Main-agent chat, sessions, memory and the agent graph. |
| Library | Prebuilt agents and the user’s own custom agents to attach. |
| Delegation engine | Budgets, approvals, revocation, trace and audit, shown through the workspace. |

### Design principles

1. **Authority is visible.** A solid node has authority. A dashed node is connected but has none.
2. **Two voices.** What an agent says (a chat message) looks different from what the gateway verified (budgets, decisions, traces). Gateway facts are rendered only by dedicated components that agent text can never produce, so an agent cannot fake a “payment approved” card.
3. **The UI never enforces security.** It displays gateway decisions. Money and authority are never updated optimistically.
4. **Plain language first.** Technical detail (raw mandate, hashes, JSON) is one click away, never the default.
5. **One environment at a time**, always labeled. Data from two environments never appears on one screen.
6. **Calm by default, loud when it matters.** Approvals, rejections and revocations get strong visual weight. Routine activity does not.

## 2. Key user journeys

- **J1 Create and fund.** Create an environment, set budget and expiry, review exactly what is being granted, approve.
- **J2 Build the system.** Attach agents from the library, ask the main agent to propose a budget split, approve or edit the plan.
- **J3 Work.** Chat in a session with the main agent while watching the graph react.
- **J4 Approve.** Receive an approval request (often on a phone), see the full details, approve or reject.
- **J5 Intervene.** Revoke one agent and its branch, or pause the whole environment.
- **J6 Investigate.** Open any payment and see who authorized it, step by step, up to the user’s own approval.
- **J7 Developer.** Connect an existing agent through MCP, register it, test the connection.

## 3. Sitemap

| Route | Screen |
| --- | --- |
| /login, /signup | Authentication |
| /environments | Environment list |
| /environments/new | Create-environment wizard |
| /e/:id | Workspace (chat, graph, sessions, memory) |
| /e/:id/s/:sessionId | Workspace focused on one session |
| /e/:id/approvals | Approval inbox |
| /e/:id/mandates | Mandates and policies |
| /e/:id/activity | Activity and audit |
| /e/:id/security | Security center |
| /e/:id/simulator | Attack simulator |
| /library, /library/:agentId | Agent library and agent detail |
| /developers | Connect an agent, keys, docs |
| /settings | Account and preferences |

## 4. App shell

**Top bar:** environment switcher, environment status pill (active, paused, closed, revoked), **Sandbox** badge, approvals bell with count, **Pause environment** button, user menu.

**Left navigation:** Workspace, Library, Approvals, Activity, Mandates, Security, Developers, Settings. Environment-scoped items are disabled until an environment is selected.

- &#91;P0\] The environment name is visible on every environment-scoped screen.
- &#91;P0\] Switching environments clears chat, graph and selection state so nothing leaks across.
- &#91;P0\] A paused or revoked environment shows a persistent banner, and every protected control is disabled with an explanation.
- &#91;P0\] A “Live updates paused, reconnecting” banner appears when the real-time connection drops, and data on screen is marked stale.

## 5. Screens

### 5.1 Authentication

- &#91;P0\] Sign up, log in, log out. Passkey preferred, with a fallback method. **\[OD-F2\]**
- &#91;P0\] Session expiry shows a clear prompt, not a blank page.
- &#91;P1\] Re-authentication before high-risk actions (revoke all, raise a limit, delete a credential).

### 5.2 Environment list

- &#91;P0\] Cards for each environment: name, purpose, status, total budget with a spent/reserved/available bar, expiry, number of agents, pending approvals.
- &#91;P0\] “New environment” button and templates (for example Vacation, Daily Budget).
- &#91;P1\] Closed and revoked environments are shown in a separate, collapsed section.
- &#91;P0\] Empty state explains what an environment is in one sentence and offers a template.

### 5.3 Create-environment wizard

Five short steps with a progress bar. Everything has a default, and nothing sensitive is enabled implicitly.

1. **Basics.** Name, purpose, optional template. A template pre-selects agents but funds none of them.
2. **Budget and time.** Total amount, currency, expiry date.
3. **Agents.** The main agent is created automatically and shown as already included. Optionally add agents from the library. They will start unfunded.
4. **Guardrails (optional).** Maximum share per agent, allowed categories, per-payment approval threshold, whether agents may delegate and how deeply. Collapsed by default, with sensible defaults.
5. **Review and approve.** A plain-language consent screen: “You are allowing the Main Agent to spend up to ₹10,000 on travel until 12 Nov. It may share this with up to 2 levels of helper agents. You will be asked before any single payment over ₹3,000.” Approve with a passkey or confirmation. The result is a stored consent record.

- &#91;P0\] Steps 1, 2, 5. \[P1\] Steps 3 and 4.
- &#91;P0\] The consent text is generated from the actual mandate values, never from free text.
- &#91;P0\] Creation happens only on the final explicit approve, never earlier.

### 5.4 Workspace (the main screen)

One screen, three panels, usable together.

```
┌───────────────┬──────────────────────────────┬───────────────────┐
│ Sessions      │  AGENT GRAPH                 │  CHAT             │
│ ▸ Plan Goa    │   You ₹10,000                │  Main Agent       │
│ ▸ Book hotel  │    └ Main Agent              │  “Plan my trip…”  │
│ + New session │       ├ Travel ₹4,000        │  ┌─────────────┐  │
│               │       ├ Hotel  ₹4,000        │  │ Budget plan │  │
│ Memory        │       └ + Attach agent       │  │ [Approve]   │  │
│ • window seat │  Budget · Activity feed      │  └─────────────┘  │
└───────────────┴──────────────────────────────┴───────────────────┘
```

**Budget strip** (under the graph): one bar split into spent, reserved and available, with the numbers. Reserved money is labeled “committed, not yet spent”.

**Activity feed** (under the graph): live one-line events with status icon, agent, amount and, for rejections, the plain-language reason. Clicking an event opens its trace (5.7).

#### Sessions panel

- &#91;P0\] List of sessions with title, status (active, waiting for you, done), and last activity. “New session” button.
- &#91;P0\] Selecting a session switches the chat. A new session starts clean and shows no history from other sessions.
- &#91;P1\] Rename, close, reopen, and search sessions.
- &#91;P1\] A session can reference another session’s output only through an explicit “Attach context” action.
- &#91;P0\] A session never shows or changes budget. Budget belongs to the environment and its mandates.

#### Chat panel

- &#91;P0\] The main agent is ready on environment creation. Streaming responses, stop button, retry.
- &#91;P0\] A target selector at the top of the chat: Main Agent by default, or any attached subagent chosen from the graph.
- &#91;P0\] Structured **cards** appear inline for gateway-verified events (see 6):
  - Budget plan card: a table of the proposed split with editable amounts, **Approve plan** and **Edit**.
  - Approval request card.
  - Payment result card with a status timeline.
  - Rejection card with the plain-language reason.
  - Delegation card (“Main Agent gave Hotel Agent ₹4,000”).
  - Memory card (“Saved: prefers window seat”) with Undo.
- &#91;P0\] Each card has “View trace” linking to 5.7.
- &#91;P0\] Agent-written text is always escaped, and visually separate from gateway cards.
- &#91;P1\] When the main agent is blocked waiting for approval, the chat shows “Waiting for you” with a shortcut to the approval.
- &#91;P2\] Voice input, file attachments.

#### Agent graph

An interactive canvas, and the main way to shape the multi-agent system.

- &#91;P0\] Tree layout: user at the top, then the main agent, then subagents, with automatic layout, zoom, pan and fit-to-screen.
- &#91;P0\] **Two kinds of edges.** A dashed line is an *attachment* (structure, no authority). A solid line labeled with an amount is a *delegation* (authority, with its allocation).
- &#91;P0\] **Node content:** icon, name, role, source badge (platform, third-party, custom), allocated, spent, reserved and remaining amounts, a mini budget bar, a status dot, and a depth marker.
- &#91;P0\] **Attach:** drag an agent from the library drawer onto the canvas and drop it on a parent, or use “Attach agent” on a node. The new node appears dashed and unfunded. If the parent cannot have children (depth limit or no delegation right), the drop is refused with a reason.
- &#91;P0\] **Detach:** remove an unfunded node directly. Removing a funded node requires confirmation and shows what happens to its unspent budget.
- &#91;P0\] **Select a node** to open the detail drawer (below).
- &#91;P1\] Collapse and expand subtrees, search for a node, minimap.
- &#91;P1\] Toggle views: “Structure” (attachments), “Authority” (delegations and amounts), or both.
- &#91;P1\] Re-parent by dragging a node to a new parent, which goes through the same validation as a new attachment.
- &#91;P0\] **Live animation:** a budget slice flows down an edge on delegation, a node pulses on payment, flashes red on rejection, and a revoked branch turns grey immediately. Honors reduced-motion settings.
- &#91;P0\] A **List view** toggle shows the same hierarchy as a nested, keyboard-friendly list.
- &#91;P2\] Replay: scrub through the environment’s history and watch the tree evolve.

#### Node detail drawer

Tabs: **Overview** (role, source, status), **Authority** (limit, scope, tools, expiry, delegation rights, parent), **Activity** (this agent’s events), **Chat** (talk to this agent directly), **Settings** (configured agents only: role, allowed tools).

Actions: Chat, Ask main agent to allocate budget, Edit guardrail, Disable, Revoke (with a preview of every descendant affected), Detach.

- &#91;P0\] Authority tab values come only from the gateway.
- &#91;P0\] Revoke shows the subtree and the budget that will return to the parent, and requires confirmation.

#### Memory panel

- &#91;P0\] Three tabs: **Session**, **Environment**, **Agent**.
  - Session memory: the current task’s notes and summary.
  - Environment memory: durable facts and preferences for this purpose (for example “prefers morning flights”).
  - Agent memory: notes a specific agent keeps for its role, visible to the user.
- &#91;P0\] Each item shows its text, which session or agent created it, and when. Users can edit, delete and pin items.
- &#91;P0\] A fixed notice: “Memory never grants spending permission.” Memory text that tries to set limits has no effect, and the UI says so when it detects such a note.
- &#91;P1\] Per-environment memory on/off switch, “clear all”, export.
- &#91;P1\] Undo for memory changes the agent made.

### 5.5 Library

- &#91;P0\] Grid of agent cards with search and filters (category, source: platform, third-party, custom). Each card shows name, publisher, one-line purpose, capabilities and a source badge.
- &#91;P0\] **Agent detail page:** description, capabilities, tools it needs, action categories it asks permission for, version, publisher. A clearly labeled **Requested permissions** block. A note that attaching grants no money.
- &#91;P0\] **Attach to environment:** choose the environment and the parent, and the agent appears unfunded in the graph.
- &#91;P1\] Templates: preset systems (for example Vacation: Main, Travel, Hotel, Shopping) attached in one click, all unfunded.
- &#91;P1\] **Register custom agent:** form for name, publisher, description, capabilities, connection method (MCP endpoint or SDK), a generated key shown once, a “Test connection” button and a connection status badge.
- &#91;P1\] Enable, disable and remove attached add-ons from the library.
- &#91;P0\] Third-party descriptions are escaped and truncated, and treated as untrusted.

### 5.6 Approval inbox

- &#91;P0\] List of pending, approved, rejected and expired requests, with a nav badge for pending.
- &#91;P0\] **Approval card:** which agent is asking and its chain (You → Main → Hotel), what for, amount, currency, merchant or recipient, remaining budget after payment, and time left. The agent’s stated reason appears in a separate block labeled “Agent says”.
- &#91;P0\] Approve and Reject buttons. An approval is shown as bound to these exact details.
- &#91;P0\] If the request exceeds a hard limit, the buttons are replaced by an explanation and an “Amend limit” path (a separate, re-authenticated flow).
- &#91;P0\] Mobile-first layout, since approving on a phone is a core use.
- &#91;P1\] Optional notification channel for new approvals. **\[OD-F5\]**

### 5.7 Payment trace (“Why was this allowed?”)

- &#91;P0\] A timeline of stages: Requested, Authorized by gateway, Sent to provider, Provider accepted, Completed (or Failed, or Uncertain).
- &#91;P0\] The chain, drawn vertically with the limit and remaining amount at each level.
- &#91;P0\] A checklist of what the gateway verified: signatures valid, within parent’s limits, not expired, not revoked, in scope, budget available at every level, approval attached (if needed).
- &#91;P0\] For a rejection, the failed check is highlighted with the plain-language reason and a hint for what the user can do.
- &#91;P1\] “Show raw record” toggle for developers (mandate IDs, hashes, JSON).
- &#91;P0\] An **Uncertain** payment is shown clearly as “Waiting for confirmation from PayPal. The money is held, not spent.”

### 5.8 Mandates and policies

- &#91;P0\] AG Grid of mandates: holder, parent, state, limit, spent, reserved, remaining, expiry. Row click opens the mandate detail with its chain.
- &#91;P1\] Policy editor: maximum share per agent, category allowlist, per-payment approval threshold, delegation depth, expiry.
- &#91;P1\] Amendments (raising a limit, extending expiry) go through a confirmation and re-authentication, and create a new consent record. The screen states that spent budget is never reset.

### 5.9 Activity and audit

- &#91;P0\] AG Grid with columns: time, actor, action, amount, outcome, reason, session, mandate, record ID. Sorting, filtering, pagination, column management, quick filters (Denied only, Approvals, Payments) and text search.
- &#91;P0\] Row click opens the trace (5.7).
- &#91;P1\] Export to CSV, saved filters, a date-range picker.
- &#91;P0\] Handles large histories through server-side paging.

### 5.10 Security center

- &#91;P0\] A prominent **Pause environment** button and **Revoke all authority** with a confirmation.
- &#91;P0\] Security events list (denied attempts, forged or altered records, replays, expired or revoked use) with severity and links to traces.
- &#91;P1\] Credentials list for agents with created date, last used, Rotate and Revoke.
- &#91;P0\] Clear explanation that revoking stops future actions but does not undo payments already completed.

### 5.11 Attack simulator and simulation mode

- &#91;P1\] Only in sandbox environments. A panel with buttons: overspend, forged delegation, expired mandate, revoked mandate, widened scope, cross-environment use, replay, and simultaneous spend.
- &#91;P1\] Each run streams its result into the graph and feed, with the exact rule that blocked it.
- &#91;P1\] A **Simulation** badge on everything it produces, and a clear note that no real payment is made.

### 5.12 Developers

- &#91;P0\] MCP server URL, authentication method, and copy-paste setup snippets for common clients.
- &#91;P0\] **Test connection** button showing a handshake result.
- &#91;P1\] API keys: create (shown once), rotate, revoke, last used.
- &#91;P1\] Links to the API reference and generated SDKs, and an example workflow runner showing: get authority, request delegation, make a protected call, handle a rejection.

### 5.13 Settings

- &#91;P0\] Profile, sign-out of other sessions.
- &#91;P1\] Notification preferences, theme (light, dark, system), data export and account deletion.

## 6. Component catalog

| Component | Purpose |
| --- | --- |
| BudgetBar | Spent, reserved, available as one segmented bar with labels. |
| AuthorityBadge | Solid or dashed marker: has authority or not. |
| AgentNode | Graph node with amounts, status dot and source badge. |
| StatusPill | Active, paused, revoked, expired, exhausted, pending. |
| ReasonChip | Plain-language denial reason with an expandable “why”. |
| ChainBreadcrumb | You → Main → Hotel with limits at each level. |
| VerifiedBlock | Gateway-verified facts. Cannot be generated from agent text. |
| AgentSays | Escaped agent text, visually distinct from VerifiedBlock. |
| ApprovalCard | Request details with Approve and Reject. |
| PaymentTimeline | The lifecycle stages with the current one highlighted. |
| BudgetPlanCard | Editable proposed split with Approve plan. |
| MemoryItem | Memory text, source, edit, delete, pin. |
| ConfirmDangerDialog | Revoke, pause and amend confirmations, with impact preview. |
| LiveBanner | Reconnecting and stale-data states. |

## 7. State and copy mapping

### Node states

| State | Look | Meaning |
| --- | --- | --- |
| Unfunded | Dashed outline, muted | Attached but has no authority. |
| Active | Solid outline, green dot | Has authority and can act. |
| Working | Soft pulse | Handling a request. |
| Awaiting approval | Amber dot | Blocked until the user decides. |
| Exhausted | Full spent bar | No remaining budget. |
| Rejected (recent) | Brief red flash | The gateway refused a request. |
| Suspended or paused | Grey with pause icon | Authority temporarily blocked. |
| Revoked | Grey, struck through | Authority cancelled. Descendants also grey. |
| Expired | Grey with clock icon | Validity period ended. |

Color is never the only signal: every state also has an icon and a text label.

### Reason codes to plain language

| Code | What the user reads |
| --- | --- |
| OVER\_BUDGET | “Hotel Agent asked for ₹5,000 but only has ₹200 left.” |
| EXPIRED | “This permission ended on 12 Nov.” |
| REVOKED | “This agent’s permission was cancelled, so it can’t spend.” |
| OUT\_OF\_SCOPE | “This agent isn’t allowed to buy electronics.” |
| INVALID\_CHAIN | “The permission record didn’t check out, so nothing was spent.” |
| ENV\_MISMATCH | “This permission belongs to a different environment.” |
| NEEDS\_APPROVAL | “This payment is above your approval limit. Waiting for you.” |
| DEPTH\_EXCEEDED | “This agent isn’t allowed to pass permission on to other agents.” |
| REPLAY | “This request was already processed.” |
| UNKNOWN\_ACTION | “That action isn’t recognized, so it was blocked.” |

## 8. Real-time behavior

- &#91;P0\] A single event stream per environment drives the graph, feed, budget bar, approvals badge and chat cards.
- &#91;P0\] Events handled: mandate created, delegation created, agent attached or detached, payment requested, authorized, denied, submitted, completed, failed, uncertain, approval requested and resolved, revocation, session updated, memory updated, security alert.
- &#91;P0\] Authority and money are updated only from confirmed gateway events. Cosmetic state (node positions, panel sizes, drafts) may update immediately.
- &#91;P0\] On reconnect the client refetches current state, so it cannot show a stale tree as current.
- &#91;P0\] Updates appear within about one second.

## 9. Cross-cutting requirements

**Security**

- **FE-S1** \[P0\] No payment credentials, provider secrets or signing keys ever reach the browser. Session tokens use secure, HttpOnly cookies, with CSRF protection.
- **FE-S2** \[P0\] All agent-supplied and third-party text is escaped and cannot render as a gateway component or inject markup.
- **FE-S3** \[P0\] High-impact actions (revoke all, amend limits, delete credentials) require confirmation with an impact preview. \[P1\] They also require re-authentication.
- **FE-S4** \[P0\] Keys and tokens are shown once on creation and never again.

**Money display**

- **FE-M1** \[P0\] Amounts are handled as integers in minor units and formatted with the currency symbol. No floating-point arithmetic in the UI.
- **FE-M2** \[P0\] One currency per environment is shown everywhere. Any converted display value is labeled as an estimate.

**Usability and accessibility**

- **FE-U1** \[P0\] Desktop-first three-panel layout. \[P1\] On tablet, two panels with tabs. On mobile, tabs for Chat, Graph and Activity, with a read-only graph and tap-for-details. Approvals are fully usable on mobile.
- **FE-U2** \[P1\] WCAG 2.1 AA target: keyboard navigation of the graph (arrow keys between nodes, Enter to open), visible focus, sufficient contrast, ARIA live region for the activity feed, and the list view as an alternative to the canvas.
- **FE-U3** \[P0\] Loading skeletons, empty states with a next step, and error states with retry on every screen.
- **FE-U4** \[P1\] Light and dark themes, and reduced-motion support.

**Performance**

- **FE-P1** \[P0\] Graph stays smooth with at least 50 nodes. \[P1\] It stays usable with 200 by collapsing subtrees.
- **FE-P2** \[P0\] Tables page through server-side data and remain responsive with large histories.
- **FE-P3** \[P0\] Initial workspace load under 3 seconds on a typical connection.

**Quality**

- **FE-Q1** \[P0\] Component tests for the money and authority components, and end-to-end tests for: create environment, attach agent, approve plan, payment success, payment rejection, revoke subtree, approval flow.
- **FE-Q2** \[P0\] The client uses a typed API client generated from the OpenAPI description, so frontend and gateway contracts cannot drift.

## 10. Suggested stack

| Need | Choice |
| --- | --- |
| App framework | Next.js with TypeScript |
| Styling and components | Tailwind CSS with shadcn/ui |
| Agent graph | React Flow |
| Tables | AG Grid (Community edition unless Enterprise features are needed) |
| Server state | TanStack Query |
| UI state | Zustand |
| Real-time and chat streaming | Server-sent events, with polling fallback |
| API client | Generated from the OpenAPI description (APIMatic SDK) |
| Auth | Passkeys (WebAuthn) with secure cookie sessions |
| Testing | Vitest for units, Playwright for end-to-end |

## 11. MVP cut and build order

**Build first (P0):** app shell, auth, create-environment wizard (basics, budget, review), workspace with chat, graph, budget bar, activity feed and sessions, approval inbox, payment trace, activity grid, revoke and pause, library browse and attach, basic memory, developer connect page.

**Then (P1):** wizard agents and guardrails, mandates and policies, custom agent registration, templates, attack simulator, graph search and views, memory extras, mobile polish.

**Later (P2):** replay, voice and attachments, advanced notifications.

Order: shell and design tokens, then graph and BudgetBar with fake data, then chat cards, then wire the event stream, then approvals and trace, then the rest.

## 12. Demo flow mapped to screens

1. Create an environment with the wizard and approve the consent screen (5.3).
2. In the workspace, tell the main agent the goal and watch it propose a budget plan card (5.4).
3. Approve the plan and watch budget slices flow down the graph.
4. Attach another agent from the library and note that it is dashed and unfunded.
5. Payments succeed. Open one and show “Why was this allowed?” (5.7).
6. Run an attack from the simulator and watch the red rejection with a plain reason (5.11).
7. Approve a high-value payment from the approval inbox on a phone (5.6).
8. Revoke an agent and watch its whole branch go grey (5.4).
9. Close on the Developers page: the MCP URL and the test-connection result (5.12).

## 13. Open frontend decisions

| ID | Question | Recommended default |
| --- | --- | --- |
| OD-F1 | Can users chat directly with a subagent, or only with the main agent? | Allow it, with every spend still going through the same gateway rules. |
| OD-F2 | Which sign-in methods? | Passkey plus email link or password fallback. |
| OD-F3 | Can users edit a library agent’s role and tools? | Configured agents yes (P1). Platform agents read-only. |
| OD-F4 | How much memory is exposed? | All of it, editable. Nothing hidden from the user. |
| OD-F5 | How are approval requests delivered? | Dashboard inbox first. Email or workflow-tool notification later. |
| OD-F6 | Mobile scope for the first release? | Approvals and read-only graph and feed. |
| OD-F7 | AG Grid edition and which features are needed? | Community edition for all tables, with paging driven by the server. |
| OD-F8 | Real-time transport. | Server-sent events, since updates flow one way. |
