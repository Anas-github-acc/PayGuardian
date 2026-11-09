import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryRegistry } from "./phase1.js";
import { InMemoryAuthorityStore } from "./phase2.js";
import { InMemoryLedgerStore } from "./phase3.js";
import { InMemoryAuditStore } from "./audit.js";
import {
  InMemoryPayPalOperationStore,
  type PayPalCapture,
  type PayPalClient,
  type PayPalOrder,
  type PayPalWorkerOrderEnqueueInput,
  type PayPalWorkerOrderStore,
} from "./paypal.js";
import { InMemoryProviderEventStore } from "./paypal-events.js";
import { InMemoryProviderJobStore } from "./provider-jobs.js";
import { createPrincipalResolver } from "./auth.js";

const apps = new Set<Awaited<ReturnType<typeof buildApp>>>();
const initialExecutionMode = process.env.PAYPAL_EXECUTION_MODE;
const initialDatabaseMode = process.env.DATABASE_MODE;

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
  if (initialExecutionMode === undefined) delete process.env.PAYPAL_EXECUTION_MODE;
  else process.env.PAYPAL_EXECUTION_MODE = initialExecutionMode;
  if (initialDatabaseMode === undefined) delete process.env.DATABASE_MODE;
  else process.env.DATABASE_MODE = initialDatabaseMode;
});

function mockPayPal() {
  const calls = { create: 0, capture: 0 };
  const client: PayPalClient = {
    async createOrder(): Promise<PayPalOrder> {
      calls.create += 1;
      return {
        id: "paypal-order-1",
        status: "CREATED",
        approvalUrl: "https://www.sandbox.paypal.com/checkoutnow?token=paypal-order-1",
        currency: "USD",
        amountMinor: 1000,
      };
    },
    async captureOrder(): Promise<PayPalCapture> {
      calls.capture += 1;
      return { orderId: "paypal-order-1", status: "COMPLETED", captureId: "paypal-capture-1" };
    },
    async getOrder() {
      return { orderId: "paypal-order-1", status: "CREATED", captureId: null };
    },
    async verifyWebhook() {
      return true;
    },
  };
  return { client, calls };
}

async function setup(options: { workerOrder?: PayPalWorkerOrderStore } = {}) {
  const registry = new InMemoryRegistry();
  const authority = new InMemoryAuthorityStore();
  const ledger = new InMemoryLedgerStore();
  const audit = new InMemoryAuditStore();
  const paypalOperations = new InMemoryPayPalOperationStore();
  const providerEvents = new InMemoryProviderEventStore();
  const providerJobs = new InMemoryProviderJobStore();
  const mock = mockPayPal();

  const resolvePrincipal = createPrincipalResolver(
    null,
    { localDevAuthEnabled: true } as any,
    registry,
  );

  const app = buildApp({
    registry,
    authority,
    ledger,
    audit,
    paypalOperations,
    providerEvents,
    providerJobs,
    paypal: mock.client,
    paypalWorkerOrder: options.workerOrder,
    resolvePrincipal,
  });
  apps.add(app);

  const userHeaders = { "x-local-user-id": "alice" };

  // 1. Create environment
  const envRes = await app.inject({
    method: "POST",
    url: "/v1/environments",
    headers: userHeaders,
    payload: {
      name: "Identity Binding Test Env",
      purpose: "Testing agent identity verification",
      currency: "USD",
      budgetLimitMinor: 20000,
    },
  });
  const environmentId = envRes.json().environment.id as string;

  // 2. Create Agent A (Root Agent)
  const agentARes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/root`,
    headers: userHeaders,
    payload: {
      name: "Agent Alpha",
      capabilities: ["delegate", "book_hotel", "paypal_order"],
    },
  });
  const agentA = agentARes.json().agent;
  const tokenA = (agentARes.json().credential.secret ?? agentARes.json().credential.token) as string;

  // 3. Create Agent B (Child Agent)
  const agentBRes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/children`,
    headers: userHeaders,
    payload: {
      parentAgentId: agentA.id,
      name: "Agent Beta",
      kind: "travel",
      capabilities: ["book_hotel", "paypal_order"],
    },
  });
  const agentB = agentBRes.json().agent;
  const tokenB = (agentBRes.json().credential.secret ?? agentBRes.json().credential.token) as string;

  // 4. Create root mandate for Agent A
  const rootMandateRes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/mandates/root`,
    headers: userHeaders,
    payload: {
      holderAgentId: agentA.id,
      budgetLimitMinor: 20000,
      currency: "USD",
      permittedActions: ["book_hotel", "paypal_order"],
      expiresAt: "2027-01-01T00:00:00.000Z",
      canDelegate: true,
      maxDelegationDepth: 2,
      approvalRequired: false,
    },
  });
  const rootMandateId = rootMandateRes.json().mandate.id as string;

  // 5. Delegate mandate to Agent B
  const childMandateRes = await app.inject({
    method: "POST",
    url: `/v1/mandates/${rootMandateId}/delegations`,
    headers: userHeaders,
    payload: {
      holderAgentId: agentB.id,
      budgetLimitMinor: 10000,
      currency: "USD",
      permittedActions: ["book_hotel", "paypal_order"],
      expiresAt: "2026-12-31T00:00:00.000Z",
      canDelegate: false,
      maxDelegationDepth: 1,
      approvalRequired: false,
    },
  });
  const childMandateId = childMandateRes.json().mandate.id as string;

  // 6. Setup ledger accounts
  const rootAccountRes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/ledger/accounts`,
    headers: userHeaders,
    payload: {
      mandateId: rootMandateId,
      currency: "USD",
      availableMinor: 20000,
    },
  });
  const rootAccountId = rootAccountRes.json().account.id as string;

  const childAccountRes = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/ledger/accounts`,
    headers: userHeaders,
    payload: {
      mandateId: childMandateId,
      parentAccountId: rootAccountId,
      currency: "USD",
      availableMinor: 0,
    },
  });
  const childAccountId = childAccountRes.json().account.id as string;

  // Allocate funds to child account
  await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/ledger/allocations`,
    headers: userHeaders,
    payload: {
      parentAccountId: rootAccountId,
      childAccountId: childAccountId,
      amountMinor: 10000,
      idempotencyKey: "alloc-child-1",
      requestHash: "hash-alloc-child-1",
    },
  });

  return {
    app,
    registry,
    authority,
    ledger,
    audit,
    mock,
    environmentId,
    userHeaders,
    agentA,
    tokenA,
    agentB,
    tokenB,
    rootMandateId,
    childMandateId,
    rootAccountId,
    childAccountId,
  };
}

