import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export type Principal = {
  userId: string;
  kind: "user";
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
    return environment;
  }

  async getEnvironment(userId: string, environmentId: string): Promise<Environment | null> {
    const environment = this.environments.get(environmentId);
    return environment?.ownerUserId === userId ? environment : null;
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
    return this.agents.get(agent.id) ?? null;
  }

  async createAgent(input: Omit<Agent, "id" | "createdAt" | "status">) {
    const agent: Agent = { ...input, id: randomUUID(), createdAt: now(), status: "active" };
    const { credential, created } = createCredential(agent.id);
    this.agents.set(agent.id, agent);
    this.credentials.set(credential.id, credential);
    return { agent, credential: created };
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
  return new InMemoryRegistry();
}
