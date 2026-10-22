import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRootMandate,
  delegateMandate,
  evaluateMandate,
  revokeMandate,
  type DelegationRequest,
  type Mandate,
  type PolicyDecision,
} from "@payguardian/domain";

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
  delegate(
    parentId: string,
    input: DelegationRequest,
  ): Promise<{ mandate: Mandate | null; decision: PolicyDecision }>;
  revoke(id: string, issuerUserId: string): Promise<Mandate | null>;
  evaluate(id: string, input: AuthorityCheckInput, userId: string): Promise<PolicyDecision>;
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

  async delegate(
    parentId: string,
    input: DelegationRequest,
  ): Promise<{ mandate: Mandate | null; decision: PolicyDecision }> {
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
    const result = delegateMandate(
      parent,
      { ...input, id: randomUUID(), createdAt: new Date().toISOString() },
      new Date(),
    );
    if (result.mandate) this.mandates.set(result.mandate.id, result.mandate);
    return result;
  }

  async revoke(id: string, issuerUserId: string): Promise<Mandate | null> {
    const mandate = this.mandates.get(id);
    if (!mandate || mandate.issuerUserId !== issuerUserId) return null;
    const revokedAt = new Date();
    for (const candidate of this.mandates.values()) {
      if (this.descendsFrom(candidate, id)) {
        this.mandates.set(candidate.id, revokeMandate(candidate, revokedAt));
      }
    }
    const current = this.mandates.get(id);
    if (!current) return null;
    const revoked = revokeMandate(current, revokedAt);
    this.mandates.set(id, revoked);
    return revoked;
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
    for (const item of chain) {
      const decision = evaluateMandate(item, { ...input, at: new Date() });
      if (!decision.allowed) return decision;
    }
    return { allowed: true, code: "ALLOW", reason: "The full mandate chain permits this action." };
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
        p_can_delegate: input.canDelegate,
        p_max_delegation_depth: input.maxDelegationDepth,
        p_approval_required: input.approvalRequired,
        p_content_hash: mandateContentHash(input),
      })
      .single();
    if (error) throw error;
    return mapMandate(data as SupabaseMandateRow);
  }

  async get(id: string, userId?: string): Promise<Mandate | null> {
    let query = this.client
      .from("mandates")
      .select(
        "id,environment_id,issuer_user_id,holder_agent_id,parent_mandate_id,budget_limit_minor,allocated_minor,spent_minor,reserved_minor,currency,permitted_actions,expires_at,can_delegate,max_delegation_depth,approval_required,state,revoked_at,created_at",
      )
      .eq("id", id);
    if (userId) query = query.eq("issuer_user_id", userId);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapMandate(data as SupabaseMandateRow) : null;
  }

  async list(environmentId: string, userId: string): Promise<Mandate[]> {
    const { data, error } = await this.client
      .from("mandates")
      .select(
        "id,environment_id,issuer_user_id,holder_agent_id,parent_mandate_id,budget_limit_minor,allocated_minor,spent_minor,reserved_minor,currency,permitted_actions,expires_at,can_delegate,max_delegation_depth,approval_required,state,revoked_at,created_at",
      )
      .eq("environment_id", environmentId)
      .eq("issuer_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => mapMandate(row as SupabaseMandateRow));
  }

  async delegate(
    parentId: string,
    input: DelegationRequest,
  ): Promise<{ mandate: Mandate | null; decision: PolicyDecision }> {
    const parent = await this.get(parentId, input.issuerUserId);
    const { data, error } = await this.client
      .rpc("delegate_mandate", {
        p_parent_mandate_id: parentId,
        p_issuer_user_id: input.issuerUserId,
        p_holder_agent_id: input.holderAgentId,
        p_budget_limit_minor: input.budgetLimitMinor,
        p_currency: input.currency,
        p_permitted_actions: input.permittedActions,
        p_expires_at: input.expiresAt,
        p_can_delegate: input.canDelegate,
        p_max_delegation_depth: input.maxDelegationDepth,
        p_approval_required: input.approvalRequired,
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

  async revoke(id: string, issuerUserId: string): Promise<Mandate | null> {
    const { data, error } = await this.client
      .rpc("revoke_mandate", {
        p_mandate_id: id,
        p_issuer_user_id: issuerUserId,
      })
      .maybeSingle();
    if (error) throw error;
    return data ? mapMandate(data as SupabaseMandateRow) : null;
  }

  async evaluate(id: string, input: AuthorityCheckInput, userId: string): Promise<PolicyDecision> {
    const { data, error } = await this.client.rpc("get_mandate_chain_for_user", {
      p_mandate_id: id,
      p_user_id: userId,
    });
    if (error) throw error;
    const chain = Array.isArray(data)
      ? data.map((row) => mapMandate(row as SupabaseMandateRow))
      : [];
    if (chain.length === 0)
      return { allowed: false, code: "MANDATE_NOT_FOUND", reason: "Mandate not found." };
    for (const mandate of chain) {
      const decision = evaluateMandate(mandate, { ...input, at: new Date() });
      if (!decision.allowed) return decision;
    }
    return { allowed: true, code: "ALLOW", reason: "The full mandate chain permits this action." };
  }
}

function mapMandate(row: SupabaseMandateRow): Mandate {
  return {
    id: String(row.id),
    issuerUserId: String(row.issuer_user_id),
    environmentId: String(row.environment_id),
    holderAgentId: String(row.holder_agent_id),
    parentMandateId: row.parent_mandate_id ? String(row.parent_mandate_id) : null,
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
  return new InMemoryAuthorityStore();
}
