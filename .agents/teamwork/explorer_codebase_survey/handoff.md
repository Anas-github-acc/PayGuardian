# Handoff Report: Codebase Survey & Technical Architecture

**Agent**: `explorer_codebase_survey`  
**Date**: 2026-10-31  
**Target Recipient**: Parent Orchestrator (`662ebdf7-a54e-4c8e-b87d-6c61fdc3fb5c`)  
**Working Directory**: `/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_codebase_survey/`

---

## 1. Observation

### Codebase Inspection Facts & Verbatim References
1. **Frontend Framework & Versions (`apps/web/package.json:12-25`)**:
   - `next`: `"16.4.2"`
   - `react`: `"19.3.1"`
   - `react-dom`: `"19.3.1"`
   - `ag-grid-community`: `"36.2.0"`
   - `ag-grid-react`: `"36.2.0"`
   - `@supabase/supabase-js`: `"2.99.2"`
   - Dev dependencies: `@types/node` (26.6.5), `@types/react` (19.3.0), `@types/react-dom` (19.3.0), `vitest` (5.0.5).
   - **Missing packages**: No `three`, `@react-three/fiber`, or `@react-three/drei`. No `tailwindcss`, `postcss`, or `autoprefixer`. No `lucide-react`. No Radix UI or Base UI primitives.

2. **Styling Structure (`apps/web/app/globals.css:1-9, 27-34`)**:
   - Styling is defined using 342 lines of plain CSS classes (`.shell`, `.auth-card`, `.card`, `.payment-grid`, `.control-panel`).
   - Root custom properties define dark mode:
     ```css
     :root {
       color-scheme: dark;
       --background: #08111f;
       --panel: #101d30;
       --text: #e9f1ff;
       --muted: #9fb1ca;
       --accent: #65e6b4;
       --border: rgba(159, 177, 202, 0.2);
     }
     ```
   - Tailwind CSS is not configured.

3. **Current Page Architecture (`apps/web/app/page.tsx:57-511`)**:
   - Monolithic single-page dashboard rendering all sections in a vertical stack: Hero, Create Environment card, Environments list, Registered Agents grid, Emergency Controls, Approvals inbox, Mandates grid, Activity Audit Trail grid, and PayPal operations grid.
   - Live activity updates currently rely on `setInterval` polling:
     ```ts
     // apps/web/app/page.tsx:158-178
     const interval = setInterval(async () => {
       const res = await api<{ events: ActivityEvent[]; cursor: string | null }>(
         `/v1/environments/${selectedEnvironmentId}/activity${query}`,
       );
     }, 3000);
     ```

4. **API Gateway Routes & Services (`apps/api/src/app.ts:68-153`)**:
   - Fastify `5.12.7` registered with Swagger (`/docs/json`), CORS, and Supabase client.
   - Routes registered:
     - Phase 1: `/v1/environments`, `/v1/environments/:id/agents` (root, children, credentials rotate & revoke).
     - Phase 2: `/v1/environments/:id/mandates/root`, `/v1/mandates/:id/delegations`, `/v1/mandates/:id/revocations`, `/v1/mandates/:id/check`, `/v1/mandates/:id/chain`.
     - Phase 3: `/v1/environments/:id/ledger/accounts`, `/allocations`, `/reclaims`, `/actions/reserve`, `/actions/:id/capture`, `/actions/:id/release`, `/actions/:id/trace`.
     - Phase 4: `/v1/environments/:id/approvals` (list, create, approve, reject), `/sessions`, `/runs`, `/actions/simulate`.
     - Phase 6: `/v1/environments/:id/pause`, `/resume`, `/revoke`, `/agents/:id/disable`, `/agents/:id/revoke`, `/mandates`, `/activity` (with `since` and `limit`).
     - PayPal: `/v1/environments/:id/payments/paypal/orders`, `/operations`, `/:actionId`, `/:actionId/capture`, `/:actionId/reconcile`, `/v1/webhooks/paypal`.
   - **Streaming & SSE**: No `text/event-stream` or SSE endpoints exist in `apps/api`.
   - **Mock Fallbacks**: Complete in-memory stores (`InMemoryRegistry`, `InMemoryAuthorityStore`, `InMemoryLedgerStore`, `InMemoryApprovalStore`, `InMemorySessionStore`, `InMemoryPayPalOperationStore`, `InMemoryAuditEventStore`) exist across all routes and activate whenever Supabase credentials are not provided.

5. **Contracts and Domain Invariants (`packages/contracts`, `packages/domain`)**:
   - Strict integer minor unit currency representation (`budgetLimitMinor`, `allocatedMinor`, `spentMinor`, `reservedMinor`, `amountMinor`) enforced with `Number.isSafeInteger(...)` and positive assertions. Floating-point arithmetic is completely absent from business logic.
   - Full DTO types available in `packages/contracts/src/index.ts`.

6. **Taste Skill & Reference Sites**:
   - Installed Taste Skill located at `/home/anas/.agents/skills/design-taste-frontend/SKILL.md` with explicit app screen rules in `references/app-screens.md`.
   - Live references inspected:
     - TurboStarter (`https://demo.turbostarter.dev/`): App shell, navigation drawer, sticky blurred header, segmented panels.
     - Efferd (`https://efferd.com/`): Typography (Geist/Outfit), 1px precision borders (`border-border/50`), top-shade cards, high contrast, clean palette.
     - Ferrow (`https://illos-ferrow-template.vercel.app/#start`): 3D spatial multi-agent network canvas, node positioning, depth, animated edge pulses, payment pulses, rejection flashes, revocation muting.

