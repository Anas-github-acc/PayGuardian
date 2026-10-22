import { describe, expect, it } from "vitest";
import {
  applyProviderObservation,
  calculateRetryDelay,
  classifyProviderFailure,
  createProviderJob,
  defaultProviderRetryPolicy,
  isRetryableProviderFailure,
  shouldRetryProviderFailure,
  type ProviderJob,
  type ProviderJobObservation,
  type RetryPolicy,
} from "./provider-jobs.js";

const retryPolicy: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 100,
  maxDelayMs: 250,
  jitterRatio: 0.2,
};

function jobWithObservation(overrides: Partial<ProviderJob> = {}): ProviderJob {
  return {
    ...createProviderJob({ id: "job-1", provider: "paypal", operation: "capture" }),
    ...overrides,
  };
}

function observation(overrides: Partial<ProviderJobObservation> = {}): ProviderJobObservation {
  return {
    observationId: "observation-1",
    state: "pending",
    observedAt: "2026-10-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("provider job retry policy", () => {
  it("uses exponential delay, caps it, and keeps jitter within bounds", () => {
    expect(calculateRetryDelay(0, retryPolicy, () => 0)).toBe(80);
    expect(calculateRetryDelay(0, retryPolicy, () => 1)).toBe(120);
    expect(calculateRetryDelay(2, retryPolicy, () => 1)).toBe(250);
    expect(calculateRetryDelay(4, retryPolicy, () => 1)).toBe(250);

    const lower = retryPolicy.baseDelayMs * (1 - retryPolicy.jitterRatio);
    const upper = retryPolicy.baseDelayMs * (1 + retryPolicy.jitterRatio);
    const delay = calculateRetryDelay(0, retryPolicy, () => 0.5);
    expect(delay).toBeGreaterThanOrEqual(lower);
    expect(delay).toBeLessThanOrEqual(upper);
  });

  it("allows retryable failures only while attempts remain", () => {
    const rateLimited = { kind: "rate_limited" as const, statusCode: 429 };
    const invalid = { kind: "invalid_request" as const, statusCode: 400 };
    expect(classifyProviderFailure(rateLimited)).toBe("retryable");
    expect(classifyProviderFailure(invalid)).toBe("non_retryable");
    expect(isRetryableProviderFailure(rateLimited)).toBe(true);
    expect(shouldRetryProviderFailure(rateLimited, 1, retryPolicy)).toBe(true);
    expect(shouldRetryProviderFailure(rateLimited, 4, retryPolicy)).toBe(false);
    expect(shouldRetryProviderFailure(invalid, 1, retryPolicy)).toBe(false);
    expect(classifyProviderFailure({ kind: "timeout" })).toBe("uncertain");
  });

  it("keeps the default policy explicit and usable", () => {
    expect(defaultProviderRetryPolicy.maxAttempts).toBeGreaterThan(1);
    expect(calculateRetryDelay(0, defaultProviderRetryPolicy, () => 0.5)).toBe(
      defaultProviderRetryPolicy.baseDelayMs,
    );
  });
});

describe("provider job observations", () => {
  it("does not regress a completed job", () => {
    const job = jobWithObservation({
      state: "completed",
      lastObservedAt: "2026-10-22T00:01:00.000Z",
      lastObservationId: "completed-1",
      providerStatus: "COMPLETED",
    });
    const result = applyProviderObservation(
      job,
      observation({
        observationId: "pending-1",
        state: "pending",
        observedAt: "2026-10-22T00:02:00.000Z",
        providerStatus: "PENDING",
      }),
    );
    expect(result.kind).toBe("ignored");
    expect(result.reason).toBe("completed_non_regression");
    expect(result.job).toEqual(job);
  });

  it("ignores older observations and duplicate deliveries", () => {
    const job = jobWithObservation({
      state: "pending",
      lastObservedAt: "2026-10-22T00:02:00.000Z",
      lastObservationId: "newer-1",
    });
    const older = applyProviderObservation(
      job,
      observation({
        observationId: "older-1",
        state: "running",
        observedAt: "2026-10-22T00:01:00.000Z",
      }),
    );
    expect(older.kind).toBe("ignored");
    expect(older.reason).toBe("older_observation");

    const duplicate = applyProviderObservation(
      job,
      observation({ observationId: "newer-1", state: "pending" }),
    );
    expect(duplicate.kind).toBe("ignored");
    expect(duplicate.reason).toBe("duplicate_observation");
  });

  it("reports equal-time state conflicts", () => {
    const job = jobWithObservation({
      state: "pending",
      lastObservedAt: "2026-10-22T00:02:00.000Z",
      lastObservationId: "pending-1",
    });
    const result = applyProviderObservation(
      job,
      observation({
        observationId: "failed-1",
        state: "failed",
        observedAt: "2026-10-22T00:02:00.000Z",
      }),
    );
    expect(result.kind).toBe("conflict");
    expect(result.reason).toBe("same_timestamp_conflict");
    expect(result.job).toEqual(job);
  });

  it("preserves uncertain work against pending observations but accepts resolution", () => {
    const uncertain = jobWithObservation({
      state: "uncertain",
      lastObservedAt: "2026-10-22T00:02:00.000Z",
      lastObservationId: "uncertain-1",
    });
    const pending = applyProviderObservation(
      uncertain,
      observation({
        observationId: "pending-2",
        state: "pending",
        observedAt: "2026-10-22T00:03:00.000Z",
      }),
    );
    expect(pending.kind).toBe("ignored");
    expect(pending.reason).toBe("uncertain_non_regression");

    const completed = applyProviderObservation(
      uncertain,
      observation({
        observationId: "completed-2",
        state: "completed",
        observedAt: "2026-10-22T00:04:00.000Z",
        providerStatus: "COMPLETED",
      }),
    );
    expect(completed.kind).toBe("applied");
    expect(completed.job.state).toBe("completed");
    expect(completed.job.failure).toBeNull();
  });

  it("does not replace one terminal outcome with another", () => {
    const failed = jobWithObservation({
      state: "failed",
      lastObservedAt: "2026-10-22T00:02:00.000Z",
      lastObservationId: "failed-1",
    });
    const result = applyProviderObservation(
      failed,
      observation({
        observationId: "cancelled-1",
        state: "cancelled",
        observedAt: "2026-10-22T00:03:00.000Z",
      }),
    );
    expect(result.kind).toBe("conflict");
    expect(result.reason).toBe("terminal_state_conflict");
  });
});
