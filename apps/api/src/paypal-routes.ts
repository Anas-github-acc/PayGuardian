import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { Registry } from "./phase1.js";
import type { AuthorityStore } from "./phase2.js";
import type { LedgerStore } from "./phase3.js";
import {
  HttpPayPalClient,
  PayPalError,
  type ProviderOperation,
  type PayPalClient,
  type PayPalOperationStore,
  type PayPalWorkerOrderStore,
} from "./paypal.js";
import type { ProviderEventStore } from "./paypal-events.js";
import type { ProviderJobStore } from "./provider-jobs.js";

type AppRequest = FastifyRequest & { principal?: { userId: string; kind: "user" } };
type PayPalExecutionMode = "inline" | "worker";

const PAYPAL_PROVIDER = "paypal";

function paypalExecutionMode(): PayPalExecutionMode {
  return process.env.PAYPAL_EXECUTION_MODE === "worker" ? "worker" : "inline";
}

function jobDedupeKey(intent: string, identity: string): string {
  return `paypal:${intent}:${identity}`;
}

async function principal(
  request: AppRequest,
  reply: FastifyReply,
  resolvePrincipal: PrincipalResolver,
) {
  const localUserId = request.headers["x-local-user-id"];
  const resolved = await resolvePrincipal(
    request.headers.authorization,
    typeof localUserId === "string" ? localUserId : undefined,
  );
  if (!resolved) {
    await reply
      .code(401)
      .send({ code: "AUTHENTICATION_REQUIRED", message: "Authentication required." });
    return null;
  }
  request.principal = resolved;
  return resolved;
}

function errorResponse(reply: FastifyReply, error: unknown) {
  if (error instanceof PayPalError) {
    return reply
      .code(error.retryable ? 502 : 400)
      .send({ code: error.code, message: error.message });
  }
  const code = error instanceof Error ? error.message : "PAYPAL_OPERATION_FAILED";
  return reply.code(400).send({ code, message: "PayPal operation failed." });
}

function callbackUrl(base: string, environmentId: string, actionId: string): string {
  const url = new URL(base);
  url.searchParams.set("environment_id", environmentId);
  url.searchParams.set("action_id", actionId);
  return url.toString();
}

function eventDetails(event: unknown): {
  id: string;
  type: string;
  orderId: string | null;
  captureId: string | null;
  status: string | null;
  occurredAt: string | null;
} | null {
  if (!event || typeof event !== "object") return null;
  const value = event as Record<string, unknown>;
  const resource =
    value.resource && typeof value.resource === "object"
      ? (value.resource as Record<string, unknown>)
      : {};
  const supplementary =
    resource.supplementary_data && typeof resource.supplementary_data === "object"
      ? (resource.supplementary_data as Record<string, unknown>)
      : {};
  const related =
    supplementary.related_ids && typeof supplementary.related_ids === "object"
      ? (supplementary.related_ids as Record<string, unknown>)
      : {};
  const id = typeof value.id === "string" ? value.id : null;
  const type = typeof value.event_type === "string" ? value.event_type : null;
  if (!id || !type) return null;
  return {
    id,
    type,
    orderId:
      typeof related.order_id === "string"
        ? related.order_id
        : typeof resource.id === "string" && type.startsWith("CHECKOUT.ORDER")
          ? resource.id
          : null,
    captureId:
      typeof resource.id === "string" && type.startsWith("PAYMENT.CAPTURE") ? resource.id : null,
    status: typeof resource.status === "string" ? resource.status : null,
    occurredAt: typeof value.create_time === "string" ? value.create_time : null,
  };
}

