import {
  calculateRetryDelay,
  classifyProviderFailure,
  type ProviderFailure,
  type RetryPolicy,
  defaultProviderRetryPolicy,
} from "@payguardian/domain";
import { PayPalError, type PayPalAction, type PayPalClient } from "@payguardian/paypal";
import {
  observeOperation,
  type ProviderJob,
  type ProviderOperation,
  type WorkerStore,
} from "./store.js";

export type WorkerPayload = {
  action?: PayPalAction;
  actionId?: string;
  environmentId?: string;
  returnUrl?: string;
  cancelUrl?: string;
  orderId?: string;
  event?: {
    id?: string;
    type?: string;
    orderId?: string | null;
    captureId?: string | null;
    status?: string | null;
    occurredAt?: string | null;
    payload?: unknown;
  };
};

export type WorkerExecutionResult = {
  operation?: ProviderOperation;
  idempotent?: boolean;
};

export class WorkerExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly failure: ProviderFailure,
  ) {
    super(message);
  }
}

export class ProviderJobExecutor {
  constructor(
    private readonly dependencies: {
      paypal: PayPalClient;
      store: WorkerStore;
      returnUrl: string;
      cancelUrl: string;
      now?: () => Date;
    },
  ) {}

  async execute(job: ProviderJob): Promise<WorkerExecutionResult> {
    if (job.provider !== "paypal") {
      throw new WorkerExecutionError("Unsupported provider.", "PROVIDER_UNSUPPORTED", {
        kind: "invalid_request",
      });
    }
    const payload = asPayload(job.payload);
    switch (job.intent) {
      case "create_order":
        return this.createOrder(job, payload);
      case "capture_order":
        return this.captureOrder(job, payload);
      case "reconcile_order":
        return this.reconcileOrder(job, payload);
      case "apply_event":
        return this.applyEvent(job, payload);
      default:
        throw new WorkerExecutionError(
          `Unsupported provider intent: ${job.intent}.`,
          "INTENT_UNSUPPORTED",
          {
            kind: "invalid_request",
          },
        );
    }
  }

  private async createOrder(
    job: ProviderJob,
    payload: WorkerPayload,
  ): Promise<WorkerExecutionResult> {
    const action = requireAction(payload);
    const existing = await this.dependencies.store.getOperation(action.id, action.environmentId);
    if (existing?.providerOrderId) return { operation: existing, idempotent: true };

    try {
      const order = await this.dependencies.paypal.createOrder({
        action,
        requestId: paypalRequestId("create", action.id),
        returnUrl: payload.returnUrl ?? this.dependencies.returnUrl,
        cancelUrl: payload.cancelUrl ?? this.dependencies.cancelUrl,
      });
      return {
        operation: await this.dependencies.store.saveOperation({
          action,
          providerOrderId: order.id,
          approvalUrl: order.approvalUrl,
          status: order.status,
        }),
      };
    } catch (error) {
      const classified = classifyWorkerError(error);
      if (!classified.retry && this.dependencies.store.releaseReservation) {
        await this.dependencies.store.releaseReservation({
          environmentId: action.environmentId,
          actionId: action.id,
          reason: `PayPal order rejected: ${classified.code}`,
        });
      }
      throw asWorkerError(error);
    }
  }

  private async captureOrder(
    job: ProviderJob,
    payload: WorkerPayload,
  ): Promise<WorkerExecutionResult> {
    const identity = requireIdentity(payload);
    const operation = await this.requireOperation(identity);
    if (["COMPLETED", "CAPTURED"].includes(operation.status)) {
      return { operation, idempotent: true };
    }
    if (!operation.providerOrderId) {
      throw new WorkerExecutionError(
        "PayPal operation is waiting for a provider order.",
        "PAYPAL_OPERATION_PENDING",
        { kind: "unknown", code: "PAYPAL_OPERATION_PENDING" },
      );
    }

    try {
      const capture = await this.dependencies.paypal.captureOrder({
        orderId: operation.providerOrderId,
        requestId: paypalRequestId("capture", operation.actionId),
      });
      const updated = await this.persistObservation({
        actionId: operation.actionId,
        environmentId: operation.environmentId,
        status: capture.status,
        observedProviderStatus: capture.status,
        reconciliationState: capture.status === "COMPLETED" ? "resolved" : "pending",
        lastCheckedAt: this.now().toISOString(),
        captureId: capture.captureId,
      });
      if (capture.status !== "COMPLETED") {
        throw new WorkerExecutionError(
          "PayPal capture is not complete.",
          "PAYPAL_CAPTURE_PENDING",
          { kind: "unknown", code: "PAYPAL_CAPTURE_PENDING" },
        );
      }
      return { operation: updated };
    } catch (error) {
      if (error instanceof WorkerExecutionError) throw error;
      throw asWorkerError(error);
    }
  }

