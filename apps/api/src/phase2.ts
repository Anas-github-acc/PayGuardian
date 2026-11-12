import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRootMandate,
  delegateMandate,
  evaluateAuthorityChain,
  revokeMandate,
  topupMandate,
  type DelegationRequest,
  type Mandate,
  type PolicyDecision,
  type TopupRequest,
} from "@payguardian/domain";
import type { Principal } from "./phase1.js";

export type DelegationGrantStatus = "active" | "consumed" | "revoked" | "expired";

export type DelegationGrant = {
  jti: string;
  environmentId: string;
  agentId: string;
  parentMandateId: string;
  allowedChildAgents: string[];
  permittedActions: string[];
  maxBudgetMinor: number;
  amountUsedMinor: number;
  maxDepth: number;
  approvalStrictness: "allow_once" | "allow";
  expiresAt: string;
  status: DelegationGrantStatus;
  requestHash: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateDelegationGrantInput = {
  jti?: string;
  environmentId: string;
  agentId: string;
  parentMandateId: string;
  allowedChildAgents?: string[];
  permittedActions?: string[];
  maxBudgetMinor: number;
  maxDepth?: number;
  approvalStrictness: "allow_once" | "allow";
  expiresAt: string;
  requestHash: string;
};

export type RootMandateInput = {
  issuerUserId: string;
  environmentId: string;
  holderAgentId: string;
  budgetLimitMinor: number;
  currency: string;
  permittedActions: string[];
  expiresAt: string;
  canDelegate: boolean;
  maxDelegationDepth: number;
  approvalRequired: boolean;
};

export type AuthorityCheckInput = {
  action: string;
  amountMinor: number;
  currency: string;
  approvalGranted: boolean;
};

export type AuthorityStore = {
  createRoot(input: RootMandateInput): Promise<Mandate>;
  get(id: string, userId?: string): Promise<Mandate | null>;
  list(environmentId: string, userId: string): Promise<Mandate[]>;
  getChain(id: string, userId: string): Promise<Mandate[]>;
  delegate(
    parentId: string,
    input: DelegationRequest & {
      idempotencyKey?: string;
      grantJti?: string;
      caller?: Principal;
      supersedeExisting?: boolean;
    },
  ): Promise<{ mandate: Mandate | null; decision: PolicyDecision }>;
  topup?(
    parentId: string,
    input: TopupRequest & {
      issuerUserId: string;
      holderAgentId: string;
      idempotencyKey?: string;
      caller?: Principal;
      grantJti?: string;
    },
  ): Promise<{ mandate: Mandate | null; decision: PolicyDecision }>;
  findActiveChild?(parentId: string, holderAgentId: string): Promise<Mandate | null>;
  revoke(id: string, issuerUserId: string): Promise<Mandate | null>;
  evaluate(id: string, input: AuthorityCheckInput, userId: string): Promise<PolicyDecision>;
  createGrant(input: CreateDelegationGrantInput): Promise<DelegationGrant>;
  getGrant(jti: string): Promise<DelegationGrant | null>;
  findGrantByRequestHash(environmentId: string, requestHash: string): Promise<DelegationGrant | null>;
  revokeGrantsForParent(parentMandateId: string): Promise<void>;
};

export function mandateContentHash(
  input: RootMandateInput & { parentMandateId?: string | null },
): string {
  const canonical = JSON.stringify({
    environmentId: input.environmentId,
    holderAgentId: input.holderAgentId,
    parentMandateId: input.parentMandateId ?? null,
    budgetLimitMinor: input.budgetLimitMinor,
    currency: input.currency.toUpperCase(),
    permittedActions: [...input.permittedActions].sort(),
    expiresAt: input.expiresAt,
    canDelegate: input.canDelegate,
    maxDelegationDepth: input.maxDelegationDepth,
    approvalRequired: input.approvalRequired,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export class InMemoryAuthorityStore implements AuthorityStore {
  private readonly mandates = new Map<string, Mandate>();
  private readonly grants = new Map<string, DelegationGrant>();
  private readonly idempotentDelegations = new Map<string, Mandate>();
  private readonly locks = new Map<string, Promise<void>>();
  private readonly filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
    this.load();
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let release!: () => void;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, lock);
    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      release();
    }
  }

  private load(): void {
    if (!this.filePath) return;
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data.mandates)) {
          for (const m of data.mandates) {
            this.mandates.set(m.id, m);
          }
        }
        if (Array.isArray(data.grants)) {
          for (const g of data.grants) {
            this.grants.set(g.jti, g);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private persist(): void {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const data = {
        mandates: [...this.mandates.values()],
        grants: [...this.grants.values()],
      };
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // ignore
    }
  }

  async createGrant(input: CreateDelegationGrantInput): Promise<DelegationGrant> {
    const now = new Date().toISOString();
    const grant: DelegationGrant = {
      jti: input.jti ?? randomUUID(),
      environmentId: input.environmentId,
      agentId: input.agentId,
      parentMandateId: input.parentMandateId,
      allowedChildAgents: input.allowedChildAgents ?? [],
      permittedActions: input.permittedActions ?? [],
      maxBudgetMinor: input.maxBudgetMinor,
      amountUsedMinor: 0,
      maxDepth: input.maxDepth ?? 1,
      approvalStrictness: input.approvalStrictness,
      expiresAt: input.expiresAt,
      status: "active",
      requestHash: input.requestHash,
      createdAt: now,
      updatedAt: now,
    };
    this.grants.set(grant.jti, grant);
    this.persist();
    return grant;
  }

  async getGrant(jti: string): Promise<DelegationGrant | null> {
    return this.grants.get(jti) ?? null;
  }

  async findGrantByRequestHash(
    environmentId: string,
    requestHash: string,
  ): Promise<DelegationGrant | null> {
    for (const grant of this.grants.values()) {
      if (grant.environmentId === environmentId && grant.requestHash === requestHash) {
        return grant;
      }
    }
    return null;
  }

  async revokeGrantsForParent(parentMandateId: string): Promise<void> {
    const now = new Date().toISOString();
    for (const [jti, grant] of this.grants.entries()) {
      if (grant.parentMandateId === parentMandateId && grant.status === "active") {
        this.grants.set(jti, { ...grant, status: "revoked", updatedAt: now });
      }
    }
    this.persist();
  }

  async createRoot(input: RootMandateInput): Promise<Mandate> {
    const mandate = createRootMandate({
      id: randomUUID(),
      issuerUserId: input.issuerUserId,
      createdAt: new Date().toISOString(),
      constraints: {
        environmentId: input.environmentId,
        holderAgentId: input.holderAgentId,
        budgetLimitMinor: input.budgetLimitMinor,
        currency: input.currency,
        permittedActions: input.permittedActions,
        expiresAt: input.expiresAt,
        canDelegate: input.canDelegate,
        maxDelegationDepth: input.maxDelegationDepth,
        approvalRequired: input.approvalRequired,
      },
    });
    this.mandates.set(mandate.id, mandate);
    this.persist();
    return mandate;
  }

  async get(id: string, userId?: string): Promise<Mandate | null> {
    const mandate = this.mandates.get(id) ?? null;
    if (mandate && userId && mandate.issuerUserId !== userId) return null;
    return mandate;
  }

  async list(environmentId: string, userId: string): Promise<Mandate[]> {
    return [...this.mandates.values()].filter(
      (mandate) => mandate.environmentId === environmentId && mandate.issuerUserId === userId,
    );
  }

  async findActiveChild(parentId: string, holderAgentId: string): Promise<Mandate | null> {
    return (
      [...this.mandates.values()].find(
        (m) =>
          m.parentMandateId === parentId &&
          m.holderAgentId === holderAgentId &&
          m.state === "active",
      ) ?? null
    );
  }

  async delegate(
    parentId: string,
    input: DelegationRequest & {
      idempotencyKey?: string;
      grantJti?: string;
      caller?: Principal;
      supersedeExisting?: boolean;
    },
  ): Promise<{ mandate: Mandate | null; decision: PolicyDecision }> {
    return this.withLock(`${parentId}:${input.holderAgentId}`, async () => {
      // 1. Check idempotency if key provided
      if (input.idempotencyKey) {
        const idemKey = `${parentId}:${input.holderAgentId}:${input.idempotencyKey}`;
        const existing = this.idempotentDelegations.get(idemKey);
        if (existing) {
          return {
            mandate: existing,
            decision: { allowed: true, code: "ALLOW", reason: "Delegation returned from idempotent execution." },
          };
        }
      }

      const parent = this.mandates.get(parentId);
      if (!parent)
        return {
          mandate: null,
          decision: {
            allowed: false,
            code: "MANDATE_NOT_FOUND",
            reason: "Parent mandate not found.",
          },
        };

      if (parent.issuerUserId !== input.issuerUserId) {
        return {
          mandate: null,
          decision: {
            allowed: false,
            code: "MANDATE_NOT_FOUND",
            reason: "Parent mandate is not owned by the authenticated principal.",
          },
        };
      }

      // Caller verification
      if (input.caller) {
        if (input.caller.kind === "agent") {
          if (input.caller.agentId !== parent.holderAgentId) {
            return {
              mandate: null,
              decision: {
                allowed: false,
                code: "AGENT_IDENTITY_MISMATCH",
                reason: "Caller agent does not hold the parent mandate.",
              },
            };
          }
        }
      }

      // 2. Grant verification if grantJti provided
      let grant: DelegationGrant | null = null;
      if (input.grantJti) {
        grant = this.grants.get(input.grantJti) ?? null;
        if (!grant) {
          return {
            mandate: null,
            decision: {
              allowed: false,
              code: "GRANT_NOT_FOUND",
              reason: "Delegation grant not found.",
            },
          };
        }
        if (grant.environmentId !== parent.environmentId) {
          return {
            mandate: null,
            decision: {
              allowed: false,
              code: "AUTHORITY_TARGET_NOT_FOUND",
              reason: "Grant environment does not match parent mandate.",
            },
          };
        }
        if (input.caller && input.caller.kind === "agent" && grant.agentId !== input.caller.agentId) {
          return {
            mandate: null,
            decision: {
              allowed: false,
              code: "AGENT_IDENTITY_MISMATCH",
              reason: "Caller agent does not match delegation grant agent.",
            },
          };
        }
        if (grant.status !== "active") {
          return {
            mandate: null,
            decision: {
              allowed: false,
              code: "GRANT_INACTIVE",
              reason: `Delegation grant is ${grant.status}.`,
            },
          };
        }
        const now = new Date();
        if (new Date(grant.expiresAt) <= now || new Date(grant.expiresAt) > new Date(parent.expiresAt)) {
          grant.status = "expired";
          grant.updatedAt = now.toISOString();
          return {
            mandate: null,
            decision: {
              allowed: false,
              code: "GRANT_EXPIRED",
              reason: "Delegation grant has expired.",
            },
          };
        }
        if (
          grant.allowedChildAgents.length > 0 &&
          !grant.allowedChildAgents.includes("*") &&
          !grant.allowedChildAgents.includes(input.holderAgentId)
        ) {
          return {
            mandate: null,
            decision: {
              allowed: false,
              code: "CHILD_AGENT_NOT_ALLOWED_BY_GRANT",
              reason: "Child agent is not allowed by this delegation grant.",
            },
          };
        }
        if (!input.permittedActions.every((act) => grant!.permittedActions.includes(act))) {
          return {
            mandate: null,
            decision: {
              allowed: false,
              code: "ACTION_NOT_PERMITTED_BY_GRANT",
              reason: "Child actions exceed permitted actions on the delegation grant.",
            },
          };
        }
        if (input.maxDelegationDepth > grant.maxDepth) {
          return {
            mandate: null,
            decision: {
              allowed: false,
              code: "DELEGATION_DEPTH_EXCEEDED",
              reason: "Child delegation depth exceeds grant limit.",
            },
          };
        }
        if (grant.amountUsedMinor + input.budgetLimitMinor > grant.maxBudgetMinor) {
          return {
            mandate: null,
            decision: {
              allowed: false,
              code: "GRANT_BUDGET_EXCEEDED",
              reason: "Requested budget exceeds remaining grant capacity.",
            },
          };
        }
      }

      // Check if active child mandate already exists for this holder under parent
      const activeChild = [...this.mandates.values()].find(
        (m) =>
          m.parentMandateId === parentId &&
          m.holderAgentId === input.holderAgentId &&
          m.state === "active",
      );

      let result: { mandate: Mandate | null; decision: PolicyDecision };

      if (activeChild && !input.supersedeExisting) {
        // TOP-UP VERSIONING: incremental allocation
        result = topupMandate(
          parent,
          activeChild,
          {
            id: randomUUID(),
            additionalBudgetMinor: input.budgetLimitMinor,
            permittedActions: input.permittedActions,
            expiresAt: input.expiresAt,
            canDelegate: input.canDelegate,
            maxDelegationDepth: input.maxDelegationDepth,
            approvalRequired: input.approvalRequired,
            createdAt: new Date().toISOString(),
          },
          new Date(),
        );

        if (result.mandate) {
          // Update superseded state for previous version
          this.mandates.set(activeChild.id, activeChild);
          // Store new version
          this.mandates.set(result.mandate.id, result.mandate);
        }
      } else {
        // SUPERSEDE OR INITIAL DELEGATION
        const prevParentAllocated = parent.allocatedMinor;
        const prevChildState = activeChild?.state;
        const prevChildSupersededAt = activeChild?.supersededAt;
        const nowIso = new Date().toISOString();

        if (activeChild && input.supersedeExisting) {
          activeChild.state = "superseded";
          activeChild.supersededAt = nowIso;
          parent.allocatedMinor = Math.max(0, parent.allocatedMinor - activeChild.budgetLimitMinor);
          this.mandates.set(activeChild.id, activeChild);

          // Supersede any active descendants of this child
          for (const candidate of this.mandates.values()) {
            if (candidate.state === "active" && this.descendsFrom(candidate, activeChild.id)) {
              candidate.state = "superseded";
              candidate.supersededAt = nowIso;
              this.mandates.set(candidate.id, candidate);
            }
          }
        }

        // Also clean up any other active mandate for this holder in the same environment if superseding
        if (input.supersedeExisting) {
          for (const candidate of this.mandates.values()) {
            if (
              candidate.id !== activeChild?.id &&
              candidate.environmentId === parent.environmentId &&
              candidate.holderAgentId === input.holderAgentId &&
              candidate.state === "active"
            ) {
              candidate.state = "superseded";
              candidate.supersededAt = nowIso;
              this.mandates.set(candidate.id, candidate);
            }
          }
        }

        result = delegateMandate(
          parent,
          { ...input, id: randomUUID(), createdAt: nowIso },
          new Date(),
        );

        if (result.mandate) {
          if (activeChild) {
            result.mandate.mandateSeriesId = activeChild.mandateSeriesId || activeChild.id;
            result.mandate.version = (activeChild.version || 1) + 1;
            result.mandate.previousMandateId = activeChild.id;
          }
          this.mandates.set(result.mandate.id, result.mandate);
        } else if (activeChild && input.supersedeExisting) {
          // Roll back state on delegation failure
          parent.allocatedMinor = prevParentAllocated;
          activeChild.state = prevChildState!;
          activeChild.supersededAt = prevChildSupersededAt!;
          this.mandates.set(activeChild.id, activeChild);
        }
      }

      if (result.mandate) {
        if (grant) {
          const nowIso = new Date().toISOString();
          grant.amountUsedMinor += input.budgetLimitMinor;
          if (grant.approvalStrictness === "allow_once") {
            grant.status = "consumed";
          } else if (grant.amountUsedMinor >= grant.maxBudgetMinor) {
            grant.status = "consumed";
          }
          grant.updatedAt = nowIso;
        }
        this.persist();
        if (input.idempotencyKey) {
          const idemKey = `${parentId}:${input.holderAgentId}:${input.idempotencyKey}`;
          this.idempotentDelegations.set(idemKey, result.mandate);
        }
      }

      return result;
    });
  }

  async topup(
    parentId: string,
    input: TopupRequest & {
      issuerUserId: string;
      holderAgentId: string;
      idempotencyKey?: string;
      caller?: Principal;
      grantJti?: string;
    },
  ): Promise<{ mandate: Mandate | null; decision: PolicyDecision }> {
    const parent = this.mandates.get(parentId);
    return this.delegate(parentId, {
      ...input,
      budgetLimitMinor: input.additionalBudgetMinor,
      currency: parent?.currency ?? "INR",
      permittedActions: input.permittedActions ?? parent?.permittedActions ?? [],
      expiresAt: input.expiresAt ?? parent?.expiresAt ?? new Date(Date.now() + 86400000).toISOString(),
      canDelegate: input.canDelegate ?? false,
      maxDelegationDepth: input.maxDelegationDepth ?? 0,
      approvalRequired: input.approvalRequired ?? false,
    });
  }

  async revoke(id: string, issuerUserId: string): Promise<Mandate | null> {
    const mandate = this.mandates.get(id);
    if (!mandate || mandate.issuerUserId !== issuerUserId) return null;
    const revokedAt = new Date();
    await this.revokeGrantsForParent(id);
    for (const candidate of this.mandates.values()) {
      if (this.descendsFrom(candidate, id)) {
        await this.revokeGrantsForParent(candidate.id);
        this.mandates.set(candidate.id, revokeMandate(candidate, revokedAt));
      }
    }
    const current = this.mandates.get(id);
    if (!current) return null;
    const revoked = revokeMandate(current, revokedAt);
    this.mandates.set(id, revoked);
    this.persist();
    return revoked;
  }

  async getChain(id: string, userId: string): Promise<Mandate[]> {
    const mandate = this.mandates.get(id);
    if (!mandate || mandate.issuerUserId !== userId) return [];
    return this.chainFor(mandate);
  }

  async evaluate(id: string, input: AuthorityCheckInput, userId: string): Promise<PolicyDecision> {
    const mandate = this.mandates.get(id);
    if (!mandate)
      return { allowed: false, code: "MANDATE_NOT_FOUND", reason: "Mandate not found." };
    if (mandate.issuerUserId !== userId)
      return {
        allowed: false,
        code: "MANDATE_NOT_FOUND",
        reason: "Mandate is not owned by the authenticated principal.",
      };
    const chain = this.chainFor(mandate);
    return evaluateAuthorityChain(chain, id, { ...input, at: new Date() });
  }

  private chainFor(mandate: Mandate): Mandate[] {
    const result: Mandate[] = [];
    let current: Mandate | null = mandate;
    while (current) {
      result.unshift(current);
      current = current.parentMandateId
        ? (this.mandates.get(current.parentMandateId) ?? null)
        : null;
    }
    return result;
  }

  private descendsFrom(candidate: Mandate, ancestorId: string): boolean {
    let current = candidate.parentMandateId;
    while (current) {
      if (current === ancestorId) return true;
      current = this.mandates.get(current)?.parentMandateId ?? null;
    }
    return false;
  }
}

type SupabaseMandateRow = Record<string, unknown>;

type SupabaseDelegationResult = {
  mandate: SupabaseMandateRow | null;
  decision: PolicyDecision;
};

export class SupabaseAuthorityStore implements AuthorityStore {
  constructor(private readonly client: SupabaseClient) {}

  async createRoot(input: RootMandateInput): Promise<Mandate> {
    const { data, error } = await this.client
      .rpc("create_root_mandate", {
        p_environment_id: input.environmentId,
        p_issuer_user_id: input.issuerUserId,
        p_holder_agent_id: input.holderAgentId,
        p_budget_limit_minor: input.budgetLimitMinor,
        p_currency: input.currency,
        p_permitted_actions: input.permittedActions,
        p_expires_at: input.expiresAt,
        p_can_delegate: input.canDelegate ?? false,
        p_max_delegation_depth: input.maxDelegationDepth ?? 0,
        p_approval_required: input.approvalRequired ?? false,
        p_content_hash: mandateContentHash(input),
      })
      .single();
    if (error) throw error;
    return mapMandate(data as SupabaseMandateRow);
  }

  async get(id: string, userId?: string): Promise<Mandate | null> {
    let query = this.client
      .from("mandates")
      .select("*")
      .eq("id", id);
    if (userId) query = query.eq("issuer_user_id", userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapMandate(data as SupabaseMandateRow) : null;
  }

  async list(environmentId: string, userId: string): Promise<Mandate[]> {
    const { data, error } = await this.client
      .from("mandates")
      .select("*")
      .eq("environment_id", environmentId)
      .eq("issuer_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapMandate(row as SupabaseMandateRow));
  }

  async createGrant(input: CreateDelegationGrantInput): Promise<DelegationGrant> {
    const jti = input.jti ?? randomUUID();
    const { data, error } = await this.client
      .from("delegation_grants")
      .insert({
        jti,
        environment_id: input.environmentId,
        agent_id: input.agentId,
        parent_mandate_id: input.parentMandateId,
        allowed_child_agents: input.allowedChildAgents ?? [],
        permitted_actions: input.permittedActions ?? [],
        max_budget_minor: input.maxBudgetMinor,
        amount_used_minor: 0,
        max_depth: input.maxDepth ?? 1,
        approval_strictness: input.approvalStrictness,
        expires_at: input.expiresAt,
        status: "active",
        request_hash: input.requestHash,
      })
      .select()
      .single();
    if (error) throw error;
    return mapGrant(data);
  }

  async getGrant(jti: string): Promise<DelegationGrant | null> {
    const { data, error } = await this.client
      .from("delegation_grants")
      .select("*")
      .eq("jti", jti)
      .maybeSingle();
    if (error) throw error;
    return data ? mapGrant(data) : null;
  }

  async findGrantByRequestHash(
    environmentId: string,
    requestHash: string,
  ): Promise<DelegationGrant | null> {
    const { data, error } = await this.client
      .from("delegation_grants")
      .select("*")
      .eq("environment_id", environmentId)
      .eq("request_hash", requestHash)
      .maybeSingle();
    if (error) throw error;
    return data ? mapGrant(data) : null;
  }

  async revokeGrantsForParent(parentMandateId: string): Promise<void> {
    const { error } = await this.client
      .from("delegation_grants")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("parent_mandate_id", parentMandateId)
      .eq("status", "active");
    if (error) throw error;
  }

  async delegate(
    parentId: string,
    input: DelegationRequest & {
      idempotencyKey?: string;
      grantJti?: string;
      caller?: Principal;
      supersedeExisting?: boolean;
    },
  ): Promise<{ mandate: Mandate | null; decision: PolicyDecision }> {
    const parent = await this.get(parentId, input.issuerUserId);
    if (input.grantJti) {
      const { data, error } = await this.client
        .rpc("delegate_mandate_with_grant", {
          p_grant_jti: input.grantJti,
          p_idempotency_key: input.idempotencyKey ?? randomUUID(),
          p_caller_kind: input.caller?.kind ?? "user",
          p_caller_user_id: input.issuerUserId,
          p_caller_agent_id: input.caller?.agentId ?? null,
          p_parent_mandate_id: parentId,
          p_holder_agent_id: input.holderAgentId,
          p_budget_limit_minor: input.budgetLimitMinor,
          p_currency: input.currency,
          p_permitted_actions: input.permittedActions,
          p_expires_at: input.expiresAt,
          p_can_delegate: input.canDelegate ?? false,
          p_max_delegation_depth: input.maxDelegationDepth ?? 0,
          p_approval_required: input.approvalRequired ?? false,
          p_content_hash: mandateContentHash({
            ...input,
            environmentId: parent?.environmentId ?? "",
            parentMandateId: parentId,
          }),
        })
        .single<SupabaseDelegationResult>();
      if (error) throw error;
      return {
        mandate: data.mandate ? mapMandate(data.mandate) : null,
        decision: data.decision,
      };
    }

    let existingActive: SupabaseMandateRow[] | null = null;
    const nowIso = new Date().toISOString();
    const prevParentAllocated = parent?.allocatedMinor ?? 0;

    if (input.supersedeExisting) {
      const { data: activeList } = await this.client
        .from("mandates")
        .select("*")
        .eq("environment_id", parent?.environmentId ?? "")
        .eq("holder_agent_id", input.holderAgentId)
        .eq("state", "active");

      if (activeList && activeList.length > 0) {
        existingActive = activeList as SupabaseMandateRow[];
        for (const prev of existingActive) {
          await this.client
            .from("mandates")
            .update({ state: "superseded", superseded_at: nowIso })
            .eq("id", prev.id as string);

          if (prev.parent_mandate_id === parentId && parent) {
            const newAllocated = Math.max(0, parent.allocatedMinor - Number(prev.budget_limit_minor));
            await this.client
              .from("mandates")
              .update({ allocated_minor: newAllocated })
              .eq("id", parentId);
            parent.allocatedMinor = newAllocated;
          }

          await this.client
            .from("mandates")
            .update({ state: "superseded", superseded_at: nowIso })
            .eq("parent_mandate_id", prev.id as string)
            .eq("state", "active");
        }
      }
    }

    const { data, error } = await this.client
      .rpc("delegate_mandate", {
        p_parent_mandate_id: parentId,
        p_issuer_user_id: input.issuerUserId,
        p_holder_agent_id: input.holderAgentId,
        p_budget_limit_minor: input.budgetLimitMinor,
        p_currency: input.currency,
        p_permitted_actions: input.permittedActions,
        p_expires_at: input.expiresAt,
        p_can_delegate: input.canDelegate ?? false,
        p_max_delegation_depth: input.maxDelegationDepth ?? 0,
        p_approval_required: input.approvalRequired ?? false,
        p_content_hash: mandateContentHash({
          ...input,
          environmentId: parent?.environmentId ?? "",
          parentMandateId: parentId,
        }),
      })
      .single<SupabaseDelegationResult>();

    if (error) {
      if (existingActive && existingActive.length > 0) {
        for (const prev of existingActive) {
          await this.client
            .from("mandates")
            .update({ state: "active", superseded_at: null })
            .eq("id", prev.id as string);
        }
        if (parent) {
          await this.client
            .from("mandates")
            .update({ allocated_minor: prevParentAllocated })
            .eq("id", parentId);
        }
      }
      throw error;
    }

    if (!data.mandate) {
      if (existingActive && existingActive.length > 0) {
        for (const prev of existingActive) {
          await this.client
            .from("mandates")
            .update({ state: "active", superseded_at: null })
            .eq("id", prev.id as string);
        }
        if (parent) {
          await this.client
            .from("mandates")
            .update({ allocated_minor: prevParentAllocated })
            .eq("id", parentId);
        }
      }
      return {
        mandate: null,
        decision: data.decision,
      };
    }

    if (existingActive && existingActive.length > 0) {
      const prev = existingActive[0];
      const seriesId = (prev.mandate_series_id as string) || (prev.id as string);
      const nextVersion = ((prev.version as number) || 1) + 1;
      await this.client
        .from("mandates")
        .update({
          mandate_series_id: seriesId,
          version: nextVersion,
          previous_mandate_id: prev.id as string,
        })
        .eq("id", (data.mandate as any).id);
      (data.mandate as any).mandate_series_id = seriesId;
      (data.mandate as any).version = nextVersion;
      (data.mandate as any).previous_mandate_id = prev.id;
    }

    return {
      mandate: mapMandate(data.mandate),
      decision: data.decision,
    };
  }

  async revoke(id: string, issuerUserId: string): Promise<Mandate | null> {
    await this.revokeGrantsForParent(id);
    const { data, error } = await this.client
      .rpc("revoke_mandate", {
        p_mandate_id: id,
        p_issuer_user_id: issuerUserId,
      })
      .maybeSingle();
    if (error) throw error;
    return data ? mapMandate(data as SupabaseMandateRow) : null;
  }

  async getChain(id: string, userId: string): Promise<Mandate[]> {
    const { data, error } = await this.client.rpc("get_mandate_chain_for_user", {
      p_mandate_id: id,
      p_user_id: userId,
    });
    if (error) throw error;
    return Array.isArray(data) ? data.map((row) => mapMandate(row as SupabaseMandateRow)) : [];
  }

  async evaluate(id: string, input: AuthorityCheckInput, userId: string): Promise<PolicyDecision> {
    const chain = await this.getChain(id, userId);
    if (chain.length === 0)
      return { allowed: false, code: "MANDATE_NOT_FOUND", reason: "Mandate not found." };
    return evaluateAuthorityChain(chain, id, { ...input, at: new Date() });
  }
}

function mapGrant(row: Record<string, unknown>): DelegationGrant {
  return {
    jti: String(row.jti),
    environmentId: String(row.environment_id),
    agentId: String(row.agent_id),
    parentMandateId: String(row.parent_mandate_id),
    allowedChildAgents: Array.isArray(row.allowed_child_agents)
      ? row.allowed_child_agents.map(String)
      : [],
    permittedActions: Array.isArray(row.permitted_actions)
      ? row.permitted_actions.map(String)
      : [],
    maxBudgetMinor: Number(row.max_budget_minor),
    amountUsedMinor: Number(row.amount_used_minor),
    maxDepth: Number(row.max_depth),
    approvalStrictness: row.approval_strictness as DelegationGrant["approvalStrictness"],
    expiresAt: String(row.expires_at),
    status: row.status as DelegationGrant["status"],
    requestHash: String(row.request_hash),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapMandate(row: SupabaseMandateRow): Mandate {
  return {
    id: String(row.id),
    issuerUserId: String(row.issuer_user_id),
    environmentId: String(row.environment_id),
    holderAgentId: String(row.holder_agent_id),
    parentMandateId: row.parent_mandate_id ? String(row.parent_mandate_id) : null,
    mandateSeriesId: row.mandate_series_id ? String(row.mandate_series_id) : String(row.id),
    version: row.version !== undefined && row.version !== null ? Number(row.version) : 1,
    previousMandateId: row.previous_mandate_id ? String(row.previous_mandate_id) : null,
    supersededAt: row.superseded_at ? String(row.superseded_at) : null,
    budgetLimitMinor: Number(row.budget_limit_minor),
    allocatedMinor: Number(row.allocated_minor),
    spentMinor: Number(row.spent_minor),
    reservedMinor: Number(row.reserved_minor),
    currency: String(row.currency),
    permittedActions: Array.isArray(row.permitted_actions) ? row.permitted_actions.map(String) : [],
    expiresAt: String(row.expires_at),
    canDelegate: Boolean(row.can_delegate),
    maxDelegationDepth: Number(row.max_delegation_depth),
    approvalRequired: Boolean(row.approval_required),
    state: row.state as Mandate["state"],
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    createdAt: String(row.created_at),
  };
}

export function createAuthorityStore(client: SupabaseClient | null): AuthorityStore {
  if ((process.env.DATABASE_MODE ?? "memory") === "supabase") {
    if (!client)
      throw new Error("DATABASE_MODE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return new SupabaseAuthorityStore(client);
  }
  const defaultPath = path.resolve(process.cwd(), ".data/authority.json");
  return new InMemoryAuthorityStore(process.env.AUTHORITY_STORAGE_FILE ?? defaultPath);
}
