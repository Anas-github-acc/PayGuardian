import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { Agent, AgentKind, Environment, Principal, Registry } from "./phase1.js";
import type { AuthorityStore } from "./phase2.js";
import type { Mandate } from "@payguardian/domain";
import type { AuditEventStore } from "./audit.js";
import type { JsonObject } from "@payguardian/observability";
import type {
  ApprovalStore,
  ApprovalStatus,
  ApprovalDecision,
  SessionStore,
  SessionStatus,
  RunStatus,
} from "./phase4.js";

type AppRequest = FastifyRequest & { principal?: Principal };

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

  const SPECIALIST_SPECS: Record<
    string,
    { name: string; kind: AgentKind; parentAlias?: string; capabilities: string[] }
  > = {
    travel: {
      name: "Travel Concierge",
      kind: "travel",
      capabilities: ["travel.discover", "flight.quote", "plan_itinerary"],
    },
    food: {
      name: "Food & Dining Specialist",
      kind: "food",
      capabilities: ["food.discover", "dining.quote", "recommend_dining"],
    },
    activities: {
      name: "Activities Specialist",
      kind: "activities",
      capabilities: ["activity.book", "attraction.quote", "book_activity"],
    },
    merchant_attach: {
      name: "MerchantAttach",
      kind: "custom",
      capabilities: ["merchant.discover", "catalog.quote", "procure_merchant_goods"],
    },
    hotel: {
      name: "Hotel Specialist",
      kind: "hotel",
      parentAlias: "travel",
      capabilities: ["hotel.discover", "lodging.quote", "book_hotel"],
    },
    transport: {
      name: "Transport Coordinator",
      kind: "transport",
      parentAlias: "travel",
      capabilities: ["transit.schedule", "ground.quote", "book_transit"],
    },
  };

  async function handleBudgetProposalApproval(
    scoped: { owner: Principal; environment: Environment },
    approvalId: string,
    body: {
      mandateId?: string;
      currency?: string;
      proposedAllocations: Array<{
        agent: string;
        role?: string;
        quotedCostMinor?: number;
        requestedMandateMinor: number;
        capabilities?: string[];
        description?: string;
        reasoning?: string;
        isChild?: boolean;
        parentAgent?: string;
      }>;
    },
    reply: FastifyReply,
  ) {
    let targetMandateId = body.mandateId;
    let parentMandate: Mandate | null = null;
    if (targetMandateId) {
      parentMandate = await dependencies.authority.get(targetMandateId, scoped.owner.userId);
    }
    if (!parentMandate) {
      const mandates = await dependencies.authority.list(scoped.environment.id, scoped.owner.userId);
      parentMandate =
        mandates.find((m) => !m.parentMandateId && m.state === "active") ||
        mandates.find((m) => !m.parentMandateId) ||
        mandates[0] ||
        null;
    }
    if (!parentMandate) {
      return reply.code(404).send({
        code: "MANDATE_NOT_FOUND",
        message: "Parent root mandate not found for environment.",
      });
    }
    if (parentMandate.state === "revoked") {
      return reply.code(403).send({
        code: "MANDATE_REVOKED",
        message: "Parent root mandate is revoked.",
      });
    }
    if (new Date(parentMandate.expiresAt) <= new Date()) {
      return reply.code(403).send({
        code: "MANDATE_EXPIRED",
        message: "Parent root mandate has expired.",
      });
    }

    // 1. Resolve or register agents in the environment
    const envAgents = await dependencies.registry.listAgents(scoped.owner.userId, scoped.environment.id);
    let rootAgent = envAgents.find((a) => a.kind === "personal" || a.parentAgentId === null);
    if (!rootAgent) {
      const createdRoot = await dependencies.registry.createAgent({
        environmentId: scoped.environment.id,
        ownerUserId: scoped.owner.userId,
        parentAgentId: null,
        name: "Personal Agent Orchestrator",
        kind: "personal",
        capabilities: ["*"],
      });
      rootAgent = createdRoot.agent;
    }

    const agentMap = new Map<string, Agent>();

    // Collect only the agent aliases that are actually part of this approved proposal
    const requestedAliases = new Set<string>();
    for (const alloc of body.proposedAllocations) {
      requestedAliases.add(alloc.agent);
      if (alloc.parentAgent) {
        requestedAliases.add(alloc.parentAgent);
      }
      const spec = SPECIALIST_SPECS[alloc.agent];
      if (spec?.parentAlias) {
        requestedAliases.add(spec.parentAlias);
      }
    }

    // Pass 1: Register/resolve only requested top-level agents
    for (const [alias, spec] of Object.entries(SPECIALIST_SPECS)) {
      if (spec.parentAlias || !requestedAliases.has(alias)) continue;
      let agent = envAgents.find(
        (a) =>
          a.kind === spec.kind ||
          a.name.toLowerCase() === spec.name.toLowerCase() ||
          a.id === `agent-${alias}`,
      );
      if (!agent) {
        const created = await dependencies.registry.createAgent({
          environmentId: scoped.environment.id,
          ownerUserId: scoped.owner.userId,
          parentAgentId: rootAgent.id,
          name: spec.name,
          kind: spec.kind,
          capabilities: spec.capabilities,
        });
        agent = created.agent;
      }
      agentMap.set(alias, agent);
    }

    // Pass 2: Register/resolve only requested nested sub-agents (e.g. hotel under travel)
    for (const [alias, spec] of Object.entries(SPECIALIST_SPECS)) {
      if (!spec.parentAlias || !requestedAliases.has(alias)) continue;
      const parentCoord = agentMap.get(spec.parentAlias);
      const parentId = parentCoord ? parentCoord.id : rootAgent.id;
      let agent = envAgents.find(
        (a) =>
          (a.kind === spec.kind ||
            a.name.toLowerCase() === spec.name.toLowerCase() ||
            a.id === `agent-${alias}`) &&
          a.parentAgentId === parentId,
      );
      if (!agent) {
        const created = await dependencies.registry.createAgent({
          environmentId: scoped.environment.id,
          ownerUserId: scoped.owner.userId,
          parentAgentId: parentId,
          name: spec.name,
          kind: spec.kind,
          capabilities: spec.capabilities,
        });
        agent = created.agent;
      }
      agentMap.set(alias, agent);
    }

    // 2. Execute hierarchical delegations
    const currency = (parentMandate.currency || body.currency || "USD").toUpperCase();
    const delegatedMandates = new Map<string, Mandate>();
    const successes: Array<{
      agent: string;
      agentId: string;
      mandateId: string;
      amountMinor: number;
      currency: string;
      status: "authorized";
      parentAgent?: string;
      parentMandateId?: string;
    }> = [];
    const failures: Array<{
      agent: string;
      reason: string;
      status: "failed";
    }> = [];

    const topLevelAllocs = body.proposedAllocations.filter(
      (a) => !a.isChild && !a.parentAgent && a.agent !== "hotel" && a.agent !== "transport",
    );
    const childAllocs = body.proposedAllocations.filter(
      (a) => a.isChild || a.parentAgent || a.agent === "hotel" || a.agent === "transport",
    );

    // Phase A: Root Mandate -> Top-level specialist delegations
    for (const alloc of topLevelAllocs) {
      const agent = agentMap.get(alloc.agent) || envAgents.find((a) => a.id === alloc.agent);
      if (!agent) {
        failures.push({
          agent: alloc.agent,
          reason: `Agent '${alloc.agent}' could not be resolved in environment registry.`,
          status: "failed",
        });
        continue;
      }

      const directChildren = childAllocs.filter(
        (c) => (c.parentAgent || SPECIALIST_SPECS[c.agent]?.parentAlias) === alloc.agent,
      );
      const hasChildren = directChildren.length > 0;
      const canDelegate = (alloc as any).canDelegate ?? (hasChildren || alloc.agent === "travel");
      const maxDepth = (alloc as any).maxDelegationDepth ?? (canDelegate ? 1 : 0);
      const idemKey = `${approvalId}:${alloc.agent}`;

      let actionsToPermit =
        alloc.capabilities && alloc.capabilities.length > 0
          ? [...alloc.capabilities]
          : [...(SPECIALIST_SPECS[alloc.agent]?.capabilities || parentMandate.permittedActions)];

      // Ensure coordinator holds capabilities required by direct child delegations
      for (const child of directChildren) {
        const childCaps =
          child.capabilities && child.capabilities.length > 0
            ? child.capabilities
            : (SPECIALIST_SPECS[child.agent]?.capabilities || []);
        for (const cap of childCaps) {
          if (!actionsToPermit.includes(cap)) {
            actionsToPermit.push(cap);
          }
        }
      }

      if (!parentMandate.permittedActions.includes("*")) {
        const filtered = actionsToPermit.filter(
          (act: string) =>
            parentMandate.permittedActions.includes(act) ||
            parentMandate.permittedActions.some((p: string) => p.endsWith(".*") && act.startsWith(p.slice(0, -2))),
        );
        actionsToPermit = filtered.length > 0 ? filtered : parentMandate.permittedActions;
      }

      const res = await dependencies.authority.delegate(parentMandate.id, {
        issuerUserId: scoped.owner.userId,
        holderAgentId: agent.id, // Real database UUID
        budgetLimitMinor: alloc.requestedMandateMinor,
        currency,
        permittedActions: actionsToPermit,
        expiresAt: parentMandate.expiresAt,
        canDelegate,
        maxDelegationDepth: maxDepth,
        approvalRequired: parentMandate.approvalRequired,
        idempotencyKey: idemKey,
        caller: scoped.owner,
        supersedeExisting: true,
      });

      if (res.mandate) {
        delegatedMandates.set(alloc.agent, res.mandate);
        successes.push({
          agent: alloc.agent,
          agentId: agent.id,
          mandateId: res.mandate.id,
          amountMinor: alloc.requestedMandateMinor,
          currency: res.mandate.currency,
          status: "authorized",
        });
      } else {
        failures.push({
          agent: alloc.agent,
          reason: res.decision?.reason || "Authority rejected delegation.",
          status: "failed",
        });
      }
    }

    // Phase B: Parent Specialist -> Nested Child Delegations (e.g. Travel -> Hotel)
    for (const alloc of childAllocs) {
      const parentAlias = alloc.parentAgent || SPECIALIST_SPECS[alloc.agent]?.parentAlias || "travel";
      const parentCoordMandate = delegatedMandates.get(parentAlias);
      const parentCoordAgent = agentMap.get(parentAlias);
      const childAgent = agentMap.get(alloc.agent) || envAgents.find((a) => a.id === alloc.agent);

      if (!parentCoordMandate || !parentCoordAgent || !childAgent) {
        failures.push({
          agent: alloc.agent,
          reason: `Parent coordinator mandate ('${parentAlias}') must be active before child delegation.`,
          status: "failed",
        });
        continue;
      }

      const idemKey = `${approvalId}:${alloc.agent}`;
      let childActions =
        alloc.capabilities && alloc.capabilities.length > 0
          ? alloc.capabilities
          : parentCoordMandate.permittedActions;
      if (!parentCoordMandate.permittedActions.includes("*")) {
        const filtered = childActions.filter(
          (act: string) =>
            parentCoordMandate.permittedActions.includes(act) ||
            parentCoordMandate.permittedActions.some((p: string) => p.endsWith(".*") && act.startsWith(p.slice(0, -2))),
        );
        childActions = filtered.length > 0 ? filtered : parentCoordMandate.permittedActions;
      }

      const childResult = await dependencies.authority.delegate(parentCoordMandate.id, {
        issuerUserId: scoped.owner.userId,
        holderAgentId: childAgent.id, // Real database UUID
        budgetLimitMinor: alloc.requestedMandateMinor,
        currency: parentCoordMandate.currency,
        permittedActions: childActions,
        expiresAt: parentCoordMandate.expiresAt,
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: parentCoordMandate.approvalRequired,
        idempotencyKey: idemKey,
        caller: { kind: "agent", agentId: parentCoordAgent.id, userId: scoped.owner.userId },
        supersedeExisting: true,
      });

      if (childResult.mandate) {
        delegatedMandates.set(alloc.agent, childResult.mandate);
        successes.push({
          agent: alloc.agent,
          agentId: childAgent.id,
          parentAgent: parentAlias,
          parentMandateId: parentCoordMandate.id,
          mandateId: childResult.mandate.id,
          amountMinor: alloc.requestedMandateMinor,
          currency: childResult.mandate.currency,
          status: "authorized",
        });
      } else {
        failures.push({
          agent: alloc.agent,
          reason: childResult.decision?.reason || "Authority rejected child delegation.",
          status: "failed",
        });
      }
    }

    // State Machine Decision:
    let finalStatus: "AUTHORIZED" | "PARTIALLY_AUTHORIZED" | "FAILED";
    if (failures.length === 0 && successes.length > 0) {
      finalStatus = "AUTHORIZED";
    } else if (successes.length > 0) {
      finalStatus = "PARTIALLY_AUTHORIZED";
    } else {
      finalStatus = "FAILED";
    }

    const totalDelegatedMinor = successes
      .filter((s) => !s.parentMandateId)
      .reduce((acc, s) => acc + s.amountMinor, 0);
    const remainingReserveMinor = Math.max(0, parentMandate.budgetLimitMinor - totalDelegatedMinor);

    if (dependencies.approvals) {
      try {
        let existing = await dependencies.approvals.get(scoped.environment.id, approvalId);
        if (!existing) {
          existing = await dependencies.approvals.create({
            id: approvalId,
            environmentId: scoped.environment.id,
            mandateId: parentMandate.id,
            agentId: rootAgent.id,
            action: "budget.delegate",
            amountMinor: totalDelegatedMinor,
            currency,
            requestHash: approvalId,
          });
        }
        if (existing && existing.status === "pending") {
          if (finalStatus === "FAILED") {
            await dependencies.approvals.reject(
              scoped.environment.id,
              existing.id,
              scoped.owner.userId,
              failures[0]?.reason || "Delegation rejected by authority.",
            );
          } else {
            await dependencies.approvals.approve(
              scoped.environment.id,
              existing.id,
              scoped.owner.userId,
              "allow_once",
            );
          }
        }
      } catch (apprErr) {
        app.log.warn({ apprErr }, "Could not sync proposal status to approval store");
      }
    }

    await dependencies.audit.append({
      environmentId: scoped.environment.id,
      actorType: "user",
      actorId: scoped.owner.userId,
      mandateId: parentMandate.id,
      eventType: finalStatus === "AUTHORIZED" ? "approval.approved" : "mandate.delegation_denied",
      outcome: finalStatus === "AUTHORIZED" ? "success" : "denied",
      reasonCode: finalStatus,
      payload: {
        approvalId,
        status: finalStatus,
        delegations: successes,
        failures,
      },
    });

    return reply.code(finalStatus === "FAILED" ? 400 : 200).send({
      status: finalStatus,
      approvalId,
      environmentId: scoped.environment.id,
      mandateId: parentMandate.id,
      delegations: successes,
      failures,
      totalDelegatedMinor,
      remainingReserveMinor,
      code: finalStatus === "FAILED" ? "DELEGATION_FAILED" : undefined,
      message: finalStatus === "FAILED" ? (failures[0]?.reason || "Authority rejected delegation.") : undefined,
    });
  }

  app.post<{
    Params: { environmentId: string; approvalId: string };
    Body: {
      decision?: "allow_once" | "allow" | "deny";
      allowedChildAgents?: string[];
      permittedActions?: string[];
      maxBudgetMinor?: number;
      maxDepth?: number;
      expiresAt?: string;
      mandateId?: string;
      currency?: string;
      proposedAllocations?: Array<{
        agent: string;
        role?: string;
        quotedCostMinor?: number;
        requestedMandateMinor: number;
        capabilities?: string[];
        description?: string;
        reasoning?: string;
        isChild?: boolean;
        parentAgent?: string;
      }>;
    };
  }>("/v1/environments/:environmentId/approvals/:approvalId/approve", async (request, reply) => {
    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      request.params.environmentId,
    );
    if (!scoped) return;

    if (scoped.owner.kind !== "user") {
      return reply.code(403).send({
        code: "USER_AUTHORITY_REQUIRED",
        message: "Approving requests is user-only.",
      });
    }

    // If this is a budget proposal delegation transaction:
    if (
      request.body?.proposedAllocations &&
      Array.isArray(request.body.proposedAllocations) &&
      request.body.proposedAllocations.length > 0
    ) {
      return handleBudgetProposalApproval(
        scoped,
        request.params.approvalId,
        request.body as Parameters<typeof handleBudgetProposalApproval>[2],
        reply,
      );
    }

    try {
      const existing = await dependencies.approvals.get(
        scoped.environment.id,
        request.params.approvalId,
      );
      if (!existing) {
        return reply
          .code(404)
          .send({ code: "APPROVAL_NOT_FOUND", message: "Approval request not found." });
      }

      let grantJti: string | undefined;
      const decisionType = request.body?.decision ?? "allow_once";

      // If approval is for a delegation request, create/bind a delegation grant
      if (existing.action.startsWith("mandate.delegate") || existing.action.startsWith("delegat")) {
        const parentMandate = await dependencies.authority.get(existing.mandateId, scoped.owner.userId);
        if (!parentMandate) {
          return reply
            .code(404)
            .send({ code: "MANDATE_NOT_FOUND", message: "Parent mandate not found." });
        }
        if (parentMandate.state === "revoked") {
          return reply
            .code(403)
            .send({ code: "MANDATE_REVOKED", message: "Parent mandate is revoked." });
        }
        if (new Date(parentMandate.expiresAt) <= new Date()) {
          return reply
            .code(403)
            .send({ code: "MANDATE_EXPIRED", message: "Parent mandate has expired." });
        }

        // Expiry capped at parent expiry
        let grantExpiresAt = request.body?.expiresAt ?? parentMandate.expiresAt;
        if (new Date(grantExpiresAt) > new Date(parentMandate.expiresAt)) {
          grantExpiresAt = parentMandate.expiresAt;
        }

        const grantMaxBudget = request.body?.maxBudgetMinor ?? existing.amountMinor;
        const grant = await dependencies.authority.createGrant({
          environmentId: scoped.environment.id,
          agentId: existing.agentId,
          parentMandateId: parentMandate.id,
          allowedChildAgents: request.body?.allowedChildAgents ?? ["*"],
          permittedActions: request.body?.permittedActions ?? parentMandate.permittedActions,
          maxBudgetMinor: grantMaxBudget,
          maxDepth: request.body?.maxDepth ?? parentMandate.maxDelegationDepth,
          approvalStrictness: decisionType === "allow" ? "allow" : "allow_once",
          expiresAt: grantExpiresAt,
          requestHash: existing.requestHash,
        });
        grantJti = grant.jti;
      }

      const approval = await dependencies.approvals.approve(
        scoped.environment.id,
        request.params.approvalId,
        scoped.owner.userId,
        decisionType,
        grantJti,
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
          decision: decisionType,
          grantJti: grantJti ?? null,
        },
      });

      return { approval, ...(grantJti ? { grantJti } : {}) };
    } catch (error) {
      return reply.code(400).send({
        code: error instanceof Error ? error.message : "APPROVAL_ACTION_FAILED",
        message: "Failed to approve request.",
      });
    }
  });

  // Direct approval endpoint without environmentId in path
  app.post<{
    Params: { approvalId: string };
    Body: {
      environmentId?: string;
      decision?: "allow_once" | "allow" | "deny";
      allowedChildAgents?: string[];
      permittedActions?: string[];
      maxBudgetMinor?: number;
      maxDepth?: number;
      expiresAt?: string;
      mandateId?: string;
      currency?: string;
      proposedAllocations?: Array<{
        agent: string;
        role?: string;
        quotedCostMinor?: number;
        requestedMandateMinor: number;
        capabilities?: string[];
        description?: string;
        reasoning?: string;
        isChild?: boolean;
        parentAgent?: string;
      }>;
    };
  }>("/v1/approvals/:approvalId/approve", async (request, reply) => {
    let targetEnvId = request.body?.environmentId;
    if (!targetEnvId) {
      const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
      if (!owner) return;
      const envs = await dependencies.registry.listEnvironments(owner.userId);
      const active = envs.find((e) => e.status === "active") || envs[0];
      if (!active) {
        return reply.code(404).send({
          code: "ENVIRONMENT_NOT_FOUND",
          message: "No active environment found for user.",
        });
      }
      targetEnvId = active.id;
    }

    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      targetEnvId,
    );
    if (!scoped) return;

    if (scoped.owner.kind !== "user") {
      return reply.code(403).send({
        code: "USER_AUTHORITY_REQUIRED",
        message: "Approving requests is user-only.",
      });
    }

    if (
      request.body?.proposedAllocations &&
      Array.isArray(request.body.proposedAllocations) &&
      request.body.proposedAllocations.length > 0
    ) {
      return handleBudgetProposalApproval(
        scoped,
        request.params.approvalId,
        request.body as Parameters<typeof handleBudgetProposalApproval>[2],
        reply,
      );
    }

    try {
      const existing = await dependencies.approvals.get(
        scoped.environment.id,
        request.params.approvalId,
      );
      if (!existing) {
        return reply
          .code(404)
          .send({ code: "APPROVAL_NOT_FOUND", message: "Approval request not found." });
      }

      const decisionType = request.body?.decision ?? "allow_once";
      const approval = await dependencies.approvals.approve(
        scoped.environment.id,
        request.params.approvalId,
        scoped.owner.userId,
        decisionType,
      );

      return { approval };
    } catch (error) {
      return reply.code(400).send({
        code: error instanceof Error ? error.message : "APPROVAL_ACTION_FAILED",
        message: "Failed to approve request.",
      });
    }
  });

  app.post<{
    Params: { approvalId: string };
    Body: { reason?: string; environmentId?: string };
  }>("/v1/approvals/:approvalId/reject", async (request, reply) => {
    let targetEnvId = request.body?.environmentId;
    if (!targetEnvId) {
      const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
      if (!owner) return;
      const envs = await dependencies.registry.listEnvironments(owner.userId);
      const active = envs.find((e) => e.status === "active") || envs[0];
      if (!active) {
        return reply.code(404).send({
          code: "ENVIRONMENT_NOT_FOUND",
          message: "No active environment found for user.",
        });
      }
      targetEnvId = active.id;
    }

    const scoped = await environmentFor(
      request as AppRequest,
      reply,
      dependencies.registry,
      dependencies.resolvePrincipal,
      targetEnvId,
    );
    if (!scoped) return;

    if (scoped.owner.kind !== "user") {
      return reply.code(403).send({
        code: "USER_AUTHORITY_REQUIRED",
        message: "Rejecting requests is user-only.",
      });
    }

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

    if (scoped.owner.kind !== "user") {
      return reply.code(403).send({
        code: "USER_AUTHORITY_REQUIRED",
        message: "Rejecting requests is user-only.",
      });
    }

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
