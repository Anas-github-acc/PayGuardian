# Frontend Audit Report: Screens 1 through 7
**Auditor**: `explorer_frontend_1_7`  
**Repository**: `/home/anas/myspace/AI/PayGuardian`  
**Frontend Scope**: Next.js App (`apps/web`)  
**Target Screens**:
1. Workspace graph
2. Budget strip
3. Activity feed
4. Chat
5. Sessions
6. Memory
7. Library

---

## Executive Summary

An exhaustive codebase audit was conducted across the Next.js frontend (`apps/web`), the backend API contracts (`packages/contracts`), the Fastify service (`apps/api`), and the Python Agent Runtime (`apps/agent-runtime`).

For Screens 1 through 7, the frontend currently relies heavily on client-side simulation, static fixtures, synthetic timers, and hardcoded in-memory state mutations. While the application presents a high-fidelity visual experience with 3D Three.js canvas rendering, animated SVG signal pipelines, and interactive cards, **none of the 7 screens are currently connected to real backend APIs**. 

Specifically:
- **Workspace Graph (Screen 1)**: Renders static 5-node/4-edge fixtures (`DEFAULT_GRAPH_NODES`, `DEFAULT_GRAPH_EDGES`) with fake ticker intervals (2800ms) and fake incrementing workflow counters (7200ms). Agent revocation is simulated purely in local client-side state.
- **Budget Strip (Screen 2)**: Fallbacks to hardcoded USD $10,000.00 limits with $2,450.00 spent and $1,500.00 reserved. Spend velocity and authority by agent are driven by static 7-day mock arrays (`SPEND_SERIES`, `AGENT_AUTHORITY`).
- **Activity Feed (Screen 3)**: Micro-feed and recent activity panels use 4 mock events (`INITIAL_ACTIVITIES`). One panel completely hardcodes 3 specific transaction buttons directly in JSX.
- **Chat (Screen 4)**: Chat interaction is 100% simulated with client-side keyword matching ("allocate", "pay", "hotel", "remember") and a `setTimeout(..., 900)` timer that injects synthetic VerifiedBlock cards (budget plans, PayPal payments, policy rejections, and memory cards).
- **Sessions (Screen 5)**: Renders 3 mock sessions (`INITIAL_SESSIONS`). New sessions are generated with `Date.now()` without backend API calls, and selecting a session does not retrieve previous chat history.
- **Memory (Screen 6)**: Renders 3 mock memories (`INITIAL_MEMORIES`). The "Undo / Forget" action merely sets a local `isRevoked: true` boolean in React state. No Memory entity or table exists anywhere in the backend database or contracts.
- **Library (Screen 7)**: Catalogs 6 pre-audited specialist agents (`CATALOG_AGENTS`). The "Attach Agent" modal calculates fake 3D trigonometric positions and pushes nodes directly into the client-side store without calling the backend.

---

## 1. Component & Route Mapping

Below is the mapping of every route, page, component, custom hook, and state store driving Screens 1 through 7.

| Screen # | Screen Name | Route / Path | Primary Component(s) | Subcomponents & Modals | Hooks & State Stores |
|---|---|---|---|---|---|
| **1** | **Workspace graph** | `/dashboard?tab=workspace` | `WorkspaceLayout` (`apps/web/components/workspace/workspace-layout.tsx`) | `DelegationTopology`<br>`PipelineSvg`<br>`AgentNetworkCanvas` (Three.js)<br>`AgentNetworkListView`<br>`NodeDetailDrawer`<br>`AgentInspector`<br>`PipelineTicker`<br>`PipelineStats` | `useWorkspaceStore`<br>`workspaceStore.setGraphData`<br>`workspaceStore.setSelectedNodeId`<br>`workspaceStore.attachAgent` |
| **2** | **Budget strip** | `/dashboard?tab=workspace`<br>`/dashboard` (overview) | `BudgetStrip` (`apps/web/components/workspace/budget-strip.tsx`)<br>`KpiStrip` (`apps/web/components/workspace/kpi-strip.tsx`) | `Overview` StatCards (`apps/web/components/dashboard/overview.tsx`)<br>`AuthorityBars`<br>`SpendChart` | `useWorkspaceStore`<br>`currentEnvironment` (`budgetLimitMinor`, `spentMinor`, `reservedMinor`)<br>`formatMinorUnits`<br>`calculateAvailableMinor` |
| **3** | **Activity feed** | `/dashboard?tab=workspace`<br>`/dashboard` (overview) | `RecentActivityPanel` (`apps/web/components/workspace/recent-activity-panel.tsx`)<br>`ActivityMicroFeed` (`apps/web/components/workspace/activity-micro-feed.tsx`) | `Overview` Recent protected actions table (`apps/web/components/dashboard/overview.tsx`) | `useWorkspaceStore`<br>`workspaceStore.setSelectedTraceId`<br>`useDashboardNavigation` |
| **4** | **Chat** | `/dashboard?tab=assistant` | `AssistantView` (`apps/web/components/chat/assistant-view.tsx`) | `AgentSays` (`apps/web/components/chat/agent-says.tsx`)<br>`AIComposer` (`apps/web/components/chat/ai-composer.tsx`)<br>`VerifiedBlock` (`apps/web/components/chat/verified-block.tsx`)<br>`BudgetPlanCard`<br>`PaymentResultCard`<br>`RejectionCard`<br>`DelegationCard`<br>`MemoryCard` | `useWorkspaceStore`<br>`workspaceStore.addChatMessage`<br>`workspaceStore.setChatMessages`<br>`useDashboardNavigation` |
| **5** | **Sessions** | `/dashboard?tab=assistant` (Sheet)<br>`/dashboard?tab=workspace` (Sheet) | `SessionHistoryPanel` (`apps/web/components/chat/session-history.tsx`)<br>`SessionsGrid` / `SessionsPanel` (`apps/web/components/workspace/sessions-memory.tsx`) | `Sheet`, `SheetContent` (`apps/web/components/ui/sheet.tsx`) | `useWorkspaceStoreSelector`<br>`workspaceStore.setActiveSessionId`<br>`workspaceStore.setChatMessages` |
| **6** | **Memory** | `/dashboard?tab=workspace` (Sheet)<br>Embedded in Chat | `MemoryVaultContent` / `MemoryGrid` (`apps/web/components/workspace/sessions-memory.tsx`)<br>`MemoryCard` (`apps/web/components/cards/memory-card.tsx`) | Category filter tabs ("All", "Env", "Session", "Agent")<br>Undo/Forget button (`RotateCcw`) | Local React State (`useState(INITIAL_MEMORIES)`)<br>Zero persistent backend or store state |
| **7** | **Library** | `/dashboard?tab=agents` | `AgentLibrary` (`apps/web/components/agents/AgentLibrary.tsx`) | `AgentCard` (`apps/web/components/agents/AgentCard.tsx`)<br>`AgentDetailDrawer` (`apps/web/components/agents/AgentDetailDrawer.tsx`)<br>`AttachAgentDialog` (`apps/web/components/agents/AttachAgentDialog.tsx`) | `useWorkspaceStore`<br>`workspaceStore.attachAgent`<br>`workspaceStore.addChatMessage` |

