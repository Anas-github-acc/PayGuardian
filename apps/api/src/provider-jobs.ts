import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderJobStatus = "queued" | "running" | "completed" | "failed";

export type ProviderJob = {
  id: string;
  provider: string;
  intent: string;
  dedupeKey: string;
  payload: unknown;
  status: ProviderJobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseExpiresAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EnqueueProviderJobInput = {
  provider: string;
  intent: string;
  dedupeKey: string;
  payload?: unknown;
  maxAttempts?: number;
  availableAt?: string | Date;
};

export type ClaimProviderJobsInput = {
  workerId: string;
  limit?: number;
  leaseDurationMs?: number;
};

export type RenewProviderJobInput = {
  jobId: string;
  workerId: string;
  leaseToken: string;
  leaseDurationMs?: number;
};

export type CompleteProviderJobInput = {
  jobId: string;
  workerId: string;
  leaseToken: string;
};

export type FailProviderJobInput = {
  jobId: string;
  workerId: string;
  leaseToken: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  retry?: boolean;
  retryAt?: string | Date | null;
};

export type ListProviderJobsOptions = {
  provider?: string;
  status?: ProviderJobStatus;
  limit?: number;
};

export interface ProviderJobStore {
  enqueue(input: EnqueueProviderJobInput): Promise<{ job: ProviderJob; deduplicated: boolean }>;
  claim(input: ClaimProviderJobsInput): Promise<ProviderJob[]>;
  renew(input: RenewProviderJobInput): Promise<ProviderJob | null>;
  complete(input: CompleteProviderJobInput): Promise<ProviderJob | null>;
  fail(input: FailProviderJobInput): Promise<ProviderJob | null>;
  get(jobId: string): Promise<ProviderJob | null>;
  list(options?: ListProviderJobsOptions): Promise<ProviderJob[]>;
}

export type InMemoryProviderJobStoreOptions = {
  now?: () => Date;
  idFactory?: () => string;
  retryDelayMs?: (attempt: number) => number;
};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_LEASE_DURATION_MS = 60_000;
const DEFAULT_LIST_LIMIT = 100;

export class InMemoryProviderJobStore implements ProviderJobStore {
  private readonly jobs = new Map<string, ProviderJob>();
  private readonly now: () => Date;
  private readonly idFactory: () => string;
  private readonly retryDelayMs: (attempt: number) => number;

  constructor(options: InMemoryProviderJobStoreOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
    this.retryDelayMs = options.retryDelayMs ?? defaultRetryDelayMs;
  }

  async enqueue(
    input: EnqueueProviderJobInput,
  ): Promise<{ job: ProviderJob; deduplicated: boolean }> {
    const dedupeKey = requireNonEmpty(input.dedupeKey, "dedupeKey");
    const existing = [...this.jobs.values()].find(
      (job) => job.provider === input.provider && job.dedupeKey === dedupeKey,
    );
    if (existing) return { job: cloneJob(existing), deduplicated: true };

    const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1)
      throw new Error("maxAttempts must be a positive integer.");

    const now = this.now().toISOString();
    const job: ProviderJob = {
      id: this.idFactory(),
      provider: requireNonEmpty(input.provider, "provider"),
      intent: requireNonEmpty(input.intent, "intent"),
      dedupeKey,
      payload: clonePayload(input.payload ?? {}),
      status: "queued",
      attempts: 0,
      maxAttempts,
      availableAt: toIso(input.availableAt ?? now),
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return { job: cloneJob(job), deduplicated: false };
  }

  async claim(input: ClaimProviderJobsInput): Promise<ProviderJob[]> {
    const limit = input.limit ?? 1;
    const leaseDurationMs = input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
    validatePositiveInteger(limit, "limit");
    validatePositiveInteger(leaseDurationMs, "leaseDurationMs");
    const workerId = requireNonEmpty(input.workerId, "workerId");
    const now = this.now();
    const nowIso = now.toISOString();
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs).toISOString();
    const claimed: ProviderJob[] = [];

    const candidates = [...this.jobs.values()]
      .filter((job) => isClaimable(job, now))
      .sort(compareAvailableJobs);
    for (const job of candidates) {
      if (claimed.length >= limit) break;
      if (job.status === "running" && job.attempts >= job.maxAttempts) {
        this.jobs.set(job.id, {
          ...job,
          status: "failed",
          leaseOwner: null,
          leaseToken: null,
          leaseExpiresAt: null,
          lastErrorCode: job.lastErrorCode ?? "MAX_ATTEMPTS_EXCEEDED",
          lastErrorMessage:
            job.lastErrorMessage ?? "Provider job lease expired after the final attempt.",
          updatedAt: nowIso,
        });
        continue;
      }
      const updated: ProviderJob = {
        ...job,
        status: "running",
        attempts: job.attempts + 1,
        leaseOwner: workerId,
        leaseToken: randomUUID(),
        leaseExpiresAt,
        updatedAt: nowIso,
      };
      this.jobs.set(job.id, updated);
      claimed.push(cloneJob(updated));
    }
    return claimed;
  }

  async renew(input: RenewProviderJobInput): Promise<ProviderJob | null> {
    const leaseDurationMs = input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
    validatePositiveInteger(leaseDurationMs, "leaseDurationMs");
    const workerId = requireNonEmpty(input.workerId, "workerId");
    const leaseToken = requireNonEmpty(input.leaseToken, "leaseToken");
    const job = this.jobs.get(input.jobId);
    const now = this.now();
    if (!job || !ownsActiveLease(job, workerId, leaseToken, now)) return null;
    const updated = {
      ...job,
      leaseExpiresAt: new Date(now.getTime() + leaseDurationMs).toISOString(),
      updatedAt: now.toISOString(),
    };
    this.jobs.set(updated.id, updated);
    return cloneJob(updated);
  }

  async complete(input: CompleteProviderJobInput): Promise<ProviderJob | null> {
    const job = this.jobs.get(input.jobId);
    const now = this.now();
    if (
      !job ||
      !ownsActiveLease(job, input.workerId, requireNonEmpty(input.leaseToken, "leaseToken"), now)
    ) {
      return null;
    }
    const updated: ProviderJob = {
      ...job,
      status: "completed",
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      completedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.jobs.set(updated.id, updated);
    return cloneJob(updated);
  }

  async fail(input: FailProviderJobInput): Promise<ProviderJob | null> {
    const job = this.jobs.get(input.jobId);
    const now = this.now();
    if (
      !job ||
      !ownsActiveLease(job, input.workerId, requireNonEmpty(input.leaseToken, "leaseToken"), now)
    ) {
      return null;
    }

    const shouldRetry =
      input.retry !== false && input.retryAt !== null && job.attempts < job.maxAttempts;
    const retryAt = shouldRetry
      ? toIso(input.retryAt ?? new Date(now.getTime() + this.retryDelayMs(job.attempts)))
      : null;
    const updated: ProviderJob = {
      ...job,
      status: retryAt ? "queued" : "failed",
      availableAt: retryAt ?? job.availableAt,
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      lastErrorCode: input.errorCode ?? null,
      lastErrorMessage: input.errorMessage ?? null,
      updatedAt: now.toISOString(),
    };
    this.jobs.set(updated.id, updated);
    return cloneJob(updated);
  }

  async get(jobId: string): Promise<ProviderJob | null> {
    const job = this.jobs.get(jobId);
    return job ? cloneJob(job) : null;
  }

  async list(options: ListProviderJobsOptions = {}): Promise<ProviderJob[]> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    validatePositiveInteger(limit, "limit");
    return [...this.jobs.values()]
      .filter((job) => !options.provider || job.provider === options.provider)
      .filter((job) => !options.status || job.status === options.status)
      .sort(compareRecentJobs)
      .slice(0, limit)
      .map(cloneJob);
  }
}

