# Step 4: technology decisions

## Assumptions and open questions
- User-selected: Next.js, Node.js + Fastify + TypeScript for the gateway/API, Python ADK for dummy agents, Supabase PostgreSQL, Supabase Auth, and a monorepo. These selections are confirmed, not implemented.
- All other choices below are recommendations awaiting approval. Do not proceed to engineering standards or scaffolding until the user approves this step.
- Supabase OAuth server is documented as beta. Prove Claude/MCP compatibility before treating it as the production connector authorization solution; no replacement identity vendor is selected.
- Exact supported runtime/dependency versions and Gemini model ID must be pinned and smoke-tested during setup, not guessed from documentation examples.
- Inventory/booking scope remains open. INR is simulation-only and USD is the approved PayPal Sandbox provider currency; no implicit FX conversion is allowed. No hosting accounts, paid licenses, subscriptions, or resources are provisioned.
- Vercel deployment means the Fastify gateway runs as Vercel Functions, not as a permanently running Node.js server. Long-running/background work needs a separate durable worker boundary.

## Decision summary
| Area | Selected/recommended option | Trade-off |
| --- | --- | --- |
| Website — selected | Next.js; recommend TypeScript and App Router | Fits the requested dashboard and SSR; shares the TypeScript ecosystem with the gateway. |
| Gateway/API — selected | Node.js + Fastify + TypeScript, with a shared deterministic domain/application layer | Typed schemas and OpenAPI through Fastify plugins; requires explicit domain authorization, not just route validation. [1] |
| Database — selected | Supabase-managed PostgreSQL | Hosted PostgreSQL/Auth integration; pooled connections, least-privilege roles and migration discipline need deliberate setup. [2][3] |
| Human identity — selected | Supabase Auth; recommend `@supabase/ssr` for Next.js sessions and server-side JWT/JWKS validation in Fastify | Keep the selected identity platform; browser sessions and agent credentials remain distinct. [4][5] |
| MCP — recommended | Official MCP TypeScript SDK, Streamable HTTP; invoke shared gateway use cases | Keeps the MCP adapter beside the TypeScript gateway; remote authentication/interoperability must be demonstrated. [6] |
| Database access — recommended | Drizzle ORM + `postgres`/`pg` driver, explicit transactions and SQL migrations | Keeps the gateway TypeScript-native while preserving direct control over concurrency and SQL; validate pooling behavior before implementation. [7][8] |
| Agents — selected direction | Google ADK Python + Gemini, deployed on Render | Matches requested dummy-agent orchestration; long-running runs and quota/error handling remain outside Vercel request lifetimes. [9] |
| Monorepo — selected | Recommend pnpm workspaces for JavaScript/TypeScript, uv workspace for Python agents, and a root Makefile | Keeps native package managers/locks while sharing contracts and docs across two ecosystems. [10][11] |
| UI — recommended | Tailwind CSS + selected shadcn/ui primitives; AG Grid Community initially | Avoid commercial license commitment; enterprise-only grid features are not included without approval. [12] |
| Live updates — recommended | Authenticated, fetch-streamed SSE from Fastify plus snapshot/cursor recovery | One-way dashboard feed without another state authority; Vercel proxy buffering/timeouts must be tested. |
| Jobs — recommended | PostgreSQL outbox/job tables with leased workers, retries and idempotent consumers | No Redis initially; we own leasing/recovery/backoff and must test crash cases. |
| Payment — selected | PayPal Sandbox; recommend Orders v2 via a server-only HTTP client | Respect provider approval/capture rules; no live charges or assumed booking fulfillment. [13] |
| Contracts — selected direction | Fastify/OpenAPI export, reviewed contract changes, APIMatic docs/validation | Avoid manually divergent contracts; account capabilities/cost and supported import version require confirmation. [14] |
| Tests — recommended | Vitest + fast-check, real PostgreSQL integration tests; Testing Library and Playwright for the website; pytest for ADK agents | Actual transaction/security evidence; more setup than mock-only tests. |
| Local/CI — recommended | Supabase CLI + containers, committed locks; CI on the eventual repository host | Reproducible auth/database tests; Docker and CI credentials are environment prerequisites. |

