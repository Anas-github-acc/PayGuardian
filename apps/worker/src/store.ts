import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { PayPalAction } from "@payguardian/paypal";

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

export type ProviderOperation = {
  environmentId: string;
  actionId: string;
  provider: "paypal";
  providerOrderId: string | null;
  approvalUrl: string | null;
  status: string;
  observedProviderStatus: string | null;
  captureId: string | null;
  reconciliationState: "pending" | "resolved";
  lastCheckedAt: string | null;
  lastEventAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OperationObservation = {
  observationId: string;
  status: string;
  observedAt: string;
  captureId?: string | null;
};

export type OperationObservationDecision = {
  kind: "applied" | "ignored" | "conflict";
  reason: string;
  operation: ProviderOperation;
};

export type ProviderEvent = {
  providerEventId: string;
  eventType: string;
  providerOrderId: string | null;
  captureId: string | null;
  observedStatus: string | null;
  eventOccurredAt: string | null;
  payload: unknown;
};

export interface WorkerJobStore {
  claim(input: {
    workerId: string;
    limit: number;
    leaseDurationMs: number;
  }): Promise<ProviderJob[]>;
  renew(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    leaseDurationMs: number;
  }): Promise<ProviderJob | null>;
  complete(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
  }): Promise<ProviderJob | null>;
  fail(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    errorCode: string;
    errorMessage: string;
    retry: boolean;
    retryAt?: string | null;
  }): Promise<ProviderJob | null>;
}

export interface ProviderObservationStore {
  getOperation(actionId: string, environmentId?: string): Promise<ProviderOperation | null>;
  getOperationByProviderOrderId(providerOrderId: string): Promise<ProviderOperation | null>;
  saveOperation(input: {
    action: PayPalAction;
    providerOrderId: string;
    approvalUrl: string | null;
    status: string;
  }): Promise<ProviderOperation>;
  updateOperation(input: {
    actionId: string;
    environmentId: string;
    status: string;
    observedProviderStatus?: string | null;
    reconciliationState?: "pending" | "resolved";
    lastCheckedAt?: string | null;
    lastEventAt?: string | null;
    lastErrorCode?: string | null;
    captureId?: string | null;
  }): Promise<ProviderOperation>;
  applyObservation?(input: {
    actionId: string;
    environmentId: string;
    status: string;
    observedProviderStatus?: string | null;
    reconciliationState?: "pending" | "resolved";
    lastCheckedAt?: string | null;
    lastEventAt?: string | null;
    lastErrorCode?: string | null;
    captureId?: string | null;
  }): Promise<ProviderOperation>;
  markProviderEventApplied(providerEventId: string): Promise<void>;
  captureReservation?(input: { environmentId: string; actionId: string }): Promise<void>;
  releaseReservation?(input: {
    environmentId: string;
    actionId: string;
    reason: string;
  }): Promise<void>;
}

export type WorkerStore = WorkerJobStore & ProviderObservationStore;

const operationColumns =
  "environment_id,action_id,provider,provider_order_id,approval_url,status,observed_provider_status,capture_id,reconciliation_state,last_checked_at,last_event_at,last_error_code,created_at,updated_at";

export class SupabaseWorkerStore implements WorkerStore {
  constructor(private readonly client: SupabaseClient) {}

