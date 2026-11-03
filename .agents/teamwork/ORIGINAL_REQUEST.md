# Original User Request

## Initial Request — 2026-11-01T21:24:32Z

use multi-agent to finsh the work. Replace hardcoded frontend data in the Next.js application with real backend data using docs/frontend-audit.md for production readiness.

Working directory: /home/anas/myspace/AI/PayGuardian
Integrity mode: development

## Reference Material
- `docs/frontend-audit.md` (Frontend-to-Backend Integration Audit & Architecture Specification)

## Requirements

### R1. Typed API Client, Type Generation, and Next.js Routing
Generate TypeScript types from the delegation API's OpenAPI specification and add a script to regenerate them. Create a typed client in `src/api/` with one hook per screen and mappers that turn API responses into the props the existing components already take, without altering component markup or styling. Route all requests through Next.js (route handlers or rewrites) so session cookies stay httpOnly and CORS is not needed in the browser, following the auth flow documented in `docs/frontend-audit.md`. Do not modify Python services (auth backend, delegation API, worker, agents).

### R2. Screen Migration and Fixture Removal
Replace hardcoded data one screen at a time across the 8 screens in sequence: starting with the graph and budget bar, then the activity feed, approvals, payment trace, library, sessions, and memory. Delete each screen's fixtures once it works with backend data. Never invent data: if an endpoint or field is MISSING, show a clear "unavailable" state in the UI and list it in `docs/gaps.md` with the proposed request and response contract.

### R3. Commands, Mutations, and Financial Data Integrity
Make every button call a backend command and update only from the confirmed response or event, with no optimistic updates for money, authority, or approvals. Handle amounts as integer minor units plus currency, formatting for display only; remove any client-side budget math or permission checks, and use fields the API returns (for example `allowed_actions`) instead.

### R4. Live Updates, Skeletons, and UI States
Use the backend's event stream for live updates; if none exists, use short polling as a clearly marked temporary fallback and record the gap in `docs/gaps.md`. Add loading skeletons, empty states, and error states with retry, matching layout sizes so nothing jumps.

### R5. Lint Guardrails and Verification
Add a lint rule banning imports from fixtures or mocks inside `src/`. Add an end-to-end test that changes a value in the backend and asserts the UI shows it. Ensure existing workspace validation scripts (`npm run typecheck`, `npm run lint`, and `npm run test` in `apps/web`) and the end-to-end test pass cleanly.

## Acceptance Criteria

### Type Generation and Routing
- [ ] TypeScript types are generated from the delegation API OpenAPI spec with a script in `apps/web` to regenerate them.
- [ ] `src/api/` contains a typed client, one hook per screen, and mappers producing the exact prop interfaces expected by existing components without modifying component markup or styles.
- [ ] All API requests from the browser route through Next.js route handlers or rewrites, maintaining httpOnly session cookies without browser CORS issues.
- [ ] Zero lines of code are modified in Python services (`apps/agent-runtime`, `agents/`, `apps/worker`, or auth backends).

### Screen Migration and Fixture Removal
- [ ] The 8 target screens are migrated to backend data in order: workspace graph and budget bar, activity feed, approvals, payment trace, library, sessions, and memory.
- [ ] Mock and fixture files for each of the 8 screens are deleted from `src/` once integrated.
- [ ] For every missing backend endpoint or field, the component renders a visible "unavailable" state and `docs/gaps.md` documents the gap with a proposed contract.

### Mutation and Financial Integrity
- [ ] Button actions dispatch backend commands and update UI state strictly after receiving a confirmed server response or event (no optimistic updates for money, authority, or approvals).
- [ ] Monetary amounts are stored and handled as integer minor units with currency strings, formatted for display only.
- [ ] Client-side budget calculations and permission checks are removed in favor of backend-provided fields such as `allowed_actions`.

### Real-Time, Resilience, and Testing
- [ ] Live UI updates consume the backend event stream, or short polling fallback is active with the gap documented in `docs/gaps.md`.
- [ ] Loading skeletons, empty states, and error states with retry are implemented on each screen, matching container dimensions without layout shift.
- [ ] A lint rule bans imports from fixtures or mocks inside `src/`.
- [ ] An end-to-end test executes, changes a value in the backend, and asserts that the UI shows the updated value.
- [ ] `npm run typecheck`, `npm run lint`, and `npm run test` in `apps/web` pass with zero errors.

## Follow-up — 2026-11-01T21:40:09Z

IMPORTANT CORRECTION FROM USER:
The user clarified: "their was some miss typing it was app/api i am not using src/ folder strcuture so take that in consideration"

In apps/web, there is no `src/` directory. Next.js App Router structure is used (`apps/web/app`, `apps/web/components`, `apps/web/lib`).
Therefore:
1. Use `app/api/` (or `apps/web/app/api/` and `apps/web/lib/api/`) instead of `src/api/`.
2. Any lint rule or reference banning fixture imports should apply to `apps/web/app/`, `apps/web/components/`, `apps/web/lib/` instead of `src/`.
Please factor this directory structure correction into all current and subsequent milestones.
