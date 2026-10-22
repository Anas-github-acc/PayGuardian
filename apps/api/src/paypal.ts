import type { SupabaseClient } from "@supabase/supabase-js";
import type { Reservation } from "@payguardian/domain";
import { PayPalError } from "@payguardian/paypal";
import type { ProtectedAction } from "./phase3.js";
import type { ProviderJob, ProviderJobStatus } from "./provider-jobs.js";

export { HttpPayPalClient, PayPalError } from "@payguardian/paypal";
export type {
  PayPalAction,
  PayPalCapture,
  PayPalClient,
  PayPalOrder,
  PayPalOrderStatus,
} from "@payguardian/paypal";

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

export type PayPalOperationStore = {
  listRecent(
    environmentId: string,
    options: { limit: number; cursor?: string },
  ): Promise<{ operations: ProviderOperation[]; nextCursor: string | null }>;
  get(actionId: string, environmentId: string): Promise<ProviderOperation | null>;
  save(input: {
    action: ProtectedAction;
    providerOrderId: string | null;
    approvalUrl?: string | null;
    status: string;
  }): Promise<ProviderOperation>;
  updateCapture(input: {
    action: ProtectedAction;
    status: string;
    captureId: string | null;
  }): Promise<ProviderOperation>;
  updateStatus(input: {
    action: ProtectedAction;
    status: string;
    observedProviderStatus?: string | null;
    reconciliationState?: "pending" | "resolved";
    lastCheckedAt?: string | null;
    lastEventAt?: string | null;
    lastErrorCode?: string | null;
    captureId?: string | null;
  }): Promise<ProviderOperation>;
  getByProviderOrderId(providerOrderId: string): Promise<ProviderOperation | null>;
};

export type PayPalWorkerOrderEnqueueInput = {
  environmentId: string;
  agentId: string;
  mandateId: string;
  ledgerAccountId: string;
  idempotencyKey: string;
  requestHash: string;
  action: string;
  amountMinor: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
};

export type PayPalWorkerOrderEnqueueResult = {
  action: ProtectedAction;
  reservation: Reservation;
  operation: ProviderOperation;
  job: ProviderJob;
  deduplicated: boolean;
};

export type PayPalWorkerOrderStore = {
  enqueue(input: PayPalWorkerOrderEnqueueInput): Promise<PayPalWorkerOrderEnqueueResult>;
};

export class InMemoryPayPalOperationStore implements PayPalOperationStore {
  private readonly operations = new Map<string, ProviderOperation>();

  async listRecent(
    environmentId: string,
    options: { limit: number; cursor?: string },
  ): Promise<{ operations: ProviderOperation[]; nextCursor: string | null }> {
    const cursor = decodeOperationCursor(options.cursor);
    const operations = [...this.operations.values()]
      .filter((operation) => operation.environmentId === environmentId)
      .sort(compareRecentOperations)
      .filter((operation) => isAfterCursor(operation, cursor));
    return paginateOperations(operations, options.limit);
  }

  async get(actionId: string, environmentId: string): Promise<ProviderOperation | null> {
    const operation = this.operations.get(actionId);
    return operation &&
      operation.actionId === actionId &&
      operation.environmentId === environmentId &&
      operation.provider === "paypal"
      ? { ...operation }
      : null;
  }

  async save(input: {
    action: ProtectedAction;
    providerOrderId: string | null;
    approvalUrl?: string | null;
    status: string;
  }): Promise<ProviderOperation> {
    const existing = this.operations.get(input.action.id);
    if (existing) {
      if (existing.providerOrderId || input.providerOrderId === null) return { ...existing };
      const updated: ProviderOperation = {
        ...existing,
        providerOrderId: input.providerOrderId,
        approvalUrl: input.approvalUrl ?? existing.approvalUrl,
        status: input.status,
        observedProviderStatus: input.status,
        updatedAt: new Date().toISOString(),
      };
      this.operations.set(input.action.id, updated);
      return { ...updated };
    }
    const now = new Date().toISOString();
    const operation: ProviderOperation = {
      environmentId: input.action.environmentId,
      actionId: input.action.id,
      provider: "paypal",
      providerOrderId: input.providerOrderId,
      approvalUrl: input.approvalUrl ?? null,
      status: input.status,
      observedProviderStatus: input.status,
      captureId: null,
      reconciliationState: "pending",
      lastCheckedAt: null,
      lastEventAt: null,
      lastErrorCode: null,
      createdAt: now,
      updatedAt: now,
    };
    this.operations.set(input.action.id, operation);
    return { ...operation };
  }