---

## 2. Hardcoded Data Inventory (Requirement R2)

The following exhaustive inventory documents every single hardcoded mock array, fixture, inline amount, currency symbol, simulated timer, fake loading state, and client-side state transition logic across Screens 1 through 7.

### Master Hardcoded Data Table

| # | File Path | Line Number(s) | Represented Data / Behavior | Category | Target Screen |
|---|---|---|---|---|---|
| 1 | `apps/web/components/workspace/workspace-defaults.ts` | 36–64 | `INITIAL_SESSIONS`: 3 mock sessions ("Goa Tech Conference Logistics", "AWS Cluster Scale Out", "Q3 Vendor Audit & Receipts") with hardcoded statuses, timestamps, and agent counts | Mock Fixture Array | 5. Sessions |
| 2 | `apps/web/components/workspace/workspace-defaults.ts` | 66–94 | `INITIAL_MEMORIES`: 3 mock memories ("dietary_preference", "hotel_proximity", "preferred_airline") with fake timestamps and agent associations | Mock Fixture Array | 6. Memory |
| 3 | `apps/web/components/workspace/workspace-defaults.ts` | 96–142 | `INITIAL_ACTIVITIES`: 4 mock activity items with amounts ($1,000.00, $245.00, $0.00, $5,000.00), fake timestamps, and mock trace IDs (`trace-pay-9018`, `trace-rej-7712`, etc.) | Mock Fixture Array | 3. Activity feed |
| 4 | `apps/web/components/workspace/workspace-defaults.ts` | 144–200 | `DEFAULT_GRAPH_NODES`: 5 mock agent nodes (`orchestrator-root` $10,000 limit, `agent-travel` $4,000 limit, `agent-hotel` $4,000 limit, `agent-flights-unfunded` $0 limit, `agent-booking-gw` $2,000 limit) | Mock Fixture Array | 1. Workspace graph |
| 5 | `apps/web/components/workspace/workspace-defaults.ts` | 202–235 | `DEFAULT_GRAPH_EDGES`: 4 mock delegation edges with hardcoded statuses ("flowing", "idle", "payment_pulse") and amounts ($4,000, $2,000) | Mock Fixture Array | 1. Workspace graph |
| 6 | `apps/web/components/workspace/workspace-defaults.ts` | 237–292 | `DEFAULT_CHAT_MESSAGES`: 4 initial chat messages containing embedded cards (`budget_plan` for $10,000.00 and `payment_result` for $245.00 via PayPal) | Mock Fixture Array | 4. Chat |
| 7 | `apps/web/app/lib/workspace-store.ts` | 139–161 | `DEFAULT_ENVIRONMENTS[0]` ("Travel & Hospitality"): $10,000.00 budget limit, $2,450.00 spent, $1,500.00 reserved, $500.00 approval threshold, 4 agents, 1 approval | Mock Environment Fixture | 2. Budget strip, 1. Workspace graph |
| 8 | `apps/web/app/lib/workspace-store.ts` | 162–184 | `DEFAULT_ENVIRONMENTS[1]` ("Production Cloud Ops"): $50,000.00 budget limit, $12,800.00 spent, $4,000.00 reserved, $1,000.00 approval threshold | Mock Environment Fixture | 2. Budget strip |
| 9 | `apps/web/app/lib/workspace-store.ts` | 191 | Hardcoded synthetic connection latency: `latencyMs: 14` | Fake Connection State | 1. Workspace graph |
| 10 | `apps/web/app/lib/workspace-store.ts` | 206–212 | Hardcoded user identity: `user-dev-local`, "Lead Operator", `authMethod: "passkey"`, `credentialId: "fido2-cred-91823"` | Mock Identity Fixture | Shell / Global |
| 11 | `apps/web/app/lib/workspace-store.ts` | 340–371 | `retryConnection`: ping fallback simulation setting latency to 12ms if network fails | Fake Connection Logic | Shell / Global |
| 12 | `apps/web/components/workspace/workspace-layout.tsx` | 37–40 | Auto-populates store with `DEFAULT_GRAPH_NODES` and `DEFAULT_GRAPH_EDGES` if store nodes are empty | Client-side Initialization | 1. Workspace graph |
| 13 | `apps/web/components/workspace/workspace-layout.tsx` | 55–71 | `handleRevokeNode`: Client-side synthetic agent revocation mutating `status: "revoked"` and appending an audit chat message without API call | Client-side State Transition | 1. Workspace graph |
| 14 | `apps/web/components/workspace/workspace-layout.tsx` | 74 | Hardcoded fallback title: `"Conference Logistics"` | Inline String Fallback | 1. Workspace graph |
| 15 | `apps/web/components/workspace/delegation-topology.tsx` | 48 | Hardcoded badge string: `"5 nodes"` | Inline String | 1. Workspace graph |
| 16 | `apps/web/components/workspace/delegation-topology.tsx` | 51 | Hardcoded badge string: `"2 active"` | Inline String | 1. Workspace graph |
| 17 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 314 | Hardcoded mandate ID label in SVG: `"man-root"` | Inline String | 1. Workspace graph |
| 18 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 360 | Hardcoded rail text in SVG: `"PayPal Sandbox"` | Inline String | 1. Workspace graph |
| 19 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 412 | Hardcoded fallback root node allocation: `1000000` ($10,000.00) | Inline Amount Fallback | 1. Workspace graph |
| 20 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 454 | Hardcoded fallback travel agent allocation: `400000` ($4,000.00) | Inline Amount Fallback | 1. Workspace graph |
| 21 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 499 | Hardcoded status label in SVG: `"Unfunded Helper"` | Inline String | 1. Workspace graph |
| 22 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 539 | Hardcoded fallback hotel agent allocation: `400000` ($4,000.00) | Inline Amount Fallback | 1. Workspace graph |
| 23 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 579 | Hardcoded fallback booking gateway allocation: `100000` ($1,000.00) | Inline Amount Fallback | 1. Workspace graph |
| 24 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 593–594 | Hardcoded fallback counts: `subagentsCount || 4`, `activeSubagentsCount || 2` | Inline Count Fallback | 1. Workspace graph |
| 25 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 598–610 | Array of 10 hardcoded pipeline ticker messages with synthetic actions ($245.00 flight, $1,000.00 hold, $5,000.00 blocked) | Mock String Array | 1. Workspace graph |
| 26 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 615–621 | `setInterval(..., 2800)`: Timer cycling fake ticker messages every 2.8 seconds | Simulated Event Timer | 1. Workspace graph |
| 27 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 656 | Initial synthetic workflow count: `useState(1247)` | Hardcoded State Number | 1. Workspace graph |
| 28 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 658–663 | `setInterval(..., 7200)`: Timer incrementing fake workflow count every 7.2 seconds | Simulated Event Timer | 1. Workspace graph |
| 29 | `apps/web/components/workspace/orchestrator-pipeline.tsx` | 692 | Hardcoded technology stack label: `"PayPal Sandbox · Claude"` | Inline String | 1. Workspace graph |
| 30 | `apps/web/components/canvas/agent-network-canvas.tsx` | 40–96 | `DEFAULT_NODES`: Duplicated static 5-node array with positions and minor amounts | Mock Fixture Array | 1. Workspace graph |
| 31 | `apps/web/components/canvas/agent-network-canvas.tsx` | 98–131 | `DEFAULT_EDGES`: Duplicated static 4-edge array with connection statuses | Mock Fixture Array | 1. Workspace graph |
| 32 | `apps/web/components/canvas/agent-network-canvas.tsx` | 256 | Hardcoded text in Three.js texture sprite: `"Attached · Unfunded ($0)"` | Inline Currency String | 1. Workspace graph |
| 33 | `apps/web/components/canvas/node-detail-drawer.tsx` | 55–65 | Fallback node data: allocated $4,000.00, spent $1,250.00, reserved $500.00 | Inline Amount Fallback | 1. Workspace graph |
| 34 | `apps/web/components/canvas/node-detail-drawer.tsx` | 176–184 | Hardcoded source `"Platform Core Agent"`, delegation depth `"Level 2"`, rails `"PayPal, Simulation"` | Inline Strings | 1. Workspace graph |
| 35 | `apps/web/components/canvas/node-detail-drawer.tsx` | 194 | Hardcoded mandate scope prose with threshold amount: `"$500.00"` | Inline Currency String | 1. Workspace graph |
| 36 | `apps/web/components/canvas/node-detail-drawer.tsx` | 263–271 | Hardcoded guardrails: Threshold `"$500.00"`, Sub-Delegation `"Yes (Depth ≤ 2)"`, Math `"100% Exact Integer"` | Inline Strings / Amounts | 1. Workspace graph |
| 37 | `apps/web/components/canvas/node-detail-drawer.tsx` | 279–304 | 2 completely hardcoded activity cards: "Reserved $1,000.00 at Grand Hyatt Goa" (`txn_pp_982194820`) and "Completed payment $245.00 for IndiGo Flight 6E-204" (`txn_pp_109283102`) | Hardcoded JSX Fixtures | 1. Workspace graph |
| 38 | `apps/web/components/workspace/agent-inspector.tsx` | 44–54 | Hardcoded agent names ("Main Orchestrator", "Travel Agent", "Hotel Agent", "Flight Scraper", "Booking Gateway") | Inline Strings | 1. Workspace graph |
| 39 | `apps/web/components/workspace/agent-inspector.tsx` | 61–63 | Fallback amounts: limit `1000000` / `400000`, spent `245000`, reserved `150000` | Inline Amount Fallbacks | 1. Workspace graph |
| 40 | `apps/web/components/workspace/agent-inspector.tsx` | 114–122 | Hardcoded permissions: `"PayPal Sandbox"`, `"Max depth ≤ 2"`, `"Mandate verified"` | Inline Strings | 1. Workspace graph |
| 41 | `apps/web/components/workspace/agent-inspector.tsx` | 143 | Hardcoded autonomous threshold: `"$500.00 / txn"` | Inline Currency String | 1. Workspace graph |
| 42 | `apps/web/components/workspace/agent-inspector.tsx` | 164–168 | Hardcoded valid through date `"Dec 31, 2026"` and kill-switch `"Armed & ready"` | Inline Strings | 1. Workspace graph |
| 43 | `apps/web/components/workspace/budget-strip.tsx` | 27–30 | Fallback budget figures: Currency `"USD"`, Limit `1000000`, Spent `245000`, Reserved `150000` | Inline Amount Fallbacks | 2. Budget strip |
| 44 | `apps/web/components/workspace/budget-strip.tsx` | 55–60 | Fallback environment name `"Travel & Hospitality"` and type `"sandbox"` | Inline Strings | 2. Budget strip |
| 45 | `apps/web/components/workspace/kpi-strip.tsx` | 22 | Hardcoded root agent count: `rootAgentCount = 1` | Inline Number | 2. Budget strip |
| 46 | `apps/web/components/workspace/kpi-strip.tsx` | 27–30 | Fallback budget figures: Limit `1000000`, Spent `245000`, Reserved `150000` | Inline Amount Fallbacks | 2. Budget strip |
| 47 | `apps/web/components/dashboard/overview.tsx` | 26–34 | `SPEND_SERIES`: 7-day daily spend and reservation numbers (Mon through Sun) | Mock Fixture Array | 2. Budget strip |
| 48 | `apps/web/components/dashboard/overview.tsx` | 36–42 | `AGENT_AUTHORITY`: Static allocation amounts for 5 agents ($10,000, $4,000, $4,000, $1,200, $800) | Mock Fixture Array | 2. Budget strip |
| 49 | `apps/web/components/dashboard/overview.tsx` | 44 | Hardcoded ceiling: `MAX_BAR = 1000000` ($10,000.00) | Inline Amount | 2. Budget strip |
| 50 | `apps/web/components/dashboard/overview.tsx` | 147 | Hardcoded root mandate: `"man-root-9081"` | Inline String | 2. Budget strip |
| 51 | `apps/web/components/dashboard/overview.tsx` | 187, 200 | Hardcoded metric deltas: `"+1 vs last week"`, `"+12.4% vs last week"` | Inline Strings | 2. Budget strip |
| 52 | `apps/web/components/workspace/activity-micro-feed.tsx` | 26–27 | Default props: `activities = INITIAL_ACTIVITIES`, `currency = "USD"` | Mock Props Fallback | 3. Activity feed |
| 53 | `apps/web/components/workspace/activity-micro-feed.tsx` | 56 | Fake streaming pulse indicator: `<Radio className="h-2.5 w-2.5 animate-pulse" /> Streaming` | Fake Loading / Status | 3. Activity feed |
| 54 | `apps/web/components/workspace/recent-activity-panel.tsx` | 65–84 | Fully hardcoded JSX transaction 1: `trace-pay-9019`, "Paid", "$245 Flight", "IndiGo Flight 6E-204 · via PayPal rail · 13:58:45" | Hardcoded JSX Element | 3. Activity feed |
| 55 | `apps/web/components/workspace/recent-activity-panel.tsx` | 87–106 | Fully hardcoded JSX transaction 2: `trace-rej-7712`, "Blocked", "$5,000 Hotel", "Grand Hyatt Goa · Exceeded $4,000 sub-mandate limit · 13:12:05" | Hardcoded JSX Element | 3. Activity feed |
| 56 | `apps/web/components/workspace/recent-activity-panel.tsx` | 109–128 | Fully hardcoded JSX transaction 3: `trace-pay-9018`, "Reserved", "$1,000 Hotel", "Grand Hyatt Goa room hold · Escrow authorization · 14:02:18" | Hardcoded JSX Element | 3. Activity feed |
| 57 | `apps/web/components/chat/assistant-view.tsx` | 28 | Hardcoded main agent descriptor: `{ id: "orchestrator-root", name: "Main Orchestrator", role: "Root Coordinator" }` | Hardcoded Object | 4. Chat |
| 58 | `apps/web/components/chat/assistant-view.tsx` | 30–51 | `SUGGESTIONS`: 4 hardcoded suggestion buttons ($4,000 allocation, $245 payment, $5,000 rejection, vegetarian preference) | Mock Prompt Array | 4. Chat |
| 59 | `apps/web/components/chat/assistant-view.tsx` | 82 | Default model string: `"gemini-2.5-pro"` | Hardcoded String | 4. Chat |
| 60 | `apps/web/components/chat/assistant-view.tsx` | 87–91 | Fake streaming simulation: `setIsStreaming(true)` followed by `setTimeout(..., 900)` | Simulated Event Timer | 4. Chat |
| 61 | `apps/web/components/chat/assistant-view.tsx` | 93–123 | Synthetic `budget_plan` card generator on keyword match ("allocate", "budget", "plan") for $10,000.00 total | Client-side Fake Logic | 4. Chat |
| 62 | `apps/web/components/chat/assistant-view.tsx` | 124–152 | Synthetic `payment_result` card generator on keyword match ("pay", "flight", "indigo") for $245.00 via PayPal | Client-side Fake Logic | 4. Chat |
| 63 | `apps/web/components/chat/assistant-view.tsx` | 153–189 | Synthetic `rejection` card generator on keyword match ("hotel", "suite", "5000", "reject") for $5,000.00 | Client-side Fake Logic | 4. Chat |
| 64 | `apps/web/components/chat/assistant-view.tsx` | 190–214 | Synthetic `memory` card generator on keyword match ("remember", "vegetarian", "preference") | Client-side Fake Logic | 4. Chat |
| 65 | `apps/web/components/chat/assistant-view.tsx` | 215–223 | Fallback synthetic response text referencing hardcoded $10,000.00 limit and $6,050.00 available | Inline String & Amounts | 4. Chat |
| 66 | `apps/web/components/chat/assistant-view.tsx` | 323–331 | `onApproveBudget`: Injects synthetic client-side approval message into chat without calling backend API | Client-side State Transition | 4. Chat |
| 67 | `apps/web/components/chat/ai-composer.tsx` | 51–55 | `CONTEXT_OPTIONS`: Hardcoded `@environment`, `@mandates`, `@memory` tags | Mock Tag Array | 4. Chat |
| 68 | `apps/web/components/chat/ai-composer.tsx` | 57–61 | `FALLBACK_MODELS`: 3 hardcoded model items (Gemini 2.5 Flash, Pro, Flash-Lite) | Mock Model Array | 4. Chat |
| 69 | `apps/web/components/cards/budget-plan-card.tsx` | 33–45 | Default props: `plan-budget-01`, `man-root-9081`, sub-allocations ($4,000, $4,000, $2,000), policy note #POL-8820 | Mock Props Fallback | 4. Chat |
| 70 | `apps/web/components/cards/budget-plan-card.tsx` | 57–75 | Client-side budget editing and approval logic toggling `approved` state in component | Client-side Logic | 4. Chat |
| 71 | `apps/web/components/cards/payment-result-card.tsx` | 41–51 | Default props: `trace-pay-9018`, `txn_pp_982194820`, IndiGo Airlines, $245.00, PayPal, hash `0x89f41b2a...c07d391e` | Mock Props Fallback | 4. Chat |
| 72 | `apps/web/components/cards/rejection-card.tsx` | 42–55 | Default props: `trace-rej-7712`, `BUDGET_EXCEEDED`, Grand Hyatt, $5,000.00, Policy #POL-8820, 3 checklist items | Mock Props Fallback | 4. Chat |
| 73 | `apps/web/components/cards/rejection-card.tsx` | 64 | Hardcoded inline remaining amount: `$200.00 remaining in its sub-mandate` | Inline Currency String | 4. Chat |
| 74 | `apps/web/components/cards/delegation-card.tsx` | 26–35 | Default props: `del-mandate-4421`, Main Orchestrator, Travel Subagent, $4,000.00, depth 2, expiry Dec 31, 2026 | Mock Props Fallback | 4. Chat |
| 75 | `apps/web/components/chat/session-history.tsx` | 26 | `useState(INITIAL_SESSIONS)`: Local session state initialized with 3 mock sessions | Mock State Array | 5. Sessions |
| 76 | `apps/web/components/chat/session-history.tsx` | 38–52 | `handleNewSession`: Generates local `sess-new-${Date.now()}` and clears chat messages without backend API call | Client-side State Transition | 5. Sessions |
| 77 | `apps/web/components/chat/session-history.tsx` | 54–57 | `handleSelectSession`: Only sets `activeSessionId` in store, does not fetch or load session message history | Incomplete State Logic | 5. Sessions |
| 78 | `apps/web/components/workspace/sessions-memory.tsx` | 55 | `useState(INITIAL_SESSIONS)`: Sessions grid initialized with mock sessions | Mock State Array | 5. Sessions |
| 79 | `apps/web/components/workspace/sessions-memory.tsx` | 66–83 | `handleCreateNewSession`: Synthetic local session creation with `Date.now()` without calling backend API | Client-side State Transition | 5. Sessions |
| 80 | `apps/web/components/workspace/sessions-memory.tsx` | 143 | Fallback session description: `"Autonomous task session with delegated agent authority."` | Inline String | 5. Sessions |
| 81 | `apps/web/components/workspace/sessions-memory.tsx` | 200 | `useState(INITIAL_MEMORIES)`: Memory vault initialized with 3 mock memories | Mock State Array | 6. Memory |
| 82 | `apps/web/components/workspace/sessions-memory.tsx` | 203–207 | `handleUndoMemory`: Synthetic forget action setting `isRevoked: true` on local memory item without API call | Client-side State Transition | 6. Memory |
| 83 | `apps/web/components/cards/memory-card.tsx` | 23–29 | Default props: `mem-entry-819`, "dietary_preference", Vegetarian meals, prompt snippet, Travel Subagent | Mock Props Fallback | 6. Memory |
| 84 | `apps/web/components/cards/memory-card.tsx` | 36–40 | `handleUndo`: Client-side synthetic undo action toggling `isUndone` state without API call | Client-side State Transition | 6. Memory |
| 85 | `apps/web/components/agents/types.ts` | 42–258 | `CATALOG_AGENTS`: 6 complete pre-audited agent definitions with recommended budgets, permissions, sample prompts, and mock audit certificates | Mock Fixture Array | 7. Library |
| 86 | `apps/web/components/agents/AgentLibrary.tsx` | 64–72 | Hardcoded category list: "All Agents", "Logistics & Travel", "Cloud Infra", "Procurement", "Finance & Payroll", "API Gateway", "Compliance" | Mock Category Array | 7. Library |
| 87 | `apps/web/components/agents/AgentLibrary.tsx` | 88–94 | `handleAttachSuccess`: Synthetic toast notification timeout (4000ms) | Simulated Event Timer | 7. Library |
| 88 | `apps/web/components/agents/AttachAgentDialog.tsx` | 39–41 | Initial form state: `$500` budget, `orchestrator-root` parent, `["PayPal"]` rail | Hardcoded Form Defaults | 7. Library |
| 89 | `apps/web/components/agents/AttachAgentDialog.tsx` | 82–152 | `handleAttach`: Computes fake 3D trigonometric node coordinates, calls `workspaceStore.attachAgent`, and injects fake delegation message into chat without calling backend API | Client-side State Transition | 7. Library |
| 90 | `apps/web/components/agents/AttachAgentDialog.tsx` | 140 | Random mock gateway signature generator: `"0x7a89f921bc" + Math.random().toString(16).slice(2, 8)` | Synthetic Cryptographic Mock | 7. Library |

