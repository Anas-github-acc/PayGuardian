import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryRegistry } from "./phase1.js";
import { InMemoryAuthorityStore } from "./phase2.js";
import { InMemoryLedgerStore } from "./phase3.js";

const apps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

async function setup() {
  const registry = new InMemoryRegistry();
  const authority = new InMemoryAuthorityStore();
  const ledger = new InMemoryLedgerStore();

  const app = buildApp({
    registry,
    authority,
    ledger,
    resolvePrincipal: async (_authorization, localUserId) =>
      localUserId ? { userId: localUserId, kind: "user" } : null,
  });
  apps.add(app);
  const headers = { "x-local-user-id": "alice" };

  // Create environment with ₹10,000 limit
  const environment = await app.inject({
    method: "POST",
    url: "/v1/environments",
    headers,
    payload: { name: "Travel Env", purpose: "Trips", currency: "INR", budgetLimitMinor: 1000000 }, // ₹10,000
  });
  const environmentId = environment.json().environment.id as string;

  // Root agent
  const rootAgent = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/root`,
    headers,
    payload: { name: "Personal Agent", capabilities: ["delegate"] },
  });
  const rootAgentId = rootAgent.json().agent.id as string;

  // Subagent X
  const subagentX = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/children`,
    headers,
    payload: { parentAgentId: rootAgentId, name: "Subagent X", kind: "travel" },
  });
  const subagentXId = subagentX.json().agent.id as string;

  // Subagent X Child (for nested child allocation testing)
  const nestedChild = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/children`,
    headers,
    payload: { parentAgentId: subagentXId, name: "Nested Booking Agent", kind: "custom" },
  });
  const nestedChildId = nestedChild.json().agent.id as string;

  // Root Mandate with ₹5,000 (500,000 paise)
  const rootMandate = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/mandates/root`,
    headers,
    payload: {
      holderAgentId: rootAgentId,
      budgetLimitMinor: 500000, // ₹5,000
      currency: "INR",
      permittedActions: ["book_hotel", "buy_food", "book_flight"],
      expiresAt: "2027-01-01T00:00:00.000Z",
      canDelegate: true,
      maxDelegationDepth: 3,
      approvalRequired: false,
    },
  });
  const rootMandateId = rootMandate.json().mandate.id as string;

  // Create root ledger account
  const rootAccount = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/ledger/accounts`,
    headers,
    payload: {
      mandateId: rootMandateId,
      currency: "INR",
      availableMinor: 500000,
    },
  });
  const rootAccountId = rootAccount.json().account.id as string;

  return {
    app,
    authority,
    ledger,
    headers,
    environmentId,
    rootAgentId,
    subagentXId,
    nestedChildId,
    rootMandateId,
    rootAccountId,
  };
}

describe("Key Changes - Mandate Versioning & Top-ups", () => {
  it("initial ₹500 allocation creates V1; additional ₹1,000 creates V2 with ₹1,500 limit and carries forward spend, reservations, and allocations", async () => {
    const { app, authority, ledger, headers, environmentId, subagentXId, nestedChildId, rootMandateId, rootAccountId } =
      await setup();

    // 1. Initial ₹500 allocation -> V1 created
    const v1Res = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 50000, // ₹500.00
        currency: "INR",
        permittedActions: ["book_hotel", "buy_food"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(v1Res.statusCode).toBe(201);
    const v1 = v1Res.json().mandate;
    expect(v1.version).toBe(1);
    expect(v1.budgetLimitMinor).toBe(50000); // ₹500
    expect(v1.state).toBe("active");
    expect(v1.previousMandateId).toBeNull();
    expect(v1.mandateSeriesId).toBe(v1.id);

    // Create ledger account for Subagent X
    const subagentAccountRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: {
        mandateId: v1.id,
        parentAccountId: rootAccountId,
        currency: "INR",
        availableMinor: 0,
      },
    });
    expect(subagentAccountRes.statusCode).toBe(201);
    const subagentAccountId = subagentAccountRes.json().account.id;

    // Allocate initial ₹500 to Subagent X ledger account
    const allocRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/allocations`,
      headers,
      payload: {
        parentAccountId: rootAccountId,
        childAccountId: subagentAccountId,
        amountMinor: 50000,
        idempotencyKey: "init-alloc-v1",
        requestHash: "hash-init-alloc",
      },
    });
    expect(allocRes.statusCode).toBe(200);

    // 2. Simulate operations under V1:
    // a) Spend ₹100 (reserve ₹100, then capture it)
    const action1 = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: subagentXId,
        mandateId: v1.id,
        ledgerAccountId: subagentAccountId,
        idempotencyKey: "action-spend-100",
        requestHash: "hash-spend-100",
        action: "book_hotel",
        amountMinor: 10000, // ₹100
        currency: "INR",
      },
    });
    expect(action1.statusCode).toBe(201);
    const action1Id = action1.json().action.id;
    await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/${action1Id}/capture`,
      headers,
    });

    // b) Existing ₹50 active reservation
    const action2 = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: subagentXId,
        mandateId: v1.id,
        ledgerAccountId: subagentAccountId,
        idempotencyKey: "action-reserve-50",
        requestHash: "hash-reserve-50",
        action: "buy_food",
        amountMinor: 5000, // ₹50
        currency: "INR",
      },
    });
    expect(action2.statusCode).toBe(201);

    // c) Existing ₹200 downstream child allocation from V1 to nestedChild
    const nestedDelegation = await app.inject({
      method: "POST",
      url: `/v1/mandates/${v1.id}/delegations`,
      headers,
      payload: {
        holderAgentId: nestedChildId,
        budgetLimitMinor: 20000, // ₹200
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-11-01T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(nestedDelegation.statusCode).toBe(201);

    // Verify V1 counters before top-up
    // Update memory model counters to mirror captured action & reservation
    const v1Stored = await authority.get(v1.id);
    expect(v1Stored).not.toBeNull();
    v1Stored!.spentMinor = 10000; // ₹100
    v1Stored!.reservedMinor = 5000; // ₹50
    expect(v1Stored!.allocatedMinor).toBe(20000); // ₹200 from nested delegation

    const parentBefore = await authority.get(rootMandateId);
    const parentAllocBefore = parentBefore!.allocatedMinor;

    // 3. Additional ₹1,000 top-up allocated to Subagent X
    const v2Res = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 100000, // Additional ₹1,000.00
        currency: "INR",
        permittedActions: ["book_hotel", "buy_food"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(v2Res.statusCode).toBe(201);
    const v2 = v2Res.json().mandate;

    // Invariants check:
    // - V2 created with limit = 500 + 1000 = ₹1,500
    expect(v2.version).toBe(2);
    expect(v2.mandateSeriesId).toBe(v1.mandateSeriesId);
    expect(v2.previousMandateId).toBe(v1.id);
    expect(v2.budgetLimitMinor).toBe(150000); // ₹1,500.00
    expect(v2.state).toBe("active");

    // - Existing ₹100 spend carried forward
    expect(v2.spentMinor).toBe(10000); // ₹100.00

    // - Existing ₹50 reservation carried forward
    expect(v2.reservedMinor).toBe(5000); // ₹50.00

    // - Existing ₹200 child allocation carried forward
    expect(v2.allocatedMinor).toBe(20000); // ₹200.00

    // - Available budget formula: Available = Limit - (Spent + Reserved + Allocated)
    // Available = 1500 - (100 + 50 + 200) = ₹1,150.00 (115,000 paise)
    const available = v2.budgetLimitMinor - (v2.spentMinor + v2.reservedMinor + v2.allocatedMinor);
    expect(available).toBe(115000);

    // - Previous version V1 is superseded
    const v1Updated = await authority.get(v1.id);
    expect(v1Updated?.state).toBe("superseded");
    expect(v1Updated?.supersededAt).toBeDefined();

    // - Parent allocation increased ONLY by the additional allocation (₹1,000)
    const parentAfter = await authority.get(rootMandateId);
    expect(parentAfter!.allocatedMinor).toBe(parentAllocBefore + 100000);

    // - Stable ledger account: Subagent X ledger account balance updated with top-up
    const subagentAccAfter = await ledger.getAccount(environmentId, subagentAccountId);
    expect(subagentAccAfter).not.toBeNull();
    // Prior available was: 500 - (100 spent + 50 reserved) = 350. With +1000 top-up, available is 1350!
    expect(subagentAccAfter!.capturedMinor).toBe(10000); // ₹100
    expect(subagentAccAfter!.reservedMinor).toBe(5000); // ₹50
    expect(subagentAccAfter!.availableMinor).toBe(135000); // ₹1,350
  });

  it("rejects permission escalation attempt", async () => {
    const { app, headers, subagentXId, rootMandateId } = await setup();

    // Initial allocation with ["book_hotel"]
    await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 50000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });

    // Top-up attempt trying to escalate by adding "buy_food" (which was blocked/omitted in V1)
    const escalateRes = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 10000,
        currency: "INR",
        permittedActions: ["book_hotel", "buy_food"], // Escalation!
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(escalateRes.statusCode).toBe(403);
    expect(escalateRes.json().decision.code).toBe("ACTION_NOT_PERMITTED");
  });

  it("rejects blocked action removal / broadening beyond parent", async () => {
    const { app, headers, subagentXId, rootMandateId } = await setup();

    // Initial allocation
    await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 50000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });

    // Top-up attempt requesting wildcard "*" or action not permitted by parent ("issue_refund")
    const broadenRes = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 10000,
        currency: "INR",
        permittedActions: ["issue_refund"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(broadenRes.statusCode).toBe(403);
    expect(broadenRes.json().decision.code).toBe("ACTION_NOT_PERMITTED");
  });

  it("rejects top-up when parent has insufficient budget", async () => {
    const { app, headers, subagentXId, rootMandateId } = await setup();

    // Initial allocation of ₹500
    await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 50000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });

    // Parent limit is ₹5,000 (500,000 paise). Request ₹6,000 top-up (600,000 paise)
    const exceedRes = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 600000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(exceedRes.statusCode).toBe(403);
    expect(exceedRes.json().decision.code).toBe("BUDGET_EXCEEDED");
  });

  it("duplicate top-up request with same idempotency key results in no duplicate allocation", async () => {
    const { app, authority, headers, subagentXId, rootMandateId } = await setup();

    // Initial allocation
    await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 50000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });

    const parentBefore = (await authority.get(rootMandateId))!.allocatedMinor;

    // First top-up with idempotency key
    const topup1 = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 100000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
        idempotencyKey: "unique-topup-key-123",
      },
    });
    expect(topup1.statusCode).toBe(201);
    const v2Id = topup1.json().mandate.id;

    // Retry identical top-up request
    const topup2 = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 100000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
        idempotencyKey: "unique-topup-key-123",
      },
    });
    expect(topup2.statusCode).toBe(201);
    expect(topup2.json().mandate.id).toBe(v2Id);

    // Parent allocation must only have increased once (+₹1,000, not +₹2,000)
    const parentAfter = (await authority.get(rootMandateId))!.allocatedMinor;
    expect(parentAfter).toBe(parentBefore + 100000);
  });

  it("handles concurrent top-ups with no lost updates or double allocation", async () => {
    const { app, authority, headers, subagentXId, rootMandateId } = await setup();

    // Initial allocation: ₹500
    const v1Res = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 50000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(v1Res.statusCode).toBe(201);

    // Launch two concurrent top-ups of ₹300 and ₹400
    const [resA, resB] = await Promise.all([
      app.inject({
        method: "POST",
        url: `/v1/mandates/${rootMandateId}/delegations`,
        headers,
        payload: {
          holderAgentId: subagentXId,
          budgetLimitMinor: 30000, // +₹300
          currency: "INR",
          permittedActions: ["book_hotel"],
          expiresAt: "2026-12-01T00:00:00.000Z",
          canDelegate: true,
          maxDelegationDepth: 2,
          approvalRequired: false,
        },
      }),
      app.inject({
        method: "POST",
        url: `/v1/mandates/${rootMandateId}/delegations`,
        headers,
        payload: {
          holderAgentId: subagentXId,
          budgetLimitMinor: 40000, // +₹400
          currency: "INR",
          permittedActions: ["book_hotel"],
          expiresAt: "2026-12-01T00:00:00.000Z",
          canDelegate: true,
          maxDelegationDepth: 2,
          approvalRequired: false,
        },
      }),
    ]);

    expect(resA.statusCode).toBe(201);
    expect(resB.statusCode).toBe(201);

    // Find the latest active mandate for subagentX
    const active = await authority.findActiveChild!(rootMandateId, subagentXId);
    expect(active).not.toBeNull();
    // Limit must be 500 + 300 + 400 = ₹1,200 (120,000 paise)
    expect(active!.budgetLimitMinor).toBe(120000);
    expect(active!.version).toBe(3);
  });

  it("previous version authorization cannot authorize new transactions", async () => {
    const { app, headers, environmentId, subagentXId, rootMandateId, rootAccountId } = await setup();

    // 1. Initial V1
    const v1Res = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 50000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    const v1Id = v1Res.json().mandate.id;

    // Subagent ledger account
    const accRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: {
        mandateId: v1Id,
        parentAccountId: rootAccountId,
        currency: "INR",
        availableMinor: 0,
      },
    });
    const accId = accRes.json().account.id;

    await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/allocations`,
      headers,
      payload: {
        parentAccountId: rootAccountId,
        childAccountId: accId,
        amountMinor: 50000,
        idempotencyKey: "alloc-prev-test",
        requestHash: "hash-prev-test",
      },
    });

    // 2. Top-up creates V2, superseding V1
    const v2Res = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 100000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    const v2Id = v2Res.json().mandate.id;

    // 3. Attempt authorization against superseded V1 -> must be rejected
    const prevAuthRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: subagentXId,
        mandateId: v1Id, // Superseded version!
        ledgerAccountId: accId,
        idempotencyKey: "superseded-attempt",
        requestHash: "hash-superseded",
        action: "book_hotel",
        amountMinor: 1000,
        currency: "INR",
      },
    });
    expect(prevAuthRes.statusCode).toBe(403);

    // 4. Authorization against current active V2 -> succeeds
    const activeAuthRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: subagentXId,
        mandateId: v2Id, // Active version!
        ledgerAccountId: accId,
        idempotencyKey: "active-attempt",
        requestHash: "hash-active",
        action: "book_hotel",
        amountMinor: 1000,
        currency: "INR",
      },
    });
    expect(activeAuthRes.statusCode).toBe(201);
  });

  it("historical transaction lookup resolves the original mandate version", async () => {
    const { app, headers, environmentId, subagentXId, rootMandateId, rootAccountId } = await setup();

    // 1. Initial V1
    const v1Res = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 50000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    const v1Id = v1Res.json().mandate.id;

    // Subagent ledger account
    const accRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: {
        mandateId: v1Id,
        parentAccountId: rootAccountId,
        currency: "INR",
        availableMinor: 0,
      },
    });
    const accId = accRes.json().account.id;

    await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/allocations`,
      headers,
      payload: {
        parentAccountId: rootAccountId,
        childAccountId: accId,
        amountMinor: 50000,
        idempotencyKey: "alloc-hist-test",
        requestHash: "hash-hist-test",
      },
    });

    // Authorize action under V1
    const actionV1 = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: subagentXId,
        mandateId: v1Id,
        ledgerAccountId: accId,
        idempotencyKey: "action-under-v1",
        requestHash: "hash-action-under-v1",
        action: "book_hotel",
        amountMinor: 10000,
        currency: "INR",
      },
    });
    expect(actionV1.statusCode).toBe(201);
    const actionId = actionV1.json().action.id;

    // Top-up to create V2
    const v2Res = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: subagentXId,
        budgetLimitMinor: 100000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-12-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    expect(v2Res.statusCode).toBe(201);

    // Look up historical action -> must still resolve original V1 mandate
    const lookedUpAction = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/actions/${actionId}`,
      headers,
    });
    expect(lookedUpAction.statusCode).toBe(200);
    expect(lookedUpAction.json().action.mandateId).toBe(v1Id);
  });
});