  async updateCapture(input: {
    action: ProtectedAction;
    status: string;
    captureId: string | null;
  }): Promise<ProviderOperation> {
    const existing = this.operations.get(input.action.id);
    if (!existing)
      throw new PayPalError("PayPal operation not found.", "PAYPAL_OPERATION_NOT_FOUND", false);
    const operation: ProviderOperation = {
      ...existing,
      status: input.status,
      observedProviderStatus: input.status,
      reconciliationState: "resolved",
      captureId: input.captureId,
      updatedAt: new Date().toISOString(),
    };
    this.operations.set(input.action.id, operation);
    return { ...operation };
  }

  async updateStatus(input: {
    action: ProtectedAction;
    status: string;
    observedProviderStatus?: string | null;
    reconciliationState?: "pending" | "resolved";
    lastCheckedAt?: string | null;
    lastEventAt?: string | null;
    lastErrorCode?: string | null;
    captureId?: string | null;
  }): Promise<ProviderOperation> {
    const existing = this.operations.get(input.action.id);
    if (!existing)
      throw new PayPalError("PayPal operation not found.", "PAYPAL_OPERATION_NOT_FOUND", false);
    const operation: ProviderOperation = {
      ...existing,
      status: input.status,
      observedProviderStatus: input.observedProviderStatus ?? input.status,
      reconciliationState: input.reconciliationState ?? existing.reconciliationState,
      lastCheckedAt: input.lastCheckedAt ?? existing.lastCheckedAt,
      lastEventAt: input.lastEventAt ?? existing.lastEventAt,
      lastErrorCode: input.lastErrorCode ?? existing.lastErrorCode,
      captureId: input.captureId ?? existing.captureId,
      updatedAt: new Date().toISOString(),
    };
    this.operations.set(input.action.id, operation);
    return { ...operation };
  }

  async getByProviderOrderId(providerOrderId: string): Promise<ProviderOperation | null> {
    for (const operation of this.operations.values()) {
      if (operation.providerOrderId === providerOrderId) return { ...operation };
    }
    return null;
  }
}

type Row = Record<string, unknown>;

export class SupabasePayPalOperationStore implements PayPalOperationStore {
  constructor(private readonly client: SupabaseClient) {}

  async listRecent(
    environmentId: string,
    options: { limit: number; cursor?: string },
  ): Promise<{ operations: ProviderOperation[]; nextCursor: string | null }> {
    const cursor = decodeOperationCursor(options.cursor);
    let query = this.client
      .from("provider_operations")
      .select(
        "environment_id,action_id,provider,provider_order_id,approval_url,status,observed_provider_status,capture_id,reconciliation_state,last_checked_at,last_event_at,last_error_code,created_at,updated_at",
      )
      .eq("environment_id", environmentId)
      .order("updated_at", { ascending: false })
      .order("action_id", { ascending: false })
      .limit(options.limit + 1);
    if (cursor) {
      query = query.or(
        `updated_at.lt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},action_id.lt.${cursor.actionId})`,
      );
    }
    const { data, error } = await query;
    if (error) throw error;
    return paginateOperations(
      (data ?? []).map((row) => mapOperation(row as Row)),
      options.limit,
    );
  }

