import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { Registry } from "./phase1.js";
import type { AuthorityStore } from "./phase2.js";

type AppRequest = FastifyRequest & { principal?: { userId: string; kind: "user" } };

async function principal(
  request: AppRequest,
  reply: FastifyReply,
  resolvePrincipal: PrincipalResolver,
) {
  const userIdHeader = request.headers["x-local-user-id"];
  const resolved = await resolvePrincipal(
    request.headers.authorization,
    typeof userIdHeader === "string" ? userIdHeader : undefined,
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

export function registerPhase2Routes(
  app: FastifyInstance,
  dependencies: {
    registry: Registry;
    authority: AuthorityStore;
    resolvePrincipal: PrincipalResolver;
  },
): void {
  app.post<{
    Params: { environmentId: string };
    Body: {
      holderAgentId: string;
      budgetLimitMinor: number;
      currency: string;
      permittedActions: string[];
      expiresAt: string;
      canDelegate: boolean;
      maxDelegationDepth: number;
      approvalRequired: boolean;
    };
  }>("/v1/environments/:environmentId/mandates/root", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;
    const environment = await dependencies.registry.getEnvironment(
      owner.userId,
      request.params.environmentId,
    );
    const holder = await dependencies.registry.getAgent(owner.userId, request.body.holderAgentId);
    if (
      !environment ||
      !holder ||
      holder.environmentId !== environment.id ||
      holder.status !== "active"
    ) {
      return reply
        .code(404)
        .send({ code: "AUTHORITY_TARGET_NOT_FOUND", message: "Environment or agent not found." });
    }
    if (request.body.currency.toUpperCase() !== environment.currency) {
      return reply.code(400).send({
        code: "CURRENCY_MISMATCH",
        message: "Mandate currency must match environment currency.",
      });
    }
    try {
      const mandate = await dependencies.authority.createRoot({
        issuerUserId: owner.userId,
        environmentId: environment.id,
        ...request.body,
        holderAgentId: holder.id,
        currency: request.body.currency.toUpperCase(),
      });
      return reply.code(201).send({ mandate });
    } catch (error) {
      return reply.code(400).send({
        code: error instanceof Error ? error.message : "INVALID_MANDATE",
        message: "Invalid root mandate.",
      });
    }
  });

  app.post<{
    Params: { mandateId: string };
    Body: {
      holderAgentId: string;
      budgetLimitMinor: number;
      currency: string;
      permittedActions: string[];
      expiresAt: string;
      canDelegate: boolean;
      maxDelegationDepth: number;
      approvalRequired: boolean;
    };
  }>("/v1/mandates/:mandateId/delegations", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;
    const child = await dependencies.registry.getAgent(owner.userId, request.body.holderAgentId);
    if (!child)
      return reply.code(404).send({ code: "AGENT_NOT_FOUND", message: "Child agent not found." });
    const parent = await dependencies.authority.get(request.params.mandateId, owner.userId);
    if (!parent || child.environmentId !== parent.environmentId || child.status !== "active") {
      return reply.code(403).send({
        code: "DELEGATION_TARGET_INVALID",
        message: "Child agent is not active in the mandate environment.",
      });
    }
    const result = await dependencies.authority.delegate(request.params.mandateId, {
      issuerUserId: owner.userId,
      ...request.body,
      holderAgentId: child.id,
      currency: request.body.currency.toUpperCase(),
    });
    return reply
      .code(result.decision.allowed ? 201 : 403)
      .send(
        result.mandate
          ? { mandate: result.mandate, decision: result.decision }
          : { decision: result.decision },
      );
  });

  app.post<{ Params: { mandateId: string } }>(
    "/v1/mandates/:mandateId/revocations",
    async (request, reply) => {
      const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
      if (!owner) return;
      const mandate = await dependencies.authority.revoke(request.params.mandateId, owner.userId);
      if (!mandate)
        return reply.code(404).send({ code: "MANDATE_NOT_FOUND", message: "Mandate not found." });
      return { mandate };
    },
  );

  app.post<{
    Params: { mandateId: string };
    Body: { action: string; amountMinor: number; currency: string; approvalGranted?: boolean };
  }>("/v1/mandates/:mandateId/check", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;
    const decision = await dependencies.authority.evaluate(
      request.params.mandateId,
      {
        ...request.body,
        currency: request.body.currency.toUpperCase(),
        approvalGranted: request.body.approvalGranted ?? false,
      },
      owner.userId,
    );
    return reply.code(decision.allowed ? 200 : 403).send({ decision });
  });
}
