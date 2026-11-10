import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryAuthorityStore } from "./phase2.js";
import { InMemoryLedgerStore } from "./phase3.js";
import { InMemoryRegistry } from "./phase1.js";
import { InMemoryApprovalStore, InMemorySessionStore } from "./phase4.js";
import { InMemoryAuditStore } from "./audit.js";

const apps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

async function setup() {
  const audit = new InMemoryAuditStore();
  const approvals = new InMemoryApprovalStore();
  const sessions = new InMemorySessionStore();
  const app = buildApp({
    registry: new InMemoryRegistry(),
    authority: new InMemoryAuthorityStore(),
    ledger: new InMemoryLedgerStore(),
    approvals,
    sessions,
    audit,
    resolvePrincipal: async (_authorization, localUserId) =>
      localUserId ? { userId: localUserId, kind: "user" } : null,
  });
  apps.add(app);

  const headers = { "x-local-user-id": "alice" };
  const envRes = await app.inject({
    method: "POST",
    url: "/v1/environments",
    headers,
    payload: {
      name: "Travel Planning",
      purpose: "Trip to Tokyo",
      currency: "USD",
      budgetLimitMinor: 100000,
    },
  });
  const environmentId = envRes.json().environment.id as string;

  const agentRes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/root`,
    headers,
    payload: { name: "Personal Agent" },
  });
  const agentId = agentRes.json().agent.id as string;

  // Create mandate requiring human approval
  const mandateRes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/mandates/root`,
    headers,
    payload: {
      holderAgentId: agentId,
      budgetLimitMinor: 50000,
      currency: "USD",
      permittedActions: ["book_hotel", "book_flight"],
      expiresAt: "2027-01-01T00:00:00.000Z",
      canDelegate: true,
      maxDelegationDepth: 2,
      approvalRequired: true,
    },
  });
  const mandateId = mandateRes.json().mandate.id as string;

  const accRes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/ledger/accounts`,
    headers,
    payload: { mandateId, currency: "USD", availableMinor: 50000 },
  });
  const accountId = accRes.json().account.id as string;

  return { app, headers, environmentId, agentId, mandateId, accountId, audit, approvals, sessions };
}

describe("Phase 4 Approvals, Protected Actions, and Sessions", () => {
  it("enforces human approval binding on approval-required actions", async () => {
    const { app, headers, environmentId, agentId, mandateId, accountId, audit } = await setup();

    const requestHash = "hash-hotel-reservation-456";
    // 1. Attempt reservation without approval: must be denied and create a pending approval
    const unapprovedRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: accountId,
        idempotencyKey: "action-hotel-1",
        requestHash,
        action: "book_hotel",
        amountMinor: 25000,
        currency: "USD",
      },
    });

    expect(unapprovedRes.statusCode).toBe(403);
    const body = unapprovedRes.json();
    expect(body.decision.code).toBe("APPROVAL_REQUIRED");
    expect(body.approvalId).toBeDefined();
    const approvalId = body.approvalId as string;

    // 2. Query approval inbox
    const listRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/approvals?status=pending`,
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().approvals).toHaveLength(1);
    expect(listRes.json().approvals[0].id).toBe(approvalId);
    expect(listRes.json().approvals[0].status).toBe("pending");

    // 3. User approves the request
    const approveRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals/${approvalId}/approve`,
      headers,
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().approval.status).toBe("approved");
    expect(approveRes.json().approval.approvedBy).toBe("alice");

    // 4. Retry reservation with valid approvalId: succeeds!
    const approvedReserveRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: accountId,
        idempotencyKey: "action-hotel-1",
        requestHash,
        action: "book_hotel",
        amountMinor: 25000,
        currency: "USD",
        approvalId,
      },
    });
    expect(approvedReserveRes.statusCode).toBe(201);
    expect(approvedReserveRes.json().reservation.state).toBe("held");
    expect(approvedReserveRes.json().reservation.amountMinor).toBe(25000);

    // Verify audit events
    const events = await audit.list(environmentId);
    expect(events.map((e) => e.eventType)).toContain("approval.requested");
    expect(events.map((e) => e.eventType)).toContain("approval.approved");
    expect(events.map((e) => e.eventType)).toContain("action.reserved");
  });

  it("rejects reservation when approved details are tampered", async () => {
    const { app, headers, environmentId, agentId, mandateId, accountId } = await setup();

    // Create approval for 25,000 USD
    const createRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals`,
      headers,
      payload: {
        mandateId,
        agentId,
        action: "book_hotel",
        amountMinor: 25000,
        currency: "USD",
        requestHash: "original-hash-123",
      },
    });
    const approvalId = createRes.json().approval.id as string;

    // Approve it
    await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals/${approvalId}/approve`,
      headers,
    });

    // Attempt to reserve for 30,000 USD (tampered amount): must be denied!
    const tamperedRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: accountId,
        idempotencyKey: "tampered-action-1",
        requestHash: "original-hash-123",
        action: "book_hotel",
        amountMinor: 30000, // exceeds approved amount
        currency: "USD",
        approvalId,
      },
    });
    expect(tamperedRes.statusCode).toBe(403);
    expect(tamperedRes.json().decision.code).toBe("APPROVAL_REQUIRED");
  });

  it("handles approval rejection properly", async () => {
    const { app, headers, environmentId, agentId, mandateId } = await setup();

    const createRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals`,
      headers,
      payload: {
        mandateId,
        agentId,
        action: "book_flight",
        amountMinor: 40000,
        currency: "USD",
        requestHash: "flight-hash-789",
      },
    });
    const approvalId = createRes.json().approval.id as string;

    const rejectRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/approvals/${approvalId}/reject`,
      headers,
      payload: { reason: "Too expensive; choose cheaper flight." },
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.json().approval.status).toBe("rejected");
    expect(rejectRes.json().approval.rejectionReason).toContain("Too expensive");
  });

  it("manages sessions and resumable task runs", async () => {
    const { app, headers, environmentId, agentId } = await setup();

    // 1. Create session
    const createRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/sessions`,
      headers,
      payload: {
        name: "Trip Planning Session",
        agentId,
        context: { destination: "Tokyo", dates: "2026-12-01 to 2026-12-10" },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const sessionId = createRes.json().session.id as string;
    expect(createRes.json().session.status).toBe("active");

    // 2. Start run under session
    const runRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/sessions/${sessionId}/runs`,
      headers,
      payload: {
        agentId,
        checkpoint: { step: "search_hotels", candidatesFound: 3 },
      },
    });
    expect(runRes.statusCode).toBe(201);
    const runId = runRes.json().run.id as string;
    expect(runRes.json().run.status).toBe("running");

    // 3. Update checkpoint and complete run
    const checkpointRes = await app.inject({
      method: "PATCH",
      url: `/v1/environments/${environmentId}/sessions/${sessionId}/runs/${runId}`,
      headers,
      payload: {
        status: "completed",
        checkpoint: { step: "selected_hotel", hotelName: "Tokyo Grand", priceMinor: 25000 },
      },
    });
    expect(checkpointRes.statusCode).toBe(200);
    expect(checkpointRes.json().run.status).toBe("completed");

    // 4. List runs
    const listRuns = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/sessions/${sessionId}/runs`,
      headers,
    });
    expect(listRuns.statusCode).toBe(200);
    expect(listRuns.json().runs).toHaveLength(1);
    expect(listRuns.json().runs[0].checkpoint.hotelName).toBe("Tokyo Grand");
  });

  it("executes protected simulation actions without real financial settlement", async () => {
    const { app, headers, environmentId, agentId, mandateId } = await setup();

    // Allowed simulation
    const simRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/simulate`,
      headers,
      payload: {
        agentId,
        mandateId,
        action: "book_hotel",
        amountMinor: 10000,
        currency: "USD",
        parameters: { hotel: "Shinjuku Inn", nights: 3 },
      },
    });
    expect(simRes.statusCode).toBe(200);
    expect(simRes.json().allowed).toBe(true);
    expect(simRes.json().simulation.result.status).toBe("simulated_success");
    expect(simRes.json().simulation.result.details.hotel).toBe("Shinjuku Inn");

    // Denied simulation: outside permitted actions
    const deniedSim = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/simulate`,
      headers,
      payload: {
        agentId,
        mandateId,
        action: "unauthorized_casino_spend",
        amountMinor: 500,
        currency: "USD",
      },
    });
    expect(deniedSim.statusCode).toBe(403);
    expect(deniedSim.json().decision.code).toBe("ACTION_NOT_PERMITTED");
  });

  it("orchestrates hierarchical budget proposal delegation via POST /v1/approvals/:approvalId/approve", async () => {
    const { app, headers, environmentId, mandateId } = await setup();

    const approvalRes = await app.inject({
      method: "POST",
      url: "/v1/approvals/appr-test-goa-123/approve",
      headers,
      payload: {
        environmentId,
        mandateId,
        proposedAllocations: [
          {
            agent: "travel",
            role: "Travel Concierge",
            quotedCostMinor: 30000,
            requestedMandateMinor: 30000,
            capabilities: ["book_flight"],
          },
          {
            agent: "hotel",
            role: "Hotel Specialist",
            quotedCostMinor: 15000,
            requestedMandateMinor: 15000,
            parentAgent: "travel",
            isChild: true,
            capabilities: ["book_hotel"],
          },
          {
            agent: "food",
            role: "Food & Dining Specialist",
            quotedCostMinor: 10000,
            requestedMandateMinor: 10000,
            capabilities: ["book_flight"],
          },
          {
            agent: "activities",
            role: "Activities Specialist",
            quotedCostMinor: 5000,
            requestedMandateMinor: 5000,
            capabilities: ["book_flight"],
          },
        ],
      },
    });

    expect(approvalRes.statusCode).toBe(200);
    const body = approvalRes.json();
    expect(body.status).toBe("AUTHORIZED");
    expect(body.delegations).toHaveLength(4);

    const travelDel = body.delegations.find((d: any) => d.agent === "travel");
    expect(travelDel).toBeDefined();
    expect(travelDel.status).toBe("authorized");
    expect(travelDel.mandateId).toBeDefined();

    const hotelDel = body.delegations.find((d: any) => d.agent === "hotel");
    expect(hotelDel).toBeDefined();
    expect(hotelDel.parentMandateId).toBe(travelDel.mandateId); // Nested under Travel!
    expect(hotelDel.status).toBe("authorized");

    expect(body.failures).toHaveLength(0);
  });
});