  async get(actionId: string, environmentId: string): Promise<ProviderOperation | null> {
    const { data, error } = await this.client
      .from("provider_operations")
      .select(
        "environment_id,action_id,provider,provider_order_id,approval_url,status,observed_provider_status,capture_id,reconciliation_state,last_checked_at,last_event_at,last_error_code,created_at,updated_at",
      )
      .eq("action_id", actionId)
      .eq("environment_id", environmentId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapOperation(data as Row) : null;
  }

  async save(input: {
    action: ProtectedAction;
    providerOrderId: string | null;
    approvalUrl?: string | null;
    status: string;
  }): Promise<ProviderOperation> {
    const existing = await this.get(input.action.id, input.action.environmentId);
    if (existing) {
      if (existing.providerOrderId || input.providerOrderId === null) return existing;
      const { data, error } = await this.client
        .from("provider_operations")
        .update({
          provider_order_id: input.providerOrderId,
          approval_url: input.approvalUrl ?? existing.approvalUrl,
          status: input.status,
          observed_provider_status: input.status,
          updated_at: new Date().toISOString(),
        })
        .eq("environment_id", input.action.environmentId)
        .eq("action_id", input.action.id)
        .is("provider_order_id", null)
        .select(
          "environment_id,action_id,provider,provider_order_id,approval_url,status,observed_provider_status,capture_id,reconciliation_state,last_checked_at,last_event_at,last_error_code,created_at,updated_at",
        )
        .maybeSingle();
      if (error) throw error;
      return data
        ? mapOperation(data as Row)
        : (await this.get(input.action.id, input.action.environmentId))!;
    }
    const { data, error } = await this.client
      .from("provider_operations")
      .insert({
        environment_id: input.action.environmentId,
        action_id: input.action.id,
        provider: "paypal",
        provider_order_id: input.providerOrderId,
        approval_url: input.approvalUrl ?? null,
        status: input.status,
      })
      .select(
        "environment_id,action_id,provider,provider_order_id,approval_url,status,observed_provider_status,capture_id,reconciliation_state,last_checked_at,last_event_at,last_error_code,created_at,updated_at",
      )
      .single();
    if (error) {
      const retry = await this.get(input.action.id, input.action.environmentId);
      if (retry) return retry;
      throw error;
    }
    return mapOperation(data as Row);
  }

  async updateCapture(input: {
    action: ProtectedAction;
    status: string;
    captureId: string | null;
  }): Promise<ProviderOperation> {
    const { data, error } = await this.client
      .from("provider_operations")
      .update({
        status: input.status,
        observed_provider_status: input.status,
        reconciliation_state: "resolved",
        capture_id: input.captureId,
        updated_at: new Date().toISOString(),
      })
      .eq("environment_id", input.action.environmentId)
      .eq("action_id", input.action.id)
      .select(
        "environment_id,action_id,provider,provider_order_id,approval_url,status,observed_provider_status,capture_id,reconciliation_state,last_checked_at,last_event_at,last_error_code,created_at,updated_at",
      )
      .single();
    if (error) throw error;
    return mapOperation(data as Row);
  }

  async updateStatus(input: {
    action: ProtectedAction;
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
      .eq("environment_id", input.action.environmentId)
      .eq("action_id", input.action.id)
      .select(
        "environment_id,action_id,provider,provider_order_id,approval_url,status,observed_provider_status,capture_id,reconciliation_state,last_checked_at,last_event_at,last_error_code,created_at,updated_at",
      )
      .single();
    if (error) throw error;
    return mapOperation(data as Row);
  }

  async getByProviderOrderId(providerOrderId: string): Promise<ProviderOperation | null> {
    const { data, error } = await this.client
      .from("provider_operations")
      .select(
        "environment_id,action_id,provider,provider_order_id,approval_url,status,observed_provider_status,capture_id,reconciliation_state,last_checked_at,last_event_at,last_error_code,created_at,updated_at",
      )
      .eq("provider_order_id", providerOrderId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapOperation(data as Row) : null;
  }
}

export class SupabasePayPalWorkerOrderStore implements PayPalWorkerOrderStore {
  constructor(private readonly client: SupabaseClient) {}

  async enqueue(input: PayPalWorkerOrderEnqueueInput): Promise<PayPalWorkerOrderEnqueueResult> {
    const { data, error } = await this.client
      .rpc("enqueue_paypal_order_worker", {
        p_environment_id: input.environmentId,
        p_agent_id: input.agentId,
        p_mandate_id: input.mandateId,
        p_ledger_account_id: input.ledgerAccountId,
        p_idempotency_key: input.idempotencyKey,
        p_request_hash: input.requestHash,
        p_action: input.action,
        p_amount_minor: input.amountMinor,
        p_currency: input.currency,
        p_return_url: input.returnUrl,
        p_cancel_url: input.cancelUrl,
      })
      .single();
    if (error) throw error;
    const result = data as Row;
    return {
      action: mapAction(result.action as Row),
      reservation: mapReservation(result.reservation as Row),
      operation: mapOperation(result.operation as Row),
      job: mapProviderJob(result.job as Row),
      deduplicated: Boolean(result.deduplicated),
    };
  }
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

function mapAction(row: Row): ProtectedAction {
  return {
    id: String(row.id),
    environmentId: String(row.environmentId ?? row.environment_id),
    agentId: String(row.agentId ?? row.agent_id),
    mandateId: String(row.mandateId ?? row.mandate_id),
    idempotencyKey: String(row.idempotencyKey ?? row.idempotency_key),
    requestHash: String(row.requestHash ?? row.request_hash),
    action: String(row.action),
    amountMinor: Number(row.amountMinor ?? row.amount_minor),
    currency: String(row.currency),
    authorizationState: String(row.authorizationState ?? row.authorization_state),
    executionState: String(row.executionState ?? row.execution_state),
    createdAt: String(row.createdAt ?? row.created_at),
  };
}

function mapReservation(row: Row): Reservation {
  return {
    actionId: String(row.actionId ?? row.action_id),
    accountId: String(row.accountId ?? row.account_id ?? row.ledger_account_id),
    amountMinor: Number(row.amountMinor ?? row.amount_minor),
    state: row.state as Reservation["state"],
  };
}

function mapProviderJob(row: Row): ProviderJob {
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

export function createPayPalOperationStore(client: SupabaseClient | null): PayPalOperationStore {
  if ((process.env.DATABASE_MODE ?? "memory") === "supabase") {
    if (!client) throw new Error("DATABASE_MODE=supabase requires Supabase credentials");
    return new SupabasePayPalOperationStore(client);
  }
  return new InMemoryPayPalOperationStore();
}

export function createPayPalWorkerOrderStore(
  client: SupabaseClient | null,
): PayPalWorkerOrderStore | null {
  if ((process.env.DATABASE_MODE ?? "memory") === "supabase") {
    if (!client) throw new Error("DATABASE_MODE=supabase requires Supabase credentials");
    return new SupabasePayPalWorkerOrderStore(client);
  }
  return null;
}

type OperationCursor = { updatedAt: string; actionId: string };

function compareRecentOperations(left: ProviderOperation, right: ProviderOperation): number {
  return (
    right.updatedAt.localeCompare(left.updatedAt) || right.actionId.localeCompare(left.actionId)
  );
}

function isAfterCursor(operation: ProviderOperation, cursor: OperationCursor | null): boolean {
  if (!cursor) return true;
  return (
    operation.updatedAt < cursor.updatedAt ||
    (operation.updatedAt === cursor.updatedAt && operation.actionId < cursor.actionId)
  );
}

function paginateOperations(
  operations: ProviderOperation[],
  limit: number,
): { operations: ProviderOperation[]; nextCursor: string | null } {
  const page = operations.slice(0, limit);
  const hasMore = operations.length > limit;
  const last = page.at(-1);
  return {
    operations: page,
    nextCursor: hasMore && last ? encodeOperationCursor(last) : null,
  };
}

function encodeOperationCursor(
  operation: Pick<ProviderOperation, "updatedAt" | "actionId">,
): string {
  return Buffer.from(
    JSON.stringify({ updatedAt: operation.updatedAt, actionId: operation.actionId }),
  ).toString("base64url");
}

function decodeOperationCursor(value: string | undefined): OperationCursor | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      updatedAt?: unknown;
      actionId?: unknown;
    };
    if (
      typeof decoded.updatedAt !== "string" ||
      Number.isNaN(Date.parse(decoded.updatedAt)) ||
      typeof decoded.actionId !== "string" ||
      !decoded.actionId
    ) {
      throw new Error("invalid cursor");
    }
    return { updatedAt: decoded.updatedAt, actionId: decoded.actionId };
  } catch {
    throw new PayPalError("Invalid PayPal operation cursor.", "INVALID_PAGINATION_CURSOR", false);
  }
}
