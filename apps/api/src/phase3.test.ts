import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryRegistry } from "./phase1.js";

const apps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

async function setup() {
  const app = buildApp({
    registry: new InMemoryRegistry(),
    resolvePrincipal: async (_authorization, localUserId) =>
      localUserId ? { userId: localUserId, kind: "user" } : null,
  });
  apps.add(app);
  const headers = { "x-local-user-id": "alice" };
  const environment = await app.inject({
    method: "POST",
    url: "/v1/environments",
    headers,
    payload: { name: "Travel", purpose: "Trip planning", currency: "INR", budgetLimitMinor: 10000 },
  });
  const environmentId = environment.json().environment.id as string;
  const rootAgent = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/root`,
    headers,
    payload: { name: "Personal Agent", capabilities: ["delegate"] },
  });
  const rootAgentId = rootAgent.json().agent.id as string;
  const childAgent = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/children`,
    headers,
    payload: { parentAgentId: rootAgentId, name: "Travel Agent", kind: "travel" },
  });
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
      maxDelegationDepth: 3,
      approvalRequired: false,
    },
  });
  const rootMandateId = rootMandate.json().mandate.id as string;
  const childMandate = await app.inject({
    method: "POST",
    url: `/v1/mandates/${rootMandateId}/delegations`,
    headers,
    payload: {
      holderAgentId: childAgent.json().agent.id,
      budgetLimitMinor: 6000,
      currency: "INR",
      permittedActions: ["book_hotel"],
      expiresAt: "2026-12-01T00:00:00.000Z",
      canDelegate: false,
      maxDelegationDepth: 2,
      approvalRequired: false,
    },
  });
  return {
    app,
    headers,
    environmentId,
    rootAgentId,
    childAgentId: childAgent.json().agent.id as string,
    rootMandateId,
    childMandateId: childMandate.json().mandate.id as string,
  };
}

describe("Phase 3 ledger routes", () => {
  it("allocates, reserves, captures, and preserves idempotent action retries", async () => {
    const {
      app,
      headers,
      environmentId,
      rootAgentId,
      childAgentId,
      rootMandateId,
      childMandateId,
    } = await setup();
    const rootAccount = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: {
        mandateId: rootMandateId,
        currency: "INR",
        availableMinor: 10000,
      },
    });
    expect(rootAccount.statusCode).toBe(201);
    const childAccount = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: {
        mandateId: childMandateId,
        parentAccountId: rootAccount.json().account.id,
        currency: "INR",
        availableMinor: 0,
      },
    });
    expect(childAccount.statusCode).toBe(201);
    const allocation = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/allocations`,
      headers,
      payload: {
        parentAccountId: rootAccount.json().account.id,
        childAccountId: childAccount.json().account.id,
        amountMinor: 6000,
        idempotencyKey: "travel-allocation-1",
        requestHash: "hash-allocation-1",
      },
    });
    expect(allocation.statusCode).toBe(200);
    expect(allocation.json().allocation.child.availableMinor).toBe(6000);

    const actionPayload = {
      agentId: childAgentId,
      mandateId: childMandateId,
      ledgerAccountId: childAccount.json().account.id,
      idempotencyKey: "hotel-action-1",
      requestHash: "hash-hotel-1",
      action: "book_hotel",
      amountMinor: 1000,
      currency: "INR",
    };
    const reserved = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: actionPayload,
    });
    expect(reserved.statusCode).toBe(201);
    const retry = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: actionPayload,
    });
    expect(retry.statusCode).toBe(201);
    expect(retry.json().action.id).toBe(reserved.json().action.id);

    const captured = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/${reserved.json().action.id}/capture`,
      headers,
    });
    expect(captured.statusCode).toBe(200);
    expect(captured.json().reservation.state).toBe("captured");

    const account = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/ledger/accounts/${childAccount.json().account.id}`,
      headers,
    });
    expect(account.json().account).toMatchObject({ availableMinor: 5000, capturedMinor: 1000 });
    const releasable = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        ...actionPayload,
        idempotencyKey: "hotel-action-2",
        requestHash: "hash-hotel-2",
        amountMinor: 500,
      },
    });
    const released = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/${releasable.json().action.id}/release`,
      headers,
      payload: { reason: "Provider rejected before dispatch" },
    });
    expect(released.statusCode).toBe(200);
    expect(released.json().reservation.state).toBe("released");
    expect(rootAgentId).toBeDefined();
  });

  it("does not allow an unauthorized mandate holder to reserve funds", async () => {
    const { app, headers, environmentId, rootAgentId, rootMandateId } = await setup();
    const rootAccount = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: { mandateId: rootMandateId, currency: "INR", availableMinor: 10000 },
    });
    const result = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: rootAgentId,
        mandateId: rootMandateId,
        ledgerAccountId: rootAccount.json().account.id,
        idempotencyKey: "refund-action",
        requestHash: "refund-hash",
        action: "refund",
        amountMinor: 1,
        currency: "INR",
      },
    });
    expect(result.statusCode).toBe(403);
    expect(result.json().decision.code).toBe("ACTION_NOT_PERMITTED");
  });
});
