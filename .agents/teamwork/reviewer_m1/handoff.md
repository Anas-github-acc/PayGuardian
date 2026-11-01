# Milestone 1 Review Handoff Report: Design System, Dependencies & Layout Foundation

> **Reviewer Subagent**: `reviewer_m1`  
> **Milestone**: M1 — Design System, Dependencies & Layout Foundation  
> **Verdict**: **APPROVE**  
> **Date**: 2026-10-31  

---

## Review Summary

**Verdict**: **APPROVE**

Milestone 1 delivers a high-fidelity foundation adhering strictly to the Efferd design language, Taste Skill directives, and critical security and financial invariants. All required packages (`three`, `lucide-react`, `clsx`, `tailwind-merge`, `tailwindcss`, `postcss`, `autoprefixer`, `@types/three`) are installed, Tailwind and PostCSS operate cleanly with Turbopack, AG Grid dark Quartz styles match the Obsidian palette, `currency.ts` implements exact zero-float integer arithmetic with safe integer verification, and all 9 UI primitives (`button`, `card`, `badge`, `dialog`, `sheet`, `tabs`, `tooltip`, `input`, `select`) are fully composable and barrel-exported. No integrity violations or shortcuts were found. Typecheck and production build pass with 0 errors.

---

## 1. Observation

1. **Dependency Configuration (`apps/web/package.json`)**:
   - `apps/web/package.json` contains:
     - `dependencies`: `clsx` (^2.1.1), `lucide-react` (^1.65.0), `tailwind-merge` (^3.7.0), `three` (^0.187.0).
     - `devDependencies`: `@types/three` (^0.186.0), `autoprefixer` (^10.6.2), `postcss` (^8.5.32), `tailwindcss` (^3.4.19).
   - Monorepo builds cleanly with Turbopack and TypeScript 6.0 path mapping (`"@/*": ["./*"]`).

2. **Tailwind and PostCSS Configuration**:
   - `apps/web/postcss.config.mjs`: Configures `tailwindcss` and `autoprefixer` plugins.
   - `apps/web/tailwind.config.ts`:
     - Defines `ground: "#000000"`, `surface: { DEFAULT: "#09090b", card: "#0d0d0d", hover: "#141414", elevated: "#18181b", active: "#222222", muted: "#27272a" }`.
     - Defines `hairline: { DEFAULT: "#ffffff1c", subtle: "rgba(255, 255, 255, 0.08)", strong: "rgba(255, 255, 255, 0.18)", dashed: "rgba(255, 255, 255, 0.22)" }`.
     - Configures specular `boxShadow: { "top-shade": "0 -1px color-mix(in oklab, var(--foreground) 8%, transparent)" }`.
     - Defines radial gradients `dome-radial` and `verified-radial`.

3. **Global Styling & AG Grid Dark Theme Overrides (`apps/web/app/globals.css`)**:
   - Lines 5-71: Establishes `:root` CSS custom properties for obsidian canvas (`#000000`), card surface (`#0d0d0d`), hairline borders (`rgba(255, 255, 255, 0.11)`), and semantic authority colors (`#1daf9c`, `#3fdec9`, `#f59e0b`, `#ff6568`, `#71717a`).
   - Lines 96-100: Implements `.top-shade` specular rim highlight.
   - Lines 137-180: Implements `.ag-theme-quartz` and `.ag-theme-quartz-dark` overrides with `--ag-background-color: #09090b !important;`, sentence-case headers (`text-transform: none; font-size: 12px; color: #71717a;`), and `.numeric-cell` tabular numeral alignment.

4. **Zero Floating-Point Financial Arithmetic (`apps/web/app/lib/currency.ts`)**:
   - Line 45: `assertSafeInteger(value, fieldName)` enforces `Number.isSafeInteger(value)` and rejects floats, `NaN`, and `Infinity`.
   - Lines 80-113: `formatMinorUnits(amountMinor, currency, options)` computes whole units via `Math.floor(absAmount / factor)` and remainder via `absAmount % factor`. Zero floating-point arithmetic.
   - Line 119: `calculateAvailableMinor(allocatedMinor, spentMinor, reservedMinor)` performs integer subtraction with `assertSafeInteger` validation on both inputs and result.
   - Lines 136-201: `addMinor`, `subtractMinor`, `multiplyMinor`, `divideMinor`, and `moduloMinor` perform strict integer calculations with division-by-zero checks.
   - Lines 229-279: `parseMajorToMinor(majorStr, currency)` parses decimal strings into integer minor units using string splitting and padding without `parseFloat`.

5. **UI Primitives (`apps/web/components/ui/`)**:
   - `button.tsx`: Implements variants (`primary`, `secondary`, `outline`, `ghost`, `destructive`, `link`) and sizes (`default`, `sm`, `lg`, `icon`) with `top-shade` and hairline borders.
   - `card.tsx`: Implements `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` with `#0d0d0d` background, `border-white/[0.11]`, and `.top-shade`.
   - `badge.tsx`: Implements pale-tinted status badges (`authorized`, `unfunded` dashed border, `pending`, `rejected`, `revoked` line-through) with dark/matching text per Taste Skill.
   - `dialog.tsx`: Implements modal dialog with backdrop blur, `Escape` key listener, `aria-modal="true"`, and `DialogContext`.
   - `sheet.tsx`: Implements slide-out drawer supporting `top`, `bottom`, `left`, `right` sides with backdrop and Escape dismissal.
   - `tabs.tsx`: Implements Radix-pattern composable tabs (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) with ARIA roles and keyboard focus styles.
   - `tooltip.tsx`: Implements micro-tooltips (`TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`) with focus/mouse listeners.
   - `input.tsx`: Implements `#09090b` input with `border-white/[0.11]` and subtle focus ring.
   - `select.tsx`: Implements both `<NativeSelect>` and composable `<Select>` with outside-click dismissal.
   - `index.ts`: Barrel export of all 9 primitives.

