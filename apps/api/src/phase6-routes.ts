import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { AuditEventStore } from "./audit.js";
import type { Registry } from "./phase1.js";
import type { AuthorityStore } from "./phase2.js";

type AppRequest = FastifyRequest & { principal?: { userId: string; kind: "user" } };
type EnvironmentControl = "active" | "paused" | "revoked";
type AgentControl = "disabled" | "revoked";

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

async function environmentFor(
  request: AppRequest,
  reply: FastifyReply,
  registry: Registry,
  resolvePrincipal: PrincipalResolver,
  environmentId: string,
) {
  const owner = await principal(request, reply, resolvePrincipal);
  if (!owner) return null;
  const environment = await registry.getEnvironment(owner.userId, environmentId);
  if (!environment) {
    await reply
      .code(404)
      .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
    return null;
  }
  return { owner, environment };
}

export function registerPhase6Routes(
  app: FastifyInstance,
  dependencies: {
    registry: Registry;
    authority: AuthorityStore;
    resolvePrincipal: PrincipalResolver;
    audit: AuditEventStore;
  },
): void {
  for (const [path, status, eventType] of [
    ["pause", "paused", "environment.paused"],
    ["resume", "active", "environment.resumed"],
    ["revoke", "revoked", "environment.revoked"],
  ] as const) {
    app.post<{ Params: { environmentId: string } }>(
      `/v1/environments/:environmentId/${path}`,
      async (request, reply) => {
        const scoped = await environmentFor(
          request as AppRequest,
          reply,
          dependencies.registry,
          dependencies.resolvePrincipal,
          request.params.environmentId,
        );
        if (!scoped) return;
        try {
          const environment = await dependencies.registry.setEnvironmentStatus(
            scoped.owner.userId,
            scoped.environment.id,
            status as EnvironmentControl,
          );
          if (!environment) {
            return reply
              .code(404)
              .send({ code: "ENVIRONMENT_NOT_FOUND", message: "Environment not found." });
          }
          await dependencies.audit.append({
            environmentId: environment.id,
            actorType: "user",
            actorId: scoped.owner.userId,
            eventType,
            outcome: "success",
            payload: { status: environment.status },
          });
          return { environment };
        } catch (error) {
          return reply.code(409).send({
            code: error instanceof Error ? error.message : "INVALID_ENVIRONMENT_TRANSITION",
            message: "Environment lifecycle transition is not allowed.",
          });
        }
      },
    );
  }

  for (const [path, status, eventType] of [
    ["disable", "disabled", "agent.disabled"],
    ["revoke", "revoked", "agent.revoked"],
  ] as const) {
    app.post<{
      Params: { environmentId: string; agentId: string };
    }>(`/v1/environments/:environmentId/agents/:agentId/${path}`, async (request, reply) => {
      const scoped = await environmentFor(
        request as AppRequest,
        reply,
        dependencies.registry,
        dependencies.resolvePrincipal,
        request.params.environmentId,
      );
      if (!scoped) return;
      const agent = await dependencies.registry.getAgent(
        scoped.owner.userId,
        request.params.agentId,
      );
      if (!agent || agent.environmentId !== scoped.environment.id) {
        return reply.code(404).send({ code: "AGENT_NOT_FOUND", message: "Agent not found." });
      }
      try {
        const updated = await dependencies.registry.setAgentStatus(
          scoped.owner.userId,
          agent.id,
          status as AgentControl,
        );
        if (!updated) {
          return reply.code(404).send({ code: "AGENT_NOT_FOUND", message: "Agent not found." });
        }
        await dependencies.audit.append({
          environmentId: scoped.environment.id,
          actorType: "user",
          actorId: scoped.owner.userId,
          eventType,
          outcome: "success",
          payload: { agentId: updated.id, status: updated.status },
        });
        return { agent: updated };
      } catch (error) {
        return reply.code(409).send({
          code: error instanceof Error ? error.message : "INVALID_AGENT_TRANSITION",
          message: "Agent lifecycle transition is not allowed.",
        });
      }
    });
  }

  app.get<{ Params: { environmentId: string } }>(
    "/v1/environments/:environmentId/mandates",
    async (request, reply) => {
      const scoped = await environmentFor(
        request as AppRequest,
        reply,
        dependencies.registry,
        dependencies.resolvePrincipal,
        request.params.environmentId,
      );
      if (!scoped) return;
      return {
        mandates: await dependencies.authority.list(scoped.environment.id, scoped.owner.userId),
      };
    },
  );

  app.get<{ Params: { environmentId: string } }>(
    "/v1/environments/:environmentId/activity",
    async (request, reply) => {
      const scoped = await environmentFor(
        request as AppRequest,
        reply,
        dependencies.registry,
        dependencies.resolvePrincipal,
        request.params.environmentId,
      );
      if (!scoped) return;
      return { events: await dependencies.audit.list(scoped.environment.id) };
    },
  );
}