---

## 3. Component Data Expectations & Action Triggers

This section documents for each of the 7 screens:
1. **Current Props, State Fields, Data Types, and Expected Shapes**.
2. **User Actions & Command Triggers**.
3. **Backend API Endpoints, Specs, and Payload Requirements** needed to replace all hardcoded fixtures.

---

### Screen 1: Workspace Graph (Topology Canvas & Inspector)

#### 1. Expected Data Shapes
- **Nodes (`AgentNodeData`)**:
  ```typescript
  interface AgentNodeData {
    id: string;                      // e.g. "orchestrator-root", "agent-travel"
    name: string;                    // e.g. "Main Orchestrator", "Travel Subagent"
    role: "orchestrator" | "subagent";
    status: "active" | "revoked" | "paused" | "unfunded";
    allocatedMinor: number;          // Integer minor units (e.g., 400000 = $4,000.00)
    spentMinor: number;              // Integer minor units
    reservedMinor: number;           // Integer minor units
    position: [number, number, number]; // 3D Three.js coordinates [x, y, z]
    isFunded: boolean;               // True = solid edge/ring; False = dashed/unfunded
    isSimulation?: boolean;          // Optional badge
  }
  ```
- **Edges (`AgentEdgeData`)**:
  ```typescript
  interface AgentEdgeData {
    id: string;                      // e.g. "edge-root-travel"
    source: string;                  // Source agent ID
    target: string;                  // Target agent ID
    isAuthorized: boolean;           // True = solid line; False = dashed line
    status: "idle" | "flowing" | "payment_pulse" | "rejected_flash";
    amountMinor?: number;            // Amount delegated along edge
    isSimulation?: boolean;
  }
  ```
