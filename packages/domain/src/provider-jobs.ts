export type ProviderJobState =
  "queued" | "running" | "pending" | "uncertain" | "completed" | "failed" | "cancelled";

export type ProviderFailureKind =
  | "network"
  | "timeout"
  | "rate_limited"
  | "server"
  | "authentication"
  | "authorization"
  | "invalid_request"
  | "conflict"
  | "not_found"
  | "cancelled"
  | "unknown";

export type ProviderFailure = {
  kind: ProviderFailureKind;
  code?: string | null;
  statusCode?: number | null;
  message?: string | null;
};

export type ProviderFailureDisposition = "retryable" | "non_retryable" | "uncertain";

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
};

export const defaultProviderRetryPolicy: Readonly<RetryPolicy> = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  jitterRatio: 0.2,
};

export type ProviderJob = {
  id: string;
  provider: string;
  operation: string;
  state: ProviderJobState;
  attempt: number;
  lastObservedAt: string | null;
  lastObservationId: string | null;
  lastObservationSequence: number | null;
  providerStatus: string | null;
  failure: ProviderFailure | null;
};

export type ProviderJobObservation = {
  observationId: string;
  state: ProviderJobState;
  observedAt: string;
  sequence?: number | null;
  providerStatus?: string | null;
  failure?: ProviderFailure | null;
};

export type ProviderObservationDecisionKind = "applied" | "ignored" | "conflict";

export type ProviderObservationDecisionReason =
  | "applied"
  | "duplicate_observation"
  | "older_observation"
  | "same_timestamp_conflict"
  | "completed_non_regression"
  | "terminal_state_conflict"
  | "uncertain_non_regression"
  | "state_regression";

export type ProviderObservationDecision = {
  kind: ProviderObservationDecisionKind;
  reason: ProviderObservationDecisionReason;
  job: ProviderJob;
};

const terminalStates = new Set<ProviderJobState>(["completed", "failed", "cancelled"]);

const stateRank: Record<ProviderJobState, number> = {
  queued: 0,
  running: 1,
  pending: 2,
  uncertain: 2,
  failed: 3,
  cancelled: 3,
  completed: 4,
};

export function isProviderJobTerminal(state: ProviderJobState): boolean {
  return terminalStates.has(state);
}

export function createProviderJob(input: {
  id: string;
  provider: string;
  operation: string;
}): ProviderJob {
  return {
    ...input,
    state: "queued",
    attempt: 0,
    lastObservedAt: null,
    lastObservationId: null,
    lastObservationSequence: null,
    providerStatus: null,
    failure: null,
  };
}

function validateRetryPolicy(policy: RetryPolicy): void {
  if (
    !Number.isSafeInteger(policy.maxAttempts) ||
    policy.maxAttempts <= 0 ||
    !Number.isFinite(policy.baseDelayMs) ||
    policy.baseDelayMs < 0 ||
    !Number.isFinite(policy.maxDelayMs) ||
    policy.maxDelayMs < policy.baseDelayMs ||
    !Number.isFinite(policy.jitterRatio) ||
    policy.jitterRatio < 0 ||
    policy.jitterRatio > 1
  ) {
    throw new Error("RETRY_POLICY_INVALID");
  }
}

/**
 * Calculates the delay before a retry. `retryAttempt` is zero-based, so the
 * first retry uses the policy's base delay. Jitter is symmetric and capped.
 */
export function calculateRetryDelay(
  retryAttempt: number,
  policy: RetryPolicy = defaultProviderRetryPolicy,
  random: () => number = Math.random,
): number {
  validateRetryPolicy(policy);
  if (!Number.isSafeInteger(retryAttempt) || retryAttempt < 0) {
    throw new Error("RETRY_ATTEMPT_INVALID");
  }
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample > 1) {
    throw new Error("JITTER_SAMPLE_INVALID");
  }

  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** retryAttempt);
  const jitterMultiplier = 1 - policy.jitterRatio + 2 * policy.jitterRatio * sample;
  return Math.round(Math.min(policy.maxDelayMs, exponential * jitterMultiplier));
}

export const getRetryDelay = calculateRetryDelay;

export function shouldRetryProviderFailure(
  failure: ProviderFailure,
  attempt: number,
  policy: RetryPolicy = defaultProviderRetryPolicy,
): boolean {
  validateRetryPolicy(policy);
  if (!Number.isSafeInteger(attempt) || attempt <= 0) {
    throw new Error("ATTEMPT_INVALID");
  }
  return classifyProviderFailure(failure) === "retryable" && attempt < policy.maxAttempts;
}

