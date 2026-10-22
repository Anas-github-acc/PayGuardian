import { describe, expect, it } from "vitest";
import { PayPalError, type PayPalAction, type PayPalClient } from "@payguardian/paypal";
import { ProviderJobExecutor, classifyWorkerError } from "./executor.js";
import { PollingWorker } from "./runner.js";
import type { ProviderJob, ProviderOperation, WorkerStore } from "./store.js";

const action: PayPalAction = {
  id: "action-1",
  environmentId: "environment-1",
  agentId: "agent-1",
  mandateId: "mandate-1",
  idempotencyKey: "idem-1",
  requestHash: "hash-1",
  action: "purchase",
  amountMinor: 2500,
  currency: "USD",
  authorizationState: "authorized",
  executionState: "reserved",
  createdAt: "2026-10-22T00:00:00.000Z",
};

function job(intent: string, payload: unknown = {}): ProviderJob {
  return {
    id: `job-${intent}`,
    provider: "paypal",
    intent,
    dedupeKey: `${intent}:action-1`,
    payload,
    status: "running",
    attempts: 1,
    maxAttempts: 5,
    availableAt: "2026-10-22T00:00:00.000Z",
    leaseOwner: "worker-1",
    leaseToken: "lease-token-1",
    leaseExpiresAt: "2026-10-22T00:01:00.000Z",
    lastErrorCode: null,
    lastErrorMessage: null,
    completedAt: null,
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
  };
}

function operation(overrides: Partial<ProviderOperation> = {}): ProviderOperation {
  return {
    environmentId: action.environmentId,
    actionId: action.id,
    provider: "paypal",
    providerOrderId: "order-1",
    approvalUrl: "https://paypal.test/approve",
    status: "CREATED",
    observedProviderStatus: "CREATED",
    captureId: null,
    reconciliationState: "pending",
    lastCheckedAt: null,
    lastEventAt: null,
    lastErrorCode: null,
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
    ...overrides,
  };
}

class FakeStore implements WorkerStore {
  claimed: ProviderJob[] = [];
  operations = new Map<string, ProviderOperation>();
  completed = 0;
  completedLeaseToken: string | null = null;
  failed: Array<{ retry: boolean; errorCode: string }> = [];
  failedLeaseToken: string | null = null;
  renewedLeaseToken: string | null = null;
  markedEvents: string[] = [];
  private activeJob: ProviderJob | null = null;
  private activeWorkerId: string | null = null;

  async claim(input: {
    workerId: string;
    limit: number;
    leaseDurationMs: number;
  }): Promise<ProviderJob[]> {
    const jobs = this.claimed;
    this.claimed = [];
    this.activeJob = jobs[0] ? { ...jobs[0], leaseOwner: input.workerId } : null;
    this.activeWorkerId = input.workerId;
    return this.activeJob ? [this.activeJob] : [];
  }
  async renew(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    leaseDurationMs: number;
  }) {
    if (input.workerId !== this.activeWorkerId || input.jobId !== this.activeJob?.id) return null;
    this.renewedLeaseToken = input.leaseToken;
    return this.activeJob;
  }
  async complete(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
  }): Promise<ProviderJob | null> {
    if (input.workerId !== this.activeWorkerId || input.jobId !== this.activeJob?.id) return null;
    this.completed += 1;
    this.completedLeaseToken = input.leaseToken;
    return job("completed");
  }
  async fail(input: {
    retry: boolean;
    errorCode: string;
    leaseToken: string;
  }): Promise<ProviderJob> {
    this.failed.push(input);
    this.failedLeaseToken = input.leaseToken;
    return job("failed");
  }
  async getOperation(actionId: string): Promise<ProviderOperation | null> {
    return this.operations.get(actionId) ?? null;
  }
  async getOperationByProviderOrderId(providerOrderId: string): Promise<ProviderOperation | null> {
    return (
      [...this.operations.values()].find((item) => item.providerOrderId === providerOrderId) ?? null
    );
  }
  async saveOperation(input: {
    action: PayPalAction;
    providerOrderId: string;
    approvalUrl: string | null;
    status: string;
  }): Promise<ProviderOperation> {
    const saved = operation({
      providerOrderId: input.providerOrderId,
      approvalUrl: input.approvalUrl,
      status: input.status,
      observedProviderStatus: input.status,
    });
    this.operations.set(input.action.id, saved);
    return saved;
  }
  async updateOperation(input: {
    actionId: string;
    environmentId: string;
    status: string;
    observedProviderStatus?: string | null;
    reconciliationState?: "pending" | "resolved";
    lastCheckedAt?: string | null;
    lastEventAt?: string | null;
    lastErrorCode?: string | null;
    captureId?: string | null;
  }): Promise<ProviderOperation> {
    const updated = operation({
      ...this.operations.get(input.actionId),
      status: input.status,
      observedProviderStatus: input.observedProviderStatus ?? input.status,
      reconciliationState: input.reconciliationState ?? "pending",
      lastCheckedAt: input.lastCheckedAt ?? null,
      lastEventAt: input.lastEventAt ?? null,
      captureId: input.captureId ?? null,
    });
    this.operations.set(input.actionId, updated);
    return updated;
  }
  async markProviderEventApplied(providerEventId: string): Promise<void> {
    this.markedEvents.push(providerEventId);
  }
}