- **Operational Pipeline Metrics**:
  - `workflowsCount: number` (live count of executed workflows)
  - `activeSubagentsCount: number`
  - `totalAuthorityMinor: number`
  - `availableMinor: number`
  - `pipelineAuditMessages: Array<{ timestamp: string; message: string; severity?: string }>`

#### 2. User Actions & Command Triggers
- **Node Selection**: User clicks on a node in 3D canvas, SVG pipeline, or keyboard list view -> triggers `onSelectNode(nodeId)` -> updates `workspaceStore.selectedNodeId` and populates `AgentInspector` and `NodeDetailDrawer`.
- **View Switching**: Toggle between "Pipeline" (SVG), "3D Canvas" (Three.js WebGL), and "List" (Accessible table).
- **Zoom / Auto Layout**: Buttons zoom in (+0.1 / +40 units), zoom out (-0.1 / -40 units), or reset camera coordinates.
- **Node Revocation**: User clicks "Revoke agent authority" in Inspector or "Confirm Revoke" in Node Detail Drawer -> currently executes client-side mutation only:
  - Sets node status to `revoked`, `isFunded: false`.
  - Appends synthetic agent message to `workspaceStore.chatMessages`.
- **Direct Chat**: User clicks "Direct Chat" in `NodeDetailDrawer` -> sets `selectedAgentId` and navigates to Assistant tab.
- **View Trace**: User clicks trace link in drawer -> sets `selectedTraceId` and navigates to Traces tab.