  private async reconcileOrder(
    job: ProviderJob,
    payload: WorkerPayload,
  ): Promise<WorkerExecutionResult> {
    const operation = await this.requireOperation(requireIdentity(payload));
    if (!operation.providerOrderId) {
      throw new WorkerExecutionError(
        "PayPal operation is waiting for a provider order.",
        "PAYPAL_OPERATION_PENDING",
        { kind: "unknown", code: "PAYPAL_OPERATION_PENDING" },
      );
    }
    try {
      const observed = await this.dependencies.paypal.getOrder({
        orderId: operation.providerOrderId,
      });
      const decision = observeOperation(operation, {
        observationId: `poll:${job.id}:${observed.status}`,
        status: observed.status,
        observedAt: this.now().toISOString(),
        captureId: observed.captureId,
      });
      if (decision.kind === "conflict") {
        throw new WorkerExecutionError(
          "Provider status conflicts with a terminal operation.",
          "PROVIDER_STATUS_CONFLICT",
          {
            kind: "conflict",
          },
        );
      }
      if (decision.kind === "ignored") return { operation: decision.operation, idempotent: true };
      return {
        operation: await this.persistObservation({
          actionId: operation.actionId,
          environmentId: operation.environmentId,
          status: decision.operation.status,
          observedProviderStatus: decision.operation.observedProviderStatus,
          reconciliationState: decision.operation.reconciliationState,
          lastCheckedAt: decision.operation.lastCheckedAt,
          captureId: decision.operation.captureId,
        }),
      };
    } catch (error) {
      if (error instanceof WorkerExecutionError) throw error;
      throw asWorkerError(error);
    }
  }

  private async applyEvent(
    job: ProviderJob,
    payload: WorkerPayload,
  ): Promise<WorkerExecutionResult> {
    const event = payload.event;
    if (!event?.id || !event.status) {
      throw new WorkerExecutionError("Provider event payload is incomplete.", "EVENT_INVALID", {
        kind: "invalid_request",
      });
    }
    const operation = event.orderId
      ? await this.dependencies.store.getOperationByProviderOrderId(event.orderId)
      : payload.actionId
        ? await this.dependencies.store.getOperation(payload.actionId, payload.environmentId)
        : null;
    if (!operation) {
      throw new WorkerExecutionError(
        "Provider operation was not found for the event.",
        "OPERATION_NOT_FOUND",
        {
          kind: "not_found",
        },
      );
    }
    const observedAt = event.occurredAt ?? this.now().toISOString();
    const decision = observeOperation(operation, {
      observationId: event.id,
      status: event.status,
      observedAt,
      captureId: event.captureId,
    });
    if (decision.kind === "conflict") {
      throw new WorkerExecutionError(
        "Provider event conflicts with the operation.",
        "EVENT_CONFLICT",
        {
          kind: "conflict",
        },
      );
    }
    if (decision.kind === "ignored") {
      await this.dependencies.store.markProviderEventApplied(event.id);
      return { operation: decision.operation, idempotent: true };
    }
    const updated = await this.persistObservation({
      actionId: operation.actionId,
      environmentId: operation.environmentId,
      status: decision.operation.status,
      observedProviderStatus: decision.operation.observedProviderStatus,
      reconciliationState: decision.operation.reconciliationState,
      lastCheckedAt: decision.operation.lastCheckedAt,
      lastEventAt: observedAt,
      captureId: decision.operation.captureId,
    });
    await this.dependencies.store.markProviderEventApplied(event.id);
    return { operation: updated };
  }