export type PayPalOperationSummaryDto = {
  actionId: string;
  provider: "paypal";
  providerOrderId: string | null;
  status: string;
  observedProviderStatus: string | null;
  captureId: string | null;
  reconciliationState: "pending" | "resolved";
  amountMinor: number | null;
  currency: string | null;
  authorizationState: string | null;
  executionState: string | null;
  lastCheckedAt: string | null;
  lastEventAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

function operationSummary(
  operation: ProviderOperation,
  action: Awaited<ReturnType<LedgerStore["getAction"]>>,
): PayPalOperationSummaryDto {
  return {
    actionId: operation.actionId,
    provider: operation.provider,
    providerOrderId: operation.providerOrderId,
    status: operation.status,
    observedProviderStatus: operation.observedProviderStatus,
    captureId: operation.captureId,
    reconciliationState: operation.reconciliationState,
    amountMinor: action?.amountMinor ?? null,
    currency: action?.currency ?? null,
    authorizationState: action?.authorizationState ?? null,
    executionState: action?.executionState ?? null,
    lastCheckedAt: operation.lastCheckedAt,
    lastEventAt: operation.lastEventAt,
    lastErrorCode: operation.lastErrorCode,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
  };
}

function parseLimit(value: string | undefined): number {
  if (value === undefined) return 25;
  if (!/^\d+$/.test(value))
    throw new PayPalError("Invalid pagination limit.", "INVALID_PAGINATION", false);
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new PayPalError(
      "Pagination limit must be between 1 and 100.",
      "INVALID_PAGINATION",
      false,
    );
  }
  return limit;
}