#### 3. API Needed to Replace Hardcoded Data
- **Backend Endpoints**:
  - `GET /v1/environments/:environmentId/graph` (**MISSING**): Currently, the backend has `GET /v1/environments/:environmentId/agents` and `GET /v1/environments/:environmentId/mandates`, but NO composite endpoint returns graph topology (nodes, edges, positions, edge statuses).
  - Proposed response shape for `GET /v1/environments/:environmentId/graph`:
    ```json
    {
      "nodes": [
        {
          "id": "agent-travel",
          "name": "Travel Subagent",
          "role": "subagent",
          "status": "active",
          "allocatedMinor": 400000,
          "spentMinor": 125000,
          "reservedMinor": 50000,
          "isFunded": true,
          "mandateId": "man-travel-01",
          "position": [-110, -30, 20]
        }
      ],
      "edges": [
        {
          "id": "edge-root-travel",
          "source": "orchestrator-root",
          "target": "agent-travel",
          "isAuthorized": true,
          "status": "flowing",
          "amountMinor": 400000
        }
      ],
      "stats": {
        "workflowCount": 1247,
        "activeSubagents": 2,
        "totalNodes": 5
      }
    }
    ```
  - `POST /v1/environments/:environmentId/agents/:agentId/revoke` or `POST /v1/environments/:environmentId/mandates/:mandateId/revoke` (**PARTIAL / FOUND**):
    - Fastify currently has `POST /v1/environments/:environmentId/mandates/:mandateId/revoke` in `phase2-routes.ts:161` and emergency kill-switch in `phase6-routes.ts:121`.
    - Component action should trigger `POST /v1/environments/:environmentId/mandates/:mandateId/revoke` with `{ "reason": "Revoked by operator in topology view" }`, then reload graph state.
  - Live Ticker: Replace `setInterval` with SSE/WebSocket event stream (`audit.event`, `action.executed`, `mandate.revoked`).

---

### Screen 2: Budget Strip

#### 1. Expected Data Shapes
- **Environment Budget Metadata (`Environment`)**:
  ```typescript
  interface Environment {
    id: string;
    name: string;
    slug: string;
    currency: string;               // e.g. "USD"
    budgetLimitMinor: number;       // e.g. 1000000 ($10,000.00)
    spentMinor: number;             // e.g. 245000 ($2,450.00)
    reservedMinor: number;          // e.g. 150000 ($1,500.00)
    availableMinor: number;         // calculateAvailableMinor(limit, spent, reserved)
    status: "active" | "paused" | "closed" | "revoked";
    type: "sandbox" | "production";
    agentCount: number;
    pendingApprovalsCount: number;
  }
  ```
- **Historical Spend Series (`SpendSeriesItem`)**:
  ```typescript
  interface SpendSeriesItem {
    label: string;                  // e.g. "Mon", "Tue" or ISO date
    spent: number;                  // Minor units
    reserved: number;               // Minor units
  }
  ```
- **Authority Distribution (`AgentAuthorityItem`)**:
  ```typescript
  interface AgentAuthorityItem {
    label: string;                  // Agent name
    value: number;                  // Minor units allocated
  }
  ```

#### 2. User Actions & Command Triggers
- **Environment Switch**: Selecting an environment from the shell switcher triggers `workspaceStore.switchEnvironment(envId)` -> calls `resetWorkspace()` and fetches fresh environment data.
- **Review Approvals Button**: User clicks "Review approvals" -> calls `navigateTab("approvals")`.