  private async requireOperation(identity: { actionId: string; environmentId?: string }) {
    const operation = await this.dependencies.store.getOperation(
      identity.actionId,
      identity.environmentId,
    );
    if (!operation) {
      throw new WorkerExecutionError("PayPal operation was not found.", "OPERATION_NOT_FOUND", {
        kind: "not_found",
      });
    }
    return operation;
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private async settleReservation(
    operation: ProviderOperation,
    actionId: string,
    environmentId: string,
  ): Promise<void> {
    if (["COMPLETED", "CAPTURED"].includes(operation.status)) {
      await this.dependencies.store.captureReservation?.({ environmentId, actionId });
    } else if (["FAILED", "DENIED", "CANCELLED", "VOIDED"].includes(operation.status)) {
      await this.dependencies.store.releaseReservation?.({
        environmentId,
        actionId,
        reason: `PayPal provider status: ${operation.status}`,
      });
    }
  }

  private async persistObservation(input: {
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
    if (this.dependencies.store.applyObservation) {
      return this.dependencies.store.applyObservation(input);
    }
    const operation = await this.dependencies.store.getOperation(
      input.actionId,
      input.environmentId,
    );
    if (!operation) throw new Error("PAYPAL_OPERATION_NOT_FOUND");
    await this.settleReservation(
      { ...operation, status: input.status },
      input.actionId,
      input.environmentId,
    );
    return this.dependencies.store.updateOperation(input);
  }
}

export function paypalRequestId(operation: "create" | "capture", actionId: string): string {
  return operation === "create" ? `payguardian-${actionId}` : `payguardian-capture-${actionId}`;
}

export function classifyWorkerError(error: unknown): {
  code: string;
  message: string;
  retry: boolean;
  failure: ProviderFailure;
} {
  const failure = toProviderFailure(error);
  const disposition = classifyProviderFailure(failure);
  return {
    code: errorCode(error, failure),
    message: errorMessage(error),
    retry: disposition !== "non_retryable",
    failure,
  };
}

export function retryAtFor(
  attempts: number,
  now: Date,
  policy: RetryPolicy = defaultProviderRetryPolicy,
  random: () => number = () => 0.5,
): string {
  return new Date(
    now.getTime() + calculateRetryDelay(Math.max(0, attempts - 1), policy, random),
  ).toISOString();
}

function asWorkerError(error: unknown): WorkerExecutionError {
  const classified = classifyWorkerError(error);
  return new WorkerExecutionError(classified.message, classified.code, classified.failure);
}

function toProviderFailure(error: unknown): ProviderFailure {
  if (error instanceof WorkerExecutionError) return error.failure;
  if (error instanceof PayPalError) {
    const paypalError = error as PayPalError;
    return {
      kind: paypalError.retryable ? "server" : "invalid_request",
      code: paypalError.code,
      statusCode: paypalError.retryable ? 503 : 400,
      message: paypalError.message,
    };
  }
  const value = error as { code?: unknown; name?: unknown; message?: unknown; retryable?: unknown };
  const code = typeof value?.code === "string" ? value.code : undefined;
  const name = typeof value?.name === "string" ? value.name : "";
  const message = typeof value?.message === "string" ? value.message : "Unknown worker failure.";
  if (value?.retryable === false) return { kind: "invalid_request", code, message };
  if (/timeout|timed out|etimedout/i.test(`${name} ${code ?? ""} ${message}`)) {
    return { kind: "timeout", code: code ?? "TIMEOUT", message };
  }
  return { kind: "unknown", code, message };
}

function errorCode(error: unknown, failure: ProviderFailure): string {
  if (error instanceof WorkerExecutionError) return error.code;
  if (error instanceof PayPalError) return (error as PayPalError).code;
  return failure.code ?? (failure.kind === "timeout" ? "TIMEOUT" : "WORKER_EXECUTION_FAILED");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Worker execution failed.";
}

function asPayload(value: unknown): WorkerPayload {
  return value && typeof value === "object" ? (value as WorkerPayload) : {};
}

function requireAction(payload: WorkerPayload): PayPalAction {
  const action = payload.action;
  if (!action) {
    throw new WorkerExecutionError(
      "PayPal action payload is required.",
      "ACTION_PAYLOAD_REQUIRED",
      {
        kind: "invalid_request",
      },
    );
  }
  return action;
}

function requireIdentity(payload: WorkerPayload): { actionId: string; environmentId?: string } {
  const actionId = payload.actionId ?? payload.action?.id;
  if (!actionId) {
    throw new WorkerExecutionError(
      "Provider operation identity is required.",
      "OPERATION_ID_REQUIRED",
      {
        kind: "invalid_request",
      },
    );
  }
  return { actionId, environmentId: payload.environmentId ?? payload.action?.environmentId };
}
