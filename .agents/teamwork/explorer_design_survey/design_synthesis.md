# PayGuardian Design System Specification & Synthesis

> **Author**: Explorer Subagent (Visual Design & Reference Synthesis)  
> **Version**: 1.0.0 — Production Grade  
> **Target Application**: PayGuardian Agent Workspace & Delegation Dashboard  
> **Governing Guideline**: Taste Skill (`references/app-screens.md` — Anti-Slop Frontend Philosophy)  
> **References Synthesized**:  
> 1. **TurboStarter** (`https://demo.turbostarter.dev/`) — Layout structure, 3-panel architecture, navigation ergonomics, command patterns  
> 2. **Efferd** (`https://efferd.com/`) — Visual identity, dark obsidian palette, specular rim lights (`top-shade`), subtle dome luminescence, high-density SaaS styling  
> 3. **Ferrow** (`https://illos-ferrow-template.vercel.app/#start`) — 3D spatial multi-agent architecture canvas, solid vs dashed node visual distinction, live state transitions  

---

## 1. Executive Summary & Synthesis Strategy

PayGuardian is a mission-critical financial governance dashboard for autonomous AI agents. Its central purpose is to **make invisible authority visible** — translating complex cryptographic mandates, delegation chains, minor-unit budgets, and gateway authorization decisions into an immediate, intuitive, and trustworthy human interface.