describe("Secure Agent Identity Binding", () => {
  describe("Phase 3 protected action reservation (/actions/reserve)", () => {
    it("succeeds when agent authenticates with matching agentId in body", async () => {
      const { app, environmentId, agentA, tokenA, rootMandateId, rootAccountId } = await setup();

      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/actions/reserve`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          agentId: agentA.id,
          mandateId: rootMandateId,
          ledgerAccountId: rootAccountId,
          idempotencyKey: "action-agent-matching",
          requestHash: "hash-agent-matching",
          action: "book_hotel",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().action.agentId).toBe(agentA.id);
      expect(res.json().action.authorizationState).toBe("authorized");
      expect(res.json().action.executionState).toBe("pending");
    });

    it("succeeds when agent authenticates and omits agentId in body (derived from credential)", async () => {
      const { app, environmentId, agentA, tokenA, rootMandateId, rootAccountId } = await setup();

      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/actions/reserve`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          mandateId: rootMandateId,
          ledgerAccountId: rootAccountId,
          idempotencyKey: "action-agent-omitted",
          requestHash: "hash-agent-omitted",
          action: "book_hotel",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().action.agentId).toBe(agentA.id);
      expect(res.json().action.authorizationState).toBe("authorized");
      expect(res.json().action.executionState).toBe("pending");
    });

    it("rejects forged agent ID with 403 AGENT_IDENTITY_MISMATCH and logs audit denial", async () => {
      const { app, audit, environmentId, agentA, tokenA, agentB, childMandateId, childAccountId } =
        await setup();

      // Agent A attempts to execute an action pretending to be Agent B
      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/actions/reserve`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          agentId: agentB.id, // Forged! Token belongs to Agent A
          mandateId: childMandateId,
          ledgerAccountId: childAccountId,
          idempotencyKey: "action-agent-forged",
          requestHash: "hash-agent-forged",
          action: "book_hotel",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({
        code: "AGENT_IDENTITY_MISMATCH",
        message: "Supplied agentId does not match authenticated agent credentials.",
      });

      // Verify audit trail contains action.denied event
      const events = await audit.list(environmentId);
      const deniedEvent = events.find((e) => e.eventType === "action.denied");
      expect(deniedEvent).toBeDefined();
      expect(deniedEvent?.reasonCode).toBe("AGENT_IDENTITY_MISMATCH");
      expect(deniedEvent?.payload).toEqual({
        authenticatedAgentId: agentA.id,
        suppliedAgentId: agentB.id,
      });
    });

    it("rejects Agent B attempting to forge Agent A identity with 403 AGENT_IDENTITY_MISMATCH", async () => {
      const { app, environmentId, agentA, tokenB, rootMandateId, rootAccountId } = await setup();

      // Agent B uses tokenB but specifies agentA.id in request body
      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/actions/reserve`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          agentId: agentA.id, // Forged!
          mandateId: rootMandateId,
          ledgerAccountId: rootAccountId,
          idempotencyKey: "action-agent-b-forged",
          requestHash: "hash-agent-b-forged",
          action: "book_hotel",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe("AGENT_IDENTITY_MISMATCH");
    });

    it("allows user-authenticated request specifying target agentId", async () => {
      const { app, environmentId, userHeaders, agentB, childMandateId, childAccountId } =
        await setup();

      // User alice makes a request specifying Agent B
      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/actions/reserve`,
        headers: userHeaders,
        payload: {
          agentId: agentB.id,
          mandateId: childMandateId,
          ledgerAccountId: childAccountId,
          idempotencyKey: "action-user-auth",
          requestHash: "hash-user-auth",
          action: "book_hotel",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().action.agentId).toBe(agentB.id);
    });

    it("rejects user-authenticated request missing agentId with 400 AGENT_ID_REQUIRED", async () => {
      const { app, environmentId, userHeaders, childMandateId, childAccountId } = await setup();

      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/actions/reserve`,
        headers: userHeaders,
        payload: {
          mandateId: childMandateId,
          ledgerAccountId: childAccountId,
          idempotencyKey: "action-user-no-agent",
          requestHash: "hash-user-no-agent",
          action: "book_hotel",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        code: "AGENT_ID_REQUIRED",
        message: "Agent ID is required.",
      });
    });

    it("rejects user-authenticated request with agent not holding the mandate", async () => {
      const { app, environmentId, userHeaders, agentA, childMandateId, childAccountId } =
        await setup();

      // Agent A does not hold childMandateId
      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/actions/reserve`,
        headers: userHeaders,
        payload: {
          agentId: agentA.id,
          mandateId: childMandateId,
          ledgerAccountId: childAccountId,
          idempotencyKey: "action-user-wrong-holder",
          requestHash: "hash-user-wrong-holder",
          action: "book_hotel",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe("AUTHORITY_TARGET_NOT_FOUND");
    });
  });

  describe("PayPal payment orders (/payments/paypal/orders)", () => {
    it("succeeds when agent authenticates with matching agentId in body", async () => {
      const { app, environmentId, agentA, tokenA, rootMandateId, rootAccountId } = await setup();

      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/payments/paypal/orders`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          agentId: agentA.id,
          mandateId: rootMandateId,
          ledgerAccountId: rootAccountId,
          idempotencyKey: "paypal-agent-matching",
          requestHash: "hash-paypal-matching",
          action: "paypal_order",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().action.agentId).toBe(agentA.id);
      expect(res.json().order.status).toBe("CREATED");
    });

    it("succeeds when agent authenticates and omits agentId in body (derived from credential)", async () => {
      const { app, environmentId, agentA, tokenA, rootMandateId, rootAccountId } = await setup();

      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/payments/paypal/orders`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          mandateId: rootMandateId,
          ledgerAccountId: rootAccountId,
          idempotencyKey: "paypal-agent-omitted",
          requestHash: "hash-paypal-omitted",
          action: "paypal_order",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().action.agentId).toBe(agentA.id);
      expect(res.json().order.status).toBe("CREATED");
    });

    it("rejects forged agent ID with 403 AGENT_IDENTITY_MISMATCH", async () => {
      const { app, environmentId, tokenA, agentB, childMandateId, childAccountId } = await setup();

      // Agent A uses tokenA but sends agentB.id
      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/payments/paypal/orders`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          agentId: agentB.id,
          mandateId: childMandateId,
          ledgerAccountId: childAccountId,
          idempotencyKey: "paypal-agent-forged",
          requestHash: "hash-paypal-forged",
          action: "paypal_order",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({
        code: "AGENT_IDENTITY_MISMATCH",
        message: "Supplied agentId does not match authenticated agent credentials.",
      });
    });

    it("allows user-authenticated request specifying agentId", async () => {
      const { app, environmentId, userHeaders, agentA, rootMandateId, rootAccountId } =
        await setup();

      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/payments/paypal/orders`,
        headers: userHeaders,
        payload: {
          agentId: agentA.id,
          mandateId: rootMandateId,
          ledgerAccountId: rootAccountId,
          idempotencyKey: "paypal-user-auth",
          requestHash: "hash-paypal-user-auth",
          action: "paypal_order",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().action.agentId).toBe(agentA.id);
    });

    it("rejects user-authenticated request missing agentId with 400 AGENT_ID_REQUIRED", async () => {
      const { app, environmentId, userHeaders, rootMandateId, rootAccountId } = await setup();

      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/payments/paypal/orders`,
        headers: userHeaders,
        payload: {
          mandateId: rootMandateId,
          ledgerAccountId: rootAccountId,
          idempotencyKey: "paypal-user-missing-agent",
          requestHash: "hash-paypal-user-missing-agent",
          action: "paypal_order",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        code: "AGENT_ID_REQUIRED",
        message: "Agent ID is required.",
      });
    });

    it("passes authenticated agent identity to worker order execution in worker mode", async () => {
      process.env.PAYPAL_EXECUTION_MODE = "worker";
      process.env.DATABASE_MODE = "supabase";

      const calls: PayPalWorkerOrderEnqueueInput[] = [];
      const workerOrder: PayPalWorkerOrderStore = {
        async enqueue(input) {
          calls.push(input);
          return {
            action: {
              id: "worker-action-1",
              environmentId: input.environmentId,
              agentId: input.agentId,
              mandateId: input.mandateId,
              action: input.action,
              amountMinor: input.amountMinor,
              currency: input.currency,
              status: "reserved",
              authorizationState: "authorized",
              executionState: "queued",
              idempotencyKey: input.idempotencyKey,
              requestHash: input.requestHash,
              signatureValid: true,
              authorizedAt: "2026-10-22T00:00:00.000Z",
              executedAt: null,
              settledAt: null,
              failureReason: null,
              createdAt: "2026-10-22T00:00:00.000Z",
              updatedAt: "2026-10-22T00:00:00.000Z",
            },
            reservation: {
              actionId: "worker-action-1",
              accountId: input.ledgerAccountId,
              amountMinor: input.amountMinor,
              state: "held",
            },
            operation: {
              actionId: "worker-action-1",
              environmentId: input.environmentId,
              provider: "paypal",
              providerOrderId: null,
              intent: "CAPTURE",
              status: "QUEUED",
              observedProviderStatus: null,
              reconciliationState: "pending",
              approvalUrl: null,
              lastCheckedAt: null,
              lastEventAt: null,
              lastErrorCode: null,
              captureId: null,
              createdAt: "2026-10-22T00:00:00.000Z",
              updatedAt: "2026-10-22T00:00:00.000Z",
            },
            job: {
              id: "worker-job-1",
              provider: "paypal",
              intent: "create_order",
              dedupeKey: "paypal:create_order:worker-action-1",
              payload: { action: { id: "worker-action-1" } },
              status: "queued",
              attempts: 0,
              maxAttempts: 5,
              availableAt: "2026-10-22T00:00:00.000Z",
              leaseOwner: null,
              leaseToken: null,
              leaseExpiresAt: null,
              lastErrorCode: null,
              lastErrorMessage: null,
              completedAt: null,
              createdAt: "2026-10-22T00:00:00.000Z",
              updatedAt: "2026-10-22T00:00:00.000Z",
            },
            deduplicated: false,
          };
        },
      };

      const { app, environmentId, agentA, tokenA, rootMandateId, rootAccountId } = await setup({
        workerOrder,
      });

      const res = await app.inject({
        method: "POST",
        url: `/v1/environments/${environmentId}/payments/paypal/orders`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          mandateId: rootMandateId,
          ledgerAccountId: rootAccountId,
          idempotencyKey: "paypal-worker-agent",
          requestHash: "hash-paypal-worker-agent",
          action: "paypal_order",
          amountMinor: 1000,
          currency: "USD",
        },
      });

      expect(res.statusCode).toBe(202);
      expect(calls).toHaveLength(1);
      expect(calls[0].agentId).toBe(agentA.id);
    });
  });
});
