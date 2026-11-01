## 2026-10-31T17:13:56Z
You are a teamwork_worker subagent assigned to Milestone 4: Approvals, Payment Traces, Mandates & Policies AG Grid, Activity Audit Log, and Security Center.

Read:
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/ORIGINAL_REQUEST.md
- /home/anas/myspace/AI/PayGuardian/.agents/teamwork/orchestrator_1/PROJECT.md
- Specification analysis: /home/anas/myspace/AI/PayGuardian/.agents/teamwork/spec_miner_survey/spec_analysis.md
- UI primitives in apps/web/components/ui/
- Workspace store in apps/web/app/lib/workspace-store.ts
- Currency utilities in apps/web/app/lib/currency.ts

Your working directory is:
/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_m4/

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL TESTING CONSTRAINT:
Do NOT create any test files, unit tests, component tests, or end-to-end test specs. No Vitest test files, no Playwright test files. The user will test manually. Focus all effort on the actual implementation.

Your Scope & Write Ownership:
You exclusively own:
- apps/web/components/approvals/* (ApprovalsInbox, ApprovalCard, ApprovalDetailDrawer, types.ts, index.ts)
- apps/web/components/traces/* (PaymentTraceView, VerticalAuthChain, LifecycleTimeline, VerificationChecklist, types.ts, index.ts)
- apps/web/components/tables/* (MandatesTable, ActivityAuditTable, PoliciesTable, types.ts, index.ts)
- apps/web/components/security/* (SecurityCenter, EmergencyControls, RevocationDialog, SecurityEventLog, types.ts, index.ts)