Generic AI dashboard generation suffers from severe tells: glowing neon gradients, arbitrary sparklines on every KPI tile, icons in pastel circles, bloated 24px drop shadows, and fake vanity figures. To deliver an award-winning, production-grade interface, we fuse three distinct references through the rigorous discipline of **Taste Skill**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PAYGUARDIAN DESIGN SYSTEM                       │
├───────────────────┬────────────────────────────┬───────────────────────┤
│   TURBOSTARTER    │           EFFERD           │        FERROW         │
│  Structural Shell │      Visual Identity       │  3D Network Canvas    │
├───────────────────┼────────────────────────────┼───────────────────────┤
│ • 3-Panel Layout  │ • True Obsidian (#000000)  │ • Spatial Coordinate  │
│ • Collapsible Nav │ • Card Elevation (#0d0d0d) │   Tree Layout         │
│ • Command Palette │ • Hairline Border (11% w)  │ • Solid (Authorized)  │
│ • Floating Header │ • Top-Shade Rim Highlight  │   vs Dashed (Unfunded)│
│ • Dialog/Drawers  │ • Subdued Color on Data    │ • Authority Flow Live │
│ • Responsive Fold │ • Crisp Micro-Typography   │   State Animations    │
└───────────────────┴────────────────────────────┴───────────────────────┘
                                   │
                   TASTE SKILL ANTI-SLOP DISCIPLINE
   [Color on data not chrome · No fake sparklines · Zero float math · Two voices]
```

---

## 2. Design Philosophy: Making Invisible Authority Visible

### 2.1 The Two Voices Principle
A core security requirement of PayGuardian is that **agent-written conversation must never masquerade as cryptographic truth**:
- **Gateway Facts (`VerifiedBlock`)**: Rendered exclusively via hardened, dedicated UI components with distinct hairline double borders, verification shield badges, and immutable data layouts. Agent markdown cannot emit these components.
- **Agent Speech (`AgentSays`)**: Displayed in standard conversational chat bubbles, strictly HTML-escaped, with subtle muted borders, clearly attributing subjective agent chatter.

### 2.2 Authority Graph Duality
- **Solid Outline / Solid Edge**: Represents active, legally-backed delegated authority with an explicit minor-unit monetary allocation (`limitMinor`).
- **Dashed Outline / Dashed Edge**: Represents a structural attachment (an agent plugged into the hierarchy) that possesses **zero spending authority** until funded.

### 2.3 Strict Minor-Unit Monetary Integrity
All currency amounts are stored and manipulated as integer minor units (e.g., paisa / cents: ₹10,000 = `1000000`).
- Display strings format with fixed decimal points via localized helpers.
- Numerals are set in tabular numbers (`font-variant-numeric: tabular-nums`) right-aligned in data tables to maintain decimal alignment.
- Zero floating-point operations occur on the frontend.

---

## 3. Design Tokens Specification

### 3.1 Color Palette & Theme Tokens
PayGuardian adopts an ultra-premium Obsidian Dark mode inspired by Efferd and Ferrow. In accordance with Taste Skill, chrome remains achromatic and dark; chromatic hues are strictly reserved for data state indicators (under 4% total pixel coverage).

#### Core Theme CSS Variables (`:root[data-theme="dark"]` / `.dark`)

```css
:root {
  /* Color Scheme */
  color-scheme: dark;

  /* Surface Hierarchy (Obsidian & Deep Slate) */
  --bg-canvas: #000000;            /* Primary viewport ground (Efferd true black) */
  --bg-surface: #09090b;           /* Sidebar, panel underlay */
  --bg-card: #0d0d0d;              /* Standard resting card surface */
  --bg-card-hover: #141414;        /* Interactive card hover */
  --bg-elevated: #18181b;          /* Menus, dialogs, drawers, popovers */
  --bg-active: #222222;            /* Active tab, pressed pill */
  --bg-muted: #27272a;             /* Subtle input fills, tag backgrounds */

  /* Hairline Borders & Dividers */
  --border-subtle: rgba(255, 255, 255, 0.08); /* 8% white for internal dividers */
  --border-default: rgba(255, 255, 255, 0.11);/* 11% white (Efferd standard border) */
  --border-strong: rgba(255, 255, 255, 0.18); /* 18% white for focused/active states */
  --border-dashed: rgba(255, 255, 255, 0.22); /* Dashed edges for unfunded agents */

  /* Text & Ink Hierarchy */
  --text-primary: #fcfcfc;          /* 99% ink for headlines and primary numbers */
  --text-secondary: #a1a1aa;        /* Muted supporting body copy */
  --text-tertiary: #71717a;         /* Micro-labels, meta timestamps, axis ticks */
  --text-disabled: #52525b;         /* Deactivated controls */

  /* Semantic Authority & State Colors (Ferrow & Efferd aligned) */
  /* Authorized / Active / Flowing */
  --authority-active: #1daf9c;      /* Ferrow primary teal/emerald */
  --authority-active-tint: rgba(29, 175, 156, 0.12);
  --authority-active-glow: rgba(29, 175, 156, 0.25);

  /* Pending / Awaiting User Approval */
  --state-pending: #f59e0b;         /* Amber 500 */
  --state-pending-tint: rgba(245, 158, 11, 0.12);

  /* Gateway Denied / Rejected / Rule Violation */
  --state-rejected: #ff6568;        /* Efferd warm destructive coral */
  --state-rejected-tint: rgba(255, 101, 104, 0.12);
  --state-rejected-glow: rgba(255, 101, 104, 0.35);

  /* Suspended / Paused / Revoked / Unfunded */
  --state-revoked: #71717a;         /* Monochromatic slate */
  --state-revoked-tint: rgba(113, 113, 122, 0.14);

  /* Budget Strip Segments */
  --budget-spent: #71717a;          /* Muted solid slate */
  --budget-reserved: #f59e0b;       /* Amber committed */
  --budget-available: #1daf9c;      /* Emerald available */
}
```

### 3.2 Specular Rim-Lighting (`top-shade`) & Subtle Luminescence
Efferd's signature premium tactile feel is achieved using dual optical techniques:
1. **`top-shade` Specular Highlight**: A 1px crisp top-rim shadow simulating overhead studio lighting on bevelled dark obsidian surfaces.
2. **Top Dome Radial Luminescence**: A faint, diffused ambient light gradient applied to hero cards.

```css
/* Efferd Specular Top-Shade Utility */
.top-shade {
  position: relative;
  background-clip: border-box;
}

.top-shade::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: 0 -1px 0 0 rgba(255, 255, 255, 0.08);
}

/* Subtle Dome Luminescence for Active Nodes and Cards */
.dome-glow {
  background-image: radial-gradient(
    80% 100% at 50% 0%,
    rgba(255, 255, 255, 0.04),
    transparent 70%
  );
}

/* Gateway Verified Card Accent Glow */
.verified-glow {
  background-image: radial-gradient(
    90% 120% at 50% 0%,
    rgba(29, 175, 156, 0.06),
    transparent 80%
  );
}
```

### 3.3 Typography Hierarchy
PayGuardian specifies a clean, neo-grotesque sans-serif primary face (`Geist Sans` or `Inter`, falling back to clean system sans), with `Geist Mono` or `JetBrains Mono` for cryptographic hashes, agent keys, JSON, and numeric balances.

| Level | Size | Weight | Tracking | Line Height | Usage |
|---|---|---|---|---|---|
| **App Title / H1** | 24px (1.5rem) | 600 SemiBold | -0.025em | 1.2 | Page / Workspace top headers |
| **Section Title / H2**| 18px (1.125rem) | 600 SemiBold | -0.02em | 1.3 | Panel headers, Drawer titles |
| **Component Header** | 14px (0.875rem) | 500 Medium | -0.01em | 1.4 | Card titles, Group labels |
| **Body Default** | 13px (0.8125rem)| 400 Regular | 0 | 1.5 | Chat text, table data, descriptions |
| **Micro Label / Meta**| 11px (0.6875rem)| 500 Medium | +0.02em | 1.3 | Sentence-case labels, status pills |
| **Monospace / Num** | 12-14px | 500 Medium | 0 (tabular) | 1.4 | Currency amounts, mandate IDs |

*Taste Skill Rule Enforced*: No uppercase tracked table headers. All headers use 12px neutral-grey sentence case (`Holder agent`, `Spent to date`, `Available`).

### 3.4 Corner Radii & Elevation Scales
To avoid "blobby" template geometry, corner radii are tightly structured:
- **Badge / Pill**: `rounded-full` (9999px) or `rounded-md` (6px) for micro-tags.
- **Buttons / Inputs / Grid Cells**: `rounded-md` (6px).
- **Cards / Panels**: `rounded-lg` (8px to 10px).
- **Dialogs / Drawers / Canvases**: `rounded-xl` (12px).
- **Elevation**: Elevation is communicated via tone steps (`#000` → `#09090b` → `#0d0d0d` → `#18181b`) plus a 1px border. Drop shadows are strictly limited to floating overlays (`box-shadow: 0 16px 32px rgba(0,0,0,0.4)` on dialogs and menus).

---

## 4. App Shell Architecture (TurboStarter 3-Panel Workspace)

The desktop layout is designed around an uncrowded, productive 3-panel architecture that balances persistent control with immersive 3D spatial monitoring.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: [Logo PayGuardian] [Env Switcher: Goa Trip ▾] [Status: Active ●] [Sandbox Badge]    [Pause] [Bell] │
├───────────────────┬────────────────────────────────────────────────────┬───────────────────────────────┤
│ PANEL 1 (220px)   │ PANEL 2 (Flex Center Canvas)                       │ PANEL 3 (380px)               │
│ Left Rail         │ 3D Spatial Agent Graph                             │ Chat & Decision Stream        │
│                   │                                                    │                               │
│ ┌───────────────┐ │   [Structure / Authority / Both]      [Reset Cam]  │ ┌───────────────────────────┐ │
│ │ Sessions      │ │                                                    │ │ Target: [Main Agent ▾]    │ │
│ │ ▸ Goa Itinerary│ │                 (You: ₹10,000)                    │ ├───────────────────────────┤ │
│ │ ▸ Hotel Search│ │                       │ (Solid Line ₹10k)          │ │ Agent: "I've structured   │ │
│ │ + New Session │ │                 [Main Agent]                       │ │ the budget split..."      │ │
│ └───────────────┘ │               ┌───────┴───────┐                    │ │                           │ │
│                   │      (Solid ₹4k)             (Solid ₹4k)           │ │ ┌───────────────────────┐ │ │
│ ┌───────────────┐ │      [Travel Agent]        [Hotel Agent]           │ │ │ Verified Budget Plan  │ │ │
│ │ Memory        │ │             │ (Dashed Line)                        │ │ │ Travel: ₹4,000        │ │ │
│ │ [Env][Sess][Ag]│ │     [Local Guide (Unfunded)]                      │ │ │ Hotel:  ₹4,000        │ │ │
│ │ • Window seat │ │                                                    │ │ [Approve] [Edit]        │ │ │
│ │ • Non-veg food│ │ ────────────────────────────────────────────────── │ │ └───────────────────────┘ │ │
│ └───────────────┘ │ BUDGET STRIP: Spent: ₹2k | Reserved: ₹4k | Avail: ₹4k│ │ [Ask agent...        ] [Send]│
│                   │ ACTIVITY: ● 14:02 Hotel Agent reserved ₹4,000      │ └───────────────────────────┘ │
└───────────────────┴────────────────────────────────────────────────────┴───────────────────────────────┘
```

### 4.1 Top App Bar
- **Environment Switcher**: Selects current workspace context. Switching resets graph, chat, and selection state completely to guarantee zero cross-environment data leakage.
- **Environment Status Pill**: Displays `Active` (green dot), `Paused` (amber pause), or `Revoked` (grey strike-through).
- **Persistent Warning / Reconnect Banner**: If WebSocket/real-time disconnects, a slim amber top banner displays: `"Live updates paused, reconnecting..."` and data freshness is marked stale.
- **Sandbox Badge & Pause Environment Trigger**: Prominent emergency stop button providing immediate environment suspension.

### 4.2 Panel 1: Left Navigation, Sessions & Memory
- **Width**: Fixed 220px on desktop (folds into slide-out drawer on `< 1100px`).
- **Sessions Queue**: Clean vertical list with active indicators, unread approval badges, and "+ New session" button.
- **Memory Tabs (`Session` / `Environment` / `Agent`)**: Durable notes pinned or created by agents, accompanied by the mandatory security notice: *"Memory never grants spending permission."*

### 4.3 Panel 2: Central Interactive 3D Canvas
- **Central Canvas**: Houses the interactive 3D multi-agent network (detailed in Section 5).
- **Sub-Graph Controls**: Top-right floating glass pill with toggles for View Mode (`Structure`, `Authority`, `Both`), `Reset Camera`, and `List View` keyboard-accessible alternative.
- **Budget Strip (Under Canvas)**: Continuous horizontal bar divided into Spent (muted slate), Reserved (amber), and Available (emerald), with human-readable numbers.
- **Activity Feed (Bottom Strip)**: Live streaming 1-line event feed displaying timestamp, actor, amount, and plain-language denial reason. Clicking any event routes to the Payment Trace view.

### 4.4 Panel 3: Chat & Gateway Decision Stream
- **Width**: 380px desktop, collapsible to icon trigger or right drawer on tablet.
- **Agent Target Selector**: Main Agent by default, or direct channel to any attached subagent.
- **Inline Gateway Verification Cards**:
  - `BudgetPlanCard`: Displays proposed budget breakdown with inline editable inputs and one-click cryptographic approval.
  - `ApprovalCard`: Mobile-ready approval card showing request chain (`You → Main → Hotel`), merchant, and Approve/Reject triggers.
  - `PaymentResultCard`: Payment completion card with timeline.
  - `RejectionCard`: Plain-language explanation for why a payment was refused (e.g., *"Hotel Agent asked for ₹5,000 but only has ₹200 left"*).

---

## 5. 3D Multi-Agent Architecture Visualization (Ferrow Engine)

Inspired by Ferrow's clean isometric architectural plates, PayGuardian represents the multi-agent delegation hierarchy in a spatial 3D canvas that transforms abstract security rules into tangible spatial structures.

### 5.1 3D Spatial Hierarchy & Layout

```
                        [ Level 0: Human Principal (You) ]
                                        │
                                        ▼  (Solid Edge ₹10,000)
                     [ Level 1: Orchestrator / Main Agent ]
                                        │
                     ┌──────────────────┴──────────────────┐
                     ▼                                     ▼
        (Solid Edge ₹4,000)                       (Solid Edge ₹4,000)
     [ Level 2: Travel Subagent ]             [ Level 2: Hotel Subagent ]
                     │                                     │
                     ▼ (Dashed Edge - Unfunded)            ▼ (Solid Edge ₹2,000)
         [ Flights Helper (Attached) ]             [ Booking Gateway Agent ]
```

- **Coordinates**: The root principal node sits at `(0, 180, 0)`, the Orchestrator at `(0, 80, 0)`, and subagents fan out radially or hierarchically along the X and Z axes at `Y = -60` and `Y = -180`.
- **Node Geometry**: Extruded geometric prism plates with 3 distinct visible isometric planes:
  - **Top Face**: Lightest tint (`--bg-card` or subtle accent dome fill).
  - **Left Face**: 1 tone step darker (`rgba(255, 255, 255, 0.05)` over obsidian).
  - **Right Face**: 2 tone steps darker (`rgba(255, 255, 255, 0.02)` over obsidian).

### 5.2 Solid vs. Dashed Visual Distinction
This is the single most critical visual rule in the system:
- **Authorized Nodes & Delegations**: Rendered with a solid, luminous 1.5px border (`var(--authority-active)` `#1daf9c`), an active status dot, and an amount label floating above the edge (`₹4,000.00`).
- **Unfunded Attached Agents**: Rendered with a **dashed 1px border** (`stroke-dasharray: 4 4`, opacity 0.45), muted monochrome fill, and a label indicating `"Attached · ₹0 allocation"`.

### 5.3 Live State Visual Dynamics & Micro-Animations
All animations respect `prefers-reduced-motion` and use Ferrow's signature easing (`cubic-bezier(0.23, 1, 0.32, 1)`):

1. **Authority Flow (Delegation Granted)**:
   - When the user approves a budget allocation, a discrete energy packet (a glowing pill or light particle) slides smoothly down the edge from parent to child over 600ms.
   - Upon arrival, the child node's top face briefly illuminates (`--authority-active-tint`), and its allocation counter ticks up with tabular number easing.

2. **Payment Execution Pulse**:
   - When an authorized payment completes, a soft circular shockwave ripples outward from the spending node (2s duration, opacity fading from 0.4 to 0).
   - The node's mini budget bar immediately updates its `spentMinor` segment.

3. **Gateway Rejection Flash**:
   - If an agent attempts an unauthorized or over-budget transaction, the connecting edge and the agent node execute an instantaneous red alert strobe (`#ff6568` at 100% opacity for 180ms, easing back to resting state).
   - A `ReasonChip` badge anchors above the node with the plain-language cause (e.g. *"Over budget"*).

4. **Revocation Desaturation & Strike-Through**:
   - When authority is revoked, all color immediately drains from the node and its entire child subtree (`filter: grayscale(1)` and opacity drops to 0.4).
   - A diagonal slash badge overlays the node icon, and solid delegation edges transition into broken, dashed grey lines.

### 5.4 Camera Navigation & Ergonomics
- **Orbit, Pan & Zoom**: Smooth mouse drag orbit, right-click pan, and scroll wheel zoom with strict damping.
- **Keyboard List View Toggle**: In compliance with accessibility standards, a persistent toggle switches the 3D canvas into a clean, hierarchical tree table navigable via standard arrow keys, Enter, and Spacebar.

---

## 6. Component Blueprints & Ergonomics

### 6.1 `BudgetBar`
Continuous segmented bar displaying the state of capital allocation:
- **Segments**: `Spent` (neutral slate `#52525b`), `Reserved` (amber `#f59e0b`, labeled *"committed, not yet spent"*), and `Available` (emerald `#1daf9c`).
- **Height**: 8px resting, expands to 12px on hover with tooltips showing exact minor-unit figures and percentage split.

### 6.2 `AuthorityBadge`
- **Pill Size**: Height 20px, font size 11px, weight 500.
- **States**:
  - `Authorized`: Solid 1px border, `#1daf9c` text on `rgba(29, 175, 156, 0.1)` background, icon: `ShieldCheck`.
  - `Unfunded`: Dashed 1px border, `#a1a1aa` text on transparent background, icon: `Link2`.

### 6.3 `ApprovalCard` (Mobile-First)
- **Container**: `bg-[#0d0d0d]`, `border-[#ffffff1c]`, `top-shade`, `rounded-lg`, padding 16px.
- **Chain Header**: Breadcrumb trail `You → Main Agent → Hotel Agent`.
- **Amount Headline**: Tabular large figure (e.g., `₹4,250.00`).
- **"Agent Says" Sub-Block**: Distinct grey container (`bg-[#18181b]`, italicized, escaped copy) isolating the agent's prose.
- **Actions**: Two full-touch buttons (min height 44px):
  - Primary **Approve**: Solid ink `#fcfcfc` with `#000` text, active scale `0.97`.
  - Secondary **Reject**: Outline border `#ffffff1c` with hover red accent.

### 6.4 `PaymentTimeline` (Lifecycle Stepper)
Horizontal or vertical stepped track detailing the 5 gateway lifecycle stages:
1. `Requested` → 2. `Authorized by Gateway` → 3. `Sent to Provider` → 4. `Provider Accepted` → 5. `Completed / Settled` (or `Uncertain - Money Held`).
- Active stage is marked by a filled emerald disc with halo; completed stages show hairline checkmarks; failed stages display coral cross marks.

### 6.5 `ReasonChip`
Converts technical gateway rejection codes into human sentences:
- `OVER_BUDGET`: *"Hotel Agent asked for ₹5,000 but only has ₹200 left."*
- `EXPIRED`: *"This permission ended on 12 Nov."*
- `REVOKED`: *"This agent's permission was cancelled, so it cannot spend."*
- `OUT_OF_SCOPE`: *"This agent isn't allowed to buy electronics."*
- `NEEDS_APPROVAL`: *"This payment is above your approval limit. Waiting for you."*
- Clicking the chip expands the cryptographic verification checklist (signatures, expiry, hashes).

### 6.6 `CreateEnvironmentWizard` (5 Steps)
1. **Basics**: Purpose, template selection (Vacation, Daily Budget).
2. **Budget & Time**: Minor-unit amount input, currency selector, calendar date picker.
3. **Agents**: Main agent pre-selected; optional library agent attachments (all start unfunded).
4. **Guardrails**: Delegation depth limits, per-transaction approval threshold.
5. **Review & Consent**: Plain-language consent statement generated strictly from entered mandate values (e.g. *"You are allowing the Main Agent to spend up to ₹10,000 on travel until 12 Nov..."*). Confirmation requires explicit approval button.

---

## 7. AG Grid Quartz Dark Theme Styling

The existing AG Grid installation (`ag-grid-community` 36.2) is styled to seamlessly match the Efferd/Ferrow aesthetic, eliminating standard enterprise clunkiness:

```css
/* Custom AG Grid Dark Styling aligned with Efferd */
.ag-theme-quartz-dark {
  --ag-background-color: #09090b;
  --ag-header-background-color: #09090b;
  --ag-odd-row-background-color: #09090b;
  --ag-row-hover-color: #141414;
  --ag-selected-row-background-color: #1a1a1a;
  --ag-border-color: rgba(255, 255, 255, 0.08);
  --ag-header-foreground-color: #a1a1aa;
  --ag-foreground-color: #fcfcfc;
  --ag-font-family: inherit;
  --ag-font-size: 13px;
  --ag-grid-size: 6px;
  --ag-row-height: 42px;
  --ag-header-height: 38px;
}

.ag-theme-quartz-dark .ag-header-cell-label {
  font-weight: 500;
  font-size: 12px;
  text-transform: none; /* Sentence case enforced */
  color: #71717a;
}

.ag-theme-quartz-dark .ag-cell {
  line-height: 42px;
}

.ag-theme-quartz-dark .ag-cell.numeric-cell {
  font-variant-numeric: tabular-nums;
  text-align: right;
  font-family: var(--font-mono, monospace);
}
```

---

## 8. Synthesis Summary Matrix

| Requirement | TurboStarter Reference | Efferd Reference | Ferrow Reference | PayGuardian Unified Implementation |
|---|---|---|---|---|
| **App Shell** | 3-Panel workspace, collapsible sidebar, floating header | Obsidian surfaces, top-shade rim highlights | Clean topbar with data-theme support | Fixed 220px nav rail, fluid 3D canvas, 380px chat panel on true black (`#000`) |
| **Color System** | Standard shadcn dark/light tokens | Deep `#000` ground, `#0d0d0d` cards, `11%` white borders | `#1daf9c` emerald, `#3fdec9` dark teal, `#efebe5` text | Achromatic obsidian base; color reserved strictly for authority/state (<4% pixels) |
| **Authority Display**| Standard status badges | Hairline glowing cards with subtle dome gradient | Isometric plates with solid vs dashed edges | Solid luminous border for funded nodes; dashed border for unfunded structural nodes |
| **State Dynamics** | Subtle UI transitions | Specular highlights (`top-shade`), soft opacity | Animated SVG isometric plates, flow pulses, rejection kicks | Live energy packets on delegation, soft ripple on payment, red strobe on rejection |
| **Typography** | Inter / Geist sans default | Outfit / Geist / JetBrains Mono | Newsreader / Geist / Geist Mono | Geist Sans body/headings, Geist Mono for amounts & hashes, sentence-case labels |
| **Data Integrity**| Form inputs | Clean input fields | Verified event log printer | Zero floating-point calculations, minor-unit formatting, verified cards isolated from chat |

---
*Report synthesized and formulated by Explorer Subagent for immediate integration into the PayGuardian architecture.*
