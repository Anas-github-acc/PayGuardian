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

  it("lists accounts, reclaims unspent child funds, and traces actions to root mandate", async () => {
    const { app, headers, environmentId, childAgentId, rootMandateId, childMandateId } =
      await setup();

    const rootAccount = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: { mandateId: rootMandateId, currency: "INR", availableMinor: 10000 },
    });
    const rootAccountId = rootAccount.json().account.id;

    const childAccount = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: {
        mandateId: childMandateId,
        parentAccountId: rootAccountId,
        currency: "INR",
        availableMinor: 0,
      },
    });
    const childAccountId = childAccount.json().account.id;

    // List all accounts in environment
    const listRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().accounts).toHaveLength(2);

    // Allocate 6000 to child
    await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/allocations`,
      headers,
      payload: {
        parentAccountId: rootAccountId,
        childAccountId,
        amountMinor: 6000,
        idempotencyKey: "alloc-trace-1",
        requestHash: "hash-alloc-1",
      },
    });

    // Reserve an action from child
    const actionRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: childAgentId,
        mandateId: childMandateId,
        ledgerAccountId: childAccountId,
        idempotencyKey: "act-trace-1",
        requestHash: "hash-act-trace-1",
        action: "book_hotel",
        amountMinor: 1500,
        currency: "INR",
      },
    });
    expect(actionRes.statusCode).toBe(201);
    const actionId = actionRes.json().action.id;

    // Trace child action to root mandate
    const traceRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/actions/${actionId}/trace`,
      headers,
    });
    expect(traceRes.statusCode).toBe(200);
    const trace = traceRes.json();
    expect(trace.action.id).toBe(actionId);
    expect(trace.agent.id).toBe(childAgentId);
    expect(trace.mandateChain).toHaveLength(2);
    expect(trace.rootMandate.id).toBe(rootMandateId);

    // Reclaim 2000 unspent funds from child back to parent
    const reclaimRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/reclaims`,
      headers,
      payload: {
        parentAccountId: rootAccountId,
        childAccountId,
        amountMinor: 2000,
        idempotencyKey: "reclaim-trace-1",
        requestHash: "hash-reclaim-1",
      },
    });
    expect(reclaimRes.statusCode).toBe(200);
    expect(reclaimRes.json().reclaim.parent.availableMinor).toBe(6000);
    expect(reclaimRes.json().reclaim.child.availableMinor).toBe(2500); // 6000 - 1500 reserved - 2000 reclaimed = 2500
  });

  it("handles concurrent reservations safely without overspending", async () => {
    const { app, headers, environmentId, childAgentId, rootMandateId, childMandateId } =
      await setup();

    const rootAccount = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: { mandateId: rootMandateId, currency: "INR", availableMinor: 10000 },
    });
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

    // Allocate 1000 to child
    await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/allocations`,
      headers,
      payload: {
        parentAccountId: rootAccount.json().account.id,
        childAccountId: childAccount.json().account.id,
        amountMinor: 1000,
        idempotencyKey: "alloc-conc-1",
        requestHash: "hash-alloc-conc-1",
      },
    });

    // Fire 2 concurrent reservations for 700 each (total 1400 > 1000 available)
    const [resA, resB] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/actions/reserve`,
        headers,
        payload: {
          agentId: childAgentId,
          mandateId: childMandateId,
          ledgerAccountId: childAccount.json().account.id,
          idempotencyKey: "conc-action-a",
          requestHash: "hash-conc-a",
          action: "book_hotel",
          amountMinor: 700,
          currency: "INR",
        },
      }),
      app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/actions/reserve`,
        headers,
        payload: {
          agentId: childAgentId,
          mandateId: childMandateId,
          ledgerAccountId: childAccount.json().account.id,
          idempotencyKey: "conc-action-b",
          requestHash: "hash-conc-b",
          action: "book_hotel",
          amountMinor: 700,
          currency: "INR",
        },
      }),
    ]);

    const statusCodes = [resA.statusCode, resB.statusCode].sort();
    // Exactly one must succeed (201) and one must be rejected (400 or 403)
    expect(statusCodes[0]).toBe(201);
    expect(statusCodes[1]).toBeGreaterThanOrEqual(400);

    const childAfter = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/ledger/accounts/${childAccount.json().account.id}`,
      headers,
    });
    expect(childAfter.json().account.reservedMinor).toBe(700);
    expect(childAfter.json().account.availableMinor).toBe(300);
  });
});
