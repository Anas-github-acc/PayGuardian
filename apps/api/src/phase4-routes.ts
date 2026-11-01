import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { Registry } from "./phase1.js";
import type { AuthorityStore } from "./phase2.js";
import type { AuditEventStore } from "./audit.js";
import type { JsonObject } from "@payguardian/observability";
import type {
  ApprovalStore,
  ApprovalStatus,
  SessionStore,
  SessionStatus,
  RunStatus,
} from "./phase4.js";

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

export function registerPhase4Routes(
  app: FastifyInstance,
  dependencies: {
    registry: Registry;
    authority: AuthorityStore;
    approvals: ApprovalStore;
    sessions: SessionStore;
    resolvePrincipal: PrincipalResolver;
    audit: AuditEventStore;
  },
): void {
  // Approvals Inbox & Management
  app.post<{
    Params: { environmentId: string };
    Body: {
      mandateId: string;
      agentId: string;
      action: string;
      amountMinor: number;
      currency: string;
      requestHash: string;
    };
  }>("/v1/environments/:environmentId/approvals", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const agent = await dependencies.registry.getAgent(scoped.owner.userId, request.body.agentId);
    const mandate = await dependencies.authority.get(request.body.mandateId, scoped.owner.userId);

    if (
      !agent ||
      agent.environmentId !== scoped.environment.id ||
      agent.status !== "active" ||
      !mandate ||
      mandate.environmentId !== scoped.environment.id
    ) {
      return reply.code(404).send({
        code: "AUTHORITY_TARGET_NOT_FOUND",
        message: "Target agent or mandate not found.",
      });
    }

    if (scoped.environment.status !== "active") {
      return reply.code(409).send({
        code: "ENVIRONMENT_NOT_ACTIVE",
        message: "Approvals require an active environment.",
      });
    }

    const approval = await dependencies.approvals.create({
      environmentId: scoped.environment.id,
      mandateId: mandate.id,
      agentId: agent.id,
      action: request.body.action,
      amountMinor: request.body.amountMinor,
      currency: request.body.currency.toUpperCase(),
      requestHash: request.body.requestHash,
    });

    await dependencies.audit.append({
      environmentId: scoped.environment.id,
      actorType: "user",
      actorId: scoped.owner.userId,
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

    return reply.code(201).send({ approval });
  });

  app.get<{
    Params: { environmentId: string };
    Querystring: { status?: ApprovalStatus; mandateId?: string };
  }>("/v1/environments/:environmentId/approvals", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const approvals = await dependencies.approvals.list(scoped.environment.id, {
      status: request.query.status,
      mandateId: request.query.mandateId,
    });
    return { approvals };
  });

  app.get<{
    Params: { environmentId: string; approvalId: string };
  }>("/v1/environments/:environmentId/approvals/:approvalId", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const approval = await dependencies.approvals.get(
      scoped.environment.id,
      request.params.approvalId,
    );
    if (!approval) {
      return reply
        .code(404)
        .send({ code: "APPROVAL_NOT_FOUND", message: "Approval request not found." });
    }
    return { approval };
  });

  app.post<{
    Params: { environmentId: string; approvalId: string };
  }>("/v1/environments/:environmentId/approvals/:approvalId/approve", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    try {
      const approval = await dependencies.approvals.approve(
        scoped.environment.id,
        request.params.approvalId,
        scoped.owner.userId,
      );

      await dependencies.audit.append({
        environmentId: scoped.environment.id,
        actorType: "user",
        actorId: scoped.owner.userId,
        mandateId: approval.mandateId,
        eventType: "approval.approved",
        outcome: "success",
        payload: {
          approvalId: approval.id,
          action: approval.action,
          amountMinor: approval.amountMinor,
          requestHash: approval.requestHash,
        },
      });

      return { approval };
    } catch (error) {
      return reply.code(400).send({
        code: error instanceof Error ? error.message : "APPROVAL_ACTION_FAILED",
        message: "Failed to approve request.",
      });
    }
  });

  app.post<{
    Params: { environmentId: string; approvalId: string };
    Body: { reason?: string };
  }>("/v1/environments/:environmentId/approvals/:approvalId/reject", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    try {
      const approval = await dependencies.approvals.reject(
        scoped.environment.id,
        request.params.approvalId,
        scoped.owner.userId,
        request.body?.reason,
      );

      await dependencies.audit.append({
        environmentId: scoped.environment.id,
        actorType: "user",
        actorId: scoped.owner.userId,
        mandateId: approval.mandateId,
        eventType: "approval.rejected",
        outcome: "success",
        payload: {
          approvalId: approval.id,
          reason: approval.rejectionReason,
        },
      });

      return { approval };
    } catch (error) {
      return reply.code(400).send({
        code: error instanceof Error ? error.message : "APPROVAL_ACTION_FAILED",
        message: "Failed to reject request.",
      });
    }
  });

  // Sessions and Task Runs
  app.post<{
    Params: { environmentId: string };
    Body: { name: string; agentId?: string; context?: Record<string, unknown> };
  }>("/v1/environments/:environmentId/sessions", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    if (request.body.agentId) {
      const agent = await dependencies.registry.getAgent(scoped.owner.userId, request.body.agentId);
      if (!agent || agent.environmentId !== scoped.environment.id) {
        return reply.code(404).send({ code: "AGENT_NOT_FOUND", message: "Agent not found." });
      }
    }

    const session = await dependencies.sessions.create({
      environmentId: scoped.environment.id,
      agentId: request.body.agentId,
      name: request.body.name,
      context: request.body.context,
    });

    await dependencies.audit.append({
      environmentId: scoped.environment.id,
      actorType: "user",
      actorId: scoped.owner.userId,
      eventType: "session.created",
      outcome: "success",
      payload: { sessionId: session.id, name: session.name },
    });

    return reply.code(201).send({ session });
  });

  app.get<{ Params: { environmentId: string } }>(
    "/v1/environments/:environmentId/sessions",
    async (request, reply) => {
      const scoped = await environmentFor(
        request as AppRequest,
        reply,
        dependencies.registry,
        dependencies.resolvePrincipal,
        request.params.environmentId,
      );
      if (!scoped) return;

      const sessions = await dependencies.sessions.list(scoped.environment.id);
      return { sessions };
    },
  );

  app.get<{ Params: { environmentId: string; sessionId: string } }>(
    "/v1/environments/:environmentId/sessions/:sessionId",
    async (request, reply) => {
      const scoped = await environmentFor(
        request as AppRequest,
        reply,
        dependencies.registry,
        dependencies.resolvePrincipal,
        request.params.environmentId,
      );
      if (!scoped) return;

      const session = await dependencies.sessions.get(
        scoped.environment.id,
        request.params.sessionId,
      );
      if (!session) {
        return reply.code(404).send({ code: "SESSION_NOT_FOUND", message: "Session not found." });
      }
      return { session };
    },
  );

  app.patch<{
    Params: { environmentId: string; sessionId: string };
    Body: { status?: SessionStatus; context?: Record<string, unknown> };
  }>("/v1/environments/:environmentId/sessions/:sessionId", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const session = await dependencies.sessions.update(
      scoped.environment.id,
      request.params.sessionId,
      request.body,
    );
    if (!session) {
      return reply.code(404).send({ code: "SESSION_NOT_FOUND", message: "Session not found." });
    }

    await dependencies.audit.append({
      environmentId: scoped.environment.id,
      actorType: "user",
      actorId: scoped.owner.userId,
      eventType: "session.updated",
      outcome: "success",
      payload: { sessionId: session.id, status: session.status },
    });

    return { session };
  });

  app.post<{
    Params: { environmentId: string; sessionId: string };
    Body: { agentId: string; checkpoint?: Record<string, unknown> };
  }>("/v1/environments/:environmentId/sessions/:sessionId/runs", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const session = await dependencies.sessions.get(
      scoped.environment.id,
      request.params.sessionId,
    );
    if (!session) {
      return reply.code(404).send({ code: "SESSION_NOT_FOUND", message: "Session not found." });
    }

    const agent = await dependencies.registry.getAgent(scoped.owner.userId, request.body.agentId);
    if (!agent || agent.environmentId !== scoped.environment.id || agent.status !== "active") {
      return reply.code(404).send({ code: "AGENT_NOT_FOUND", message: "Active agent not found." });
    }

    const run = await dependencies.sessions.createRun({
      sessionId: session.id,
      agentId: agent.id,
      checkpoint: request.body.checkpoint,
    });

    await dependencies.audit.append({
      environmentId: scoped.environment.id,
      actorType: "agent",
      actorId: agent.id,
      eventType: "run.started",
      outcome: "success",
      payload: { sessionId: session.id, runId: run.id },
    });

    return reply.code(201).send({ run });
  });

  app.get<{ Params: { environmentId: string; sessionId: string } }>(
    "/v1/environments/:environmentId/sessions/:sessionId/runs",
    async (request, reply) => {
      const scoped = await environmentFor(
        request as AppRequest,
        reply,
        dependencies.registry,
        dependencies.resolvePrincipal,
        request.params.environmentId,
      );
      if (!scoped) return;

      const session = await dependencies.sessions.get(
        scoped.environment.id,
        request.params.sessionId,
      );
      if (!session) {
        return reply.code(404).send({ code: "SESSION_NOT_FOUND", message: "Session not found." });
      }

      const runs = await dependencies.sessions.listRuns(session.id);
      return { runs };
    },
  );

  app.patch<{
    Params: { environmentId: string; sessionId: string; runId: string };
    Body: { status?: RunStatus; checkpoint?: Record<string, unknown> };
  }>("/v1/environments/:environmentId/sessions/:sessionId/runs/:runId", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const run = await dependencies.sessions.updateRun(request.params.runId, request.body);
    if (!run || run.sessionId !== request.params.sessionId) {
      return reply.code(404).send({ code: "RUN_NOT_FOUND", message: "Run not found." });
    }

    await dependencies.audit.append({
      environmentId: scoped.environment.id,
      actorType: "agent",
      actorId: run.agentId,
      eventType: "run.checkpointed",
      outcome: "success",
      payload: { runId: run.id, status: run.status },
    });

    return { run };
  });

  // Protected Simulation Actions (non-payment tool execution)
  app.post<{
    Params: { environmentId: string };
    Body: {
      agentId: string;
      mandateId: string;
      action: string;
      amountMinor: number;
      currency: string;
      parameters?: Record<string, unknown>;
    };
  }>("/v1/environments/:environmentId/actions/simulate", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    const agent = await dependencies.registry.getAgent(scoped.owner.userId, request.body.agentId);
    const mandate = await dependencies.authority.get(request.body.mandateId, scoped.owner.userId);

    if (
      !agent ||
      agent.environmentId !== scoped.environment.id ||
      agent.status !== "active" ||
      !mandate ||
      mandate.environmentId !== scoped.environment.id ||
      mandate.holderAgentId !== agent.id
    ) {
      return reply.code(404).send({
        code: "AUTHORITY_TARGET_NOT_FOUND",
        message: "Target agent or mandate not found.",
      });
    }

    if (scoped.environment.status !== "active") {
      return reply.code(409).send({
        code: "ENVIRONMENT_NOT_ACTIVE",
        message: "Simulation requires an active environment.",
      });
    }

    const decision = await dependencies.authority.evaluate(
      mandate.id,
      {
        action: request.body.action,
        amountMinor: request.body.amountMinor,
        currency: request.body.currency.toUpperCase(),
        approvalGranted: true,
      },
      scoped.owner.userId,
    );

    if (!decision.allowed) {
      await dependencies.audit.append({
        environmentId: scoped.environment.id,
        actorType: "agent",
        actorId: agent.id,
        mandateId: mandate.id,
        eventType: "action.denied",
        outcome: "denied",
        reasonCode: decision.code,
        payload: { action: request.body.action, amountMinor: request.body.amountMinor },
      });
      return reply.code(403).send({ decision });
    }

    await dependencies.audit.append({
      environmentId: scoped.environment.id,
      actorType: "agent",
      actorId: agent.id,
      mandateId: mandate.id,
      eventType: "action.simulated",
      outcome: "success",
      payload: {
        action: request.body.action,
        amountMinor: request.body.amountMinor,
        currency: request.body.currency.toUpperCase(),
        parameters: (request.body.parameters as JsonObject | undefined) ?? {},
      },
    });

    return reply.code(200).send({
      allowed: true,
      approvalRequired: mandate.approvalRequired,
      simulation: {
        action: request.body.action,
        amountMinor: request.body.amountMinor,
        currency: request.body.currency.toUpperCase(),
        simulatedAt: new Date().toISOString(),
        result: {
          status: "simulated_success",
          details: request.body.parameters ?? {},
        },
      },
    });
  });
}
