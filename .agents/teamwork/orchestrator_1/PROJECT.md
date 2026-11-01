# Project: PayGuardian Agent Workspace & Delegation Dashboard Redesign

## Architecture
PayGuardian is redesigned into a production-grade Agent Workspace and Delegation Dashboard that fuses:
1. **TurboStarter Architecture**: 3-panel responsive layout (Left: Sessions & Memory Drawer, Center: 3D Spatial Canvas + Budget Strip + Live Activity Feed, Right: Chat & Decision Stream), sticky top navigation bar with environment switcher, status pill, and reconnect banner.
2. **Efferd Visual Identity**: True obsidian ground (`#000000`), `#0d0d0d` card surfaces, hairline 1px borders (`#ffffff1c`), `.top-shade` specular rim lighting (`box-shadow: 0 -1px color-mix(in oklab, var(--foreground) 8%, transparent)`), subtle dome radial gradients, Geist typography, and pale-tinted status chips with dark text.
3. **Ferrow 3D Multi-Agent Canvas**: Interactive spatial 3D agent network canvas (Three.js) rendering the orchestrator root and connected subagents with solid (funded authority) vs dashed (unfunded structural attachment) edges, live micro-animations (authority flow, payment pulse, rejection flash, revocation desaturation), and a keyboard-accessible list view.
4. **Authority & Security Invariants**:
   - Two Voices architecture: `AgentSays` (escaped conversational text) vs `VerifiedBlock` (tamper-proof gateway-verified cards: BudgetPlan, PaymentResult, Rejection, Delegation, Memory with undo).
   - Strict integer minor-unit financial arithmetic with zero floating-point operations.
   - Complete synchronous workspace state reset on environment switching.

---

## Feature Inventory
| # | Feature | Description | Priority | Milestone | Source |
|---|---------|-------------|----------|-----------|--------|
| 1 | Efferd Design Tokens | CSS custom properties, hairline borders, .top-shade lighting, obsidian surfaces | P0 | M1 | Survey (Efferd) |
| 2 | Tailwind & UI Primitives | Buttons, Cards, Badges, Dialogs, Sheets, Tabs, Tooltips styled with Efferd tokens | P0 | M1 | Survey (TurboStarter/Efferd) |
| 3 | Minor Unit Currency Helpers | Exact integer calculations, formatMinorUnits, zero float math | P0 | M1 | Survey (Invariants) |
| 4 | Efferd AG Grid Theme | Custom themeQuartz dark styling matching Efferd palette | P0 | M1 | Survey (Codebase/Efferd) |
| 5 | App Shell Header | Environment switcher, status pill, live reconnect banner, nav tabs | P0 | M2 | R2 / Spec §4 |
| 6 | Passkey & Fallback Auth | Mock passkey WebAuthn flow with dev bypass fallback | P1 | M2 | R2 / Spec §4 |
| 7 | 5-Step Create-Env Wizard | Modal wizard: Identity, Root Mandate, Guardrails, Dynamic Consent, Confirm | P0 | M2 | R2 / Spec §5.4 |
| 8 | Workspace State & Reset | Central store with atomic resetWorkspace() preventing data leakage on env switch | P0 | M2 | R2 / Spec §9 |
| 9 | Three-Panel Workspace Shell | Left rail (sessions/memory), Center canvas, Right chat & decision stream | P0 | M3 | R3 / Spec §5.1 |
| 10 | 3D Agent Network Canvas | Three.js interactive canvas: nodes, camera controls, solid vs dashed edges | P0 | M3 | R3 / Spec §5.1 (Ferrow) |
| 11 | Canvas State Animations | Authority flow, payment pulse, red rejection strobe, grey revocation strike | P0 | M3 | R3 / Spec §5.1 (Ferrow) |
| 12 | Accessible Network List View | 1:1 keyboard-navigable tabular/list alternative to the 3D canvas | P0 | M3 | R3 / Spec §5.1 |
| 13 | Two-Voices Chat Pipeline | Escaped AgentSays vs tamper-proof immutable VerifiedBlock components | P0 | M3 | R3 / Spec §1, §6 |
| 14 | Gateway Verified Cards | BudgetPlanCard, PaymentResultCard, RejectionCard, DelegationCard, MemoryCard | P0 | M3 | R3 / Spec §6 |
| 15 | Mobile-First Approvals Inbox | Card details, plain-language reasons, Approve / Reject action buttons | P0 | M4 | R4 / Spec §5.3 |
| 16 | Interactive Payment Traces | Vertical authorization chain, lifecycle timeline, gateway verification checklist | P0 | M4 | R4 / Spec §5.2 |
| 17 | AG Grid Mandates & Policies | AG Grid table with server-side paging, filtering, and row click inspection | P0 | M4 | R4 / Spec §5.5 |
| 18 | AG Grid Activity Audit Log | AG Grid table with 3s polling / cursor updates, filter by type, row-click trace | P0 | M4 | R4 / Spec §5.6 |
| 19 | Security Center | Emergency environment pause/resume, agent authority revocation, event log | P1 | M4 | R4 / Spec §5.8 |
| 20 | Agent Library | Agent catalog grid, detail inspection drawer, attach agent to environment | P1 | M5 | R5 / Spec §5.7 |
| 21 | Developer Portal | MCP server endpoint URL, Python/TS setup snippets, keys, connection test | P1 | M5 | R5 / Spec §5.9 |
| 22 | Sandbox Attack Simulator | Simulation triggers, rule violations stream, simulation badges in feed/graph | P1 | M5 | R5 / Spec §5.10 |
| 23 | Resilient API Integration | Connecting UI to Fastify API endpoints with complete in-memory mock fallbacks | P0 | M5 | R5 / Codebase |
| 24 | Unified Page Assembly | Integrating all panels and screens into production-grade Next.js page | P0 | M5 | R1-R5 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Design System & Foundation | Tailwind setup, Efferd CSS tokens, UI primitives, minor unit math, AG Grid theme | none | DONE |
| M2 | App Shell, Auth & Env Wizard | Shell header, env switcher, status pill, reconnect banner, 5-step wizard, store reset | M1 | DONE |
| M3 | 3-Panel Workspace & 3D Canvas | 3-panel layout, Three.js 3D agent canvas, live animations, Two Voices chat & verified cards | M1, M2 | DONE |
| M4 | Approvals, Traces & Audit Tables | Approvals inbox, payment traces, AG Grid mandates & activity tables, security center | M1, M2 | DONE |
| M5 | Agent Library, Dev Portal, Simulator & Assembly | Agent library, MCP portal, attack simulator, API integration, and full page assembly | M1, M2, M3, M4 | DONE |

