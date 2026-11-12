import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryRegistry } from "./phase1.js";
import { InMemoryAuthorityStore } from "./phase2.js";
import { InMemoryLedgerStore } from "./phase3.js";
import { InMemoryApprovalStore } from "./phase4.js";
import { InMemoryAuditStore } from "./audit.js";
import { createPrincipalResolver } from "./auth.js";

const apps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

async function setup() {
  const registry = new InMemoryRegistry();
  const authority = new InMemoryAuthorityStore();
  const ledger = new InMemoryLedgerStore();
  const approvals = new InMemoryApprovalStore();
  const audit = new InMemoryAuditStore();

  const resolvePrincipal = createPrincipalResolver(
    null,
    { localDevAuthEnabled: true } as any,
    registry,
  );

  const app = buildApp({
    registry,
    authority,
    ledger,
    approvals,
    audit,
    resolvePrincipal,
  });
  apps.add(app);

  const userHeaders = { "x-local-user-id": "alice" };

  // 1. Create Environment
  const envRes = await app.inject({
    method: "POST",
    url: "/v1/environments",
    headers: userHeaders,
    payload: {
      name: "Stage1&2 Env",
      purpose: "Testing identity spoofing and delegation grants",
      currency: "USD",
      budgetLimitMinor: 50000,
    },
  });
  const environmentId = envRes.json().environment.id as string;

  // 2. Create Root Agent A
  const agentARes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/root`,
    headers: userHeaders,
    payload: {
      name: "Agent Root Alpha",
      capabilities: ["delegate", "book_hotel"],
    },
  });
  const agentA = agentARes.json().agent;
  const tokenA = (agentARes.json().credential.secret ??
    agentARes.json().credential.token) as string;

  // 3. Create Child Agent B
  const agentBRes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/children`,
    headers: userHeaders,
    payload: {
      parentAgentId: agentA.id,
      name: "Agent Child Beta",
      kind: "travel",
      capabilities: ["book_hotel"],
    },
  });
  const agentB = agentBRes.json().agent;
  const tokenB = (agentBRes.json().credential.secret ??
    agentBRes.json().credential.token) as string;

  // 4. Create Root Mandate for Agent A
  const rootMandateRes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/mandates/root`,
    headers: userHeaders,
    payload: {
      holderAgentId: agentA.id,
      budgetLimitMinor: 30000,
      currency: "USD",
      permittedActions: ["book_hotel"],
      expiresAt: "2027-01-01T00:00:00.000Z",
      canDelegate: true,
      maxDelegationDepth: 2,
      approvalRequired: false,
    },
  });
  const rootMandateId = rootMandateRes.json().mandate.id as string;

  return {
    app,
    authority,
    approvals,
    environmentId,
    userHeaders,
    agentA,
    tokenA,
    agentB,
    tokenB,
    rootMandateId,
  };
}

describe("STAGE 1: Fix Identity Spoofing", () => {
  it("an agent credential is never its owner's user authority", async () => {
    const { app, environmentId, tokenA } = await setup();

    // Agent credential cannot perform root mandate creation
    const rootRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/mandates/root`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        holderAgentId: "some-agent-id",
        budgetLimitMinor: 1000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2027-01-01T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: false,
      },
    });
    expect(rootRes.statusCode).toBe(403);
    expect(rootRes.json().code).toBe("USER_AUTHORITY_REQUIRED");

    // Agent credential cannot pause/resume/revoke environment
    const pauseRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/pause`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(pauseRes.statusCode).toBe(403);
    expect(pauseRes.json().code).toBe("USER_AUTHORITY_REQUIRED");

    const resumeRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/resume`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(resumeRes.statusCode).toBe(403);
    expect(resumeRes.json().code).toBe("USER_AUTHORITY_REQUIRED");

    const revokeEnvRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/revoke`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(revokeEnvRes.statusCode).toBe(403);
    expect(revokeEnvRes.json().code).toBe("USER_AUTHORITY_REQUIRED");
  });

  it("root mandate revocation is user-only", async () => {
    const { app, rootMandateId, tokenA } = await setup();

    const revokeRes = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/revocations`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(revokeRes.statusCode).toBe(403);
    expect(revokeRes.json().code).toBe("USER_AUTHORITY_REQUIRED");
  });

  it("for agent-driven delegation, rejects if request.body.agentId differs from credential with 403 AGENT_IDENTITY_MISMATCH", async () => {
    const { app, rootMandateId, agentA, agentB, tokenA } = await setup();

    const res = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        agentId: "forged-agent-id",
        holderAgentId: agentB.id,
        budgetLimitMinor: 5000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("AGENT_IDENTITY_MISMATCH");
  });

  it("requires verified agentId to equal parent mandate holderAgentId", async () => {
    const { app, rootMandateId, agentB, tokenB } = await setup();

    // Agent B tries to delegate from Root Mandate (which is held by Agent A)
    const res = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: {
        holderAgentId: agentB.id,
        budgetLimitMinor: 2000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("AGENT_IDENTITY_MISMATCH");
  });

  it("cross-environment access still returns 404", async () => {
    const { app, tokenA } = await setup();

    const res = await app.inject({
      method: "POST",
      url: "/v1/mandates/non-existent-mandate-id/delegations",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        holderAgentId: "any-agent",
        budgetLimitMinor: 1000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("AUTHORITY_TARGET_NOT_FOUND");
  });
});

describe("STAGE 2: Delegation Grants", () => {
  it("enforces user approval with 'allow_once' single-use grant", async () => {
    const { app, authority, environmentId, userHeaders, agentA, agentB, tokenA, rootMandateId } =
      await setup();

    // 1. Submit an approval request in inbox for delegation
    const appReqRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals`,
      headers: userHeaders,
      payload: {
        mandateId: rootMandateId,
        agentId: agentA.id,
        action: "mandate.delegate",
        amountMinor: 5000,
        currency: "USD",
        requestHash: "hash-grant-single-use-1",
      },
    });
    expect(appReqRes.statusCode).toBe(201);
    const approvalId = appReqRes.json().approval.id as string;

    // 2. User approves with "allow_once"
    const approveRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals/${approvalId}/approve`,
      headers: userHeaders,
      payload: {
        decision: "allow_once",
        maxBudgetMinor: 5000,
        allowedChildAgents: [agentB.id],
        permittedActions: ["book_hotel"],
      },
    });
    expect(approveRes.statusCode).toBe(200);
    const grantJti = approveRes.json().grantJti as string;
    expect(grantJti).toBeDefined();

    // 3. Delegate child mandate using grant
    const delRes1 = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        grantJti,
        holderAgentId: agentB.id,
        budgetLimitMinor: 5000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(delRes1.statusCode).toBe(201);
    expect(delRes1.json().mandate).toBeDefined();

    // Check grant status is now 'consumed'
    const grantAfter = await authority.getGrant(grantJti);
    expect(grantAfter?.status).toBe("consumed");

    // 4. Reusing the single-use grant must be rejected as GRANT_INACTIVE
    const delRes2 = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        grantJti,
        holderAgentId: agentB.id,
        budgetLimitMinor: 1000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(delRes2.statusCode).toBe(403);
    expect(delRes2.json().decision.code).toBe("GRANT_INACTIVE");
  });

  it("enforces reusable grant with cumulative amount_used capping at max_budget", async () => {
    const { app, authority, environmentId, userHeaders, agentA, agentB, tokenA, rootMandateId } =
      await setup();

    // 1. Submit approval
    const appReqRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals`,
      headers: userHeaders,
      payload: {
        mandateId: rootMandateId,
        agentId: agentA.id,
        action: "mandate.delegate",
        amountMinor: 10000,
        currency: "USD",
        requestHash: "hash-grant-reusable-1",
      },
    });
    const approvalId = appReqRes.json().approval.id as string;

    // 2. User approves with "allow" (reusable)
    const approveRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals/${approvalId}/approve`,
      headers: userHeaders,
      payload: {
        decision: "allow",
        maxBudgetMinor: 10000,
        allowedChildAgents: ["*"],
        permittedActions: ["book_hotel"],
      },
    });
    const grantJti = approveRes.json().grantJti as string;

    // First use: 6,000 minor
    const del1 = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        grantJti,
        holderAgentId: agentB.id,
        budgetLimitMinor: 6000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(del1.statusCode).toBe(201);
    let grantState = await authority.getGrant(grantJti);
    expect(grantState?.amountUsedMinor).toBe(6000);
    expect(grantState?.status).toBe("active");

    // Second use exceeding capacity: 5,000 minor (6,000 + 5,000 = 11,000 > 10,000)
    const del2 = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        grantJti,
        holderAgentId: agentB.id,
        budgetLimitMinor: 5000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(del2.statusCode).toBe(403);
    expect(del2.json().decision.code).toBe("GRANT_BUDGET_EXCEEDED");

    // Second use within capacity: 4,000 minor (6,000 + 4,000 = 10,000)
    const del3 = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        grantJti,
        holderAgentId: agentB.id,
        budgetLimitMinor: 4000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(del3.statusCode).toBe(201);
    grantState = await authority.getGrant(grantJti);
    expect(grantState?.amountUsedMinor).toBe(10000);
    expect(grantState?.status).toBe("consumed");
  });

  it("is idempotent on idempotency key: retries return same child and do not burn single-use grant", async () => {
    const { app, authority, environmentId, userHeaders, agentA, agentB, tokenA, rootMandateId } =
      await setup();

    const appReqRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals`,
      headers: userHeaders,
      payload: {
        mandateId: rootMandateId,
        agentId: agentA.id,
        action: "mandate.delegate",
        amountMinor: 3000,
        currency: "USD",
        requestHash: "hash-grant-idempotent-1",
      },
    });
    const approvalId = appReqRes.json().approval.id as string;

    const approveRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals/${approvalId}/approve`,
      headers: userHeaders,
      payload: {
        decision: "allow_once",
        maxBudgetMinor: 3000,
      },
    });
    const grantJti = approveRes.json().grantJti as string;

    const payload = {
      grantJti,
      idempotencyKey: "delegation-key-abc-123",
      holderAgentId: agentB.id,
      budgetLimitMinor: 3000,
      currency: "USD",
      permittedActions: ["book_hotel"],
      expiresAt: "2026-12-31T00:00:00.000Z",
      canDelegate: false,
      maxDelegationDepth: 1,
      approvalRequired: false,
    };

    // First call
    const call1 = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload,
    });
    expect(call1.statusCode).toBe(201);
    const childId1 = call1.json().mandate.id;

    // Retry call with same idempotency key
    const call2 = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload,
    });
    expect(call2.statusCode).toBe(201);
    expect(call2.json().mandate.id).toBe(childId1);

    // Grant should only have been consumed once for 3000
    const grant = await authority.getGrant(grantJti);
    expect(grant?.amountUsedMinor).toBe(3000);
  });

  it("revoking parent mandate invalidates active grants", async () => {
    const { app, authority, environmentId, userHeaders, agentA, tokenA, rootMandateId } =
      await setup();

    const appReqRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals`,
      headers: userHeaders,
      payload: {
        mandateId: rootMandateId,
        agentId: agentA.id,
        action: "mandate.delegate",
        amountMinor: 5000,
        currency: "USD",
        requestHash: "hash-grant-revoke-1",
      },
    });
    const approvalId = appReqRes.json().approval.id as string;

    const approveRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals/${approvalId}/approve`,
      headers: userHeaders,
      payload: {
        decision: "allow",
        maxBudgetMinor: 5000,
      },
    });
    const grantJti = approveRes.json().grantJti as string;
    let grant = await authority.getGrant(grantJti);
    expect(grant?.status).toBe("active");

    // Revoke parent mandate
    await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/revocations`,
      headers: userHeaders,
    });

    grant = await authority.getGrant(grantJti);
    expect(grant?.status).toBe("revoked");
  });
});