  async claim(input: {
    workerId: string;
    limit: number;
    leaseDurationMs: number;
  }): Promise<ProviderJob[]> {
    const { data, error } = await this.client.rpc("claim_provider_jobs", {
      p_worker_id: input.workerId,
      p_limit: input.limit,
      p_lease_duration_seconds: Math.max(1, Math.ceil(input.leaseDurationMs / 1000)),
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map((row) => mapJob(row as Row));
  }

  async renew(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    leaseDurationMs: number;
  }): Promise<ProviderJob | null> {
    const { data, error } = await this.client
      .rpc("renew_provider_job", {
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_lease_token: input.leaseToken,
        p_lease_duration_seconds: Math.max(1, Math.ceil(input.leaseDurationMs / 1000)),
      })
      .maybeSingle();
    if (error) throw error;
    return data ? mapJob(data as Row) : null;
  }

  async complete(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
  }): Promise<ProviderJob | null> {
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

  async fail(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    errorCode: string;
    errorMessage: string;
    retry: boolean;
    retryAt?: string | null;
  }): Promise<ProviderJob | null> {
    const { data, error } = await this.client
      .rpc("fail_provider_job", {
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_lease_token: input.leaseToken,
        p_error_code: input.errorCode,
        p_error_message: input.errorMessage,
        p_retry_at: input.retryAt ?? null,
        p_should_retry: input.retry,
      })
      .maybeSingle();
    if (error) throw error;
    return data ? mapJob(data as Row) : null;
  }