function paypal(overrides: Partial<PayPalClient> = {}): PayPalClient {
  return {
    createOrder: async () => ({
      id: "order-1",
      status: "CREATED",
      approvalUrl: "https://paypal.test/approve",
      currency: "USD",
      amountMinor: action.amountMinor,
    }),
    captureOrder: async () => ({ orderId: "order-1", status: "COMPLETED", captureId: "capture-1" }),
    getOrder: async () => ({ orderId: "order-1", status: "COMPLETED", captureId: "capture-1" }),
    verifyWebhook: async () => true,
    ...overrides,
  };
}

describe("worker lease and polling behavior", () => {
  it("does not allow another worker to renew or complete a claimed lease", async () => {
    const store = new FakeStore();
    store.claimed = [job("create_order", { action })];
    const [claimed] = await store.claim({ workerId: "worker-a", limit: 1, leaseDurationMs: 1_000 });

    expect(claimed.leaseOwner).toBe("worker-a");
    expect(
      await store.renew({
        jobId: claimed.id,
        workerId: "worker-b",
        leaseToken: claimed.leaseToken!,
        leaseDurationMs: 1_000,
      }),
    ).toBeNull();
    expect(
      await store.complete({
        jobId: claimed.id,
        workerId: "worker-b",
        leaseToken: claimed.leaseToken!,
      }),
    ).toBeNull();
    expect(
      await store.renew({
        jobId: claimed.id,
        workerId: "worker-a",
        leaseToken: claimed.leaseToken!,
        leaseDurationMs: 1_000,
      }),
    ).toBe(claimed);
  });

  it("only completes a claimed job through the injected store", async () => {
    const store = new FakeStore();
    store.claimed = [job("create_order", { action })];
    const runner = new PollingWorker(
      store,
      { execute: async () => ({}) },
      {
        workerId: "worker-1",
        batchSize: 1,
        pollIntervalMs: 10,
        leaseDurationMs: 1_000,
        leaseRenewalIntervalMs: 100,
      },
    );

    await expect(runner.runOnce()).resolves.toMatchObject({ claimed: 1, completed: 1 });
    expect(store.completed).toBe(1);
    expect(store.completedLeaseToken).toBe("lease-token-1");
  });

  it("polls no jobs and shuts down cleanly", async () => {
    const store = new FakeStore();
    const holder: { runner?: PollingWorker } = {};
    const runner = new PollingWorker(
      store,
      { execute: async () => ({}) },
      {
        workerId: "worker-1",
        batchSize: 1,
        pollIntervalMs: 1_000,
        leaseDurationMs: 1_000,
        leaseRenewalIntervalMs: 100,
        sleep: async (): Promise<void> => {
          holder.runner?.requestStop();
        },
      },
    );
    holder.runner = runner;

    await runner.start();
    expect(store.completed).toBe(0);
  });
});

describe("PayPal job execution", () => {
  it("uses stable request IDs and does not repeat a completed operation", async () => {
    const store = new FakeStore();
    const calls: string[] = [];
    const client = paypal({
      createOrder: async (input: {
        action: PayPalAction;
        requestId: string;
        returnUrl: string;
        cancelUrl: string;
      }) => {
        calls.push(input.requestId);
        return {
          id: "order-1",
          status: "CREATED",
          approvalUrl: "https://paypal.test/approve",
          currency: "USD",
          amountMinor: action.amountMinor,
        };
      },
    });
    const executor = new ProviderJobExecutor({
      paypal: client,
      store,
      returnUrl: "https://app.test/return",
      cancelUrl: "https://app.test/cancel",
    });

    await executor.execute(job("create_order", { action }));
    store.operations.set(
      action.id,
      operation({ status: "COMPLETED", observedProviderStatus: "COMPLETED" }),
    );
    const second = await executor.execute(job("create_order", { action }));

    expect(calls).toEqual(["payguardian-action-1"]);
    expect(second.idempotent).toBe(true);
  });

  it("classifies a timeout as retryable uncertainty", () => {
    const result = classifyWorkerError(new Error("PayPal request timed out"));
    expect(result).toMatchObject({ code: "TIMEOUT", retry: true, failure: { kind: "timeout" } });
  });

  it("does not retry an explicit non-retryable provider failure", async () => {
    const store = new FakeStore();
    const executor = new ProviderJobExecutor({
      paypal: paypal({
        createOrder: async () => {
          throw new PayPalError("Invalid request", "INVALID_REQUEST", false);
        },
      }),
      store,
      returnUrl: "https://app.test/return",
      cancelUrl: "https://app.test/cancel",
    });
    const runner = new PollingWorker(store, executor, {
      workerId: "worker-1",
      batchSize: 1,
      pollIntervalMs: 1,
      leaseDurationMs: 1_000,
      leaseRenewalIntervalMs: 100,
    });
    store.claimed = [job("create_order", { action })];

    await runner.runOnce();
    expect(store.failed).toEqual([
      expect.objectContaining({ retry: false, errorCode: "INVALID_REQUEST" }),
    ]);
    expect(store.failedLeaseToken).toBe("lease-token-1");
  });
});
