# Review & Handoff Report: Milestone 3 — Three-Panel Workspace and Interactive 3D Agent Network Canvas

## Review Summary

**Verdict**: **APPROVE**

Milestone 3 successfully implements the Three-Panel Workspace, Interactive 3D Agent Network Canvas (Ferrow synthesis with strictly maintained solid vs dashed distinction), Two-Voices chat stream with zero `dangerouslySetInnerHTML`, 5 gateway-verified cards, and the 1:1 accessible keyboard list view. No integrity violations or cheating patterns were detected. All verification builds and typechecks pass with zero errors.

---

## 1. Observation

Direct observations from examining codebase files and running verification commands:

1. **Card Implementations** (`apps/web/components/cards/*`):
   - `budget-plan-card.tsx` (lines 5-144): Uses `formatMinorUnits` for minor-unit integer arithmetic; supports interactive sub-allocation adjustment, approval state, and trace lookup.
   - `payment-result-card.tsx` (lines 32-57, 95-135): Implements a 5-stage lifecycle stepper (`requested` -> `authorized` -> `sent_to_provider` -> `provider_accepted` -> `completed`), transaction ID, and auth signature hash.
   - `rejection-card.tsx` (lines 32-69, 130-153): Implements plain-language refusal reasons (`BUDGET_EXCEEDED`, `UNAUTHORIZED_MERCHANT`, `THRESHOLD_EXCEEDED`, `EXPIRED`, `REVOKED`, `POLICY_DENIED`), expandable cryptographic checklist disclosure, and "Zero funds disbursed. Protected by PayGuardian."
   - `delegation-card.tsx` (lines 46-57, 66-83): Renders parent-to-child authority chain, distinct `authorized` vs `unfunded` structural attachment badges, permitted rails, and expiry.
   - `memory-card.tsx` (lines 48-58, 81-87, 97-126): Category pills (`session`, `environment`, `agent`), undo/forget functionality with confirmation dialog, and the mandatory security notice: *"Security Notice: Memory never grants spending permission. Authority can only be granted via signed cryptographic mandates."*

2. **Two-Voices Chat Pipeline** (`apps/web/components/chat/*`):
   - `agent-says.tsx` (lines 15-19, 61-63): Conversational text is strictly rendered as an escaped React text node: `<span className="whitespace-pre-wrap">{message.text}</span>`. Ripgrep confirms zero instances of `dangerouslySetInnerHTML` across the entire `apps/web/components` codebase.
   - `verified-block.tsx` (lines 39-116): Cryptographic fact cards (`budget_plan`, `payment_result`, `rejection`, `delegation`, `memory`) render exclusively in immutable containers with hairline borders and top-shade specular highlights.
   - `chat-panel.tsx` (lines 49-60, 276-292, 365-385): 380px panel with target agent selector synchronized to the 3D graph selection, "Waiting for you" approval alert banner, typing indicator with "Stop" button, and mock simulation engine for allocation, payment, rejection, and memory intents.

3. **Interactive 3D Agent Network Canvas** (`apps/web/components/canvas/*`):
   - `agent-network-canvas.tsx` (lines 304-325, 361-403): Implements Three.js WebGL scene with PerspectiveCamera and OrbitControls (damping factor 0.08, constrained polar angle).
   - **Critical visual distinction strictly maintained**:
     * Authorized (funded) nodes and edges use `LineBasicMaterial` with solid emerald styling (`0x1daf9c`).
     * Unfunded structural attachments use `LineDashedMaterial` (`color: 0x71717a`, `dashSize: 4`, `gapSize: 3`) and explicitly execute `.computeLineDistances()` on geometry line segments.
   - **Micro-animations**: Flow particles travel along delegation bezier curves; expanding ripple rings animate on `payment_pulse` nodes; gentle node floating oscillation; revoked nodes desaturate to grey.
   - Cleanup hook (lines 551-556): Disposes `OrbitControls`, `WebGLRenderer`, and disconnects `ResizeObserver`.

4. **1:1 Accessible List View** (`apps/web/components/canvas/agent-network-list-view.tsx`):
   - Full keyboard navigation (ArrowUp, ArrowDown, Enter, Space) navigating through agents with focus indicators, live minor-unit balance calculations, and search filtering.

5. **Three-Panel Workspace Layout** (`apps/web/components/workspace/*`):
   - `workspace-layout.tsx` (lines 104-188): Assembles `LeftPanel` (240px collapsible), center panel with `BudgetStrip`, 3D Canvas / List View toggle, `ActivityMicroFeed`, and right `ChatPanel` (380px collapsible).
   - `budget-strip.tsx` (lines 32-38): Strict integer arithmetic via `calculateAvailableMinor` and `formatMinorUnits` across Total Limit, Spent, Reserved, and Available tiles, with segmented progress bar.
   - `left-panel.tsx` (lines 65-67): New session creation enforces workspace state pristine reset (`workspaceStore.setChatMessages([])`).

