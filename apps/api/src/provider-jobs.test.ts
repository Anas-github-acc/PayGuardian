import { describe, expect, it } from "vitest";
import { InMemoryProviderJobStore } from "./provider-jobs.js";

function clock() {
  let current = new Date("2026-10-22T00:00:00.000Z");
  return {
    now: () => new Date(current),
    advance: (milliseconds: number) => {
      current = new Date(current.getTime() + milliseconds);
    },
  };
}

describe("InMemoryProviderJobStore", () => {
  it("deduplicates enqueue requests by provider and dedupe key", async () => {
    const store = new InMemoryProviderJobStore({ idFactory: () => "job-1" });

    const first = await store.enqueue({
      provider: "paypal",
      intent: "create_order",
      dedupeKey: "action-1:create-order",
      payload: { actionId: "action-1" },
    });
    const second = await store.enqueue({
      provider: "paypal",
      intent: "create_order",
      dedupeKey: "action-1:create-order",
      payload: { actionId: "action-1", changed: true },
    });

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(second.job.id).toBe(first.job.id);
    expect(second.job.payload).toEqual({ actionId: "action-1" });
  });

  it("claims jobs with a lease and only allows the lease owner to renew or complete", async () => {
    const time = clock();
    const store = new InMemoryProviderJobStore({ now: time.now, idFactory: () => "job-1" });
    const { job } = await store.enqueue({
      provider: "paypal",
      intent: "capture",
      dedupeKey: "action-1:capture",
    });

    const [claimed] = await store.claim({ workerId: "worker-a", leaseDurationMs: 1_000 });
    expect(claimed).toMatchObject({
      id: job.id,
      status: "running",
      attempts: 1,
      leaseOwner: "worker-a",
    });
    expect(claimed.leaseToken).toEqual(expect.any(String));
    expect(
      await store.renew({
        jobId: job.id,
        workerId: "worker-b",
        leaseToken: claimed.leaseToken!,
        leaseDurationMs: 1_000,
      }),
    ).toBeNull();
    expect(
      await store.complete({
        jobId: job.id,
        workerId: "worker-b",
        leaseToken: claimed.leaseToken!,
      }),
    ).toBeNull();
    expect(
      (
        await store.renew({
          jobId: job.id,
          workerId: "worker-a",
          leaseToken: claimed.leaseToken!,
        })
      )?.leaseOwner,
    ).toBe("worker-a");
    expect(
      (
        await store.complete({
          jobId: job.id,
          workerId: "worker-a",
          leaseToken: claimed.leaseToken!,
        })
      )?.status,
    ).toBe("completed");
  });

  it("reclaims expired leases for another worker", async () => {
    const time = clock();
    const store = new InMemoryProviderJobStore({ now: time.now, idFactory: () => "job-1" });
    const { job } = await store.enqueue({
      provider: "paypal",
      intent: "reconcile",
      dedupeKey: "event-1",
    });
    const [initial] = await store.claim({ workerId: "worker-a", leaseDurationMs: 1_000 });

    time.advance(1_001);
    const [reclaimed] = await store.claim({ workerId: "worker-b", leaseDurationMs: 1_000 });

    expect(reclaimed).toMatchObject({
      id: job.id,
      status: "running",
      attempts: 2,
      leaseOwner: "worker-b",
    });
    expect(reclaimed.leaseToken).toEqual(expect.any(String));
    expect(reclaimed.leaseToken).not.toBe(initial.leaseToken);

    expect(
      await store.renew({
        jobId: job.id,
        workerId: "worker-a",
        leaseToken: initial.leaseToken!,
        leaseDurationMs: 1_000,
      }),
    ).toBeNull();
    expect(
      await store.complete({
        jobId: job.id,
        workerId: "worker-a",
        leaseToken: initial.leaseToken!,
      }),
    ).toBeNull();
    expect(
      await store.fail({
        jobId: job.id,
        workerId: "worker-a",
        leaseToken: initial.leaseToken!,
        errorCode: "STALE_WORKER",
        errorMessage: "Stale worker must not mutate reclaimed work.",
        retry: false,
      }),
    ).toBeNull();
    expect(await store.get(job.id)).toMatchObject({
      status: "running",
      leaseOwner: "worker-b",
      leaseToken: reclaimed.leaseToken,
    });
  });

  it("schedules retryable failures and transitions terminal failures", async () => {
    const time = clock();
    const store = new InMemoryProviderJobStore({
      now: time.now,
      idFactory: (() => {
        let index = 0;
        return () => `job-${++index}`;
      })(),
    });
    const retryable = await store.enqueue({
      provider: "paypal",
      intent: "create_order",
      dedupeKey: "retry",
      maxAttempts: 2,
    });
    await store.claim({ workerId: "worker-a" });
    const retry = await store.fail({
      jobId: retryable.job.id,
      workerId: "worker-a",
      leaseToken: (await store.get(retryable.job.id))!.leaseToken!,
      errorCode: "TIMEOUT",
      errorMessage: "Provider timed out.",
      retryAt: new Date("2026-10-22T00:01:00.000Z"),
    });
    expect(retry).toMatchObject({ status: "queued", attempts: 1, lastErrorCode: "TIMEOUT" });
    expect(await store.claim({ workerId: "worker-b" })).toEqual([]);
    time.advance(60_000);
    expect((await store.claim({ workerId: "worker-b" }))[0]?.attempts).toBe(2);

    const terminal = await store.fail({
      jobId: retryable.job.id,
      workerId: "worker-b",
      leaseToken: (await store.get(retryable.job.id))!.leaseToken!,
      errorCode: "DECLINED",
      retry: false,
    });
    expect(terminal).toMatchObject({ status: "failed", lastErrorCode: "DECLINED" });
  });

  it("lists jobs by status and returns defensive copies", async () => {
    const store = new InMemoryProviderJobStore({
      idFactory: (() => {
        let index = 0;
        return () => `job-${++index}`;
      })(),
    });
    const created = await store.enqueue({
      provider: "paypal",
      intent: "create_order",
      dedupeKey: "one",
      payload: { nested: true },
    });
    await store.enqueue({ provider: "stripe", intent: "charge", dedupeKey: "two" });

    const copy = await store.get(created.job.id);
    (copy?.payload as { nested: boolean }).nested = false;

    expect((await store.get(created.job.id))?.payload).toEqual({ nested: true });
    expect(
      (await store.list({ provider: "paypal", status: "queued" })).map((job) => job.id),
    ).toEqual([created.job.id]);
  });
});