## Runtime and deployment boundaries
- **Next.js:** UI, Supabase user session handling and optional thin server proxy. No independent payment, mandate or ledger implementation.
- **Fastify gateway:** REST, MCP adapter, deterministic authorization, budgets, policies and approval operations in Node.js + TypeScript.
- **Python ADK services:** Personal and specialist dummy agents execute on Render and call the gateway using authenticated contracts; they never implement authorization or ledger mutation.
- **Async workers:** payment/reconciliation work must run through a durable worker/queue boundary; Vercel request functions must not be treated as an always-on worker. Exact worker placement remains an open deployment decision.
- **Supabase:** Auth and PostgreSQL. Protected reads/writes go through the gateway initially; no direct browser ledger/mandate mutation path.
- **Recommended hosting:** Vercel for the Next.js frontend and Fastify gateway as separate projects from the same monorepo; Render for Python ADK dummy-agent services; Supabase for database/Auth. Vercel's unified Services feature is private beta, so the initial plan must not depend on it. Confirm region, service-to-service authentication, worker support, streaming, restart behavior and cost before provisioning. [18][19][20][21]
- Never depend on an in-process task or a request staying alive to finish a payment or agent run.

Vercel can deploy Fastify with Vercel Functions. The initial deployment shape is two Vercel projects from the monorepo—`web` and `api`—because Vercel Services is currently private beta. A later single-project Services deployment can be evaluated without changing the application boundaries. [18][20][21]

## Supabase security and OAuth decisions
1. **Website login:** use Supabase Auth with SSR cookie handling. Fastify validates token signature, issuer, expiry and applicable audience against the configured project; do not authorize from an unverified browser session or caller-supplied user ID. [4][5]
2. **Database boundary:** put application authority/payment tables in a non-exposed schema with separate migration/runtime roles. Revoke public access and use RLS where applicable. Supabase documents that service keys bypass RLS, so a service key is not an authorization policy. [3]
3. **Direct SQL caveat:** the Node.js database driver does not automatically inherit a browser's Supabase JWT/RLS context. Explicitly enforce environment/principal filtering, relational constraints, and any deliberately implemented database policies. Do not claim RLS protection without proving the actual connection role/policy behavior.
4. **Agent identity:** issue distinct gateway-managed runtime credentials with hashed secret storage, expiry, rotation/revocation and server-side environment/parent binding. User login tokens, agent credentials and mandate grants are separate concepts. Exact token format belongs to approved engineering standards.
5. **Claude/MCP OAuth:** first try Supabase's OAuth server with a custom gateway consent screen, discovery and supported client registration. Its beta status and OAuth support are not proof of complete MCP interoperability. [15]
6. **Required OAuth spike:** demonstrate Claude Web connection, authorization-code/PKCE flow, metadata/client registration, resource indicators and audience checks, user consent, rejected wrong-audience/expired tokens, revocation behavior and root-agent binding. Investigate supported registration modes rather than assuming arbitrary clients can register. If a required capability fails, stop and propose a compatible extension; do not silently substitute API keys for Claude OAuth or select a new provider. [6][15][16]

## Transactions, migrations and jobs
- Use PostgreSQL transactions for balance transfers, reservations, ledger entries, action state and outbox creation. Lock rows in a stable order; retry only safe transaction conflicts/deadlocks. `SELECT ... FOR UPDATE` locks rows until transaction end; benchmark contention rather than assuming the latency target. [8]
- Use a single application-schema migration history compatible with the selected TypeScript database layer. Supabase CLI manages the local Supabase stack and its configuration, not a competing second migration history. Managed Auth schemas are not owned by application migrations.
- Choose runtime pooling/driver settings after deployment-mode compatibility checks. Keep connection creation safe for Vercel function reuse and avoid holding database connections across external HTTP calls. [2]
- Commit job/outbox state with the action transaction, then claim jobs with leases. No external HTTP while holding financial transaction locks. Recover abandoned leases and reuse operation idempotency keys.
- Keep an authorized replay/catch-up API for streaming reconnects. Bearer tokens belong in headers/cookies as appropriate, never URL query strings.

