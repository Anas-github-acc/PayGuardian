import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { AgentKind, Registry } from "./phase1.js";
import type { AuditEventStore } from "./audit.js";

type AppRequest = FastifyRequest & { principal?: { userId: string; kind: "user" } };

function getBody<T>(request: FastifyRequest): T {
  return request.body as T;
}

async function requirePrincipal(
  request: AppRequest,
  reply: FastifyReply,
  resolvePrincipal: PrincipalResolver,
): Promise<{ userId: string } | null> {
  const principal = await resolvePrincipal(
    request.headers.authorization,
    typeof request.headers["x-local-user-id"] === "string"
      ? request.headers["x-local-user-id"]
      : undefined,
  );
  if (!principal) {
    await reply
      .code(401)
      .send({ code: "AUTHENTICATION_REQUIRED", message: "Authentication required." });
    return null;
  }
  request.principal = principal;
  return principal;
}

export function registerPhase1Routes(
  app: FastifyInstance,
  dependencies: { registry: Registry; resolvePrincipal: PrincipalResolver; audit: AuditEventStore },
): void {
  app.post<{ Body: { name: string; purpose: string; currency: string; budgetLimitMinor: number } }>(
    "/v1/environments",
    async (request, reply) => {
      const principal = await requirePrincipal(
        request as AppRequest,
        reply,
        dependencies.resolvePrincipal,
      );
      if (!principal) return;
      const body = getBody<{
        name: string;
        purpose: string;
        currency: string;
        budgetLimitMinor: number;
      }>(request);
      if (
        !body?.name ||
        !body.purpose ||
        !body.currency ||
        !Number.isSafeInteger(body.budgetLimitMinor) ||
        body.budgetLimitMinor < 0
      ) {
        return reply.code(400).send({
          code: "INVALID_ENVIRONMENT",
          message: "A valid name, purpose, currency, and integer budget are required.",
        });
      }
      const environment = await dependencies.registry.createEnvironment({
        ownerUserId: principal.userId,
        name: body.name,
        purpose: body.purpose,
        currency: body.currency.toUpperCase(),
        budgetLimitMinor: body.budgetLimitMinor,
      });
      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: principal.userId,
        eventType: "environment.created",
        outcome: "success",
        payload: { currency: environment.currency },
      });
      return reply.code(201).send({ environment });
    },
  );

  app.get("/v1/environments", async (request, reply) => {
    const principal = await requirePrincipal(
      request as AppRequest,
      reply,
      dependencies.resolvePrincipal,
    );
    if (!principal) return;
    return { environments: await dependencies.registry.listEnvironments(principal.userId) };
  });

  app.get<{ Params: { environmentId: string } }>(
    "/v1/environments/:environmentId/agents",
    async (request, reply) => {
      const principal = await requirePrincipal(
        request as AppRequest,
        reply,
        dependencies.resolvePrincipal,
      );
      if (!principal) return;
      const environment = await dependencies.registry.getEnvironment(
        principal.userId,
        request.params.environmentId,
      );
      if (!environment)
        return reply
          .code(404)
          .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
      return { agents: await dependencies.registry.listAgents(principal.userId, environment.id) };
    },
  );

  app.post<{ Params: { environmentId: string }; Body: { name: string; capabilities?: string[] } }>(
    "/v1/environments/:environmentId/agents/root",
    async (request, reply) => {
      const principal = await requirePrincipal(
        request as AppRequest,
        reply,
        dependencies.resolvePrincipal,
      );
      if (!principal) return;
      const environment = await dependencies.registry.getEnvironment(
        principal.userId,
        request.params.environmentId,
      );
      if (!environment)
        return reply
          .code(404)
          .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
      const existing = await dependencies.registry.listAgents(principal.userId, environment.id);
      if (existing.some((agent) => agent.parentAgentId === null && agent.kind === "personal")) {
        return reply.code(409).send({
          code: "ROOT_AGENT_EXISTS",
          message: "This environment already has a Personal Agent.",
        });
      }
      const body = getBody<{ name: string; capabilities?: string[] }>(request);
      if (!body?.name)
        return reply.code(400).send({ code: "INVALID_AGENT", message: "Agent name is required." });
      const created = await dependencies.registry.createAgent({
        environmentId: environment.id,
        ownerUserId: principal.userId,
        parentAgentId: null,
        name: body.name,
        kind: "personal",
        capabilities: body.capabilities ?? [],
      });
      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: principal.userId,
        eventType: "agent.created",
        outcome: "success",
        payload: { agentId: created.agent.id, kind: created.agent.kind, parentAgentId: null },
      });
      return reply.code(201).send(created);
    },
  );

  app.post<{
    Params: { environmentId: string };
    Body: { parentAgentId: string; name: string; kind: AgentKind; capabilities?: string[] };
  }>("/v1/environments/:environmentId/agents/children", async (request, reply) => {
    const principal = await requirePrincipal(
      request as AppRequest,
      reply,
      dependencies.resolvePrincipal,
    );
    if (!principal) return;
    const environment = await dependencies.registry.getEnvironment(
      principal.userId,
      request.params.environmentId,
    );
    if (!environment)
      return reply
        .code(404)
        .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
    const body = getBody<{
      parentAgentId: string;
      name: string;
      kind: AgentKind;
      capabilities?: string[];
    }>(request);
    const parent = body?.parentAgentId
      ? await dependencies.registry.getAgent(principal.userId, body.parentAgentId)
      : null;
    if (!parent || parent.environmentId !== environment.id || parent.status !== "active") {
      return reply.code(403).send({
        code: "PARENT_AGENT_INVALID",
        message: "The authenticated parent agent is invalid for this environment.",
      });
    }
    if (!body.name || !body.kind)
      return reply
        .code(400)
        .send({ code: "INVALID_AGENT", message: "Agent name and kind are required." });
    const created = await dependencies.registry.createAgent({
      environmentId: environment.id,
      ownerUserId: principal.userId,
      parentAgentId: parent.id,
      name: body.name,
      kind: body.kind,
      capabilities: body.capabilities ?? [],
    });
    await dependencies.audit.append({
      environmentId: environment.id,
      actorType: "user",
      actorId: principal.userId,
      eventType: "agent.created",
      outcome: "success",
      payload: { agentId: created.agent.id, kind: created.agent.kind, parentAgentId: parent.id },
    });
    return reply.code(201).send(created);
  });
}