---

## Interface Contracts

### 1. Currency Formatting & Math (`apps/web/app/lib/currency.ts`)
```ts
export function formatMinorUnits(amountMinor: number, currency: string = 'USD'): string;
export function calculateAvailableMinor(allocatedMinor: number, spentMinor: number, reservedMinor: number): number;
```

### 2. Workspace State & Isolation (`apps/web/app/lib/workspace-store.ts`)
```ts
export interface WorkspaceState {
  currentEnvironmentId: string | null;
  currentEnvironment: Environment | null;
  activeSessionId: string | null;
  selectedAgentId: string | null;
  selectedTraceId: string | null;
  chatMessages: ChatMessage[];
  gatewayCards: GatewayCardPayload[];
  graphNodes: AgentNodeData[];
  graphEdges: AgentEdgeData[];
  switchEnvironment: (envId: string) => void;
  resetWorkspace: () => void; // Clears chat, graph, memory, selection
}
```

### 3. Gateway Cards vs Agent Text (`apps/web/app/components/chat/types.ts`)
```ts
export interface AgentSaysMessage {
  type: 'agent_says';
  id: string;
  sender: string;
  timestamp: string;
  text: string; // Plain string, strictly escaped
}

export interface VerifiedBlockMessage {
  type: 'verified_block';
  id: string;
  cardType: 'budget_plan' | 'payment_result' | 'rejection' | 'delegation' | 'memory';
  payload: Record<string, unknown>;
  verifiedAt: string;
  gatewaySignature?: string;
}
```

### 4. 3D Spatial Agent Network Node (`apps/web/app/components/canvas/types.ts`)
```ts
export interface AgentNodeData {
  id: string;
  name: string;
  role: 'orchestrator' | 'subagent';
  status: 'active' | 'revoked' | 'paused' | 'unfunded';
  allocatedMinor: number;
  spentMinor: number;
  reservedMinor: number;
  position: [number, number, number];
  isFunded: boolean; // Solid if true, Dashed if false
}

export interface AgentEdgeData {
  id: string;
  source: string;
  target: string;
  isAuthorized: boolean; // Solid if true, Dashed if false
  status: 'idle' | 'flowing' | 'payment_pulse' | 'rejected_flash';
}
```

---

## Code Layout
```
apps/web/
├── app/
│   ├── layout.tsx                     # Root HTML layout with Geist font and dark background
│   ├── globals.css                    # Efferd CSS tokens, .top-shade, mask lines, AG Grid overrides
│   ├── page.tsx                       # Production-grade 3-panel Agent Workspace & Delegation Dashboard
│   ├── auth-provider.tsx              # Preserved Supabase auth provider
│   └── lib/
│       ├── api.ts                     # Preserved API client with local bypass
│       ├── currency.ts                # Minor unit arithmetic & formatters
│       ├── workspace-store.ts         # Central Zustand/React workspace store with atomic reset
│       ├── mock-data.ts               # Resilient fallback fixtures for simulator and offline mode
│       └── services/                  # Extended API service calls (agents, simulator, traces)
├── components/
│   ├── ui/                            # Efferd-styled primitives (Button, Card, Badge, Dialog, Sheet, Tabs, Input)
│   ├── shell/                         # Header, Environment Switcher, Status Pill, Reconnect Banner
│   ├── wizard/                        # 5-step Create Environment Wizard with dynamic consent text
│   ├── workspace/                     # 3-Panel Workspace container (Left Rail, Center, Right Chat)
│   ├── canvas/                        # Three.js 3D Agent Network Canvas & Accessible List View
│   ├── chat/                          # Two-Voices Chat Stream (AgentSays + VerifiedBlock)
│   ├── cards/                         # BudgetPlanCard, PaymentResultCard, RejectionCard, DelegationCard, MemoryCard
│   ├── approvals/                     # Mobile-first Approval Inbox with plain-language reasons
│   ├── traces/                        # Payment Trace view (Vertical chain, Timeline, Gateway checklist)
│   ├── tables/                        # AG Grid Mandates & Activity Audit Log tables
│   ├── security/                      # Emergency controls, authority revocation, security audit
│   ├── agents/                        # Agent Library & detail inspection drawer
│   ├── developer/                     # Developer portal (MCP snippets, key management, test connection)
│   └── simulator/                     # Sandbox Attack Simulator with simulation badges
```