#### 3. API Needed to Replace Hardcoded Data
- **Backend Endpoints**:
  - `GET /v1/environments/:environmentId` (**PARTIAL**):
    - Fastify `phase1-routes.ts:125` exposes `GET /v1/environments/:environmentId` returning `{ environment: EnvironmentDto }`.
    - Shape Gap: `EnvironmentDto` in backend only returns `{ id, name, purpose, currency, budgetLimitMinor, status, createdAt }`. It does NOT return `spentMinor`, `reservedMinor`, `agentCount`, or `pendingApprovalsCount`. These currently must be derived from `GET /v1/environments/:environmentId/ledger` (accounts) and `GET /v1/environments/:environmentId/approvals?status=pending`.
  - `GET /v1/environments/:environmentId/analytics/spend-velocity` (**MISSING**):
    - Currently no endpoint exists for daily historical spend/reservation series (`SPEND_SERIES`).
    - Proposed response shape:
      ```json
      {
        "series": [
          { "date": "2026-10-25", "label": "Mon", "spentMinor": 32000, "reservedMinor": 12000 },
          { "date": "2026-10-26", "label": "Tue", "spentMinor": 18000, "reservedMinor": 9000 }
        ]
      }
      ```
  - `GET /v1/environments/:environmentId/analytics/authority-breakdown` (**MISSING**):
    - Currently no endpoint returns agent authority bar metrics. Can be computed if frontend queries `GET /v1/environments/:environmentId/mandates` or provided via an analytics summary endpoint.

---

### Screen 3: Activity Feed

#### 1. Expected Data Shapes
- **Activity Feed Row (`ActivityFeedItem` / `ActivityAuditRow`)**:
  ```typescript
  interface ActivityFeedItem {
    id: string;                      // e.g. "act-01"
    timestamp: string;               // ISO or formatted time
    actorName: string;               // e.g. "Hotel Subagent"
    action: string;                  // e.g. "Reserved room at Grand Hyatt Goa"
    amountMinor?: number;            // e.g. 100000
    currency?: string;               // e.g. "USD"
    outcome: "success" | "denied" | "pending";
    reasonCode?: string;             // e.g. "BUDGET_EXCEEDED"
    isSimulation?: boolean;
    traceId?: string;                // e.g. "trace-pay-9018"
  }
  ```

#### 2. User Actions & Command Triggers
- **Trace Inspection**: User clicks an activity row or external link icon -> triggers `onSelectTrace(traceId)` -> sets `workspaceStore.setSelectedTraceId(traceId)` and routes to `/dashboard?tab=traces`.
- **View All Link**: User clicks "View all" in `RecentActivityPanel` -> routes to `/dashboard?tab=tables&sub=activity`.

#### 3. API Needed to Replace Hardcoded Data
- **Backend Endpoints**:
  - `GET /v1/environments/:environmentId/activity` (**FOUND / PARTIAL**):
    - Fastify `phase3-routes.ts:397` exposes `GET /v1/environments/:environmentId/activity?limit=50&cursor=...`.
    - Returns `{ events: AuditEventDto[], cursor?: string }`.
    - Shape Gap: Backend `AuditEventDto` contains `{ id, environmentId, actorType, actorId, sessionId, mandateId, actionId, eventType, outcome, reasonCode, payload, eventHash, createdAt }`.
    - `actorName`, formatted `action` description, and `amountMinor` are buried inside `payload` or require looking up `actorId` in `agents` table.
    - Proposed normalization in backend response or client adapter:
      ```json
      {
        "events": [
          {
            "id": "audit-9812",
            "createdAt": "2026-10-31T14:02:18Z",
            "actorId": "agent-hotel",
            "actorName": "Hotel Subagent",
            "action": "Reserved room at Grand Hyatt Goa",
            "amountMinor": 100000,
            "currency": "USD",
            "outcome": "success",
            "reasonCode": null,
            "traceId": "trace-pay-9018"
          }
        ]
      }
      ```
  - Real-time SSE Stream (**MISSING** in worker/API): Worker processes PayPal and ledger events but does NOT expose an SSE `/v1/environments/:environmentId/activity/stream` endpoint.

---

### Screen 4: Chat (Assistant View)

#### 1. Expected Data Shapes
- **Chat Message (`ChatMessage`)**:
  ```typescript
  interface ChatMessage {
    type: "agent_says" | "verified_block";
    id: string;
    sender?: string;                 // "You", "Main Orchestrator", "Gateway Policy Engine"
    timestamp: string;               // ISO 8601 string
    text?: string;                   // Escaped plain string
    cardType?: "budget_plan" | "payment_result" | "rejection" | "delegation" | "memory";
    payload?: Record<string, unknown>; // Card payload object
    verifiedAt?: string;
    gatewaySignature?: string;       // Cryptographic signature hex
  }
  ```
- **Composer Submission (`AIComposerSubmission`)**:
  ```typescript
  interface AIComposerSubmission {
    prompt: string;
    mode: "Delegate" | "Ask";
    modelId: string;                 // e.g. "gemini-2.5-flash", "gemini-2.5-pro"
    modelName: string;
    effort: "Low" | "Medium" | "High" | "Max";
    autoMode: boolean;
    attachedFiles: string[];
    files: File[];
  }
  ```
- **Verified Card Payload Shapes**:
  - `budget_plan`: `{ title, parentMandateId, totalRequestedMinor, currency, status, subAllocations: [{ agentId, agentName, role, amountMinor }], policyNotes }`
  - `payment_result`: `{ transactionId, recipient, merchantCategory, amountMinor, currency, rail, authHash, currentStage, agentName }`
  - `rejection`: `{ reasonCode, agentName, attemptedAmountMinor, currency, attemptedMerchant, ruleReference, explanation, checksFailed: string[] }`
  - `delegation`: `{ parentAgentName, subagentName, delegatedBudgetMinor, currency, allowedRails, maxDepth, expiresAt, isFunded, delegationHash }`
  - `memory`: `{ category, keyName, value, contextSnippet, agentName }`

#### 2. User Actions & Command Triggers
- **Send Prompt**: User submits prompt via Enter or Send Button -> triggers `handleComposerSubmit` -> currently appends message to local store, sets `isStreaming: true`, and triggers `setTimeout(..., 900)`.
- **Stop Streaming**: User clicks "Stop" button -> aborts streaming state (`setIsStreaming(false)`).
- **Suggestion Pill Click**: User clicks a suggestion card -> populates prompt and calls `handleSendMessage`.
- **Approve Budget Plan**: User clicks "Approve Plan" on a `budget_plan` card -> triggers `onApproveBudget` -> appends local confirmation message.
- **Adjust Budget Plan**: User clicks "Adjust" -> edits inline input amounts -> clicks "Save".
- **View Trace**: User clicks "View Trace" on any card -> navigates to `/dashboard?tab=traces`.
- **Voice Recording**: User clicks Mic icon -> initializes `SpeechRecognition` -> records audio -> appends transcript to prompt.
- **Model / Effort Selection**: User selects model from popover, toggles favourite, or adjusts effort level.