export function classifyProviderFailure(failure: ProviderFailure): ProviderFailureDisposition {
  const statusCode = failure.statusCode;
  if (failure.kind === "timeout") return "uncertain";
  if (failure.kind === "network" || failure.kind === "rate_limited" || failure.kind === "server") {
    return "retryable";
  }
  if (
    failure.kind === "authentication" ||
    failure.kind === "authorization" ||
    failure.kind === "invalid_request" ||
    failure.kind === "conflict" ||
    failure.kind === "not_found" ||
    failure.kind === "cancelled"
  ) {
    return "non_retryable";
  }

  if (statusCode === 408) return "uncertain";
  if (
    statusCode === 425 ||
    statusCode === 429 ||
    (statusCode !== null && statusCode !== undefined && statusCode >= 500)
  ) {
    return "retryable";
  }
  if (statusCode !== null && statusCode !== undefined && statusCode >= 400) {
    return "non_retryable";
  }
  return "uncertain";
}

export function isRetryableProviderFailure(failure: ProviderFailure): boolean {
  return classifyProviderFailure(failure) === "retryable";
}

export function isUncertainProviderFailure(failure: ProviderFailure): boolean {
  return classifyProviderFailure(failure) === "uncertain";
}

function timestampValue(timestamp: string): number {
  const value = Date.parse(timestamp);
  if (Number.isNaN(value)) throw new Error("OBSERVATION_TIMESTAMP_INVALID");
  return value;
}

function compareObservationOrder(
  job: ProviderJob,
  observation: ProviderJobObservation,
): -1 | 0 | 1 {
  if (
    job.lastObservationSequence !== null &&
    observation.sequence !== undefined &&
    observation.sequence !== null
  ) {
    if (observation.sequence < job.lastObservationSequence) return -1;
    if (observation.sequence > job.lastObservationSequence) return 1;
  }
  if (job.lastObservedAt === null) return 1;
  const currentTimestamp = timestampValue(job.lastObservedAt);
  const observationTimestamp = timestampValue(observation.observedAt);
  if (observationTimestamp < currentTimestamp) return -1;
  if (observationTimestamp > currentTimestamp) return 1;
  return 0;
}

function withObservation(job: ProviderJob, observation: ProviderJobObservation): ProviderJob {
  return {
    ...job,
    state: observation.state,
    lastObservedAt: observation.observedAt,
    lastObservationId: observation.observationId,
    lastObservationSequence:
      observation.sequence === undefined || observation.sequence === null
        ? job.lastObservationSequence
        : observation.sequence,
    providerStatus: observation.providerStatus ?? job.providerStatus,
    failure:
      observation.failure === undefined
        ? observation.state === "completed"
          ? null
          : job.failure
        : observation.failure,
  };
}

/**
 * Applies a provider observation without allowing stale or terminal state
 * regressions. The returned job is always a new object.
 */
export function applyProviderObservation(
  job: ProviderJob,
  observation: ProviderJobObservation,
): ProviderObservationDecision {
  if (job.lastObservationId === observation.observationId) {
    return { kind: "ignored", reason: "duplicate_observation", job: { ...job } };
  }

  const order = compareObservationOrder(job, observation);
  if (order < 0) return { kind: "ignored", reason: "older_observation", job: { ...job } };
  if (order === 0 && job.state !== observation.state) {
    return { kind: "conflict", reason: "same_timestamp_conflict", job: { ...job } };
  }

  if (job.state === "completed" && observation.state !== "completed") {
    return { kind: "ignored", reason: "completed_non_regression", job: { ...job } };
  }
  if (isProviderJobTerminal(job.state) && job.state !== observation.state) {
    return { kind: "conflict", reason: "terminal_state_conflict", job: { ...job } };
  }
  if (job.state === "uncertain" && observation.state === "pending") {
    return { kind: "ignored", reason: "uncertain_non_regression", job: { ...job } };
  }
  if (stateRank[observation.state] < stateRank[job.state]) {
    return { kind: "ignored", reason: "state_regression", job: { ...job } };
  }

  return { kind: "applied", reason: "applied", job: withObservation(job, observation) };
}

export const decideProviderObservation = applyProviderObservation;
export const observeProviderJob = applyProviderObservation;
