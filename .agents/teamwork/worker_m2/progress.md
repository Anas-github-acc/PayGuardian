# Progress Tracking

Last visited: 2026-11-01T22:27:00Z

## Status
Milestone 2 Completed Successfully. All Screen 1 and Screen 2 components wired to live backend endpoints via typed hooks and mappers. All mock fixtures deleted. Unit tests (37/37) and TypeScript typecheck pass with 0 errors. Zero lines modified in protected Python or auth backend services.

## Steps
- [x] Read references (ORIGINAL_REQUEST.md, PROJECT.md, docs/frontend-audit.md, explorer report, worker_m1 handoff, reviewer_m1 report)
- [x] Fix Reviewer Findings:
  - [x] Proxy route status 101/204/205/304 null body to prevent TypeError
  - [x] upstreamResponse.headers.getSetCookie() preservation
  - [x] Remove unused variables across route.test.ts, mappers.test.ts, use-agent-memory.ts, use-approvals.ts, workspace-graph.ts
- [x] Screen 2 Migration (Activity Feed):
  - [x] Wire use-activity-feed.ts with 3s short polling and `since` timestamp cursor
  - [x] Update components (activity-micro-feed.tsx, recent-activity-panel.tsx, tables/ActivityAuditTable.tsx)
  - [x] Format integer minor units strictly for display without client-side floating point math
  - [x] Delete static hardcoded JSX cards in recent-activity-panel.tsx:65-128
  - [x] Remove forced mock merging in ActivityAuditTable.tsx:94-96
  - [x] Delete mock fixtures (INITIAL_ACTIVITIES, DEFAULT_ACTIVITY_EVENTS)
  - [x] Implement loading skeleton, empty state, and error state with retry matching layout sizes
- [x] Screen 1 Migration (Workspace Graph & Budget Bar):
  - [x] Wire use-workspace-graph.ts and use-budget-strip.ts to live backend endpoints
  - [x] Implement/update mappers (workspace-graph.ts, budget-strip.ts) with relational ledger matching
  - [x] Update components (workspace-layout.tsx, delegation-topology.tsx, canvas/agent-network-canvas.tsx, agent-network-list-view.tsx, node-detail-drawer.tsx, budget-strip.tsx, overview.tsx)
  - [x] Wire Agent Revocation mutation in use-workspace-graph and workspace-layout (server confirmation only, zero optimistic updates)
  - [x] In orchestrator-pipeline.tsx, remove fake synthetic tickers (2.8s ticker interval and 7.2s counter interval)
  - [x] Delete mock fixtures (DEFAULT_GRAPH_NODES, DEFAULT_GRAPH_EDGES, SPEND_SERIES, AGENT_AUTHORITY)
  - [x] Implement loading skeleton, empty state, and error state with retry for Graph and Budget Bar
  - [x] Document GAP-SPEND-01 in docs/gaps.md
- [x] Verification:
  - [x] pnpm --filter @payguardian/web run typecheck (0 errors)
  - [x] pnpm --filter @payguardian/web run test (37/37 passing)
  - [x] git diff on protected services remains completely empty
- [x] Write handoff report and notify caller