#### 3. API Needed to Replace Hardcoded Data
- **Backend Endpoints**:
  - `POST /v1/environments/:environmentId/chat` or `POST /v1/sessions/:sessionId/chat` (**MISSING** in gateway API):
    - Currently, `apps/api` has NO chat endpoint. `apps/agent-runtime` has `POST /run` (FastAPI at `localhost:8000`), but `POST /run` expects `{ agent, message, dry_run, environment_id, mandate_id, action, amount_minor, currency }` and does NOT return streaming chat or structured VerifiedBlock card payloads.
    - Proposed SSE endpoint: `POST /v1/environments/:environmentId/chat/stream`
      - Request payload:
        ```json
        {
          "sessionId": "sess-goa-01",
          "message": "Pay $245.00 for IndiGo flight via PayPal",
          "mode": "Delegate",
          "model": "gemini-2.5-flash",
          "contextTags": ["@environment", "@mandates"]
        }
        ```
      - SSE Events emitted:
        * `event: token` -> text chunk for typing stream
        * `event: card` -> structured JSON payload for `VerifiedBlock`
        * `event: done` -> final message metadata and signature
  - `GET /v1/models` (**FOUND**):
    - Fastify `app.ts:134` exposes `GET /v1/models` returning `{ models: [{ id, label, provider, default }] }`.
    - Fully functional and used by `AIComposer`.
  - `POST /v1/environments/:environmentId/mandates/:mandateId/approve-plan` (**MISSING**):
    - To replace client-side budget approval in `BudgetPlanCard`.

---

### Screen 5: Sessions

#### 1. Expected Data Shapes
- **Session Item (`SessionItem` / `SessionDto`)**:
  ```typescript
  // Component expects:
  interface SessionItem {
    id: string;                      // e.g. "sess-goa-01"
    title: string;                   // e.g. "Goa Tech Conference Logistics"
    description?: string;
    status: "active" | "waiting for you" | "done";
    lastActivity: string;            // e.g. "2 mins ago"
    agentCount: number;
  }

  // Backend contracts index.ts:186 currently defines:
  interface SessionDto {
    id: string;
    environmentId: string;
    agentId: string | null;
    name: string;                    // maps to title
    status: "active" | "paused" | "completed" | "cancelled";
    context: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }
  ```

#### 2. User Actions & Command Triggers
- **Select Session**: User clicks a session row in `SessionHistoryPanel` or `SessionsGrid` -> updates `workspaceStore.setActiveSessionId(id)`.
- **Create New Session**: User clicks "New session" or "New thread" -> currently creates local `sess-new-${Date.now()}` and wipes `workspaceStore.chatMessages` to `[]`.
- **Search Sessions**: Filter input filters local sessions by title substring.

#### 3. API Needed to Replace Hardcoded Data
- **Backend Endpoints**:
  - `GET /v1/environments/:environmentId/sessions` (**PARTIAL**):
    - Fastify `phase4-routes.ts:311` exposes `GET /v1/environments/:environmentId/sessions`.
    - Returns `{ sessions: Session[] }`.
    - Shape Gap:
      * Backend uses `name`, frontend uses `title`.
      * Backend statuses: `"active" | "paused" | "completed" | "cancelled"`. Frontend expects: `"active" | "waiting for you" | "done"`.
      * Backend does not compute `agentCount` or relative `lastActivity` string (requires client-side formatting from `updatedAt`).
      * In-memory store only in backend (`InMemorySessionStore`), not persisted to Postgres!
  - `POST /v1/environments/:environmentId/sessions` (**PARTIAL**):
    - Fastify `phase4-routes.ts:274` exposes `POST /v1/environments/:environmentId/sessions` with `{ name, agentId, context }`.
    - Needs to be called when user clicks "New session" instead of generating `sess-new-${Date.now()}` in React state.
  - `GET /v1/environments/:environmentId/sessions/:sessionId/messages` (**MISSING**):
    - No endpoint exists to load message history for a chosen session!

---

### Screen 6: Memory (Memory Vault)

#### 1. Expected Data Shapes
- **Memory Item (`MemoryItem`)**:
  ```typescript
  interface MemoryItem {
    id: string;                      // e.g. "mem-01"
    category: "session" | "environment" | "agent";
    key: string;                     // e.g. "dietary_preference"
    value: string;                   // e.g. "Vegetarian meals only..."
    contextSnippet?: string;         // e.g. "Operator requested default travel dietary preferences"
    agentName?: string;              // e.g. "Travel Subagent"
    savedAt: string;                 // ISO 8601 string
    isRevoked?: boolean;             // True if undone/forgotten
  }
  ```

#### 2. User Actions & Command Triggers
- **Category Filter**: User clicks "All", "Env", "Session", or "Agent" pills -> filters local list.
- **Forget Memory / Undo**: User clicks `RotateCcw` button -> triggers `handleUndoMemory(memId)` -> sets `isRevoked: true` on item (renders line-through and dashed border).

#### 3. API Needed to Replace Hardcoded Data
- **Backend Endpoints**:
  - **ENTIRE MEMORY SUBSYSTEM IS MISSING FROM BACKEND**.
  - No database migration creates a `memories` table in `supabase/migrations`.
  - No contract definition exists in `packages/contracts`.
  - No routes exist in `apps/api`.
- **Proposed Endpoints & Schema**:
  - Proposed Database Table:
    ```sql
    CREATE TABLE public.memories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      environment_id UUID NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
      session_id UUID REFERENCES public.sessions(id),
      agent_id UUID REFERENCES public.agents(id),
      category TEXT NOT NULL CHECK (category IN ('environment', 'session', 'agent')),
      key_name TEXT NOT NULL,
      value_text TEXT NOT NULL,
      context_snippet TEXT,
      is_revoked BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_at TIMESTAMPTZ
    );
    ```
  - Proposed REST Endpoints:
    * `GET /v1/environments/:environmentId/memories?category=...`
    * `POST /v1/environments/:environmentId/memories` with `{ category, keyName, value, contextSnippet, agentId }`
    * `PATCH /v1/environments/:environmentId/memories/:memoryId/revoke`

---

### Screen 7: Library (Agent Library)

#### 1. Expected Data Shapes
- **Specialist Agent Catalog Item (`SpecialistAgent`)**:
  ```typescript
  interface SpecialistAgent {
    id: string;                      // e.g. "agent-travel-concierge"
    name: string;                    // e.g. "Travel Concierge"
    tagline: string;
    description: string;
    specialty: string;
    role: "orchestrator" | "subagent";
    category: "logistics" | "infrastructure" | "procurement" | "finance" | "gateway" | "compliance";
    authorityTier: string;           // e.g. "Tier 2: Autonomous Micro-Transactions"
    tierLevel: 1 | 2 | 3 | 4;
    recommendedBudgetMinor: number;  // e.g. 250000 ($2,500.00)
    currency: string;
    supportedRails: string[];        // e.g. ["PayPal", "Simulation"]
    publisher: "Official PayGuardian" | "Verified Partner" | "Custom";
    avatarIcon: "plane" | "cloud" | "shopping-cart" | "dollar-sign" | "network" | "shield-check";
    permissions: string[];
    samplePrompts: string[];
    securityAudit: {
      auditedBy: string;
      auditDate: string;
      cveVulnerabilities: number;
      status: "certified" | "passed";
      signatureHash: string;
      sandboxTested: boolean;
    };
  }
  ```
