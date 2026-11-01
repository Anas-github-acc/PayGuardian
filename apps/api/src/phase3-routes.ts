import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { Registry } from "./phase1.js";
import type { AuthorityStore } from "./phase2.js";
import type { LedgerStore } from "./phase3.js";
import type { AuditEventStore } from "./audit.js";
import type { ApprovalStore } from "./phase4.js";

type AppRequest = FastifyRequest & { principal?: { userId: string; kind: "user" } };

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

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "LEDGER_OPERATION_FAILED";
}

export function registerPhase3Routes(
  app: FastifyInstance,
  dependencies: {
    registry: Registry;
    authority: AuthorityStore;
    ledger: LedgerStore;
    resolvePrincipal: PrincipalResolver;
    audit: AuditEventStore;
    approvals?: ApprovalStore;
  },
): void {
  app.post<{
    Params: { environmentId: string };
    Body: {
      mandateId: string;
      parentAccountId?: string | null;
      currency: string;
      availableMinor: number;
    };
  }>("/v1/environments/:environmentId/ledger/accounts", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;
    const environment = await dependencies.registry.getEnvironment(
      owner.userId,
      request.params.environmentId,
    );
    const mandate = await dependencies.authority.get(request.body.mandateId, owner.userId);
    if (!environment || !mandate || mandate.environmentId !== request.params.environmentId) {
      return reply
        .code(404)
        .send({ code: "LEDGER_TARGET_NOT_FOUND", message: "Ledger target not found." });
    }
    if (environment.status !== "active") {
      return reply.code(409).send({
        code: "ENVIRONMENT_NOT_ACTIVE",
        message: "Ledger account creation requires an active environment.",
      });
    }
    if (request.body.currency.toUpperCase() !== environment.currency) {
      return reply
        .code(400)
        .send({ code: "CURRENCY_MISMATCH", message: "Ledger currency mismatch." });
    }
    if (
      request.body.parentAccountId === undefined &&
      request.body.availableMinor !== mandate.budgetLimitMinor
    ) {
      return reply.code(400).send({
        code: "ROOT_FUNDING_MISMATCH",
        message: "A root ledger account must start with the mandate budget.",
      });
    }
    if (request.body.parentAccountId !== undefined && request.body.availableMinor !== 0) {
      return reply.code(400).send({
        code: "CHILD_FUNDING_INVALID",
        message: "Child ledger accounts start at zero and receive allocated funds.",
      });
    }
    try {
      const account = await dependencies.ledger.createAccount({
        environmentId: environment.id,
        mandateId: mandate.id,
        parentAccountId: request.body.parentAccountId ?? null,
        currency: request.body.currency.toUpperCase(),
        availableMinor: request.body.availableMinor,
      });
      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: owner.userId,
        mandateId: mandate.id,
        eventType: "ledger.account_created",
        outcome: "success",
        payload: { accountId: account.id, parentAccountId: request.body.parentAccountId ?? null },
      });
      return reply.code(201).send({ account });
    } catch (error) {
      return reply
        .code(400)
        .send({ code: errorCode(error), message: "Ledger account creation failed." });
    }
  });

  app.get<{
    Params: { environmentId: string; accountId: string };
  }>("/v1/environments/:environmentId/ledger/accounts/:accountId", async (request, reply) => {
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
    if (environment.status !== "active") {
      return reply.code(409).send({
        code: "ENVIRONMENT_NOT_ACTIVE",
        message: "Budget allocation requires an active environment.",
      });
    }
    const account = await dependencies.ledger.getAccount(environment.id, request.params.accountId);
    if (!account)
      return reply
        .code(404)
        .send({ code: "ACCOUNT_NOT_FOUND", message: "Ledger account not found." });
    return { account };
  });

  app.get<{
    Params: { environmentId: string };
  }>("/v1/environments/:environmentId/ledger/accounts", async (request, reply) => {
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
    const accounts = await dependencies.ledger.listAccounts(environment.id);
    return { accounts };
  });

  app.post<{
    Params: { environmentId: string };
    Body: {
      parentAccountId: string;
      childAccountId: string;
      amountMinor: number;
      idempotencyKey: string;
      requestHash: string;
    };
  }>("/v1/environments/:environmentId/ledger/reclaims", async (request, reply) => {
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
      const result = await dependencies.ledger.reclaim({
        environmentId: environment.id,
        ...request.body,
      });
      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: owner.userId,
        eventType: "ledger.reclaimed",
        outcome: "success",
        payload: {
          parentAccountId: request.body.parentAccountId,
          childAccountId: request.body.childAccountId,
          amountMinor: request.body.amountMinor,
        },
      });
      return { reclaim: result };
    } catch (error) {
      return reply.code(400).send({ code: errorCode(error), message: "Budget reclaim failed." });
    }
  });

  app.post<{
    Params: { environmentId: string };
    Body: {
      parentAccountId: string;
      childAccountId: string;
      amountMinor: number;
      idempotencyKey: string;
      requestHash: string;
    };
  }>("/v1/environments/:environmentId/ledger/allocations", async (request, reply) => {
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
      const result = await dependencies.ledger.allocate({
        environmentId: environment.id,
        ...request.body,
      });
      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: owner.userId,
        eventType: "ledger.allocated",
        outcome: "success",
        payload: {
          parentAccountId: request.body.parentAccountId,
          childAccountId: request.body.childAccountId,
          amountMinor: request.body.amountMinor,
        },
      });
      return { allocation: result };
    } catch (error) {
      return reply.code(400).send({ code: errorCode(error), message: "Budget allocation failed." });
    }
  });

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
      approvalId?: string;
    };
  }>("/v1/environments/:environmentId/actions/reserve", async (request, reply) => {
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
        .send({ code: "AUTHORITY_TARGET_NOT_FOUND", message: "Action target not found." });
    }
    if (environment.status !== "active") {
      return reply.code(409).send({
        code: "ENVIRONMENT_NOT_ACTIVE",
        message: "Protected actions require an active environment.",
      });
    }

    let approvalGranted = false;
    if (request.body.approvalId && dependencies.approvals) {
      const approval = await dependencies.approvals.get(environment.id, request.body.approvalId);
      if (
        approval &&
        approval.status === "approved" &&
        approval.mandateId === mandate.id &&
        approval.agentId === agent.id &&
        approval.action === request.body.action &&
        approval.amountMinor === request.body.amountMinor &&
        approval.currency === request.body.currency.toUpperCase() &&
        approval.requestHash === request.body.requestHash
      ) {
        approvalGranted = true;
      }
    }

    const decision = await dependencies.authority.evaluate(
      mandate.id,
      {
        action: request.body.action,
        amountMinor: request.body.amountMinor,
        currency: request.body.currency.toUpperCase(),
        approvalGranted,
      },
      owner.userId,
    );
    if (!decision.allowed) {
      let createdApprovalId: string | undefined;
      if (decision.code === "APPROVAL_REQUIRED" && dependencies.approvals) {
        const approval = await dependencies.approvals.create({
          environmentId: environment.id,
          mandateId: mandate.id,
          agentId: agent.id,
          action: request.body.action,
          amountMinor: request.body.amountMinor,
          currency: request.body.currency.toUpperCase(),
          requestHash: request.body.requestHash,
        });
        createdApprovalId = approval.id;
        await dependencies.audit.append({
          environmentId: environment.id,
          actorType: "user",
          actorId: owner.userId,
          mandateId: mandate.id,
          eventType: "approval.requested",
          outcome: "success",
          payload: {
            approvalId: approval.id,
            action: approval.action,
            amountMinor: approval.amountMinor,
            currency: approval.currency,
            requestHash: approval.requestHash,
          },
        });
      }

      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: owner.userId,
        mandateId: mandate.id,
        eventType: "action.denied",
        outcome: "denied",
        reasonCode: decision.code,
        payload: {
          action: request.body.action,
          amountMinor: request.body.amountMinor,
          approvalId: createdApprovalId ?? request.body.approvalId ?? null,
        },
      });
      return reply.code(403).send({
        decision,
        ...(createdApprovalId ? { approvalId: createdApprovalId } : {}),
      });
    }
    try {
      const result = await dependencies.ledger.authorizeAndReserve({
        environmentId: environment.id,
        ...request.body,
        currency: request.body.currency.toUpperCase(),
      });
      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: owner.userId,
        mandateId: mandate.id,
        actionId: result.action.id,
        eventType: "action.reserved",
        outcome: "success",
        payload: { action: request.body.action, amountMinor: request.body.amountMinor },
      });
      return reply.code(201).send(result);
    } catch (error) {
      return reply
        .code(400)
        .send({ code: errorCode(error), message: "Action reservation failed." });
    }
  });

  app.post<{
    Params: { environmentId: string; actionId: string };
  }>("/v1/environments/:environmentId/actions/:actionId/capture", async (request, reply) => {
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
      const reservation = await dependencies.ledger.capture(
        environment.id,
        request.params.actionId,
      );
      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: owner.userId,
        actionId: request.params.actionId,
        eventType: "action.captured",
        outcome: "success",
        payload: { reservationState: reservation.state },
      });
      return { reservation };
    } catch (error) {
      return reply
        .code(400)
        .send({ code: errorCode(error), message: "Reservation capture failed." });
    }
  });

  app.post<{
    Params: { environmentId: string; actionId: string };
    Body: { reason: string };
  }>("/v1/environments/:environmentId/actions/:actionId/release", async (request, reply) => {
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
      const reservation = await dependencies.ledger.release(
        environment.id,
        request.params.actionId,
        request.body.reason,
      );
      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: owner.userId,
        actionId: request.params.actionId,
        eventType: "action.released",
        outcome: "success",
        reasonCode: "RELEASED",
        payload: { reservationState: reservation.state },
      });
      return { reservation };
    } catch (error) {
      return reply
        .code(400)
        .send({ code: errorCode(error), message: "Reservation release failed." });
    }
  });

  app.get<{
    Params: { environmentId: string; actionId: string };
  }>("/v1/environments/:environmentId/actions/:actionId", async (request, reply) => {
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
    if (!action)
      return reply
        .code(404)
        .send({ code: "ACTION_NOT_FOUND", message: "Protected action not found." });
    const reservation = await dependencies.ledger.getReservation(environment.id, action.id);
    return { action, reservation };
  });

  app.get<{
    Params: { environmentId: string; actionId: string };
  }>("/v1/environments/:environmentId/actions/:actionId/trace", async (request, reply) => {
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
    if (!action)
      return reply
        .code(404)
        .send({ code: "ACTION_NOT_FOUND", message: "Protected action not found." });
    const mandateChain = await dependencies.authority.getChain(action.mandateId, owner.userId);
    const agent = await dependencies.registry.getAgent(owner.userId, action.agentId);
    return {
      action,
      agent,
      mandateChain,
      rootMandate: mandateChain[0] ?? null,
    };
  });
}