## ADK/Gemini and contracts
- Execute Personal/Travel/Hotel/Transport/Food/Activities as permitted templates or configured integrations, with dynamic parent-driven registration.
- Runtime tool wrappers attach per-agent credentials outside LLM-visible prompts. An ADK subagent definition does not itself register a gateway principal or grant a mandate.
- Persist workflow/run checkpoints separately from financial state. An LLM retry or a new session must never issue duplicate payments or replenish a budget.
- Recommend a configurable stable Flash-family Gemini model available on the account's free tier. Confirm the exact model and current quotas before implementation acceptance. Free-tier rate limits are not an availability guarantee, and quota exhaustion must not weaken authorization. Current pricing also distinguishes free-tier data use; assess prompt privacy before sending sensitive information. [17]
- Export the actual Fastify/OpenAPI contract, validate/import it in APIMatic and check for contract drift in CI. MCP tool schemas map to the same application inputs without assuming the two wire protocols are identical.
- Prepare versioned contract and client-package boundaries now; do not generate/publish SDKs in the initial release.

## Decisions requested before Step 5
1. Approve Node.js + Fastify + TypeScript, Drizzle + PostgreSQL driver, and the official MCP TypeScript SDK.
2. Approve pnpm + uv + Makefile; Tailwind/shadcn and AG Grid Community with custom column controls as needed.
3. Approve PostgreSQL-backed durable jobs and authenticated SSE initially (no Redis).
4. Approve the Supabase OAuth compatibility spike as an implementation gate, not a completed integration.
5. Approve the Vercel frontend + Vercel Fastify API + Render Python ADK deployment direction, or request a different hosting target before provisioning.
6. Resolve demo inventory versus real booking providers and supported Sandbox currency separation. Exact Gemini model/runtime versions remain setup-verification gates.

## Primary documentation checked
1. [Fastify](https://fastify.dev/docs/latest/)
2. [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
3. [Supabase RLS and service-key behavior](https://supabase.com/docs/guides/database/postgres/row-level-security)
4. [Supabase Next.js server-side Auth](https://supabase.com/docs/guides/auth/server-side/nextjs)
5. [Supabase JWT verification/JWKS](https://supabase.com/docs/guides/auth/jwts)
6. [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
7. [Drizzle ORM](https://orm.drizzle.team/docs/overview)
8. [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
9. [Google ADK](https://google.github.io/adk-docs/)
10. [pnpm workspaces](https://pnpm.io/workspaces)
11. [uv workspaces](https://docs.astral.sh/uv/concepts/projects/workspaces/)
12. [AG Grid Community and Enterprise](https://www.ag-grid.com/react-data-grid/community-vs-enterprise/)
13. [PayPal Orders API](https://developer.paypal.com/docs/api/orders/v2/)
14. [APIMatic OpenAPI support](https://docs.apimatic.io/changelog/added-support-for-openapi-3-1/)
15. [Supabase OAuth server](https://supabase.com/docs/guides/auth/oauth-server)
16. [MCP authorization](https://modelcontextprotocol.io/specification/latest/basic/authorization)
17. [Gemini API pricing and free-tier data use](https://ai.google.dev/gemini-api/docs/pricing)
18. [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
19. [Render background workers](https://render.com/docs/background-workers)
20. [Fastify on Vercel](https://vercel.com/docs/frameworks/backend/fastify)
21. [Vercel Services](https://vercel.com/docs/services)