type Row = Record<string, unknown>;

export class SupabaseProviderJobStore implements ProviderJobStore {
  constructor(private readonly client: SupabaseClient) {}

  async enqueue(
    input: EnqueueProviderJobInput,
  ): Promise<{ job: ProviderJob; deduplicated: boolean }> {
    const { data, error } = await this.client
      .rpc("enqueue_provider_job", {
        p_provider: input.provider,
        p_intent: input.intent,
        p_dedupe_key: input.dedupeKey,
        p_payload: input.payload ?? {},
        p_max_attempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        p_available_at: input.availableAt ? toIso(input.availableAt) : undefined,
      })
      .single();
    if (error) throw error;
    const result = data as Row;
    return {
      job: mapJob((result.job ?? result) as Row),
      deduplicated: Boolean(result.deduplicated),
    };
  }

  async claim(input: ClaimProviderJobsInput): Promise<ProviderJob[]> {
    const { data, error } = await this.client.rpc("claim_provider_jobs", {
      p_worker_id: input.workerId,
      p_limit: input.limit ?? 1,
      p_lease_duration_seconds: Math.max(
        1,
        Math.ceil((input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS) / 1000),
      ),
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((row) => mapJob(row as Row));
  }

  async renew(input: RenewProviderJobInput): Promise<ProviderJob | null> {
    const { data, error } = await this.client
      .rpc("renew_provider_job", {
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_lease_token: input.leaseToken,
        p_lease_duration_seconds: Math.max(
          1,
          Math.ceil((input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS) / 1000),
        ),
      })
      .maybeSingle();
    if (error) throw error;
    return data ? mapJob(data as Row) : null;
  }

  async complete(input: CompleteProviderJobInput): Promise<ProviderJob | null> {
    const { data, error } = await this.client
      .rpc("complete_provider_job", {
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_lease_token: input.leaseToken,
      })
      .maybeSingle();
    if (error) throw error;
    return data ? mapJob(data as Row) : null;
  }

  async fail(input: FailProviderJobInput): Promise<ProviderJob | null> {
    const retryAt = input.retryAt === undefined ? undefined : input.retryAt;
    const { data, error } = await this.client
      .rpc("fail_provider_job", {
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_lease_token: input.leaseToken,
        p_error_code: input.errorCode ?? null,
        p_error_message: input.errorMessage ?? null,
        p_retry_at: retryAt ? toIso(retryAt) : null,
        p_should_retry: input.retry !== false && retryAt !== null,
      })
      .maybeSingle();
    if (error) throw error;
    return data ? mapJob(data as Row) : null;
  }

  async get(jobId: string): Promise<ProviderJob | null> {
    const { data, error } = await this.client
      .from("provider_jobs")
      .select(providerJobColumns)
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapJob(data as Row) : null;
  }

  async list(options: ListProviderJobsOptions = {}): Promise<ProviderJob[]> {
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    validatePositiveInteger(limit, "limit");
    let query = this.client
      .from("provider_jobs")
      .select(providerJobColumns)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (options.provider) query = query.eq("provider", options.provider);
    if (options.status) query = query.eq("status", options.status);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => mapJob(row as Row));
  }
}

const providerJobColumns =
  "id,provider,intent,dedupe_key,payload,status,attempts,max_attempts,available_at,lease_owner,lease_token,lease_expires_at,last_error_code,last_error_message,completed_at,created_at,updated_at";

function mapJob(row: Row): ProviderJob {
  return {
    id: String(row.id),
    provider: String(row.provider),
    intent: String(row.intent),
    dedupeKey: String(row.dedupe_key),
    payload: row.payload ?? {},
    status: row.status as ProviderJobStatus,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    availableAt: String(row.available_at),
    leaseOwner: row.lease_owner ? String(row.lease_owner) : null,
    leaseToken: row.lease_token ? String(row.lease_token) : null,
    leaseExpiresAt: row.lease_expires_at ? String(row.lease_expires_at) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    lastErrorMessage: row.last_error_message ? String(row.last_error_message) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createProviderJobStore(client: SupabaseClient | null): ProviderJobStore {
  if ((process.env.DATABASE_MODE ?? "memory") === "supabase") {
    if (!client) throw new Error("DATABASE_MODE=supabase requires Supabase credentials");
    return new SupabaseProviderJobStore(client);
  }
  return new InMemoryProviderJobStore();
}

function isClaimable(job: ProviderJob, now: Date): boolean {
  if (job.status === "queued") return Date.parse(job.availableAt) <= now.getTime();
  return (
    job.status === "running" &&
    job.leaseExpiresAt !== null &&
    Date.parse(job.leaseExpiresAt) <= now.getTime()
  );
}

function ownsActiveLease(
  job: ProviderJob,
  workerId: string,
  leaseToken: string,
  now: Date,
): boolean {
  return (
    job.status === "running" &&
    job.leaseOwner === workerId &&
    job.leaseToken === leaseToken &&
    job.leaseExpiresAt !== null &&
    Date.parse(job.leaseExpiresAt) > now.getTime()
  );
}

function compareAvailableJobs(left: ProviderJob, right: ProviderJob): number {
  return (
    left.availableAt.localeCompare(right.availableAt) ||
    left.createdAt.localeCompare(right.createdAt)
  );
}

function compareRecentJobs(left: ProviderJob, right: ProviderJob): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt)
  );
}

function defaultRetryDelayMs(attempt: number): number {
  return Math.min(60 * 60 * 1000, 1000 * 2 ** Math.max(0, attempt - 1));
}

function requireNonEmpty(value: string, field: string): string {
  if (!value.trim()) throw new Error(`${field} must not be empty.`);
  return value;
}

function validatePositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${field} must be a positive integer.`);
}

function toIso(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid provider job timestamp.");
  return date.toISOString();
}

function cloneJob(job: ProviderJob): ProviderJob {
  return { ...job, payload: clonePayload(job.payload) };
}

function clonePayload(payload: unknown): unknown {
  return typeof structuredClone === "function" ? structuredClone(payload) : payload;
}
