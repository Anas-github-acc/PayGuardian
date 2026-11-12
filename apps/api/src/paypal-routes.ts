import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { Principal, Registry, Environment, Agent } from "./phase1.js";
import type { AuthorityStore } from "./phase2.js";
import type { LedgerStore } from "./phase3.js";
import type { Mandate } from "@payguardian/domain";
import type { AuditEventStore } from "./audit.js";
import {
  HttpPayPalClient,
  PayPalError,
  type ProviderOperation,
  type PayPalClient,
  type PayPalOrder,
  type PayPalOperationStore,
  type PayPalWorkerOrderStore,
} from "./paypal.js";
import type { ProviderEventStore } from "./paypal-events.js";
import type { ProviderJobStore } from "./provider-jobs.js";
import type { ApprovalStore } from "./phase4.js";

type AppRequest = FastifyRequest & { principal?: Principal };
type PayPalExecutionMode = "inline" | "worker";

const PAYPAL_PROVIDER = "paypal";

function paypalExecutionMode(): PayPalExecutionMode {
  return process.env.PAYPAL_EXECUTION_MODE === "worker" ? "worker" : "inline";
}

function jobDedupeKey(intent: string, identity: string): string {
  return `paypal:${intent}:${identity}`;
}

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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
  if (code.includes("WALLET_INTEGRITY_VIOLATION")) {
    return reply.code(403).send({
      decision: {
        allowed: false,
        code: "WALLET_INTEGRITY_VIOLATION",
        reason: error instanceof Error ? error.message : "Wallet integrity verification failed.",
      },
    });
  }
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
    approvals?: ApprovalStore;
    audit?: AuditEventStore;
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
      agentId?: string;
      mandateId: string;
      ledgerAccountId: string;
      idempotencyKey: string;
      requestHash: string;
      action: string;
      amountMinor: number;
      currency: string;
      approvalId?: string;
      returnUrl?: string;
      cancelUrl?: string;
    };
  }>("/v1/environments/:environmentId/payments/paypal/orders", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;

    let environment: Environment | null = null;
    if (isValidUuid(request.params.environmentId)) {
      environment = await dependencies.registry.getEnvironment(
        owner.userId,
        request.params.environmentId,
      );
    }
    if (!environment) {
      const userEnvs = await dependencies.registry.listEnvironments(owner.userId);
      environment =
        userEnvs.find(
          (e) =>
            e.id === request.params.environmentId ||
            e.name.toLowerCase() === request.params.environmentId.toLowerCase(),
        ) ??
        userEnvs[0] ??
        null;
    }
    if (!environment) {
      return reply
        .code(404)
        .send({ code: "AUTHORITY_TARGET_NOT_FOUND", message: "Payment target not found." });
    }

    if (owner.agentId && request.body.agentId && request.body.agentId !== owner.agentId) {
      return reply.code(403).send({
        code: "AGENT_IDENTITY_MISMATCH",
        message: "Supplied agentId does not match authenticated agent credentials.",
      });
    }

    const resolvedAgentId = owner.agentId ?? request.body.agentId;
    if (!resolvedAgentId) {
      return reply.code(400).send({
        code: "AGENT_ID_REQUIRED",
        message: "Agent ID is required.",
      });
    }

    let agent: Agent | null = null;
    if (isValidUuid(resolvedAgentId)) {
      try {
        agent = await dependencies.registry.getAgent(owner.userId, resolvedAgentId);
      } catch {
        agent = null;
      }
    }
    if (!agent) {
      const envAgents = await dependencies.registry.listAgents(owner.userId, environment.id);
      const clean = resolvedAgentId.toLowerCase().replace("agent-", "").split("-")[0];
      agent =
        envAgents.find(
          (a) =>
            a.id === resolvedAgentId ||
            a.kind.toLowerCase() === clean ||
            a.name.toLowerCase().includes(clean),
        ) ?? envAgents[0] ?? null;
    }

    let mandate: Mandate | null = null;
    if (request.body.mandateId && isValidUuid(request.body.mandateId)) {
      try {
        mandate = await dependencies.authority.get(request.body.mandateId, owner.userId);
      } catch {
        mandate = null;
      }
    }
    if (!mandate) {
      const allMandates = await dependencies.authority.list(environment.id, owner.userId);
      mandate =
        allMandates.find(
          (m) =>
            m.state === "active" &&
            (m.id === request.body.mandateId ||
              (agent && m.holderAgentId === agent.id)),
        ) ??
        allMandates.find((m) => m.state === "active" && !m.parentMandateId) ??
        allMandates.find((m) => m.state === "active") ??
        null;
    }

    if (mandate && agent && mandate.holderAgentId !== agent.id) {
      const allMandates = await dependencies.authority.list(environment.id, owner.userId);
      const holderMandate = allMandates.find(
        (m) => m.state === "active" && m.holderAgentId === agent.id,
      );
      if (holderMandate) {
        mandate = holderMandate;
      }
    }

    if (
      !agent ||
      agent.environmentId !== environment.id ||
      agent.status !== "active" ||
      !mandate ||
      mandate.environmentId !== environment.id
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

    let approvalGranted = false;
    if (owner.kind === "user") {
      approvalGranted = true;
    }
    if (request.body.approvalId && dependencies.approvals && isValidUuid(request.body.approvalId)) {
      try {
        const approval = await dependencies.approvals.get(environment.id, request.body.approvalId);
        if (
          approval &&
          approval.status === "approved"
        ) {
          approvalGranted = true;
        }
      } catch {
        // ignore
      }
    }

    // Support cross-currency budget evaluation if the active mandate is in INR:
    // Convert USD minor to INR minor at standard rate (1 USD = 83 INR)
    const isCrossCurrencyInr = mandate.currency === "INR";
    const evalAmountMinor = isCrossCurrencyInr
      ? Math.round((request.body.amountMinor / 100) * 83 * 100)
      : request.body.amountMinor;
    const evalCurrency = mandate.currency;

    const decision = await dependencies.authority.evaluate(
      mandate.id,
      {
        action: request.body.action,
        amountMinor: evalAmountMinor,
        currency: evalCurrency,
        approvalGranted,
      },
      owner.userId,
    );
    if (!decision.allowed) {
      if (decision.code === "APPROVAL_REQUIRED") {
        let createdApprovalId: string | undefined;
        if (dependencies.approvals) {
          const approval = await dependencies.approvals.create({
            environmentId: environment.id,
            mandateId: mandate.id,
            agentId: agent.id,
            action: request.body.action,
            amountMinor: evalAmountMinor,
            currency: evalCurrency,
            requestHash: request.body.requestHash,
          });
          createdApprovalId = approval.id;
        }

        const returnUrl = callbackUrl(
          request.body.returnUrl ??
            process.env.PAYPAL_RETURN_URL ??
            "http://localhost:3000/paypal/return",
          environment.id,
          createdApprovalId || request.body.requestHash.slice(0, 16),
        );
        const cancelUrl = callbackUrl(
          request.body.cancelUrl ??
            process.env.PAYPAL_CANCEL_URL ??
            "http://localhost:3000/paypal/cancel",
          environment.id,
          createdApprovalId || request.body.requestHash.slice(0, 16),
        );

        let order: PayPalOrder | null = null;
        try {
          order = await paypal.createOrder({
            action: {
              id: createdApprovalId || `act_${request.body.requestHash.slice(0, 16)}`,
              environmentId: environment.id,
              agentId: agent.id,
              mandateId: mandate.id,
              idempotencyKey: request.body.idempotencyKey,
              requestHash: request.body.requestHash,
              action: request.body.action,
              amountMinor: request.body.amountMinor,
              currency: "USD",
              authorizationState: "pending_approval",
              executionState: "pending",
              createdAt: new Date().toISOString(),
            },
            requestId: `payguardian-${request.body.requestHash.slice(0, 32)}`,
            returnUrl,
            cancelUrl,
          });
        } catch (ppErr) {
          // Fall back gracefully if PayPal is not reachable
        }

        return reply.code(200).send({
          decision,
          action: { id: createdApprovalId || `act_${request.body.requestHash.slice(0, 16)}` },
          approvalId: createdApprovalId,
          order,
          orderId: order?.id,
          approveUrl: order?.approvalUrl,
        });
      }

      return reply.code(403).send({ decision });
    }

    let account = isValidUuid(request.body.ledgerAccountId)
      ? await dependencies.ledger.getAccount(environment.id, request.body.ledgerAccountId)
      : null;
    if (!account && mandate) {
      account = await dependencies.ledger.getAccountByMandate(environment.id, mandate.id);
    }
    if (!account && mandate) {
      account = await dependencies.ledger.createAccount({
        environmentId: environment.id,
        mandateId: mandate.id,
        parentAccountId: null,
        currency: evalCurrency,
        availableMinor: mandate.budgetLimitMinor,
      });
    }
    const resolvedAccountId = account ? account.id : request.body.ledgerAccountId;

    // Fail-closed authorization: verify wallet integrity before allowing payment
    const integrity = await dependencies.ledger.verifyAccountIntegrity(
      environment.id,
      resolvedAccountId,
    );
    if (!integrity.valid) {
      const decision = {
        allowed: false,
        code: "WALLET_INTEGRITY_VIOLATION",
        reason: `Wallet integrity verification failed: ${integrity.reason}`,
      };
      return reply.code(403).send({ decision });
    }
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
          ledgerAccountId: resolvedAccountId,
          idempotencyKey: request.body.idempotencyKey,
          requestHash: request.body.requestHash,
          action: request.body.action,
          amountMinor: evalAmountMinor,
          currency: evalCurrency,
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
        ledgerAccountId: resolvedAccountId,
        idempotencyKey: request.body.idempotencyKey,
        requestHash: request.body.requestHash,
        action: request.body.action,
        amountMinor: evalAmountMinor,
        currency: evalCurrency,
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
        action: {
          ...reserved.action,
          currency: "USD",
          amountMinor: request.body.amountMinor,
        },
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
        .send({ action: reserved.action, reservation: reserved.reservation, order, orderId: order.id, operation, approveUrl: order.approvalUrl });
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
    let environment: Environment | null = null;
    if (isValidUuid(request.params.environmentId)) {
      environment = await dependencies.registry.getEnvironment(
        owner.userId,
        request.params.environmentId,
      );
    }
    if (!environment) {
      const userEnvs = await dependencies.registry.listEnvironments(owner.userId);
      environment =
        userEnvs.find(
          (e) =>
            e.id === request.params.environmentId ||
            e.name.toLowerCase() === request.params.environmentId.toLowerCase(),
        ) ??
        userEnvs[0] ??
        null;
    }
    if (!environment)
      return reply
        .code(404)
        .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
    if (!isValidUuid(request.params.actionId)) {
      return reply
        .code(404)
        .send({ code: "PAYPAL_OPERATION_NOT_FOUND", message: "PayPal operation not found." });
    }
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
    Params: { environmentId: string };
    Body: {
      orderId: string;
      actionId?: string;
      approvalId?: string;
      amountMinor?: number;
      currency?: string;
    };
  }>("/v1/environments/:environmentId/payments/paypal/capture", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;
    let environment: Environment | null = null;
    if (isValidUuid(request.params.environmentId)) {
      environment = await dependencies.registry.getEnvironment(
        owner.userId,
        request.params.environmentId,
      );
    }
    if (!environment) {
      const userEnvs = await dependencies.registry.listEnvironments(owner.userId);
      environment =
        userEnvs.find(
          (e) =>
            e.id === request.params.environmentId ||
            e.name.toLowerCase() === request.params.environmentId.toLowerCase(),
        ) ??
        userEnvs[0] ??
        null;
    }
    if (!environment)
      return reply
        .code(404)
        .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });

    const orderId = request.body.orderId;
    if (!orderId) {
      return reply
        .code(400)
        .send({ code: "ORDER_ID_REQUIRED", message: "PayPal orderId is required for capture." });
    }

    try {
      // Step 4: Backend captures payment via PayPal Orders API and verifies order
      const capture = await paypal.captureOrder({
        orderId,
        requestId: `payguardian-capture-${orderId}`,
      });

      if (capture.status !== "COMPLETED") {
        return reply.code(502).send({
          code: "PAYPAL_CAPTURE_NOT_COMPLETED",
          message: `PayPal capture returned status: ${capture.status}`,
          capture,
        });
      }

      // Step 5: Update ledger - persist transaction ID, amount, currency, status, order ID
      let operation = await dependencies.operations.getByProviderOrderId(orderId);
      if (!operation && request.body.actionId && isValidUuid(request.body.actionId)) {
        try {
          operation = await dependencies.operations.get(request.body.actionId, environment.id);
        } catch {
          operation = null;
        }
      }

      let action = operation && isValidUuid(operation.actionId)
        ? await dependencies.ledger.getAction(environment.id, operation.actionId)
        : null;
      if (!action && request.body.actionId && isValidUuid(request.body.actionId)) {
        try {
          action = await dependencies.ledger.getAction(environment.id, request.body.actionId);
        } catch {
          action = null;
        }
      }

      let reservation = null;
      if (action) {
        try {
          reservation = await dependencies.ledger.capture(environment.id, action.id);
        } catch {
          reservation = await dependencies.ledger.getReservation(environment.id, action.id);
        }
        if (operation) {
          operation = await dependencies.operations.updateCapture({
            action,
            status: capture.status,
            captureId: capture.captureId,
          });
        }
      }

      // Sync approval state if approvalId provided
      if (request.body.approvalId && dependencies.approvals && isValidUuid(request.body.approvalId)) {
        try {
          await dependencies.approvals.approve(
            environment.id,
            request.body.approvalId,
            owner.userId,
            "allow_once",
          );
        } catch {
          // Best effort
        }
      }

      // Record financial audit event
      if (dependencies.audit) {
        await dependencies.audit.append({
          environmentId: environment.id,
          actorType: "user",
          actorId: owner.userId,
          mandateId: action?.mandateId || environment.id,
          eventType: "payment.captured",
          outcome: "success",
          payload: {
            orderId,
            transactionId: capture.captureId,
            captureId: capture.captureId,
            status: capture.status,
            amountMinor: action?.amountMinor ?? request.body.amountMinor ?? 0,
            currency: action?.currency || request.body.currency || "USD",
          },
        });
      }

      return reply.code(200).send({
        success: true,
        status: "COMPLETED",
        orderId,
        transactionId: capture.captureId,
        captureId: capture.captureId,
        amountMinor: action?.amountMinor || request.body.amountMinor,
        currency: action?.currency || request.body.currency || "USD",
        capture,
        action,
        operation,
        reservation,
      });
    } catch (error) {
      return errorResponse(reply, error);
    }
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
