# Step 0: approved input

## Assumptions and open questions
- The complete baseline is `../input.md`; this file records its planning status rather than replacing it.
- Inventory/booking providers and payment-demo currency mapping remain open.

## Status
The user approved the requirements baseline, then refined the agent onboarding model and selected the core stack. See the confirmed refinements at the top of `../input.md`.

## Problem and requirements
Provide bounded, accountable spending authority for agents and descendants without shared unrestricted credentials, duplicated budgets, privilege escalation, or implicit authority from sessions/registration.

The initial product includes environments, accounts, sessions, agents, mandates, policies/approvals, delegation, a budget ledger, revocation, audit, a dashboard, REST, MCP, ADK/Gemini agents, and PayPal Sandbox integration. Security and financial-correctness requirements in the baseline remain mandatory.

## Approval evidence
The user confirmed the baseline, clarified automatic descendant registration, approved the revised specification and architecture direction, and selected Next.js, Node.js + Fastify + TypeScript for the gateway/API, Python ADK for dummy agents, Supabase PostgreSQL, Supabase Auth, and a monorepo. The intended deployment is Vercel for the website and gateway, and Render for the ADK agent services.
