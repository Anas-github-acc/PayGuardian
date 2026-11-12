import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type Principal =
  | {
      userId: string;
      kind: "user";
      agentId?: undefined;
    }
  | {
      userId: string;
      kind: "agent";
      agentId: string;
    };

export type EnvironmentStatus = "active" | "paused" | "closed" | "revoked";
export type AgentStatus = "active" | "disabled" | "revoked";
export type AgentKind =
  "personal" | "travel" | "hotel" | "transport" | "food" | "activities" | "custom";

export type Environment = {
  id: string;
  ownerUserId: string;
  name: string;
  purpose: string;
  currency: string;
  budgetLimitMinor: number;
  status: EnvironmentStatus;
  createdAt: string;
};

export type Agent = {
  id: string;
  environmentId: string;
  ownerUserId: string;
  parentAgentId: string | null;
  name: string;
  kind: AgentKind;
  status: AgentStatus;
  capabilities: string[];
  createdAt: string;
};

export type AgentCredential = {
  id: string;
  agentId: string;
  secretHash: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type CreatedCredential = {
  id: string;
  agentId: string;
  secret: string;
  expiresAt: string;
};

export type Registry = {
  listEnvironments(userId: string): Promise<Environment[]>;
  createEnvironment(input: Omit<Environment, "id" | "createdAt" | "status">): Promise<Environment>;
  getEnvironment(userId: string, environmentId: string): Promise<Environment | null>;
  deleteEnvironment(userId: string, environmentId: string): Promise<boolean>;
  setEnvironmentStatus(
    userId: string,
    environmentId: string,
    status: Extract<EnvironmentStatus, "active" | "paused" | "revoked">,
  ): Promise<Environment | null>;
  listAgents(userId: string, environmentId: string): Promise<Agent[]>;
  getAgent(userId: string, agentId: string): Promise<Agent | null>;
  setAgentStatus(
    userId: string,
    agentId: string,
    status: Extract<AgentStatus, "disabled" | "revoked">,
  ): Promise<Agent | null>;
  createAgent(
    input: Omit<Agent, "id" | "createdAt" | "status">,
  ): Promise<{ agent: Agent; credential: CreatedCredential }>;
  rotateAgentCredential(userId: string, agentId: string): Promise<CreatedCredential | null>;
  revokeAgentCredential(userId: string, agentId: string, credentialId: string): Promise<boolean>;
  verifyAgentCredential(
    secret: string,
  ): Promise<{ agent: Agent; credential: AgentCredential } | null>;
};

function now(): string {
  return new Date().toISOString();
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function createCredential(agentId: string): {
  credential: AgentCredential;
  created: CreatedCredential;
} {
  const secret = `pg_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();
  const id = randomUUID();
  return {
    credential: { id, agentId, secretHash: hashSecret(secret), expiresAt, revokedAt: null },
    created: { id, agentId, secret, expiresAt },
  };
}

export class InMemoryRegistry implements Registry {
  private readonly environments = new Map<string, Environment>();
  private readonly agents = new Map<string, Agent>();
  private readonly credentials = new Map<string, AgentCredential>();
  private readonly filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
    this.load();
  }

  private load(): void {
    if (!this.filePath) return;
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data.environments)) {
          for (const env of data.environments) {
            this.environments.set(env.id, env);
          }
        }
        if (Array.isArray(data.agents)) {
          for (const ag of data.agents) {
            this.agents.set(ag.id, ag);
          }
        }
        if (Array.isArray(data.credentials)) {
          for (const cr of data.credentials) {
            this.credentials.set(cr.id, cr);
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
        environments: [...this.environments.values()],
        agents: [...this.agents.values()],
        credentials: [...this.credentials.values()],
      };
      writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // ignore
    }
  }

  async listEnvironments(userId: string): Promise<Environment[]> {
    return [...this.environments.values()].filter((item) => item.ownerUserId === userId);
  }

  async createEnvironment(
    input: Omit<Environment, "id" | "createdAt" | "status">,
  ): Promise<Environment> {
    const environment: Environment = {
      ...input,
      id: randomUUID(),
      createdAt: now(),
      status: "active",
    };
    this.environments.set(environment.id, environment);
    this.persist();
    return environment;
  }

  async getEnvironment(userId: string, environmentId: string): Promise<Environment | null> {
    const environment = this.environments.get(environmentId);
    return environment?.ownerUserId === userId ? environment : null;
  }

  async deleteEnvironment(userId: string, environmentId: string): Promise<boolean> {
    const environment = this.environments.get(environmentId);
    if (!environment || environment.ownerUserId !== userId) {
      return false;
    }
    this.environments.delete(environmentId);
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.environmentId === environmentId) {
        this.agents.delete(agentId);
        for (const [credId, cred] of this.credentials.entries()) {
          if (cred.agentId === agentId) {
            this.credentials.delete(credId);
          }
        }
      }
    }
    this.persist();
    return true;
  }

  async setEnvironmentStatus(
    userId: string,
    environmentId: string,
    status: Extract<EnvironmentStatus, "active" | "paused" | "revoked">,
  ): Promise<Environment | null> {
    const environment = await this.getEnvironment(userId, environmentId);
    if (!environment) return null;
    if (environment.status === "closed" || environment.status === "revoked") {
      if (environment.status === status) return environment;
      throw new Error("INVALID_ENVIRONMENT_TRANSITION");
    }
    if (environment.status === "active" && status === "active") return environment;
    if (environment.status === "paused" && status === "paused") return environment;
    environment.status = status;
    this.environments.set(environment.id, environment);
    this.persist();
    return environment;
  }

  async listAgents(userId: string, environmentId: string): Promise<Agent[]> {
    return [...this.agents.values()].filter(
      (item) => item.ownerUserId === userId && item.environmentId === environmentId,
    );
  }

  async getAgent(userId: string, agentId: string): Promise<Agent | null> {
    const agent = this.agents.get(agentId);
    return agent?.ownerUserId === userId ? agent : null;
  }

  async setAgentStatus(
    userId: string,
    agentId: string,
    status: Extract<AgentStatus, "disabled" | "revoked">,
  ): Promise<Agent | null> {
    const agent = await this.getAgent(userId, agentId);
    if (!agent) return null;
    if (agent.status === "revoked") {
      if (status === "revoked") return agent;
      throw new Error("INVALID_AGENT_TRANSITION");
    }

    const descendants = new Set<string>([agent.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of this.agents.values()) {
        if (
          candidate.ownerUserId === userId &&
          candidate.environmentId === agent.environmentId &&
          candidate.parentAgentId &&
          descendants.has(candidate.parentAgentId) &&
          !descendants.has(candidate.id)
        ) {
          descendants.add(candidate.id);
          changed = true;
        }
      }
    }

    for (const descendantId of descendants) {
      const candidate = this.agents.get(descendantId);
      if (!candidate || candidate.status === "revoked") continue;
      candidate.status = status;
      this.agents.set(candidate.id, candidate);
    }
    this.persist();
    return this.agents.get(agent.id) ?? null;
  }

  async createAgent(input: Omit<Agent, "id" | "createdAt" | "status">) {
    const agent: Agent = { ...input, id: randomUUID(), createdAt: now(), status: "active" };
    const { credential, created } = createCredential(agent.id);
    this.agents.set(agent.id, agent);
    this.credentials.set(credential.id, credential);
    this.persist();
    return { agent, credential: created };
  }

  async rotateAgentCredential(userId: string, agentId: string): Promise<CreatedCredential | null> {
    const agent = await this.getAgent(userId, agentId);
    if (!agent || agent.status !== "active") return null;
    const { credential, created } = createCredential(agent.id);
    this.credentials.set(credential.id, credential);
    this.persist();
    return created;
  }

  async revokeAgentCredential(
    userId: string,
    agentId: string,
    credentialId: string,
  ): Promise<boolean> {
    const agent = await this.getAgent(userId, agentId);
    if (!agent) return false;
    const credential = this.credentials.get(credentialId);
    if (!credential || credential.agentId !== agent.id) return false;
    credential.revokedAt = now();
    this.credentials.set(credential.id, credential);
    this.persist();
    return true;
  }

  async verifyAgentCredential(
    secret: string,
  ): Promise<{ agent: Agent; credential: AgentCredential } | null> {
    const secretHash = hashSecret(secret);
    for (const cred of this.credentials.values()) {
      if (cred.secretHash === secretHash) {
        if (cred.revokedAt !== null || new Date(cred.expiresAt).getTime() <= Date.now()) {
          return null;
        }
        const agent = this.agents.get(cred.agentId);
        if (!agent || agent.status !== "active") return null;
        return { agent, credential: cred };
      }
    }
    return null;
  }
}

export class SupabaseRegistry implements Registry {
  constructor(private readonly client: SupabaseClient) {}

  async listEnvironments(userId: string): Promise<Environment[]> {
    const { data, error } = await this.client
      .from("environments")
      .select("id,owner_user_id,name,purpose,currency,budget_limit_minor,status,created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapEnvironment);
  }

  async createEnvironment(
    input: Omit<Environment, "id" | "createdAt" | "status">,
  ): Promise<Environment> {
    const { data, error } = await this.client
      .rpc("create_environment_with_owner", {
        p_owner_user_id: input.ownerUserId,
        p_name: input.name,
        p_purpose: input.purpose,
        p_currency: input.currency,
        p_budget_limit_minor: input.budgetLimitMinor,
      })
      .single();
    if (error) throw error;
    return mapEnvironment(data as Record<string, unknown>);
  }

  async getEnvironment(userId: string, environmentId: string): Promise<Environment | null> {
    const { data, error } = await this.client
      .from("environments")
      .select("id,owner_user_id,name,purpose,currency,budget_limit_minor,status,created_at")
      .eq("owner_user_id", userId)
      .eq("id", environmentId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapEnvironment(data) : null;
  }

  async deleteEnvironment(userId: string, environmentId: string): Promise<boolean> {
    // 1. Try atomic database cascade function first
    try {
      const { data: rpcSuccess, error: rpcError } = await this.client.rpc(
        "delete_environment_cascade",
        {
          p_user_id: userId,
          p_environment_id: environmentId,
        },
      );
      if (!rpcError && typeof rpcSuccess === "boolean") {
        return rpcSuccess;
      }
    } catch {
      // Fallback to progressive child-first cleanup if RPC is not present
    }

    const env = await this.getEnvironment(userId, environmentId);
    if (!env) return false;

    // 2. Fallback progressive cleanup:
    // Remove chatbot task events & runs
    const { data: runs } = await this.client
      .from("agent_runs")
      .select("id")
      .eq("environment_id", environmentId);
    const runIds = (runs || []).map((r: { id: string }) => r.id);
    if (runIds.length > 0) {
      await this.client.from("agent_events").delete().in("run_id", runIds);
      await this.client
        .from("agent_tasks")
        .update({ parent_task_id: null, mandate_id: null })
        .in("run_id", runIds);
      await this.client.from("agent_tasks").delete().in("run_id", runIds);
      await this.client.from("agent_runs").delete().eq("environment_id", environmentId);
    }

    // Remove conversations & messages
    const { data: convs } = await this.client
      .from("conversations")
      .select("id")
      .eq("environment_id", environmentId);
    const convIds = (convs || []).map((c: { id: string }) => c.id);
    if (convIds.length > 0) {
      await this.client.from("messages").delete().in("conversation_id", convIds);
      await this.client.from("conversations").delete().eq("environment_id", environmentId);
    }

    // Remove delegation grants
    await this.client.from("delegation_grants").delete().eq("environment_id", environmentId);

    // Remove provider jobs, events, operations
    await this.client.from("provider_jobs").delete().eq("environment_id", environmentId);
    await this.client.from("provider_events").delete().eq("environment_id", environmentId);
    await this.client.from("provider_operations").delete().eq("environment_id", environmentId);

    // Remove protected actions & reservations
    const { data: actions } = await this.client
      .from("protected_actions")
      .select("id")
      .eq("environment_id", environmentId);
    const actionIds = (actions || []).map((a: { id: string }) => a.id);
    if (actionIds.length > 0) {
      await this.client.from("reservations").delete().in("action_id", actionIds);
      await this.client.from("protected_actions").delete().eq("environment_id", environmentId);
    }

    // Remove ledger accounts & transitions & transfers
    await this.client
      .from("ledger_balance_transitions")
      .delete()
      .eq("environment_id", environmentId);
    await this.client.from("ledger_transfers").delete().eq("environment_id", environmentId);
    await this.client
      .from("ledger_accounts")
      .update({ parent_account_id: null })
      .eq("environment_id", environmentId);
    await this.client.from("ledger_accounts").delete().eq("environment_id", environmentId);

    // Remove mandates
    await this.client
      .from("mandates")
      .update({ parent_mandate_id: null, previous_mandate_id: null, issuer_agent_id: null })
      .eq("environment_id", environmentId);
    await this.client.from("mandates").delete().eq("environment_id", environmentId);

    // Remove credentials & agents
    const { data: agents } = await this.client
      .from("agents")
      .select("id")
      .eq("environment_id", environmentId);
    const agentIds = (agents || []).map((a: { id: string }) => a.id);
    if (agentIds.length > 0) {
      await this.client.from("agent_credentials").delete().in("agent_id", agentIds);
      await this.client
        .from("agents")
        .update({ parent_agent_id: null })
        .eq("environment_id", environmentId);
      await this.client.from("agents").delete().eq("environment_id", environmentId);
    }

    // Remove policies & memberships
    await this.client.from("policies").delete().eq("environment_id", environmentId);
    await this.client.from("environment_memberships").delete().eq("environment_id", environmentId);

    // Finally delete environment
    const { error } = await this.client
      .from("environments")
      .delete()
      .eq("owner_user_id", userId)
      .eq("id", environmentId);
    if (error) throw error;
    return true;
  }

  async setEnvironmentStatus(
    userId: string,
    environmentId: string,
    status: Extract<EnvironmentStatus, "active" | "paused" | "revoked">,
  ): Promise<Environment | null> {
    const current = await this.getEnvironment(userId, environmentId);
    if (!current) return null;
    if (current.status === "closed" || current.status === "revoked") {
      if (current.status === status) return current;
      throw new Error("INVALID_ENVIRONMENT_TRANSITION");
    }
    if (current.status === status) return current;
    const { data, error } = await this.client
      .from("environments")
      .update({ status })
      .eq("owner_user_id", userId)
      .eq("id", environmentId)
      .select("id,owner_user_id,name,purpose,currency,budget_limit_minor,status,created_at")
      .maybeSingle();
    if (error) throw error;
    return data ? mapEnvironment(data) : null;
  }

  async listAgents(userId: string, environmentId: string): Promise<Agent[]> {
    const { data, error } = await this.client
      .from("agents")
      .select(
        "id,environment_id,owner_user_id,parent_agent_id,name,kind,status,capabilities,created_at",
      )
      .eq("owner_user_id", userId)
      .eq("environment_id", environmentId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapAgent);
  }

  async getAgent(userId: string, agentId: string): Promise<Agent | null> {
    const { data, error } = await this.client
      .from("agents")
      .select(
        "id,environment_id,owner_user_id,parent_agent_id,name,kind,status,capabilities,created_at",
      )
      .eq("owner_user_id", userId)
      .eq("id", agentId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAgent(data) : null;
  }

  async setAgentStatus(
    userId: string,
    agentId: string,
    status: Extract<AgentStatus, "disabled" | "revoked">,
  ): Promise<Agent | null> {
    const agent = await this.getAgent(userId, agentId);
    if (!agent) return null;
    if (agent.status === "revoked") {
      if (status === "revoked") return agent;
      throw new Error("INVALID_AGENT_TRANSITION");
    }
    const agents = await this.listAgents(userId, agent.environmentId);
    const affected = new Set<string>([agent.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of agents) {
        if (
          candidate.parentAgentId &&
          affected.has(candidate.parentAgentId) &&
          !affected.has(candidate.id)
        ) {
          affected.add(candidate.id);
          changed = true;
        }
      }
    }
    const mutableAgentIds = agents
      .filter((candidate) => affected.has(candidate.id) && candidate.status !== "revoked")
      .map((candidate) => candidate.id);
    const { error } = await this.client
      .from("agents")
      .update({ status })
      .eq("owner_user_id", userId)
      .in("id", mutableAgentIds);
    if (error) throw error;
    return this.getAgent(userId, agent.id);
  }

  async createAgent(input: Omit<Agent, "id" | "createdAt" | "status">) {
    const { credential, created } = createCredential(randomUUID());
    const { data, error } = await this.client
      .rpc("create_agent_with_credential", {
        p_environment_id: input.environmentId,
        p_owner_user_id: input.ownerUserId,
        p_parent_agent_id: input.parentAgentId,
        p_name: input.name,
        p_kind: input.kind,
        p_capabilities: input.capabilities,
        p_credential_id: credential.id,
        p_secret_hash: credential.secretHash,
        p_expires_at: credential.expiresAt,
      })
      .single();
    if (error) throw error;
    const row = data as Record<string, unknown>;
    return { agent: mapAgent(row), credential: { ...created, agentId: String(row.id) } };
  }

  async rotateAgentCredential(userId: string, agentId: string): Promise<CreatedCredential | null> {
    const agent = await this.getAgent(userId, agentId);
    if (!agent || agent.status !== "active") return null;
    const { credential, created } = createCredential(agent.id);
    const { error } = await this.client.from("agent_credentials").insert({
      id: credential.id,
      agent_id: credential.agentId,
      secret_hash: credential.secretHash,
      expires_at: credential.expiresAt,
    });
    if (error) throw error;
    return created;
  }

  async revokeAgentCredential(
    userId: string,
    agentId: string,
    credentialId: string,
  ): Promise<boolean> {
    const agent = await this.getAgent(userId, agentId);
    if (!agent) return false;
    const { data, error } = await this.client
      .from("agent_credentials")
      .update({ revoked_at: now() })
      .eq("id", credentialId)
      .eq("agent_id", agent.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }

  async verifyAgentCredential(
    secret: string,
  ): Promise<{ agent: Agent; credential: AgentCredential } | null> {
    const secretHash = hashSecret(secret);
    const { data: credRow, error: credError } = await this.client
      .from("agent_credentials")
      .select("id,agent_id,secret_hash,expires_at,revoked_at")
      .eq("secret_hash", secretHash)
      .is("revoked_at", null)
      .gt("expires_at", now())
      .maybeSingle();
    if (credError || !credRow) return null;
    const { data: agentRow, error: agentError } = await this.client
      .from("agents")
      .select(
        "id,environment_id,owner_user_id,parent_agent_id,name,kind,status,capabilities,created_at",
      )
      .eq("id", (credRow as Record<string, unknown>).agent_id)
      .eq("status", "active")
      .maybeSingle();
    if (agentError || !agentRow) return null;
    const cRow = credRow as Record<string, unknown>;
    return {
      agent: mapAgent(agentRow as Record<string, unknown>),
      credential: {
        id: String(cRow.id),
        agentId: String(cRow.agent_id),
        secretHash: String(cRow.secret_hash),
        expiresAt: String(cRow.expires_at),
        revokedAt: cRow.revoked_at ? String(cRow.revoked_at) : null,
      },
    };
  }
}

function mapEnvironment(row: Record<string, unknown>): Environment {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    name: String(row.name),
    purpose: String(row.purpose),
    currency: String(row.currency),
    budgetLimitMinor: Number(row.budget_limit_minor),
    status: row.status as EnvironmentStatus,
    createdAt: String(row.created_at),
  };
}

function mapAgent(row: Record<string, unknown>): Agent {
  return {
    id: String(row.id),
    environmentId: String(row.environment_id),
    ownerUserId: String(row.owner_user_id),
    parentAgentId: row.parent_agent_id ? String(row.parent_agent_id) : null,
    name: String(row.name),
    kind: row.kind as AgentKind,
    status: row.status as AgentStatus,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities.map(String) : [],
    createdAt: String(row.created_at),
  };
}

export function createSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function createRegistry(): Registry {
  const mode = process.env.DATABASE_MODE ?? "memory";
  if (mode === "supabase") {
    const client = createSupabaseClient();
    if (!client)
      throw new Error("DATABASE_MODE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return new SupabaseRegistry(client);
  }
  const defaultPath = path.resolve(process.cwd(), ".data/registry.json");
  return new InMemoryRegistry(process.env.REGISTRY_STORAGE_FILE ?? defaultPath);
}
