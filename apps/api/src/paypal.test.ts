import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryAuthorityStore } from "./phase2.js";
import { InMemoryLedgerStore } from "./phase3.js";
import { InMemoryRegistry } from "./phase1.js";
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

async function setup(
  executionMode: "inline" | "worker" = "inline",
  options: { workerOrder?: PayPalWorkerOrderStore } = {},
) {
  process.env.PAYPAL_EXECUTION_MODE = executionMode;
  const mock = mockPayPal();
  const providerJobs = new InMemoryProviderJobStore();
  const app = buildApp({
    registry: new InMemoryRegistry(),
    authority: options.workerOrder ? new InMemoryAuthorityStore() : undefined,
    ledger: options.workerOrder ? new InMemoryLedgerStore() : undefined,
    paypalOperations: options.workerOrder ? new InMemoryPayPalOperationStore() : undefined,
    providerEvents: options.workerOrder ? new InMemoryProviderEventStore() : undefined,
    paypalWorkerOrder: options.workerOrder,
    paypal: mock.client,
    providerJobs,
    resolvePrincipal: async (_authorization, localUserId) =>
      localUserId ? { userId: localUserId, kind: "user" } : null,
  });
  apps.add(app);
  const headers = { "x-local-user-id": "alice" };
  const environment = await app.inject({
    method: "POST",
    url: "/v1/environments",
    headers,
    payload: {
      name: "USD Payments",
      purpose: "PayPal Sandbox",
      currency: "USD",
      budgetLimitMinor: 5000,
    },
  });
  const environmentId = environment.json().environment.id as string;
  const agent = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/agents/root`,
    headers,
    payload: { name: "Personal Agent", capabilities: ["pay"] },
  });
  const agentId = agent.json().agent.id as string;
  const mandate = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/mandates/root`,
    headers,
    payload: {
      holderAgentId: agentId,
      budgetLimitMinor: 5000,
      currency: "USD",
      permittedActions: ["paypal_order"],
      expiresAt: "2027-01-01T00:00:00.000Z",
      canDelegate: false,
      maxDelegationDepth: 0,
      approvalRequired: false,
    },
  });
  const account = await app.inject({
    method: "POST",
    url: `/v1/environments/${environmentId}/ledger/accounts`,
    headers,
    payload: { mandateId: mandate.json().mandate.id, currency: "USD", availableMinor: 5000 },
  });
  return {
    app,
    headers,
    mock,
    providerJobs,
    environmentId,
    agentId,
    mandateId: mandate.json().mandate.id as string,
    accountId: account.json().account.id as string,
  };
}