  async getOperation(actionId: string, environmentId?: string): Promise<ProviderOperation | null> {
    let query = this.client
      .from("provider_operations")
      .select(operationColumns)
      .eq("action_id", actionId);
    if (environmentId) query = query.eq("environment_id", environmentId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapOperation(data as Row) : null;
  }

  async getOperationByProviderOrderId(providerOrderId: string): Promise<ProviderOperation | null> {
    const { data, error } = await this.client
      .from("provider_operations")
      .select(operationColumns)
      .eq("provider", "paypal")
      .eq("provider_order_id", providerOrderId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapOperation(data as Row) : null;
  }

  async saveOperation(input: {
    action: PayPalAction;
    providerOrderId: string;
    approvalUrl: string | null;
    status: string;
  }): Promise<ProviderOperation> {
    const existing = await this.getOperation(input.action.id, input.action.environmentId);
    if (existing) {
      if (existing.providerOrderId) return existing;
      const { data, error } = await this.client
        .from("provider_operations")
        .update({
          provider_order_id: input.providerOrderId,
          approval_url: input.approvalUrl,
          status: input.status,
          observed_provider_status: input.status,
          updated_at: new Date().toISOString(),
        })
        .eq("environment_id", input.action.environmentId)
        .eq("action_id", input.action.id)
        .is("provider_order_id", null)
        .select(operationColumns)
        .maybeSingle();
      if (error) throw error;
      return data
        ? mapOperation(data as Row)
        : (await this.getOperation(input.action.id, input.action.environmentId))!;
    }
    const { data, error } = await this.client
      .from("provider_operations")
      .insert({
        environment_id: input.action.environmentId,
        action_id: input.action.id,
        provider: "paypal",
        provider_order_id: input.providerOrderId,
        approval_url: input.approvalUrl,
        status: input.status,
        observed_provider_status: input.status,
      })
      .select(operationColumns)
      .single();
    if (error) {
      const retry = await this.getOperation(input.action.id, input.action.environmentId);
      if (retry) return retry;
      throw error;
    }
    return mapOperation(data as Row);
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
    const { data, error } = await this.client
      .from("provider_operations")
      .update({
        status: input.status,
        observed_provider_status: input.observedProviderStatus ?? input.status,
        reconciliation_state: input.reconciliationState,
        last_checked_at: input.lastCheckedAt,
        last_event_at: input.lastEventAt,
        last_error_code: input.lastErrorCode,
        capture_id: input.captureId,
        updated_at: new Date().toISOString(),
      })
      .eq("environment_id", input.environmentId)
      .eq("action_id", input.actionId)
      .select(operationColumns)
      .single();
    if (error) throw error;
    return mapOperation(data as Row);
  }

  async applyObservation(input: {
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
    const { data, error } = await this.client
      .rpc("apply_paypal_observation", {
        p_environment_id: input.environmentId,
        p_action_id: input.actionId,
        p_status: input.status,
        p_observed_provider_status: input.observedProviderStatus ?? input.status,
        p_reconciliation_state: input.reconciliationState ?? "pending",
        p_last_checked_at: input.lastCheckedAt ?? new Date().toISOString(),
        p_last_event_at: input.lastEventAt ?? null,
        p_last_error_code: input.lastErrorCode ?? null,
        p_capture_id: input.captureId ?? null,
      })
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("PAYPAL_OPERATION_NOT_FOUND");
    return mapOperation(data as Row);
  }

  async markProviderEventApplied(providerEventId: string): Promise<void> {
    const { error } = await this.client
      .from("provider_events")
      .update({ processing_state: "applied", processed_at: new Date().toISOString() })
      .eq("provider", "paypal")
      .eq("provider_event_id", providerEventId);
    if (error) throw error;
  }

  async captureReservation(input: { environmentId: string; actionId: string }): Promise<void> {
    const { error } = await this.client.rpc("capture_reservation", {
      p_environment_id: input.environmentId,
      p_action_id: input.actionId,
    });
    if (error) throw error;
  }

  async releaseReservation(input: {
    environmentId: string;
    actionId: string;
    reason: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("release_reservation", {
      p_environment_id: input.environmentId,
      p_action_id: input.actionId,
      p_reason: input.reason,
    });
    if (error) throw error;
  }
}

export function createSupabaseWorkerStore(input: {
  url: string;
  serviceRoleKey: string;
}): SupabaseWorkerStore {
  return new SupabaseWorkerStore(
    // The worker is server-only and requires the service role for security-definer RPCs.
    // The client is created here rather than at module import time so tests can import safely.
    createClient(input.url, input.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    }),
  );
}

export function observeOperation(
  operation: ProviderOperation,
  observation: OperationObservation,
): OperationObservationDecision {
  if (
    operation.lastEventAt === observation.observedAt &&
    operation.observedProviderStatus === observation.status
  ) {
    return { kind: "ignored", reason: "duplicate_observation", operation: { ...operation } };
  }
  if (
    operation.lastEventAt &&
    Date.parse(observation.observedAt) < Date.parse(operation.lastEventAt)
  ) {
    return { kind: "ignored", reason: "older_observation", operation: { ...operation } };
  }
  if (
    ["COMPLETED", "CAPTURED"].includes(operation.status) &&
    !["COMPLETED", "CAPTURED"].includes(observation.status)
  ) {
    return { kind: "ignored", reason: "completed_non_regression", operation: { ...operation } };
  }
  const terminal = ["COMPLETED", "CAPTURED", "FAILED", "DENIED", "CANCELLED", "VOIDED"];
  if (terminal.includes(operation.status) && operation.status !== observation.status) {
    return { kind: "conflict", reason: "terminal_state_conflict", operation: { ...operation } };
  }
  const resolved = terminal.includes(observation.status);
  return {
    kind: "applied",
    reason: "applied",
    operation: {
      ...operation,
      status: observation.status,
      observedProviderStatus: observation.status,
      captureId: observation.captureId ?? operation.captureId,
      reconciliationState: resolved ? "resolved" : "pending",
      lastCheckedAt: observation.observedAt,
      lastEventAt: observation.observedAt,
      updatedAt: observation.observedAt,
    },
  };
}

type Row = Record<string, unknown>;

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

function mapOperation(row: Row): ProviderOperation {
  return {
    environmentId: String(row.environment_id),
    actionId: String(row.action_id),
    provider: "paypal",
    providerOrderId: row.provider_order_id ? String(row.provider_order_id) : null,
    approvalUrl: row.approval_url ? String(row.approval_url) : null,
    status: String(row.status),
    observedProviderStatus: row.observed_provider_status
      ? String(row.observed_provider_status)
      : null,
    captureId: row.capture_id ? String(row.capture_id) : null,
    reconciliationState: row.reconciliation_state === "resolved" ? "resolved" : "pending",
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
    lastEventAt: row.last_event_at ? String(row.last_event_at) : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
