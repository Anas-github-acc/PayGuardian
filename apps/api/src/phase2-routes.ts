import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrincipalResolver } from "./auth.js";
import type { Principal, Registry } from "./phase1.js";
import { mandateContentHash, type AuthorityStore } from "./phase2.js";
import type { LedgerStore } from "./phase3.js";
import type { ApprovalStore } from "./phase4.js";
import type { AuditEventStore } from "./audit.js";

type AppRequest = FastifyRequest & { principal?: Principal };

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
    ledger?: LedgerStore;
    approvals?: ApprovalStore;
    resolvePrincipal: PrincipalResolver;
    audit: AuditEventStore;
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
    if (owner.kind !== "user") {
      return reply.code(403).send({
        code: "USER_AUTHORITY_REQUIRED",
        message: "Root mandate creation is user-only.",
      });
    }
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
    if (environment.status !== "active") {
      return reply.code(409).send({
        code: "ENVIRONMENT_NOT_ACTIVE",
        message: "Mandate creation requires an active environment.",
      });
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
      await dependencies.audit.append({
        environmentId: environment.id,
        actorType: "user",
        actorId: owner.userId,
        mandateId: mandate.id,
        eventType: "mandate.created",
        outcome: "success",
        payload: {
          holderAgentId: mandate.holderAgentId,
          budgetLimitMinor: mandate.budgetLimitMinor,
        },
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
      agentId?: string;
      holderAgentId: string;
      budgetLimitMinor: number;
      currency: string;
      permittedActions: string[];
      expiresAt: string;
      canDelegate: boolean;
      maxDelegationDepth: number;
      approvalRequired: boolean;
      idempotencyKey?: string;
      grantJti?: string;
    };
  }>("/v1/mandates/:mandateId/delegations", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;

    // STAGE 1: Agent identity derivation & spoofing check
    if (owner.kind === "agent") {
      if (request.body.agentId && request.body.agentId !== owner.agentId) {
        return reply.code(403).send({
          code: "AGENT_IDENTITY_MISMATCH",
          message: "Supplied agentId does not match authenticated agent credentials.",
        });
      }
    }

    const parent = await dependencies.authority.get(request.params.mandateId, owner.userId);
    if (!parent) {
      return reply
        .code(404)
        .send({ code: "AUTHORITY_TARGET_NOT_FOUND", message: "Parent mandate not found." });
    }

    // Agent caller must equal the parent mandate's holderAgentId
    if (owner.kind === "agent") {
      if (owner.agentId !== parent.holderAgentId) {
        return reply.code(403).send({
          code: "AGENT_IDENTITY_MISMATCH",
          message: "Authenticated agent does not hold the parent mandate.",
        });
      }
    }

    const child = await dependencies.registry.getAgent(owner.userId, request.body.holderAgentId);
    if (!child || child.environmentId !== parent.environmentId) {
      return reply.code(404).send({
        code: "AUTHORITY_TARGET_NOT_FOUND",
        message: "Child agent not found in mandate environment.",
      });
    }
    if (child.status !== "active") {
      return reply.code(403).send({
        code: "DELEGATION_TARGET_INVALID",
        message: "Child agent is not active in the mandate environment.",
      });
    }

    // Enforce hierarchical child relationships at Gateway level:
    // 1. A sub-mandate can only delegate to agents registered directly under its holder agent.
    if (parent.parentMandateId && child.parentAgentId !== parent.holderAgentId) {
      return reply.code(403).send({
        code: "DELEGATION_TARGET_INVALID",
        message: "Child agent must be registered under the delegating parent agent.",
      });
    }
    // 2. Root orchestrator cannot directly delegate to nested sub-agents (prevent bypassing parent coordinator)
    if (!parent.parentMandateId && child.parentAgentId) {
      const parentAgent = await dependencies.registry.getAgent(owner.userId, child.parentAgentId);
      if (parentAgent && parentAgent.kind !== "personal" && parentAgent.parentAgentId !== null) {
        return reply.code(403).send({
          code: "DELEGATION_TARGET_INVALID",
          message:
            "Root mandate cannot directly delegate to nested child agents; delegate through the parent coordinator.",
        });
      }
    }

    const environment = await dependencies.registry.getEnvironment(
      owner.userId,
      parent.environmentId,
    );
    if (!environment) {
      return reply.code(404).send({
        code: "AUTHORITY_TARGET_NOT_FOUND",
        message: "Environment not found.",
      });
    }
    if (environment.status !== "active") {
      return reply.code(409).send({
        code: "ENVIRONMENT_NOT_ACTIVE",
        message: "Delegation requires an active environment.",
      });
    }

    // Fail-closed authorization: verify wallet integrity before allowing delegation
    if (dependencies.ledger) {
      const parentAccount = await dependencies.ledger.getAccountByMandate(
        parent.environmentId,
        parent.id,
      );
      if (parentAccount) {
        const integrity = await dependencies.ledger.verifyAccountIntegrity(
          parent.environmentId,
          parentAccount.id,
        );
        if (!integrity.valid) {
          const decision = {
            allowed: false,
            code: "WALLET_INTEGRITY_VIOLATION" as const,
            reason: `Wallet integrity verification failed: ${integrity.reason}`,
          };
          await dependencies.audit.append({
            environmentId: parent.environmentId,
            actorType: owner.kind,
            actorId: owner.kind === "agent" ? owner.agentId : owner.userId,
            mandateId: parent.id,
            eventType: "mandate.delegation_denied",
            outcome: "denied",
            reasonCode: "WALLET_INTEGRITY_VIOLATION",
            payload: {
              holderAgentId: child.id,
              budgetLimitMinor: request.body.budgetLimitMinor,
              integrityFailureReason: integrity.reason ?? null,
            },
          });
          return reply.code(403).send({ decision });
        }
      }

      const envIntegrity = await dependencies.ledger.verifyEnvironmentIntegrity(
        parent.environmentId,
      );
      if (!envIntegrity.valid) {
        const decision = {
          allowed: false,
          code: "WALLET_INTEGRITY_VIOLATION" as const,
          reason: `Environment wallet integrity verification failed: ${envIntegrity.reason}`,
        };
        await dependencies.audit.append({
          environmentId: parent.environmentId,
          actorType: owner.kind,
          actorId: owner.kind === "agent" ? owner.agentId : owner.userId,
          mandateId: parent.id,
          eventType: "mandate.delegation_denied",
          outcome: "denied",
          reasonCode: "WALLET_INTEGRITY_VIOLATION",
          payload: {
            holderAgentId: child.id,
            budgetLimitMinor: request.body.budgetLimitMinor,
            integrityFailureReason: envIntegrity.reason ?? null,
          },
        });
        return reply.code(403).send({ decision });
      }
    }

    const result = await dependencies.authority.delegate(request.params.mandateId, {
      issuerUserId: owner.userId,
      ...request.body,
      holderAgentId: child.id,
      currency: request.body.currency.toUpperCase(),
      caller: owner,
      idempotencyKey: request.body.idempotencyKey,
      grantJti: request.body.grantJti,
    });

    if (result.mandate && dependencies.ledger) {
      if (
        result.mandate.version &&
        result.mandate.version > 1 &&
        result.mandate.previousMandateId
      ) {
        if (dependencies.ledger.linkMandateVersion) {
          dependencies.ledger.linkMandateVersion(
            parent.environmentId,
            result.mandate.id,
            result.mandate.previousMandateId,
          );
        }
        const childAcc = await dependencies.ledger.getAccountByMandate(
          parent.environmentId,
          result.mandate.previousMandateId,
        );
        const parentAcc = await dependencies.ledger.getAccountByMandate(
          parent.environmentId,
          parent.id,
        );
        if (childAcc && parentAcc) {
          try {
            await dependencies.ledger.allocate({
              environmentId: parent.environmentId,
              parentAccountId: parentAcc.id,
              childAccountId: childAcc.id,
              amountMinor: request.body.budgetLimitMinor,
              idempotencyKey: request.body.idempotencyKey ?? `topup:${result.mandate.id}`,
              requestHash: mandateContentHash({
                issuerUserId: owner.userId,
                environmentId: parent.environmentId,
                holderAgentId: child.id,
                budgetLimitMinor: request.body.budgetLimitMinor,
                currency: request.body.currency ?? parent.currency,
                permittedActions: request.body.permittedActions ?? parent.permittedActions,
                expiresAt: request.body.expiresAt ?? parent.expiresAt,
                canDelegate: request.body.canDelegate ?? false,
                maxDelegationDepth: request.body.maxDelegationDepth ?? 0,
                approvalRequired: request.body.approvalRequired ?? false,
                parentMandateId: parent.id,
              }),
            });
          } catch {
            // ledger allocation logged or skipped if already processed
          }
        }
      }
    }

    const isTopup = Boolean(result.mandate && result.mandate.version && result.mandate.version > 1);
    await dependencies.audit.append({
      environmentId: parent.environmentId,
      actorType: owner.kind,
      actorId: owner.kind === "agent" ? owner.agentId : owner.userId,
      mandateId: result.mandate?.id ?? parent.id,
      eventType: result.mandate
        ? isTopup
          ? "mandate.topped_up"
          : "mandate.delegated"
        : "mandate.delegation_denied",
      outcome: result.mandate ? "success" : "denied",
      reasonCode: result.decision.code,
      payload: {
        holderAgentId: child.id,
        budgetLimitMinor: request.body.budgetLimitMinor,
        grantJti: request.body.grantJti ?? null,
        ...(result.mandate
          ? {
              version: result.mandate.version,
              mandateSeriesId: result.mandate.mandateSeriesId,
              previousMandateId: result.mandate.previousMandateId,
              totalBudgetLimitMinor: result.mandate.budgetLimitMinor,
            }
          : {}),
      },
    });
    return reply
      .code(result.decision.allowed ? 201 : 403)
      .send(
        result.mandate
          ? { mandate: result.mandate, decision: result.decision }
          : { decision: result.decision },
      );
  });

  app.post<{
    Params: { mandateId: string };
    Body: {
      holderAgentId: string;
      additionalBudgetMinor: number;
      currency?: string;
      permittedActions?: string[];
      expiresAt?: string;
      canDelegate?: boolean;
      maxDelegationDepth?: number;
      approvalRequired?: boolean;
      idempotencyKey?: string;
      grantJti?: string;
    };
  }>("/v1/mandates/:mandateId/topups", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;

    const parent = await dependencies.authority.get(request.params.mandateId, owner.userId);
    if (!parent) {
      return reply
        .code(404)
        .send({ code: "AUTHORITY_TARGET_NOT_FOUND", message: "Parent mandate not found." });
    }

    const child = await dependencies.registry.getAgent(owner.userId, request.body.holderAgentId);
    if (!child || child.environmentId !== parent.environmentId) {
      return reply.code(404).send({
        code: "AUTHORITY_TARGET_NOT_FOUND",
        message: "Child agent not found in mandate environment.",
      });
    }

    const result = await dependencies.authority.delegate(request.params.mandateId, {
      issuerUserId: owner.userId,
      holderAgentId: child.id,
      budgetLimitMinor: request.body.additionalBudgetMinor,
      currency: (request.body.currency ?? parent.currency).toUpperCase(),
      permittedActions: request.body.permittedActions ?? parent.permittedActions,
      expiresAt: request.body.expiresAt ?? parent.expiresAt,
      canDelegate: request.body.canDelegate ?? false,
      maxDelegationDepth: request.body.maxDelegationDepth ?? 0,
      approvalRequired: request.body.approvalRequired ?? false,
      caller: owner,
      idempotencyKey: request.body.idempotencyKey,
      grantJti: request.body.grantJti,
    });

    if (result.mandate && dependencies.ledger && result.mandate.previousMandateId) {
      if (dependencies.ledger.linkMandateVersion) {
        dependencies.ledger.linkMandateVersion(
          parent.environmentId,
          result.mandate.id,
          result.mandate.previousMandateId,
        );
      }
      const childAcc = await dependencies.ledger.getAccountByMandate(
        parent.environmentId,
        result.mandate.previousMandateId,
      );
      const parentAcc = await dependencies.ledger.getAccountByMandate(
        parent.environmentId,
        parent.id,
      );
      if (childAcc && parentAcc) {
        try {
          await dependencies.ledger.allocate({
            environmentId: parent.environmentId,
            parentAccountId: parentAcc.id,
            childAccountId: childAcc.id,
            amountMinor: request.body.additionalBudgetMinor,
            idempotencyKey: request.body.idempotencyKey ?? `topup:${result.mandate.id}`,
            requestHash: mandateContentHash({
              issuerUserId: owner.userId,
              environmentId: parent.environmentId,
              holderAgentId: child.id,
              budgetLimitMinor: request.body.additionalBudgetMinor,
              currency: request.body.currency ?? parent.currency,
              permittedActions: request.body.permittedActions ?? parent.permittedActions,
              expiresAt: request.body.expiresAt ?? parent.expiresAt,
              canDelegate: request.body.canDelegate ?? false,
              maxDelegationDepth: request.body.maxDelegationDepth ?? 0,
              approvalRequired: request.body.approvalRequired ?? false,
              parentMandateId: parent.id,
            }),
          });
        } catch {
          // ignore
        }
      }
    }

    await dependencies.audit.append({
      environmentId: parent.environmentId,
      actorType: owner.kind,
      actorId: owner.kind === "agent" ? owner.agentId : owner.userId,
      mandateId: result.mandate?.id ?? parent.id,
      eventType: result.mandate ? "mandate.topped_up" : "mandate.delegation_denied",
      outcome: result.mandate ? "success" : "denied",
      reasonCode: result.decision.code,
      payload: {
        holderAgentId: child.id,
        additionalBudgetMinor: request.body.additionalBudgetMinor,
        ...(result.mandate
          ? {
              version: result.mandate.version,
              mandateSeriesId: result.mandate.mandateSeriesId,
              previousMandateId: result.mandate.previousMandateId,
              totalBudgetLimitMinor: result.mandate.budgetLimitMinor,
            }
          : {}),
      },
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
      if (owner.kind !== "user") {
        return reply.code(403).send({
          code: "USER_AUTHORITY_REQUIRED",
          message: "Mandate revocation is user-only.",
        });
      }
      const mandate = await dependencies.authority.revoke(request.params.mandateId, owner.userId);
      if (!mandate)
        return reply.code(404).send({ code: "MANDATE_NOT_FOUND", message: "Mandate not found." });
      await dependencies.audit.append({
        environmentId: mandate.environmentId,
        actorType: "user",
        actorId: owner.userId,
        mandateId: mandate.id,
        eventType: "mandate.revoked",
        outcome: "success",
        payload: { revokedAt: mandate.revokedAt },
      });
      return { mandate };
    },
  );

  app.post<{
    Params: { mandateId: string };
    Body: { action: string; amountMinor: number; currency: string; approvalGranted?: boolean };
  }>("/v1/mandates/:mandateId/check", async (request, reply) => {
    const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
    if (!owner) return;

    if (dependencies.ledger) {
      const targetMandate = await dependencies.authority.get(
        request.params.mandateId,
        owner.userId,
      );
      if (targetMandate) {
        const targetAccount = await dependencies.ledger.getAccountByMandate(
          targetMandate.environmentId,
          targetMandate.id,
        );
        if (targetAccount) {
          const integrity = await dependencies.ledger.verifyAccountIntegrity(
            targetMandate.environmentId,
            targetAccount.id,
          );
          if (!integrity.valid) {
            return reply.code(403).send({
              decision: {
                allowed: false,
                code: "WALLET_INTEGRITY_VIOLATION",
                reason: `Wallet integrity verification failed: ${integrity.reason}`,
              },
            });
          }
        }
      }
    }

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

  app.get<{ Params: { mandateId: string } }>(
    "/v1/mandates/:mandateId/chain",
    async (request, reply) => {
      const owner = await principal(request as AppRequest, reply, dependencies.resolvePrincipal);
      if (!owner) return;
      const target = await dependencies.authority.get(request.params.mandateId, owner.userId);
      if (!target) {
        return reply.code(404).send({ code: "MANDATE_NOT_FOUND", message: "Mandate not found." });
      }
      const chain = await dependencies.authority.getChain(request.params.mandateId, owner.userId);
      return { chain };
    },
  );
}