describe("PayPal Sandbox routes", () => {
  it("creates an idempotent order and captures it", async () => {
    const { app, headers, mock, providerJobs, environmentId, agentId, mandateId, accountId } =
      await setup();
    const payload = {
      agentId,
      mandateId,
      ledgerAccountId: accountId,
      idempotencyKey: "paypal-action-1",
      requestHash: "paypal-request-1",
      action: "paypal_order",
      amountMinor: 1000,
      currency: "USD",
    };
    const created = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload,
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().order.approvalUrl).toContain("paypal-order-1");

    const retry = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload,
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().operation.providerOrderId).toBe("paypal-order-1");
    expect(mock.calls.create).toBe(1);

    const captured = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/${created.json().action.id}/capture`,
      headers,
    });
    expect(captured.statusCode).toBe(200);
    expect(captured.json().reservation.state).toBe("captured");
    expect(mock.calls.capture).toBe(1);
    expect(await providerJobs.list({ provider: "paypal" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ intent: "create_order" }),
        expect.objectContaining({ intent: "capture_order" }),
      ]),
    );
  });

  it("rejects INR before creating a provider order", async () => {
    const { app, headers, mock, environmentId, agentId, mandateId, accountId } = await setup();
    const response = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: accountId,
        idempotencyKey: "paypal-inr-1",
        requestHash: "paypal-inr-hash",
        action: "paypal_order",
        amountMinor: 1000,
        currency: "INR",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("PAYPAL_CURRENCY_UNSUPPORTED");
    expect(mock.calls.create).toBe(0);
  });

  it("shows status and applies a verified capture webhook only once", async () => {
    const { app, headers, mock, providerJobs, environmentId, agentId, mandateId, accountId } =
      await setup();
    const created = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: accountId,
        idempotencyKey: "paypal-webhook-1",
        requestHash: "paypal-webhook-hash",
        action: "paypal_order",
        amountMinor: 1000,
        currency: "USD",
      },
    });
    const actionId = created.json().action.id as string;
    const status = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/payments/paypal/${actionId}`,
      headers,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json().operation.status).toBe("CREATED");

    const event = {
      id: "paypal-event-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: "2026-10-22T00:00:00.000Z",
      resource: {
        id: "paypal-capture-1",
        status: "COMPLETED",
        supplementary_data: { related_ids: { order_id: "paypal-order-1" } },
      },
    };
    const applied = await app.inject({
      method: "POST",
      url: "/v1/webhooks/paypal",
      payload: event,
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json().operation.status).toBe("COMPLETED");
    const duplicate = await app.inject({
      method: "POST",
      url: "/v1/webhooks/paypal",
      payload: event,
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().duplicate).toBe(true);
    expect(mock.calls.capture).toBe(0);
    expect(await providerJobs.list({ provider: "paypal" })).toEqual(
      expect.arrayContaining([expect.objectContaining({ intent: "apply_event" })]),
    );
  });

  it("lists recent operations with safe cursor pagination and environment authorization", async () => {
    const { app, headers, environmentId, agentId, mandateId, accountId } = await setup();
    const payload = (idempotencyKey: string) => ({
      agentId,
      mandateId,
      ledgerAccountId: accountId,
      idempotencyKey,
      requestHash: `${idempotencyKey}-hash`,
      action: "paypal_order",
      amountMinor: 1000,
      currency: "USD",
    });
    await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload: payload("recent-1"),
    });
    await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload: payload("recent-2"),
    });

    const firstPage = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/payments/paypal/operations?limit=1`,
      headers,
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json().operations).toHaveLength(1);
    expect(firstPage.json().pagination.nextCursor).toEqual(expect.any(String));
    expect(firstPage.json().operations[0]).toMatchObject({
      provider: "paypal",
      amountMinor: 1000,
      currency: "USD",
      status: "CREATED",
      reconciliationState: "pending",
    });
    expect(firstPage.json().operations[0]).not.toHaveProperty("requestHash");
    expect(firstPage.json().operations[0]).not.toHaveProperty("idempotencyKey");
    expect(firstPage.json().operations[0]).not.toHaveProperty("environmentId");

    const secondPage = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/payments/paypal/operations?limit=1&cursor=${firstPage.json().pagination.nextCursor}`,
      headers,
    });
    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json().operations).toHaveLength(1);
    expect(secondPage.json().pagination.nextCursor).toBeNull();

    const invalidPage = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/payments/paypal/operations?limit=101`,
      headers,
    });
    expect(invalidPage.statusCode).toBe(400);
    expect(invalidPage.json().code).toBe("INVALID_PAGINATION");

    const otherUserEnvironment = await app.inject({
      method: "POST",
      url: "/v1/environments",
      headers: { "x-local-user-id": "bob" },
      payload: {
        name: "Bob's environment",
        purpose: "Private",
        currency: "USD",
        budgetLimitMinor: 1000,
      },
    });
    const unauthorized = await app.inject({
      method: "GET",
      url: `/v1/environments/${otherUserEnvironment.json().environment.id}/payments/paypal/operations`,
      headers,
    });
    expect(unauthorized.statusCode).toBe(404);
  });

  it("queues a worker-mode order without calling PayPal and deduplicates retries", async () => {
    const { app, headers, mock, providerJobs, environmentId, agentId, mandateId, accountId } =
      await setup("worker");
    const payload = {
      agentId,
      mandateId,
      ledgerAccountId: accountId,
      idempotencyKey: "paypal-worker-order-1",
      requestHash: "paypal-worker-order-hash",
      action: "paypal_order",
      amountMinor: 1000,
      currency: "USD",
    };

    const first = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload,
    });
    expect(first.statusCode).toBe(202);
    expect(first.json()).toMatchObject({
      queued: true,
      operation: { status: "PENDING", providerOrderId: null },
      job: { intent: "create_order", status: "queued" },
    });
    expect(first.json().job.payload).toMatchObject({
      action: { id: first.json().action.id },
      returnUrl: expect.stringContaining("environment_id="),
      cancelUrl: expect.stringContaining("action_id="),
    });
    expect(mock.calls.create).toBe(0);

    const retry = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload,
    });
    expect(retry.statusCode).toBe(202);
    expect(retry.json().deduplicated).toBe(true);
    expect(mock.calls.create).toBe(0);
    expect(await providerJobs.list({ provider: "paypal" })).toHaveLength(1);
  });

  it("uses the atomic Supabase worker enqueue service in Supabase worker mode", async () => {
    process.env.DATABASE_MODE = "supabase";
    const calls: PayPalWorkerOrderEnqueueInput[] = [];
    const workerOrder: PayPalWorkerOrderStore = {
      async enqueue(input) {
        calls.push(input);
        return {
          action: {
            id: "atomic-action-1",
            environmentId: input.environmentId,
            agentId: input.agentId,
            mandateId: input.mandateId,
            idempotencyKey: input.idempotencyKey,
            requestHash: input.requestHash,
            action: input.action,
            amountMinor: input.amountMinor,
            currency: input.currency,
            authorizationState: "authorized",
            executionState: "pending",
            createdAt: "2026-10-22T00:00:00.000Z",
          },
          reservation: {
            actionId: "atomic-action-1",
            accountId: input.ledgerAccountId,
            amountMinor: input.amountMinor,
            state: "held",
          },
          operation: {
            environmentId: input.environmentId,
            actionId: "atomic-action-1",
            provider: "paypal",
            providerOrderId: null,
            approvalUrl: null,
            status: "PENDING",
            observedProviderStatus: "PENDING",
            captureId: null,
            reconciliationState: "pending",
            lastCheckedAt: null,
            lastEventAt: null,
            lastErrorCode: null,
            createdAt: "2026-10-22T00:00:00.000Z",
            updatedAt: "2026-10-22T00:00:00.000Z",
          },
          job: {
            id: "atomic-job-1",
            provider: "paypal",
            intent: "create_order",
            dedupeKey: "paypal:create_order:atomic-action-1",
            payload: { action: { id: "atomic-action-1" } },
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
    const { app, headers, mock, providerJobs, environmentId, agentId, mandateId, accountId } =
      await setup("worker", { workerOrder });

    const response = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: accountId,
        idempotencyKey: "paypal-atomic-worker-1",
        requestHash: "paypal-atomic-worker-hash",
        action: "paypal_order",
        amountMinor: 1000,
        currency: "USD",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      queued: true,
      operation: { actionId: "atomic-action-1", providerOrderId: null },
      job: { id: "atomic-job-1", intent: "create_order" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      environmentId,
      agentId,
      mandateId,
      ledgerAccountId: accountId,
      returnUrl: "http://localhost:3000/paypal/return",
      cancelUrl: "http://localhost:3000/paypal/cancel",
    });
    expect(await providerJobs.list({ provider: "paypal" })).toHaveLength(0);
    expect(mock.calls.create).toBe(0);
  });

  it("queues deduplicated worker-mode capture and reconcile jobs without provider calls", async () => {
    const { app, headers, mock, providerJobs, environmentId, agentId, mandateId, accountId } =
      await setup("worker");
    const created = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: accountId,
        idempotencyKey: "paypal-worker-actions-1",
        requestHash: "paypal-worker-actions-hash",
        action: "paypal_order",
        amountMinor: 1000,
        currency: "USD",
      },
    });
    const actionId = created.json().action.id as string;

    const capture = (await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/${actionId}/capture`,
      headers,
    })) as { statusCode: number; json: () => Record<string, unknown> };
    const captureRetry = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/${actionId}/capture`,
      headers,
    });
    const reconcile = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/${actionId}/reconcile`,
      headers,
    });
    const reconcileRetry = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/${actionId}/reconcile`,
      headers,
    });

    expect(capture.statusCode).toBe(202);
    expect(capture.json()).toMatchObject({ queued: true, job: { intent: "capture_order" } });
    expect(captureRetry.statusCode).toBe(202);
    expect(captureRetry.json().deduplicated).toBe(true);
    expect(reconcile.statusCode).toBe(202);
    expect(reconcile.json()).toMatchObject({ queued: true, job: { intent: "reconcile_order" } });
    expect(reconcileRetry.statusCode).toBe(202);
    expect(reconcileRetry.json().deduplicated).toBe(true);
    expect(mock.calls.capture).toBe(0);
    expect(mock.calls.create).toBe(0);
    expect(await providerJobs.list({ provider: "paypal" })).toHaveLength(3);
  });

  it("rejects INR before reserving or enqueueing a worker job", async () => {
    const { app, headers, mock, providerJobs, environmentId, agentId, mandateId, accountId } =
      await setup("worker");
    const response = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: accountId,
        idempotencyKey: "paypal-worker-inr-1",
        requestHash: "paypal-worker-inr-hash",
        action: "paypal_order",
        amountMinor: 1000,
        currency: "INR",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("PAYPAL_CURRENCY_UNSUPPORTED");
    expect(mock.calls.create).toBe(0);
    expect(await providerJobs.list({ provider: "paypal" })).toHaveLength(0);
  });

  it("queues a verified webhook for worker application and does not apply it inline", async () => {
    const { app, headers, mock, providerJobs, environmentId, agentId, mandateId, accountId } =
      await setup("worker");
    const created = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: accountId,
        idempotencyKey: "paypal-worker-webhook-1",
        requestHash: "paypal-worker-webhook-hash",
        action: "paypal_order",
        amountMinor: 1000,
        currency: "USD",
      },
    });
    const event = {
      id: "paypal-worker-event-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: "2026-10-22T00:00:00.000Z",
      resource: {
        id: "paypal-capture-1",
        status: "COMPLETED",
        supplementary_data: { related_ids: { order_id: "paypal-order-1" } },
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/v1/webhooks/paypal",
      payload: event,
    });
    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      received: true,
      queued: true,
      job: { intent: "apply_event" },
    });
    expect(mock.calls.capture).toBe(0);
    expect(created.json().operation.status).toBe("PENDING");
    expect(await providerJobs.list({ provider: "paypal" })).toHaveLength(2);
  });
});