export function registerPayPalRoutes(
  app: FastifyInstance,
  dependencies: {
    registry: Registry;
    authority: AuthorityStore;
    ledger: LedgerStore;
    operations: PayPalOperationStore;
    providerEvents: ProviderEventStore;
    paypal?: PayPalClient;
    resolvePrincipal: PrincipalResolver;
    providerJobs: ProviderJobStore;
    workerOrder?: PayPalWorkerOrderStore | null;
  },
): void {
  const paypal = dependencies.paypal ?? new HttpPayPalClient();

  async function applyProviderStatus(
    environmentId: string,
    action: Awaited<ReturnType<LedgerStore["getAction"]>>,
    operation: ProviderOperation,
    status: string,
    captureId: string | null,
    eventTime: string | null = null,
  ) {
    if (!action) return operation;
    if (["COMPLETED", "CAPTURED"].includes(operation.status) && status !== "COMPLETED")
      return operation;
    if (status === "COMPLETED") {
      await dependencies.ledger.capture(environmentId, action.id);
      return dependencies.operations.updateStatus({
        action,
        status,
        observedProviderStatus: status,
        reconciliationState: "resolved",
        lastCheckedAt: new Date().toISOString(),
        lastEventAt: eventTime,
        captureId,
      });
    }
    if (["VOIDED", "CANCELLED", "DENIED", "FAILED"].includes(status)) {
      await dependencies.ledger.release(
        environmentId,
        action.id,
        `PayPal provider status: ${status}`,
      );
      return dependencies.operations.updateStatus({
        action,
        status,
        observedProviderStatus: status,
        reconciliationState: "resolved",
        lastCheckedAt: new Date().toISOString(),
        lastEventAt: eventTime,
        captureId,
      });
    }
    return dependencies.operations.updateStatus({
      action,
      status,
      observedProviderStatus: status,
      reconciliationState: "pending",
      lastCheckedAt: new Date().toISOString(),
      lastEventAt: eventTime,
      captureId,
    });
  }

  app.post<{
    Params: { environmentId: string };
    Body: {
      agentId: string;
      mandateId: string;
      ledgerAccountId: string;
      idempotencyKey: string;
      requestHash: string;
      action: string;
      amountMinor: number;
      currency: string;
      returnUrl?: string;
      cancelUrl?: string;
    };
  }>("/v1/environments/:environmentId/payments/paypal/orders", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;
    const environment = await dependencies.registry.getEnvironment(
      owner.userId,
      request.params.environmentId,
    );
    const agent = await dependencies.registry.getAgent(owner.userId, request.body.agentId);
    const mandate = await dependencies.authority.get(request.body.mandateId, owner.userId);
    if (
      !environment ||
      !agent ||
      agent.environmentId !== environment.id ||
      agent.status !== "active" ||
      !mandate ||
      mandate.environmentId !== environment.id ||
      mandate.holderAgentId !== agent.id
    ) {
      return reply
        .code(404)
        .send({ code: "AUTHORITY_TARGET_NOT_FOUND", message: "Payment target not found." });
    }
    if (environment.status !== "active") {
      return reply.code(409).send({
        code: "ENVIRONMENT_NOT_ACTIVE",
        message: "PayPal orders require an active environment.",
      });
    }
    if (request.body.currency.toUpperCase() !== "USD") {
      return reply.code(400).send({
        code: "PAYPAL_CURRENCY_UNSUPPORTED",
        message: "PayPal Sandbox provider payments require USD; use simulation for INR.",
      });
    }
    const decision = await dependencies.authority.evaluate(
      mandate.id,
      {
        action: request.body.action,
        amountMinor: request.body.amountMinor,
        currency: "USD",
        approvalGranted: false,
      },
      owner.userId,
    );
    if (!decision.allowed) return reply.code(403).send({ decision });
    let reserved: Awaited<ReturnType<LedgerStore["authorizeAndReserve"]>> | null = null;
    const executionMode = paypalExecutionMode();
    try {
      if (
        executionMode === "worker" &&
        (process.env.DATABASE_MODE ?? "memory") === "supabase" &&
        dependencies.workerOrder
      ) {
        const queued = await dependencies.workerOrder.enqueue({
          environmentId: environment.id,
          agentId: agent.id,
          mandateId: mandate.id,
          ledgerAccountId: request.body.ledgerAccountId,
          idempotencyKey: request.body.idempotencyKey,
          requestHash: request.body.requestHash,
          action: request.body.action,
          amountMinor: request.body.amountMinor,
          currency: "USD",
          returnUrl:
            request.body.returnUrl ??
            process.env.PAYPAL_RETURN_URL ??
            "http://localhost:3000/paypal/return",
          cancelUrl:
            request.body.cancelUrl ??
            process.env.PAYPAL_CANCEL_URL ??
            "http://localhost:3000/paypal/cancel",
        });
        return reply.code(202).send({
          action: queued.action,
          reservation: queued.reservation,
          operation: queued.operation,
          queued: true,
          deduplicated: queued.deduplicated,
          job: queued.job,
        });
      }

      reserved = await dependencies.ledger.authorizeAndReserve({
        environmentId: environment.id,
        agentId: agent.id,
        mandateId: mandate.id,
        ledgerAccountId: request.body.ledgerAccountId,
        idempotencyKey: request.body.idempotencyKey,
        requestHash: request.body.requestHash,
        action: request.body.action,
        amountMinor: request.body.amountMinor,
        currency: "USD",
      });
      const existing = await dependencies.operations.get(reserved.action.id, environment.id);
      const returnUrl = callbackUrl(
        request.body.returnUrl ??
          process.env.PAYPAL_RETURN_URL ??
          "http://localhost:3000/paypal/return",
        environment.id,
        reserved.action.id,
      );
      const cancelUrl = callbackUrl(
        request.body.cancelUrl ??
          process.env.PAYPAL_CANCEL_URL ??
          "http://localhost:3000/paypal/cancel",
        environment.id,
        reserved.action.id,
      );
      const queued = await dependencies.providerJobs.enqueue({
        provider: PAYPAL_PROVIDER,
        intent: "create_order",
        dedupeKey: jobDedupeKey("create_order", reserved.action.id),
        payload: { action: reserved.action, returnUrl, cancelUrl },
      });
      if (existing && executionMode === "inline") {
        return reply.code(200).send({
          action: reserved.action,
          reservation: reserved.reservation,
          operation: existing,
        });
      }
      if (executionMode === "worker") {
        const operation = await dependencies.operations.save({
          action: reserved.action,
          providerOrderId: null,
          approvalUrl: null,
          status: "PENDING",
        });
        return reply.code(202).send({
          action: reserved.action,
          reservation: reserved.reservation,
          operation,
          queued: true,
          deduplicated: queued.deduplicated,
          job: queued.job,
        });
      }
      const order = await paypal.createOrder({
        action: reserved.action,
        requestId: `payguardian-${reserved.action.id}`,
        returnUrl,
        cancelUrl,
      });
      const operation = await dependencies.operations.save({
        action: reserved.action,
        providerOrderId: order.id,
        approvalUrl: order.approvalUrl,
        status: order.status,
      });
      return reply
        .code(201)
        .send({ action: reserved.action, reservation: reserved.reservation, order, operation });
    } catch (error) {
      if (reserved && error instanceof PayPalError && !error.retryable) {
        try {
          await dependencies.ledger.release(
            environment.id,
            reserved.action.id,
            "PayPal order rejected before provider acceptance",
          );
        } catch {
          // Preserve the original provider error; a follow-up reconciliation can inspect the held action.
        }
      }
      return errorResponse(reply, error);
    }
  });

  app.get<{
    Params: { environmentId: string };
    Querystring: { limit?: string; cursor?: string };
  }>("/v1/environments/:environmentId/payments/paypal/operations", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;
    const environment = await dependencies.registry.getEnvironment(
      owner.userId,
      request.params.environmentId,
    );
    if (!environment)
      return reply
        .code(404)
        .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
    try {
      const limit = parseLimit(request.query.limit);
      const page = await dependencies.operations.listRecent(environment.id, {
        limit,
        cursor: request.query.cursor,
      });
      const operations = await Promise.all(
        page.operations.map(async (operation) =>
          operationSummary(
            operation,
            await dependencies.ledger.getAction(environment.id, operation.actionId),
          ),
        ),
      );
      return { operations, pagination: { limit, nextCursor: page.nextCursor } };
    } catch (error) {
      return errorResponse(reply, error);
    }
  });

  app.get<{
    Params: { environmentId: string; actionId: string };
  }>("/v1/environments/:environmentId/payments/paypal/:actionId", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;
    const environment = await dependencies.registry.getEnvironment(
      owner.userId,
      request.params.environmentId,
    );
    if (!environment)
      return reply
        .code(404)
        .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
    const action = await dependencies.ledger.getAction(environment.id, request.params.actionId);
    const operation = await dependencies.operations.get(request.params.actionId, environment.id);
    if (!action || !operation)
      return reply
        .code(404)
        .send({ code: "PAYPAL_OPERATION_NOT_FOUND", message: "PayPal operation not found." });
    return {
      action,
      operation,
      reservation: await dependencies.ledger.getReservation(environment.id, action.id),
    };
  });

  app.post<{
    Params: { environmentId: string; actionId: string };
  }>(
    "/v1/environments/:environmentId/payments/paypal/:actionId/capture",
    async (request, reply) => {
      const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
      if (!owner) return;
      const environment = await dependencies.registry.getEnvironment(
        owner.userId,
        request.params.environmentId,
      );
      if (!environment)
        return reply
          .code(404)
          .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
      const action = await dependencies.ledger.getAction(environment.id, request.params.actionId);
      const operation = await dependencies.operations.get(request.params.actionId, environment.id);
      if (!action || !operation) {
        return reply
          .code(404)
          .send({ code: "PAYPAL_OPERATION_NOT_FOUND", message: "PayPal operation not found." });
      }
      const queued = await dependencies.providerJobs.enqueue({
        provider: PAYPAL_PROVIDER,
        intent: "capture_order",
        dedupeKey: jobDedupeKey("capture_order", action.id),
        payload: { actionId: action.id, environmentId: environment.id },
      });
      if (paypalExecutionMode() === "worker") {
        return reply.code(202).send({
          action,
          operation,
          reservation: await dependencies.ledger.getReservation(environment.id, action.id),
          queued: true,
          deduplicated: queued.deduplicated,
          job: queued.job,
        });
      }
      if (operation.status === "COMPLETED" || operation.status === "CAPTURED") {
        return {
          action,
          operation,
          reservation: await dependencies.ledger.getReservation(environment.id, action.id),
        };
      }
      try {
        if (!operation.providerOrderId) {
          throw new PayPalError(
            "PayPal operation is waiting for a provider order.",
            "PAYPAL_OPERATION_PENDING",
            false,
          );
        }
        const capture = await paypal.captureOrder({
          orderId: operation.providerOrderId,
          requestId: `payguardian-capture-${action.id}`,
        });
        if (capture.status !== "COMPLETED") {
          const updated = await dependencies.operations.updateStatus({
            action,
            status: capture.status,
            observedProviderStatus: capture.status,
            reconciliationState: "pending",
            lastCheckedAt: new Date().toISOString(),
            captureId: capture.captureId,
          });
          return reply.code(502).send({
            code: "PAYPAL_CAPTURE_NOT_COMPLETED",
            message:
              "PayPal did not report a completed capture; the reservation remains held for reconciliation.",
            capture,
            operation: updated,
          });
        }
        const reservation = await dependencies.ledger.capture(environment.id, action.id);
        const updated = await dependencies.operations.updateCapture({
          action,
          status: capture.status,
          captureId: capture.captureId,
        });
        return { action, operation: updated, reservation, capture };
      } catch (error) {
        return errorResponse(reply, error);
      }
    },
  );

  app.post<{
    Params: { environmentId: string; actionId: string };
  }>(
    "/v1/environments/:environmentId/payments/paypal/:actionId/reconcile",
    async (request, reply) => {
      const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
      if (!owner) return;
      const environment = await dependencies.registry.getEnvironment(
        owner.userId,
        request.params.environmentId,
      );
      if (!environment)
        return reply
          .code(404)
          .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
      const action = await dependencies.ledger.getAction(environment.id, request.params.actionId);
      const operation = await dependencies.operations.get(request.params.actionId, environment.id);
      if (!action || !operation)
        return reply
          .code(404)
          .send({ code: "PAYPAL_OPERATION_NOT_FOUND", message: "PayPal operation not found." });
      const queued = await dependencies.providerJobs.enqueue({
        provider: PAYPAL_PROVIDER,
        intent: "reconcile_order",
        dedupeKey: jobDedupeKey("reconcile_order", action.id),
        payload: { actionId: action.id, environmentId: environment.id },
      });
      if (paypalExecutionMode() === "worker") {
        return reply.code(202).send({
          action,
          operation,
          reservation: await dependencies.ledger.getReservation(environment.id, action.id),
          queued: true,
          deduplicated: queued.deduplicated,
          job: queued.job,
        });
      }
      try {
        if (!operation.providerOrderId) {
          throw new PayPalError(
            "PayPal operation is waiting for a provider order.",
            "PAYPAL_OPERATION_PENDING",
            false,
          );
        }
        const observed = await paypal.getOrder({ orderId: operation.providerOrderId });
        const updated = await applyProviderStatus(
          environment.id,
          action,
          operation,
          observed.status,
          observed.captureId,
        );
        return {
          action,
          operation: updated,
          reservation: await dependencies.ledger.getReservation(environment.id, action.id),
          provider: observed,
        };
      } catch (error) {
        return errorResponse(reply, error);
      }
    },
  );

  app.post("/v1/webhooks/paypal", async (request, reply) => {
    const details = eventDetails(request.body);
    if (!details)
      return reply
        .code(400)
        .send({ code: "PAYPAL_EVENT_INVALID", message: "Invalid PayPal event." });
    try {
      const verified = await paypal.verifyWebhook({
        headers: Object.fromEntries(
          Object.entries(request.headers).map(([key, value]) => [
            key.toLowerCase(),
            Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
          ]),
        ),
        event: request.body,
      });
      const recorded = await dependencies.providerEvents.record({
        event: request.body,
        providerEventId: details.id,
        eventType: details.type,
        providerOrderId: details.orderId,
        captureId: details.captureId,
        observedStatus: details.status,
        eventOccurredAt: details.occurredAt,
        verificationState: verified ? "verified" : "rejected",
      });
      if (!verified)
        return reply
          .code(400)
          .send({ code: "PAYPAL_WEBHOOK_INVALID", message: "PayPal webhook verification failed." });
      if (recorded.duplicate && recorded.event.processingState === "applied") {
        return { received: true, duplicate: true };
      }
      if (!details.orderId) {
        if (!recorded.duplicate) await dependencies.providerEvents.markApplied(details.id);
        return { received: true, ignored: true };
      }
      const queued = await dependencies.providerJobs.enqueue({
        provider: PAYPAL_PROVIDER,
        intent: "apply_event",
        dedupeKey: jobDedupeKey("apply_event", details.id),
        payload: {
          event: {
            id: details.id,
            type: details.type,
            orderId: details.orderId,
            captureId: details.captureId,
            status: details.status ?? "PENDING",
            occurredAt: details.occurredAt,
            payload: request.body,
          },
        },
      });
      if (paypalExecutionMode() === "worker") {
        return reply.code(202).send({
          received: true,
          queued: true,
          duplicate: recorded.duplicate,
          deduplicated: queued.deduplicated,
          job: queued.job,
        });
      }
      const operation = await dependencies.operations.getByProviderOrderId(details.orderId);
      if (!operation) return { received: true, queued: false, unresolved: true };
      const action = await dependencies.ledger.getAction(
        operation.environmentId,
        operation.actionId,
      );
      const updated = await applyProviderStatus(
        operation.environmentId,
        action,
        operation,
        details.status ?? "PENDING",
        details.captureId,
        details.occurredAt,
      );
      await dependencies.providerEvents.markApplied(details.id);
      return { received: true, operation: updated };
    } catch (error) {
      return errorResponse(reply, error);
    }
  });
}
