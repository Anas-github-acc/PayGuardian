import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryRegistry } from "./phase1.js";

const apps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

function testApp() {
  const app = buildApp({
    registry: new InMemoryRegistry(),
    resolvePrincipal: async (_authorization, localUserId) =>
      localUserId ? { userId: localUserId, kind: "user" } : null,
  });
  apps.add(app);
  return app;
}

async function setup() {
  const app = testApp();
  const headers = { "x-local-user-id": "alice" };
  const environment = await app.inject({
    method: "POST",
    url: "/v1/environments",
    headers,
    payload: { name: "Travel", purpose: "Trip planning", currency: "INR", budgetLimitMinor: 10000 },
  });
  const environmentId = environment.json().environment.id as string;
  const root = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/root`,
    headers,
    payload: { name: "Personal Agent", capabilities: ["delegate"] },
  });
  const rootAgentId = root.json().agent.id as string;
  const child = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/children`,
    headers,
    payload: { parentAgentId: rootAgentId, name: "Travel Agent", kind: "travel" },
  });
  const childAgentId = child.json().agent.id as string;
  const rootMandate = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/mandates/root`,
    headers,
    payload: {
      holderAgentId: rootAgentId,
      budgetLimitMinor: 10000,
      currency: "INR",
      permittedActions: ["book_hotel"],
      expiresAt: "2027-01-01T00:00:00.000Z",
      canDelegate: true,
      maxDelegationDepth: 2,
      approvalRequired: false,
    },
  });
  const rootMandateId = rootMandate.json().mandate.id as string;
  const childMandate = await app.inject({
    method: "POST",
    url: `/v1/mandates/${rootMandateId}/delegations`,
    headers,
    payload: {
      holderAgentId: childAgentId,
      budgetLimitMinor: 5000,
      currency: "INR",
      permittedActions: ["book_hotel"],
      expiresAt: "2026-12-01T00:00:00.000Z",
      canDelegate: false,
      maxDelegationDepth: 1,
      approvalRequired: false,
    },
  });
  return {
    app,
    headers,
    environmentId,
    rootAgentId,
    childAgentId,
    rootMandateId,
    childMandateId: childMandate.json().mandate.id as string,
  };
}

describe("Phase 6 dashboard controls", () => {
  it("denies another user access to control and monitoring endpoints", async () => {
    const { app, environmentId, rootAgentId, rootMandateId } = await setup();
    const bob = { "x-local-user-id": "bob" };

    const activity = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/activity`,
      headers: bob,
    });
    const mandates = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/mandates`,
      headers: bob,
    });
    const disable = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/${rootAgentId}/disable`,
      headers: bob,
    });
    const revokeEnvironment = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/revoke`,
      headers: bob,
    });
    const revokeMandate = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/revocations`,
      headers: bob,
    });

    expect(activity.statusCode).toBe(404);
    expect(mandates.statusCode).toBe(404);
    expect(disable.statusCode).toBe(404);
    expect(revokeEnvironment.statusCode).toBe(404);
    expect(revokeMandate.statusCode).toBe(404);
  });

  it("pauses and resumes an environment while blocking new protected actions", async () => {
    const { app, headers, environmentId, rootAgentId, rootMandateId } = await setup();
    const pause = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/pause`,
      headers,
    });
    expect(pause.statusCode).toBe(200);
    expect(pause.json().environment.status).toBe("paused");

    const blockedRoot = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/mandates/root`,
      headers,
      payload: {
        holderAgentId: rootAgentId,
        budgetLimitMinor: 1,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2027-01-01T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: false,
      },
    });
    expect(blockedRoot.statusCode).toBe(409);

    const resume = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/resume`,
      headers,
    });
    expect(resume.statusCode).toBe(200);
    expect(resume.json().environment.status).toBe("active");

    const check = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/check`,
      headers,
      payload: { action: "book_hotel", amountMinor: 1, currency: "INR" },
    });
    expect(check.statusCode).toBe(200);
  });

  it("propagates agent disablement and mandate revocation to future use", async () => {
    const {
      app,
      headers,
      environmentId,
      rootAgentId,
      childAgentId,
      childMandateId,
      rootMandateId,
    } = await setup();
    const disabled = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/${rootAgentId}/disable`,
      headers,
    });
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json().agent.status).toBe("disabled");

    const agents = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/agents`,
      headers,
    });
    expect(
      agents.json().agents.find((agent: { id: string }) => agent.id === childAgentId).status,
    ).toBe("disabled");

    const mandates = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/mandates`,
      headers,
    });
    expect(mandates.json().mandates).toHaveLength(2);

    const revoked = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/revocations`,
      headers,
    });
    expect(revoked.statusCode).toBe(200);

    const childCheck = await app.inject({
      method: "POST",
      url: `/v1/mandates/${childMandateId}/check`,
      headers,
      payload: { action: "book_hotel", amountMinor: 1, currency: "INR" },
    });
    expect(childCheck.statusCode).toBe(403);
    expect(childCheck.json().decision.code).toBe("MANDATE_REVOKED");
  });

  it("revokes an environment without allowing protected actions to bypass the control", async () => {
    const { app, headers, environmentId, rootAgentId, rootMandateId } = await setup();
    const account = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: { mandateId: rootMandateId, currency: "INR", availableMinor: 10000 },
    });
    expect(account.statusCode).toBe(201);

    const revoke = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/revoke`,
      headers,
    });
    expect(revoke.statusCode).toBe(200);
    expect(revoke.json().environment.status).toBe("revoked");

    const blocked = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: rootAgentId,
        mandateId: rootMandateId,
        ledgerAccountId: account.json().account.id,
        idempotencyKey: "revoked-environment-action",
        requestHash: "revoked-environment-request",
        action: "book_hotel",
        amountMinor: 1,
        currency: "INR",
      },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().code).toBe("ENVIRONMENT_NOT_ACTIVE");

    const activity = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/activity`,
      headers,
    });
    expect(activity.json().events.at(-1)).toMatchObject({
      eventType: "environment.revoked",
      outcome: "success",
    });
  });

  it("revokes an agent hierarchy before protected actions can use the revoked agent", async () => {
    const { app, headers, environmentId, rootAgentId, rootMandateId } = await setup();
    const account = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: { mandateId: rootMandateId, currency: "INR", availableMinor: 10000 },
    });
    expect(account.statusCode).toBe(201);

    const revoke = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/${rootAgentId}/revoke`,
      headers,
    });
    expect(revoke.statusCode).toBe(200);
    expect(revoke.json().agent.status).toBe("revoked");

    const blocked = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: rootAgentId,
        mandateId: rootMandateId,
        ledgerAccountId: account.json().account.id,
        idempotencyKey: "revoked-agent-action",
        requestHash: "revoked-agent-request",
        action: "book_hotel",
        amountMinor: 1,
        currency: "INR",
      },
    });
    expect(blocked.statusCode).toBe(404);
    expect(blocked.json().code).toBe("AUTHORITY_TARGET_NOT_FOUND");
  });
});
