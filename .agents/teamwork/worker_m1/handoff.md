# Milestone 1 Handoff Report: Design System, Dependencies & Layout Foundation

> **Subagent**: `worker_m1`  
> **Milestone**: M1 — Design System, Dependencies & Layout Foundation  
> **Date**: 2026-10-31  
> **Status**: COMPLETE & VERIFIED  

---

## 1. Observation

1. **Installed Dependencies**:
   - `apps/web/package.json` was updated with:
     - `dependencies`: `lucide-react` (^1.65.0), `three` (^0.187.0), `clsx` (^2.1.1), `tailwind-merge` (^3.7.0).
     - `devDependencies`: `tailwindcss` (^3.4.17), `postcss` (^8.5.32), `autoprefixer` (^10.6.2), `@types/three` (^0.186.0).
   - Monorepo lockfile `pnpm-lock.yaml` resolved and updated cleanly with 0 vulnerabilities.

2. **Tailwind & PostCSS Configuration**:
   - Created `apps/web/postcss.config.mjs` registering `tailwindcss` and `autoprefixer`.
   - Created `apps/web/tailwind.config.ts` defining:
     - Efferd Ground: `#000000`, Card Surface: `#0d0d0d`, Surface hierarchy (`#09090b`, `#141414`, `#18181b`, `#222222`, `#27272a`).
     - Hairline borders: `#ffffff1c` (`rgba(255, 255, 255, 0.11)`), subtle `rgba(255, 255, 255, 0.08)`, strong `rgba(255, 255, 255, 0.18)`, dashed `rgba(255, 255, 255, 0.22)`.
     - Typography colors: Foreground `#fcfcfc`, muted `#a1a1aa`, tertiary `#71717a`.
     - Semantic authority and status colors: active `#1daf9c`, mint `#3fdec9`, emerald `#10b981`, pending amber `#f59e0b`, destructive coral `#ff6568`, revoked slate `#71717a`.
     - Efferd specular `.top-shade`: `box-shadow: 0 -1px color-mix(in oklab, var(--foreground) 8%, transparent)`.
     - Dome radial luminescence: `radial-gradient(80% 100% at 49% 0%, rgba(255, 255, 255, 0.05), transparent)`.

3. **Global Styling & AG Grid Dark Overrides**:
   - Updated `apps/web/app/globals.css`:
     - Configured Tailwind directives `@tailwind base`, `@tailwind components`, `@tailwind utilities`.
     - Defined CSS variables for Efferd dark tokens on `:root`.
     - Provided `.top-shade`, `.dome-glow`, `.verified-glow`, `.tabular-nums` utilities.
     - Implemented full AG Grid Quartz and Quartz Dark overrides matching Efferd Obsidian theme:
       - `--ag-background-color: #09090b !important;`
       - `--ag-header-background-color: #09090b !important;`
       - `--ag-row-hover-color: #141414 !important;`
       - `--ag-selected-row-background-color: #1a1a1a !important;`
       - `--ag-border-color: rgba(255, 255, 255, 0.08) !important;`
       - `--ag-header-foreground-color: #a1a1aa !important;`
       - `--ag-foreground-color: #fcfcfc !important;`
       - Sentence-case headers (`text-transform: none; font-size: 12px; color: #71717a;`) per Taste Skill.
       - Numeric tabular numbers alignment for `.numeric-cell`.

4. **Minor Unit Arithmetic (`apps/web/app/lib/currency.ts`)**:
   - Implemented `assertSafeInteger(value, fieldName)` strictly checking `Number.isSafeInteger(value)` and rejecting floats, `NaN`, and `Infinity`.
   - Implemented `formatMinorUnits(amountMinor, currency = 'USD', options)` guaranteeing zero floating-point arithmetic using integer division and modulo (`Math.floor(absAmount / factor)` and `absAmount % factor`).
   - Implemented `calculateAvailableMinor(allocatedMinor, spentMinor, reservedMinor)`.
   - Implemented `addMinor`, `subtractMinor`, `multiplyMinor`, `divideMinor`, and `moduloMinor`.
   - Implemented `parseMajorToMinor(majorStr, currency)` converting user-entered currency strings into exact integer minor units without `parseFloat`.
   - Exported at both `apps/web/app/lib/currency.ts` and `apps/web/lib/currency.ts`.

