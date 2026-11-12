import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ApprovalDecision = "allow_once" | "allow" | "deny";

export type Approval = {
  id: string;
  environmentId: string;
  mandateId: string;
  agentId: string;
  action: string;
  amountMinor: number;
  currency: string;
  requestHash: string;
  status: ApprovalStatus;
  decision?: ApprovalDecision | null;
  grantJti?: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateApprovalInput = {
  id?: string;
  environmentId: string;
  mandateId: string;
  agentId: string;
  action: string;
  amountMinor: number;
  currency: string;
  requestHash: string;
};

export interface ApprovalStore {
  create(input: CreateApprovalInput): Promise<Approval>;
  get(environmentId: string, id: string): Promise<Approval | null>;
  list(
    environmentId: string,
    filter?: { status?: ApprovalStatus; mandateId?: string },
  ): Promise<Approval[]>;
  approve(
    environmentId: string,
    id: string,
    userId: string,
    decision?: ApprovalDecision,
    grantJti?: string,
  ): Promise<Approval>;
  reject(environmentId: string, id: string, userId: string, reason?: string): Promise<Approval>;
  findByRequestHash(environmentId: string, requestHash: string): Promise<Approval | null>;
}

export class InMemoryApprovalStore implements ApprovalStore {
  private approvals = new Map<string, Approval>();

  async create(input: CreateApprovalInput): Promise<Approval> {
    const existing = await this.findByRequestHash(input.environmentId, input.requestHash);
    if (existing) return existing;

    const now = new Date().toISOString();
    const approval: Approval = {
      id: input.id ?? randomUUID(),
      environmentId: input.environmentId,
      mandateId: input.mandateId,
      agentId: input.agentId,
      action: input.action,
      amountMinor: input.amountMinor,
      currency: input.currency.toUpperCase(),
      requestHash: input.requestHash,
      status: "pending",
      decision: null,
      grantJti: null,
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.approvals.set(approval.id, approval);
    return approval;
  }

  async get(environmentId: string, id: string): Promise<Approval | null> {
    const approval = this.approvals.get(id);
    if (!approval || approval.environmentId !== environmentId) return null;
    return approval;
  }

  async list(
    environmentId: string,
    filter?: { status?: ApprovalStatus; mandateId?: string },
  ): Promise<Approval[]> {
    return [...this.approvals.values()].filter((item) => {
      if (item.environmentId !== environmentId) return false;
      if (filter?.status && item.status !== filter.status) return false;
      if (filter?.mandateId && item.mandateId !== filter.mandateId) return false;
      return true;
    });
  }

  async approve(
    environmentId: string,
    id: string,
    userId: string,
    decision: ApprovalDecision = "allow_once",
    grantJti?: string,
  ): Promise<Approval> {
    const approval = await this.get(environmentId, id);
    if (!approval) throw new Error("APPROVAL_NOT_FOUND");
    if (approval.status !== "pending") throw new Error("APPROVAL_ALREADY_DECIDED");

    const now = new Date().toISOString();
    const updated: Approval = {
      ...approval,
      status: "approved",
      decision,
      grantJti: grantJti ?? approval.grantJti ?? null,
      approvedBy: userId,
      approvedAt: now,
      updatedAt: now,
    };
    this.approvals.set(id, updated);
    return updated;
  }

  async reject(
    environmentId: string,
    id: string,
    userId: string,
    reason = "Rejected by user.",
  ): Promise<Approval> {
    const approval = await this.get(environmentId, id);
    if (!approval) throw new Error("APPROVAL_NOT_FOUND");
    if (approval.status !== "pending") throw new Error("APPROVAL_ALREADY_DECIDED");

    const now = new Date().toISOString();
    const updated: Approval = {
      ...approval,
      status: "rejected",
      approvedBy: userId,
      rejectionReason: reason,
      updatedAt: now,
    };
    this.approvals.set(id, updated);
    return updated;
  }

  async findByRequestHash(environmentId: string, requestHash: string): Promise<Approval | null> {
    for (const item of this.approvals.values()) {
      if (item.environmentId === environmentId && item.requestHash === requestHash) {
        return item;
      }
    }
    return null;
  }
}

export type SessionStatus = "active" | "paused" | "completed" | "cancelled";
export type RunStatus = "running" | "paused" | "completed" | "failed";

export type Session = {
  id: string;
  environmentId: string;
  agentId: string | null;
  name: string;
  status: SessionStatus;
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SessionRun = {
  id: string;
  sessionId: string;
  agentId: string;
  status: RunStatus;
  checkpoint: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateSessionInput = {
  environmentId: string;
  agentId?: string | null;
  name: string;
  context?: Record<string, unknown>;
};

export interface SessionStore {
  create(input: CreateSessionInput): Promise<Session>;
  get(environmentId: string, id: string): Promise<Session | null>;
  list(environmentId: string): Promise<Session[]>;
  update(
    environmentId: string,
    id: string,
    update: { status?: SessionStatus; context?: Record<string, unknown> },
  ): Promise<Session | null>;
  createRun(input: {
    sessionId: string;
    agentId: string;
    checkpoint?: Record<string, unknown>;
  }): Promise<SessionRun>;
  updateRun(
    runId: string,
    update: { status?: RunStatus; checkpoint?: Record<string, unknown> },
  ): Promise<SessionRun | null>;
  listRuns(sessionId: string): Promise<SessionRun[]>;
}

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();
  private runs = new Map<string, SessionRun>();

  async create(input: CreateSessionInput): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      environmentId: input.environmentId,
      agentId: input.agentId ?? null,
      name: input.name,
      status: "active",
      context: input.context ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async get(environmentId: string, id: string): Promise<Session | null> {
    const session = this.sessions.get(id);
    if (!session || session.environmentId !== environmentId) return null;
    return session;
  }

  async list(environmentId: string): Promise<Session[]> {
    return [...this.sessions.values()].filter((item) => item.environmentId === environmentId);
  }

  async update(
    environmentId: string,
    id: string,
    update: { status?: SessionStatus; context?: Record<string, unknown> },
  ): Promise<Session | null> {
    const session = await this.get(environmentId, id);
    if (!session) return null;

    const updated: Session = {
      ...session,
      status: update.status ?? session.status,
      context: update.context ? { ...session.context, ...update.context } : session.context,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(id, updated);
    return updated;
  }

  async createRun(input: {
    sessionId: string;
    agentId: string;
    checkpoint?: Record<string, unknown>;
  }): Promise<SessionRun> {
    const now = new Date().toISOString();
    const run: SessionRun = {
      id: randomUUID(),
      sessionId: input.sessionId,
      agentId: input.agentId,
      status: "running",
      checkpoint: input.checkpoint ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(run.id, run);
    return run;
  }

  async updateRun(
    runId: string,
    update: { status?: RunStatus; checkpoint?: Record<string, unknown> },
  ): Promise<SessionRun | null> {
    const run = this.runs.get(runId);
    if (!run) return null;

    const updated: SessionRun = {
      ...run,
      status: update.status ?? run.status,
      checkpoint: update.checkpoint ? { ...run.checkpoint, ...update.checkpoint } : run.checkpoint,
      updatedAt: new Date().toISOString(),
    };
    this.runs.set(runId, updated);
    return updated;
  }

  async listRuns(sessionId: string): Promise<SessionRun[]> {
    return [...this.runs.values()].filter((run) => run.sessionId === sessionId);
  }
}

export function createApprovalStore(_supabaseClient: SupabaseClient | null = null): ApprovalStore {
  void _supabaseClient;
  return new InMemoryApprovalStore();
}

export function createSessionStore(_supabaseClient: SupabaseClient | null = null): SessionStore {
  void _supabaseClient;
  return new InMemorySessionStore();
}