- **Attach Agent Form Data**:
  - `parentAgentId: string`
  - `budgetLimitMinor: number`
  - `allowedRails: string[]`

#### 2. User Actions & Command Triggers
- **Search & Filter**: Search text query and category chip selection filters the cards. "Attached Only" toggle compares `agent.id` against `store.graphNodes`.
- **Open Inspection Drawer**: User clicks "Open" on an agent card -> opens `AgentDetailDrawer` showing permissions, audit certificate, and copyable prompts.
- **Copy Sample Prompt / Hash**: Copies prompt text or signature hash to OS clipboard.
- **Attach Agent**: User clicks "Attach" -> opens `AttachAgentDialog` -> selects parent mandate holder, inputs budget dollars, selects rails -> clicks "Confirm & Attach" -> currently computes fake trigonometric 3D coordinates, adds node and edge to `workspaceStore`, and appends fake delegation chat message.

#### 3. API Needed to Replace Hardcoded Data
- **Backend Endpoints**:
  - `GET /v1/agent-catalog` (**MISSING**):
    - Currently, `CATALOG_AGENTS` is a static client-side TypeScript array in `types.ts`.
    - Python agent runtime has `GET /agents` (`main.py:49`), but only returns `{"agents": ["personal", "travel", "hotel", "transport", "food", "activities"]}` without catalog metadata (recommended budget, authority tier, permissions, security audit).
    - Proposed Gateway endpoint: `GET /v1/agent-catalog` returning `{ catalog: SpecialistAgent[] }`.
  - `POST /v1/environments/:environmentId/agents` (**FOUND / PARTIAL**):
    - Fastify `phase1-routes.ts:167` exposes `POST /v1/environments/:environmentId/agents` with `{ parentAgentId, name, kind, capabilities }`.
    - Attaching an agent should call this endpoint to persist the agent in `public.agents`.
  - `POST /v1/environments/:environmentId/mandates` (**FOUND / PARTIAL**):
    - Fastify `phase2-routes.ts:114` exposes `POST /v1/environments/:environmentId/mandates` with `{ holderAgentId, budgetLimitMinor, currency, permittedActions, expiresAt, canDelegate, maxDelegationDepth, approvalRequired }`.
    - When user attaches an agent with a budget > $0, the frontend must call this endpoint to issue a real delegated mandate, rather than generating a fake random signature hash in the browser.

---

## 4. Synthesis & Gap Matrix

| Screen | Target Screen Name | Backend Endpoint Status | Existing Endpoint(s) | Key Shape Gaps & Missing Backend Capabilities |
|---|---|---|---|---|
| **1** | Workspace graph | **PARTIAL** | `GET /v1/environments/:id/agents`<br>`GET /v1/environments/:id/mandates` | **Missing Graph API**: No composite endpoint returns nodes, edges, and 3D positions together. Revocation (`POST /mandates/:id/revoke`) is implemented in API but frontend executes client-side state mutation only. Workflow counter and live ticker are simulated by `setInterval` timers with no WebSocket/SSE broadcast. |
| **2** | Budget strip | **PARTIAL** | `GET /v1/environments/:id`<br>`GET /v1/environments/:id/ledger` | **Shape Difference**: `EnvironmentDto` lacks `spentMinor`, `reservedMinor`, `agentCount`, and `pendingApprovalsCount`. **Missing Analytics API**: No historical spend velocity (`SPEND_SERIES`) or agent authority breakdown (`AGENT_AUTHORITY`) endpoints exist. |
| **3** | Activity feed | **PARTIAL** | `GET /v1/environments/:id/activity` | **Shape Difference**: Backend `AuditEventDto` does not flatten `actorName`, formatted `action`, and `amountMinor` (nested in JSONB payload). `RecentActivityPanel` ignores data and hardcodes 3 JSX buttons. No SSE stream for live activity. |
| **4** | Chat | **MISSING** | `GET /v1/models` (Found)<br>`apps/agent-runtime: /run` | **Missing Gateway Chat**: Gateway API has zero chat/message endpoints. Python agent runtime `POST /run` does not support interactive chat, streaming tokens, or structured `VerifiedBlock` cards. All agent replies and cards are generated by client-side regexes with `setTimeout(..., 900)`. |
| **5** | Sessions | **PARTIAL** | `GET /v1/environments/:id/sessions`<br>`POST /v1/environments/:id/sessions` | **Shape Difference**: Backend uses `name` (vs `title`), different status enums (`active/paused/completed/cancelled` vs `active/waiting for you/done`), and in-memory storage only (not in Postgres). **Missing API**: No endpoint exists to load message history for a session. |
| **6** | Memory | **MISSING** | *None* | **Completely Missing**: No `memories` table in Postgres, no contract DTO, and no API endpoints exist. All memory storage and "Forget/Undo" actions are purely local React state (`useState(INITIAL_MEMORIES)`). |
| **7** | Library | **PARTIAL** | `POST /v1/environments/:id/agents`<br>`POST /v1/environments/:id/mandates` | **Missing Catalog API**: Agent catalog definitions are hardcoded in `types.ts:42`. Attach modal performs client-side trigonometric positioning and generates fake hex signatures (`0x7a89f921bc...`) without calling agent creation or mandate delegation endpoints. |

---

## 5. Recommended Architecture for Implementation

To transition Screens 1 through 7 from static mock fixtures to full production readiness:

1. **Deploy Missing API Endpoints in Fastify (`apps/api`)**:
   - `GET /v1/environments/:id/topology`: Aggregate agents, mandates, and ledger accounts into nodes and edges for Screen 1.
   - `GET /v1/environments/:id/analytics/spend-velocity`: Query `ledger_transfers` grouped by date for Screen 2.
   - `POST /v1/environments/:id/chat/stream`: Server-Sent Events endpoint streaming agent reasoning and verified card payloads for Screen 4.
   - `GET /v1/environments/:id/sessions/:sessionId/messages`: Retrieve chat history for Screen 5.
   - `GET /v1/agent-catalog`: Serve the pre-audited specialist agent registry for Screen 7.

2. **Implement Durable Memory in Supabase Postgres**:
   - Create migration `20261102000000_durable_memory.sql` introducing `public.memories`.
   - Implement `MemoryStore` in `apps/api/src/memory.ts` and register routes in `memory-routes.ts`.

3. **Wire Action Triggers to Real Gateway Mutations**:
   - In `WorkspaceLayout` & `AgentInspector`: Replace client-side node mutation with `POST /v1/environments/:id/mandates/:mandateId/revoke`.
   - In `AttachAgentDialog`: Replace client-side coordinate math with `POST /v1/environments/:id/agents` followed by `POST /v1/environments/:id/mandates`.
   - In `AIComposer`: Replace `setTimeout(..., 900)` and regex keyword simulation with an SSE `fetch` to `/v1/environments/:id/chat/stream`.
   - In `RecentActivityPanel`: Replace static JSX buttons with a dynamic map over `GET /v1/environments/:id/activity`.
   - In `SessionHistoryPanel`: Wire "New thread" to `POST /v1/environments/:id/sessions` and session click to message retrieval.
