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
  const travel = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/children`,
    headers,
    payload: { parentAgentId: rootAgentId, name: "Travel Agent", kind: "travel" },
  });
  return {
    app,
    headers,
    environmentId,
    rootAgentId,
    travelAgentId: travel.json().agent.id as string,
  };
}

describe("Phase 2 authority routes", () => {
  it("creates a root mandate and delegates only within its scope and budget", async () => {
    const { app, headers, environmentId, rootAgentId, travelAgentId } = await setup();
    const root = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/mandates/root`,
      headers,
      payload: {
        holderAgentId: rootAgentId,
        budgetLimitMinor: 10000,
        currency: "INR",
        permittedActions: ["book_hotel", "book_transport"],
        expiresAt: "2027-01-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 3,
        approvalRequired: false,
      },
    });
    expect(root.statusCode).toBe(201);
    const rootMandateId = root.json().mandate.id as string;

    const child = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: travelAgentId,
        budgetLimitMinor: 6000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(child.statusCode).toBe(201);
    expect(child.json().decision.code).toBe("ALLOW");

    const broad = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: travelAgentId,
        budgetLimitMinor: 5000,
        currency: "INR",
        permittedActions: ["refund"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(broad.statusCode).toBe(403);
    expect(broad.json().decision.code).toBe("BUDGET_EXCEEDED");
  });

  it("denies actions after root revocation", async () => {
    const { app, headers, environmentId, rootAgentId } = await setup();
    const root = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/mandates/root`,
      headers,
      payload: {
        holderAgentId: rootAgentId,
        budgetLimitMinor: 10000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2027-01-01T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: false,
      },
    });
    const mandateId = root.json().mandate.id as string;
    await app.inject({ method: "POST", url: `/v1/mandates/${mandateId}/revocations`, headers });
    const check = await app.inject({
      method: "POST",
      url: `/v1/mandates/${mandateId}/check`,
      headers,
      payload: { action: "book_hotel", amountMinor: 1, currency: "INR" },
    });
    expect(check.statusCode).toBe(403);
    expect(check.json().decision.code).toBe("MANDATE_REVOKED");
  });

  it("does not allow another principal to inspect a mandate", async () => {
    const { app, headers, environmentId, rootAgentId } = await setup();
    const root = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/mandates/root`,
      headers,
      payload: {
        holderAgentId: rootAgentId,
        budgetLimitMinor: 10000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2027-01-01T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: false,
      },
    });
    const mandateId = root.json().mandate.id as string;
    const check = await app.inject({
      method: "POST",
      url: `/v1/mandates/${mandateId}/check`,
      headers: { "x-local-user-id": "bob" },
      payload: { action: "book_hotel", amountMinor: 1, currency: "INR" },
    });
    expect(check.statusCode).toBe(403);
    expect(check.json().decision.code).toBe("MANDATE_NOT_FOUND");
  });

  it("permits child mandate actions when root has allocated all funds, and supports action-to-root trace", async () => {
    const { app, headers, environmentId, rootAgentId, travelAgentId } = await setup();
    const root = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/mandates/root`,
      headers,
      payload: {
        holderAgentId: rootAgentId,
        budgetLimitMinor: 10000,
        currency: "INR",
        permittedActions: ["book_hotel", "book_transport"],
        expiresAt: "2027-01-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 3,
        approvalRequired: false,
      },
    });
    const rootMandateId = root.json().mandate.id as string;

    // Delegate entire 10,000 budget to travel agent (so root has 0 unallocated remaining)
    const child = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: travelAgentId,
        budgetLimitMinor: 10000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(child.statusCode).toBe(201);
    const childMandateId = child.json().mandate.id as string;

    // Checking child mandate for 1,000 must ALLOW even though root has 0 available
    const check = await app.inject({
      method: "POST",
      url: `/v1/mandates/${childMandateId}/check`,
      headers,
      payload: { action: "book_hotel", amountMinor: 1000, currency: "INR" },
    });
    expect(check.statusCode).toBe(200);
    expect(check.json().decision.allowed).toBe(true);
    expect(check.json().decision.code).toBe("ALLOW");

    // Inspect mandate chain for action-to-root trace
    const chainRes = await app.inject({
      method: "GET",
      url: `/v1/mandates/${childMandateId}/chain`,
      headers,
    });
    expect(chainRes.statusCode).toBe(200);
    const chain = chainRes.json().chain;
    expect(chain).toHaveLength(2);
    expect(chain[0].id).toBe(rootMandateId);
    expect(chain[1].id).toBe(childMandateId);

    // Foreign user cannot view chain
    const foreignChain = await app.inject({
      method: "GET",
      url: `/v1/mandates/${childMandateId}/chain`,
      headers: { "x-local-user-id": "bob" },
    });
    expect(foreignChain.statusCode).toBe(404);
  });
});