5. **Taste Skill UI Primitives (`apps/web/components/ui/`)**:
   - `button.tsx`: Variants `primary`, `secondary`, `outline`, `ghost`, `destructive`, `link`; sizes `default`, `sm`, `lg`, `icon`.
   - `card.tsx`: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` with `.top-shade` and 1px hairline border.
   - `badge.tsx`: Pale-tinted chips with dark/matching text per Taste Skill (`authorized`, `unfunded` dashed, `pending`, `rejected`, `revoked` strike-through, `default`, `secondary`).
   - `dialog.tsx`: Accessible modal dialog with focus handling, Escape key listener, and `X` close.
   - `sheet.tsx`: Slide-out drawer with side selection (`left`, `right`, `top`, `bottom`) for mobile approvals and node details.
   - `tabs.tsx`: Segmented tabs (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`) styled with Efferd surface tokens.
   - `tooltip.tsx`: Micro-label tooltip with positioning (`top`, `bottom`, `left`, `right`).
   - `input.tsx`: Efferd input with 1px hairline border and subtle focus ring.
   - `select.tsx`: Native select and custom composable select (`Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`).
   - `index.ts`: Barrel export for all UI primitives.
   - `apps/web/lib/utils.ts`: `cn` class merger combining `clsx` and `tailwind-merge`.

6. **Build & Typecheck Results**:
   - `pnpm typecheck`: Exit code 0, 0 errors across all 11 packages and apps.
   - `pnpm --filter @payguardian/web build`: Exit code 0, Turbopack compiled successfully in 695ms.
   - `pnpm build`: Exit code 0, all workspaces compiled cleanly in 4.7s.
   - `pnpm lint`: Exit code 0, 0 lint warnings or errors.

---

## 2. Logic Chain

1. **Dependency Installation**:
   - The user instructions specified installing `lucide-react`, `three`, `clsx`, `tailwind-merge`, `tailwindcss`, `postcss`, `autoprefixer`, and `@types/three`.
   - During initial evaluation, Tailwind v4 was installed by pnpm by default, which separated its PostCSS plugin into `@tailwindcss/postcss`. By pinning `tailwindcss@^3.4.17`, standard PostCSS integration and `tailwind.config.ts` operated seamlessly with Next.js Turbopack without external plugins.

2. **TypeScript Path Mapping**:
   - When attempting `baseUrl: "."` in `apps/web/tsconfig.json`, TypeScript 6.0 emitted deprecation error TS5101.
   - Configured `"paths": { "@/*": ["./*"] }` directly without `baseUrl`, resolving all `@/components/ui/*` and `@/lib/*` imports cleanly under TypeScript 6.0 standards.

3. **Financial Invariants (Zero Floating-Point)**:
   - Floating-point representations in JavaScript produce decimal drift (e.g. `0.1 + 0.2 = 0.30000000000000004`).
   - By asserting `Number.isSafeInteger` and computing major and fractional units via integer quotient (`Math.floor(abs / 100)`) and modulo (`abs % 100`), exact arithmetic is preserved across all currencies (2 decimals for USD/INR/EUR, 0 for JPY, 3 for KWD/BHD).
   - String parsing (`parseMajorToMinor`) parses whole and fractional substrings without `parseFloat`, avoiding floating point errors on user inputs.

4. **Taste Skill Compliance**:
   - In accordance with `references/app-screens.md`, all UI components avoid heavy drop shadows, neon gradients, and saturated pills.
   - Badges use pale tints with matching hue text (e.g. `#1daf9c/10` with `#3fdec9` text for authorized, and dashed borders for unfunded agents).
   - Surfaces are flat `#0d0d0d` with 1px hairline borders (`rgba(255, 255, 255, 0.11)`) and specular overhead lighting (`.top-shade`).

---

## 3. Caveats

- In accordance with the critical user constraint (*"Do NOT create any test files, unit tests, component tests, or end-to-end test specs. No Vitest test files, no Playwright test files"*), no new `.test.ts` or `.spec.ts` files were written.
- Existing pre-redesign tests in the repository continue to pass without regression.

---

## 4. Conclusion

Milestone 1 is completely satisfied. The design system foundation, package dependencies, Tailwind and PostCSS configurations, Efferd obsidian design tokens, AG Grid dark theme overrides, exact integer minor-unit currency mathematics, and the complete catalog of UI primitives are implemented, type-checked, and verified against production builds. Downstream agents (Milestones 2 through 5) can now consume these primitives.

---

## 5. Verification Method

To independently verify this milestone:

1. **Typecheck Verification**:
   ```bash
   pnpm typecheck
   ```
   *Expected outcome*: Exits with code 0 across all packages and apps with 0 errors.

2. **Web Production Build**:
   ```bash
   pnpm --filter @payguardian/web build
   ```
   *Expected outcome*: Next.js Turbopack compiles successfully with all static pages generated.

3. **Lint Verification**:
   ```bash
   pnpm lint
   ```
   *Expected outcome*: Exits with code 0.

4. **File Inspection**:
   - Inspect `apps/web/app/lib/currency.ts` to confirm `Number.isSafeInteger` assertions and zero floating-point math.
   - Inspect `apps/web/tailwind.config.ts` to confirm Efferd color tokens and `.top-shade` shadow.
   - Inspect `apps/web/components/ui/` to confirm all 9 requested UI primitives (`button`, `card`, `badge`, `dialog`, `sheet`, `tabs`, `tooltip`, `input`, `select`) and index barrel export.