7. **Build & Typecheck Command Execution**:
   - `pnpm typecheck` was executed and completed with exit code 0 across all packages.

---

## 2. Logic Chain

1. **Need for Design System Setup (R1)**:
   - *Observation*: `apps/web` has no Tailwind, no UI primitive library, and relies on 342 lines of custom CSS.
   - *Deduction*: Before building the three-panel workspace or complex wizards, Tailwind CSS and shadcn-style UI primitives (buttons, dialogs, drawers, cards, tabs, tooltips) along with `lucide-react` must be installed. This establishes the unified design tokens combining TurboStarter layout, Efferd styling, and Taste Skill anti-slop guidelines.

2. **Preservation of Existing Core Logic**:
   - *Observation*: Existing API client (`apps/web/app/lib/api.ts`) seamlessly handles both production Supabase JWTs and local development headers (`x-local-user-id`). The AG Grid row mappers correctly format minor units into display strings (`(amountMinor / 100).toFixed(2)`).
   - *Deduction*: These data structures and API helpers must be preserved and reused directly, rather than rewritten.

3. **3D Visualization Architecture (R3)**:
   - *Observation*: The app is running Next.js 16.4.2 and React 19.3.1. Ferrow provides an interactive 3D spatial network layout of agents.
   - *Deduction*: To avoid peer-dependency issues with React 19, Three.js should be used directly with a React canvas wrapper (`useRef` + `useEffect`), driving camera controls, 3D meshes for nodes, and spline curves for edges. Edges must be solid for authorized delegations and dashed for unfunded attachments. State animations (authority flow down edges, pulse on payment, red flash on rejection, grey on revocation) can be driven cleanly via lightweight uniforms or material properties.

4. **Security & State Isolation Invariants (R2, R3)**:
   - *Observation*: The specification mandates that switching environments must clear chat, graph, and selection state to prevent cross-tenant data leakage. Additionally, gateway facts (budgets, decisions, traces) must never be injectable from agent text.
   - *Deduction*: A central workspace store (e.g. Zustand) must implement an atomic `resetWorkspace()` on environment change. Dedicated verified components (`<VerifiedBlock />`, `<BudgetPlanCard />`) must strictly render structured gateway payloads and never parse raw agent strings as markup.

5. **AG Grid Integration & Payment Traces (R4)**:
   - *Observation*: `ag-grid-community@36.2.0` is already installed. Currently it renders static client arrays.
   - *Deduction*: AG Grid should be themed with `themeQuartz` custom dark variables matching Efferd's aesthetic, connected to server-side pagination for large audit histories, and configured with `onRowClicked` to trigger the Payment Trace view.

6. **Missing Gateway Endpoints (R3, R5)**:
   - *Observation*: `apps/api` has no SSE streaming endpoint, no chat assistant endpoint, no prebuilt agent catalog endpoint, and no explicit attack scenario triggers.
   - *Deduction*: Frontend services must include mock fallbacks or client-side orchestration for the Agent Library, MCP connection handshake, and Attack Simulator, while API endpoints should be supplemented or polled via the existing resilient activity stream.

---

## 3. Caveats

1. **Testing Constraint**: Testing instruction strictly states: *"NOTE: Do NOT write any unit tests, test files, or end-to-end test specs. The user will test manually. Skip all Vitest and Playwright test creation entirely."* All implementation efforts must focus exclusively on source code and visual verification via CDP.
2. **External PayPal & LLM Services**: In local development, PayPal calls and LLM generation rely on sandbox mock responses. Real payment execution is bounded by the PayPal sandbox credentials in `.env`.
3. **Database Mode**: The backend automatically falls back to in-memory mode when Supabase credentials are absent. UI state persistence across full API restarts requires configured database credentials.

---

## 4. Conclusion

The PayGuardian codebase possesses a remarkably sound domain and backend core. All necessary business invariants (hierarchical agent delegation, double-entry budgeting in integer minor units, atomic reservations, human approvals, and hash-chained audit trails) are fully functional.

The primary task ahead is a complete frontend transformation of `apps/web`:
- Replacing the vertical prototype with a **three-panel workspace** (Sessions/Memory, Interactive 3D Canvas + Budget/Feed, Main Agent Chat with Verified Cards).
- Upgrading the shell with an environment switcher, status pills, and reconnect banners.
- Delivering the 5-step Create-Environment Wizard with dynamic plain-language consent generation.
- Providing mobile-first Approvals, interactive Payment Traces, AG Grid audit tables, an Agent Library, a Developer MCP portal, and a Sandbox Attack Simulator.

Detailed technical findings and integration recommendations are documented in:
`/home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_codebase_survey/technical_survey.md`

---

## 5. Verification Method

To independently verify the survey observations:
1. **Verify Frontend Dependencies**:
   ```bash
   cat apps/web/package.json
   ```
   Confirm Next.js `16.4.2`, React `19.3.1`, AG Grid `36.2.0`, and absence of `three` / `tailwindcss`.
2. **Verify Monorepo Compilation**:
   ```bash
   pnpm typecheck
   ```
   Must exit with code 0 across all packages.
3. **Inspect Gateway Routes & Mock Fallbacks**:
   ```bash
   view_file apps/api/src/app.ts
   view_file apps/api/src/phase1.ts:485-504
   ```
   Confirm route modules and `InMemoryRegistry` fallback logic.
4. **Verify Integer Minor Units & Domain Invariants**:
   ```bash
   view_file packages/domain/src/index.ts:70-87
   view_file packages/contracts/src/index.ts:61-166
   ```
   Confirm `budgetLimitMinor`, `allocatedMinor`, `spentMinor`, and absence of floating-point math.