6. **Independent Verification Commands**:
   - `pnpm typecheck`: Exit code 0 across all 11 packages and workspaces.
   - `pnpm --filter @payguardian/web build`: Exit code 0. Turbopack compiled successfully in 691ms with all static routes generated.
   - `pnpm lint`: Exit code 0. 0 warnings, 0 errors.

---

## 2. Logic Chain

1. **Adherence to Taste Skill**:
   - The user specification mandates: "Obsidian ground (#000000), card surfaces (#0d0d0d), hairline 1px borders (#ffffff1c), .top-shade specular highlight, flat surfaces, pale-tinted chips with dark/matching text, zero neon AI-slop."
   - `globals.css` and `tailwind.config.ts` configure `#000000` as the ground canvas, `#0d0d0d` as card surfaces, and `#ffffff1c` (11% white) as hairline borders.
   - `components/ui/card.tsx` applies `bg-[#0d0d0d]`, `border-white/[0.11]`, and `top-shade` directly.
   - `components/ui/badge.tsx` avoids saturated neon pills, using restrained 10% opacity tints (`bg-[#1daf9c]/10 text-[#3fdec9]`) and dashed borders for unfunded agents.
   - AG Grid Quartz theme overrides eliminate uppercase shouting headers and high-contrast grids in favor of sentence-case `#71717a` labels and hairline borders.

2. **Financial Arithmetic Invariants**:
   - The system invariant requires exact minor-unit arithmetic with zero floating-point math.
   - JavaScript `Number` operations on floats cause rounding errors (e.g., `0.1 + 0.2 !== 0.3`).
   - `apps/web/app/lib/currency.ts` enforces `Number.isSafeInteger` before and after all calculations, preventing non-integers from ever entering or exiting financial state.
   - Modulo (`%`) and integer division (`Math.floor`) guarantee exact whole and minor fractions for zero-decimal currencies (JPY), two-decimal currencies (USD, INR, EUR), and three-decimal currencies (KWD, BHD).
   - Input parsing splits on `.` and zero-pads strings, avoiding `parseFloat` entirely.

3. **Integrity & Anti-Cheat Review**:
   - Verified that no hardcoded test outputs or dummy facades were introduced.
   - Verified that all components implement genuine logic, state management, and props passing.
   - Verified that no test files were created, in strict compliance with the project testing constraint.

---

## 3. Caveats

- **No Test Specs Created**: As explicitly commanded by the prompt constraint (*"Do NOT create any test files, unit tests, component tests, or end-to-end test specs. No Vitest test files, no Playwright test files"*), automated test files were omitted. Dynamic testing was executed via direct evaluation of node module exports without writing test files.
- **Visual Browser CDP Inspection**: Live CDP inspection of the full workspace will take place in Milestone 5 when panels are integrated into the main page shell.

---

## 4. Conclusion

Milestone 1 satisfies all criteria for Design System, Dependencies, and Layout Foundation:
- Efferd Obsidian visual design language and Taste Skill rules are fully embodied.
- Minor unit financial arithmetic is safe, exact, and float-free.
- UI primitives are robust, composable, and cleanly exported for downstream milestones (M2 through M5).
- Monorepo typecheck and Next.js web build compile cleanly with zero errors.

**Verdict: APPROVE**. Milestone 2 can proceed immediately.

---

## 5. Verification Method

To verify these results independently:

1. **Typecheck Monorepo**:
   ```bash
   pnpm typecheck
   ```
   *Expected result*: Exits with code 0 across all packages and apps.

2. **Web Production Build**:
   ```bash
   pnpm --filter @payguardian/web build
   ```
   *Expected result*: Next.js Turbopack compilation succeeds (0 errors).

3. **Currency Arithmetic Stress Test (via node inline execution without test files)**:
   ```bash
   node -e '
   const c = require("./apps/web/app/lib/currency.ts");
   console.assert(c.formatMinorUnits(1000, "USD") === "$10.00");
   console.assert(c.formatMinorUnits(-250, "USD") === "-$2.50");
   console.assert(c.formatMinorUnits(500, "JPY") === "¥500");
   console.assert(c.calculateAvailableMinor(10000, 3000, 2000) === 5000);
   console.assert(c.parseMajorToMinor("10.50", "USD") === 1050);
   let threw = false;
   try { c.formatMinorUnits(10.5, "USD"); } catch(e) { threw = true; }
   console.assert(threw, "Float must throw");
   console.log("Currency verification passed!");
   '
   ```
   *Expected result*: Outputs `"Currency verification passed!"` with zero assertion failures.

---

## Verified Claims

| Claim | Method | Result |
|---|---|---|
| Dependencies installed in `apps/web/package.json` | Inspected `apps/web/package.json` | PASS |
| Efferd design tokens and `.top-shade` in Tailwind/CSS | Inspected `tailwind.config.ts` & `globals.css` | PASS |
| AG Grid themeQuartz dark overrides implemented | Inspected `globals.css` lines 137-180 | PASS |
| Zero float math and `Number.isSafeInteger` in `currency.ts` | Evaluated in Node.js runtime and inspected code | PASS |
| Rejection of floats and division by zero | Adversarial tests with floats and 0 divisor | PASS |
| All 9 UI primitives and barrel index exported | Inspected `apps/web/components/ui/` | PASS |
| `pnpm typecheck` succeeds | Executed command in workspace | PASS (Exit code 0) |
| `pnpm --filter @payguardian/web build` succeeds | Executed command in workspace | PASS (Exit code 0 in 691ms) |
| Zero test files created | Inspected git status | PASS |