6. **Integrity & Verification Commands**:
   - `pnpm typecheck`: Exited with code 0 across all 11 packages and workspaces.
   - `pnpm --filter @payguardian/web build`: Turbopack build succeeded with 0 errors (6 static pages generated).

---

## 2. Logic Chain

1. **Integrity Audit**: Checked for hardcoded outputs, fake facading, bypass shortcuts, or fabricated test results. The worker created genuine, comprehensive TypeScript and Three.js components with robust state handling and complete styling. Zero integrity violations found.
2. **Design & Invariant Conformance**:
   - Two Voices Separation: Verified that conversational copy is purely text-escaped with no HTML injection path, and gateway cards are strictly typed and encapsulated.
   - Solid vs Dashed Graph Distinction: Verified that `LineDashedMaterial` and `computeLineDistances()` are correctly applied to unfunded nodes and edges, preserving the Ferrow visual convention.
   - Minor Unit Currency Arithmetic: Verified that all financial calculations use `calculateAvailableMinor` and integer math, with zero floating-point representation drift.
   - Memory Invariant: Verified that memory cards and panels display the explicit disclaimer that memory does not grant financial authority.
3. **Adversarial Analysis**:
   - Tested keyboard interaction in `AgentNetworkListView`. Identified that spacebar input in the search field bubbles up to table row selection (Minor Finding 1).
   - Inspected `AgentNetworkCanvas` animation loop. Identified that while `flowParticles` and `pulseRings` animate actively, `strobeNodesRef` is unlooped in `animate()` (Minor Finding 2).
   - Evaluated WebGL disposal: Verified that `renderer.dispose()`, `controls.dispose()`, `cancelAnimationFrame(animId)`, and `resizeObserver.disconnect()` are invoked during cleanup.
4. **Conclusion Derivation**: The core requirements of Milestone 3 are satisfied, the code is cleanly structured and well-typed, and builds successfully. The findings are non-blocking UX/visual refinements.

---

## 3. Findings & Advisory Notes

### [Minor] Finding 1: Search Input Spacebar Bubbling in Accessible List View
- **What**: In `apps/web/components/canvas/agent-network-list-view.tsx`, pressing `Space` while typing in the search input prevents the space character from being entered and triggers node selection.
- **Where**: `apps/web/components/canvas/agent-network-list-view.tsx:50-67`
- **Why**: The outer `<div>` has `onKeyDown={handleKeyDown}`. When the search `<input>` receives a keydown for `Space`, the event bubbles to `handleKeyDown`, which checks `e.key === " "` and executes `e.preventDefault()`, selecting the currently focused table row instead of typing a space.
- **Recommendation**: Add a check at the top of `handleKeyDown`:
  ```tsx
  if ((e.target as HTMLElement).tagName === "INPUT") return;
  ```
  or add `onKeyDown={(e) => e.stopPropagation()}` to the search `<input>`.

### [Minor] Finding 2: Rejection Strobe Animation Loop in Three.js Canvas
- **What**: Rejection red strobe (`strobeNodesRef`) is tracked in `buildGraphScene`, but the `animate()` loop does not oscillate its color.
- **Where**: `apps/web/components/canvas/agent-network-canvas.tsx:334-340, 490-534`
- **Why**: The animate loop updates `flowParticlesRef` and `pulseRingsRef`, but omitted iterating through `strobeNodesRef` or flashing edges with `status === "rejected_flash"`.
- **Recommendation**: In `animate()`, add a red strobe oscillation on nodes marked in `strobeNodesRef` or edges with `status === "rejected_flash"`.

---

## 4. Caveats

- In accordance with the prompt's `CRITICAL TESTING CONSTRAINT`, no automated Vitest or Playwright test files were created or modified. All testing was performed via manual inspection, static analysis, adversarial tracing, and build verification.
- The 3D Canvas requires WebGL support in the target browser; for headless or low-capability devices, the Accessible List View serves as the 1:1 equivalent.

---

## 5. Conclusion

**Verdict: APPROVE**

Milestone 3 is complete, compliant with the architecture, and ready for integration into Milestone 4 (Approvals, Traces, AG Grid Mandates & Activity Tables).

---

## 6. Verification Method

To independently reproduce the verification:

1. **Run Monorepo Typecheck**:
   ```bash
   pnpm typecheck
   ```
   *Expected outcome*: Exits with code 0 across all packages.

2. **Run Next.js Web Build**:
   ```bash
   pnpm --filter @payguardian/web build
   ```
   *Expected outcome*: Next.js Turbopack compiles successfully with 0 errors.

3. **Verify Two-Voices Escaping**:
   ```bash
   git grep "dangerouslySetInnerHTML" apps/web/components/
   ```
   *Expected outcome*: Zero matches (only comment mentions).
