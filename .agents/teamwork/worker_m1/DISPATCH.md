## 2026-11-01T21:37:03Z
You are worker_m1, an expert full-stack TypeScript/Next.js engineer.
Your working directory is: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m1/

Read your original request file: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/ORIGINAL_REQUEST.md
Also read:
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/PROJECT.md
- /home/anas/myspace/AI/PayGuardian/docs/frontend-audit.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/explorer_survey_infra/report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your objective is Milestone 1: Typed API Client, OpenAPI Type Generation, Next.js Routing, and Lint Guardrail:
1. Generate / create `apps/web/openapi.json` representing Fastify Gateway endpoints and DTOs from `@payguardian/contracts` (as analyzed in explorer_survey_infra/report.md).
2. Add the `"typegen"` script to `apps/web/package.json` (`"typegen": "openapi-typescript openapi.json -o src/api/generated-schema.ts"`). If needed, install `openapi-typescript` as a devDependency in `apps/web`. Run the typegen script to generate `apps/web/src/api/generated-schema.ts`.
3. Update `apps/web/tsconfig.json` so that `"src/*": ["./src/*"]` path alias is properly configured alongside `"@/*": ["./*"]`.
4. Create `apps/web/src/api/`:
   - `client.ts`: Typed API client routing all requests through Next.js proxy `/api/proxy/v1/...` with session token / local auth header support.
   - Screen hook skeletons and base mapper helpers in `src/api/hooks/` and `src/api/mappers/`.
5. Implement Next.js proxy route handler at `apps/web/app/api/proxy/[...path]/route.ts`:
   - Handles GET, POST, PUT, PATCH, DELETE.
   - Proxies to Fastify Gateway (`http://127.0.0.1:3001`).
   - Forwards auth headers: `x-local-user-id: local-user` during dev, Bearer tokens if session cookie present.
   - Keeps session cookies httpOnly and eliminates browser CORS.
6. Configure ESLint rule in root `eslint.config.mjs` (or `apps/web`) banning imports from `*fixtures*`, `*mocks*`, and `*workspace-defaults*` inside `apps/web/src/**`.
7. Initialize `docs/gaps.md` with schema for recording missing endpoints and proposed contracts.
8. Run `pnpm --filter @payguardian/web run typecheck` and `pnpm --filter @payguardian/web run test` (or `npm run typecheck` and `npm run test`) to verify zero compile or test errors.

STRICT CONSTRAINT:
Zero lines of code are modified in Python services (`apps/agent-runtime`, `agents/`, `apps/worker`, or auth backends).

Output instructions:
Write your handoff report to:
`/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m1/handoff.md`
Report verification commands and results clearly. When done, send a message back.

## 2026-11-01T21:40:39Z
**Context**: Milestone 1 Implementation (Typed API Client & Directory Structure)
**Content**: IMPORTANT CORRECTION FROM USER:
The user clarified: "their was some miss typing it was app/api i am not using src/ folder strcuture so take that in consideration"
In `apps/web`, there is no `src/` directory. The Next.js App Router structure is used (`apps/web/app`, `apps/web/components`, `apps/web/lib`).
Therefore:
1. Put the typed client, hooks, mappers, and generated types in `apps/web/lib/api/` (and/or `apps/web/app/api/`), NOT in `src/`.
2. Any lint rule or reference banning fixture imports should apply across `apps/web/app/`, `apps/web/components/`, `apps/web/lib/` instead of `src/`.
**Action**: Adapt your implementation files and configurations to use `apps/web/lib/api/` / `apps/web/app/api/` without creating a `src/` directory.
