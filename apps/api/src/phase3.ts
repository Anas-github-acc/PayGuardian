import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InMemoryLedger, type LedgerAccount, type Reservation } from "@payguardian/domain";

export type ProtectedAction = {
  id: string;
  environmentId: string;
  agentId: string;
  mandateId: string;
  idempotencyKey: string;
  requestHash: string;
  action: string;
  amountMinor: number;
  currency: string;
  authorizationState: string;
  executionState: string;
  createdAt: string;
};

export type LedgerStore = {
  createAccount(input: {
    environmentId: string;
    mandateId: string;
    parentAccountId: string | null;
    currency: string;
    availableMinor: number;
  }): Promise<LedgerAccount>;
  getAccount(environmentId: string, accountId: string): Promise<LedgerAccount | null>;
  allocate(input: {
    environmentId: string;
    parentAccountId: string;
    childAccountId: string;
    amountMinor: number;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<{ parent: LedgerAccount; child: LedgerAccount }>;
  authorizeAndReserve(input: {
    environmentId: string;
    agentId: string;
    mandateId: string;
    ledgerAccountId: string;
    idempotencyKey: string;
    requestHash: string;
    action: string;
    amountMinor: number;
    currency: string;
  }): Promise<{ action: ProtectedAction; reservation: Reservation }>;
  getAction(environmentId: string, actionId: string): Promise<ProtectedAction | null>;
  capture(environmentId: string, actionId: string): Promise<Reservation>;
  release(environmentId: string, actionId: string, reason: string): Promise<Reservation>;
  getReservation(environmentId: string, actionId: string): Promise<Reservation | null>;
};

function validateAmount(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly ledger = new InMemoryLedger();
  private readonly accountEnvironments = new Map<string, string>();
  private readonly actions = new Map<string, ProtectedAction>();
  private readonly actionKeys = new Map<string, string>();

  async createAccount(input: {
    environmentId: string;
    mandateId: string;
    parentAccountId: string | null;
    currency: string;
    availableMinor: number;
  }): Promise<LedgerAccount> {
    const account = this.ledger.createAccount({
      id: randomUUID(),
      parentId: input.parentAccountId,
      availableMinor: input.availableMinor,
    });
    this.accountEnvironments.set(account.id, input.environmentId);
    return account;
  }

  async getAccount(environmentId: string, accountId: string): Promise<LedgerAccount | null> {
    if (this.accountEnvironments.get(accountId) !== environmentId) return null;
    try {
      return this.ledger.getAccount(accountId);
    } catch {
      return null;
    }
  }

  async allocate(input: {
    environmentId: string;
    parentAccountId: string;
    childAccountId: string;
    amountMinor: number;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<{ parent: LedgerAccount; child: LedgerAccount }> {
    if (
      this.accountEnvironments.get(input.parentAccountId) !== input.environmentId ||
      this.accountEnvironments.get(input.childAccountId) !== input.environmentId
    ) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }
    const existing = this.actions.get(`allocation:${input.idempotencyKey}`);
    if (existing) {
      if (existing.requestHash !== input.requestHash) throw new Error("IDEMPOTENCY_CONFLICT");
      const parent = await this.getAccount(input.environmentId, input.parentAccountId);
      const child = await this.getAccount(input.environmentId, input.childAccountId);
      if (!parent || !child) throw new Error("ACCOUNT_NOT_FOUND");
      return { parent, child };
    }
    validateAmount(input.amountMinor);
    this.ledger.allocate(input.parentAccountId, input.childAccountId, input.amountMinor);
    this.actions.set(`allocation:${input.idempotencyKey}`, {
      id: `allocation:${input.idempotencyKey}`,
      environmentId: input.environmentId,
      agentId: "",
      mandateId: "",
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      action: "ledger.allocate",
      amountMinor: input.amountMinor,
      currency: "",
      authorizationState: "authorized",
      executionState: "succeeded",
      createdAt: new Date().toISOString(),
    });
    const parent = await this.getAccount(input.environmentId, input.parentAccountId);
    const child = await this.getAccount(input.environmentId, input.childAccountId);
    if (!parent || !child) throw new Error("ACCOUNT_NOT_FOUND");
    return { parent, child };
  }

  async authorizeAndReserve(input: {
    environmentId: string;
    agentId: string;
    mandateId: string;
    ledgerAccountId: string;
    idempotencyKey: string;
    requestHash: string;
    action: string;
    amountMinor: number;
    currency: string;
  }): Promise<{ action: ProtectedAction; reservation: Reservation }> {
    const key = `${input.agentId}:${input.idempotencyKey}`;
    const existingId = this.actionKeys.get(key);
    if (existingId) {
      const existing = this.actions.get(existingId);
      if (!existing || existing.requestHash !== input.requestHash)
        throw new Error("IDEMPOTENCY_CONFLICT");
      const reservation = this.ledger.reserve(
        existing.id,
        input.ledgerAccountId,
        input.amountMinor,
      );
      return { action: existing, reservation };
    }
    validateAmount(input.amountMinor);
    const id = randomUUID();
    const reservation = this.ledger.reserve(id, input.ledgerAccountId, input.amountMinor);
    const action: ProtectedAction = {
      id,
      environmentId: input.environmentId,
      agentId: input.agentId,
      mandateId: input.mandateId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      action: input.action,
      amountMinor: input.amountMinor,
      currency: input.currency,
      authorizationState: "authorized",
      executionState: "pending",
      createdAt: new Date().toISOString(),
    };
    this.actions.set(id, action);
    this.actionKeys.set(key, id);
    return { action, reservation };
  }

  async getAction(environmentId: string, actionId: string): Promise<ProtectedAction | null> {
    const action = this.actions.get(actionId);
    return action?.environmentId === environmentId ? action : null;
  }

  async capture(environmentId: string, actionId: string): Promise<Reservation> {
    const action = await this.getAction(environmentId, actionId);
    if (!action) throw new Error("ACTION_NOT_FOUND");
    action.executionState = "succeeded";
    return this.ledger.capture(actionId);
  }

  async release(environmentId: string, actionId: string, reason: string): Promise<Reservation> {
    if (!reason.trim()) throw new Error("RELEASE_REASON_REQUIRED");
    const action = await this.getAction(environmentId, actionId);
    if (!action) throw new Error("ACTION_NOT_FOUND");
    action.executionState = "failed";
    return this.ledger.release(actionId);
  }

  async getReservation(environmentId: string, actionId: string): Promise<Reservation | null> {
    const action = await this.getAction(environmentId, actionId);
    if (!action) return null;
    return this.ledger.getReservation(actionId);
  }
}

type Row = Record<string, unknown>;

export class SupabaseLedgerStore implements LedgerStore {
  constructor(private readonly client: SupabaseClient) {}

  async createAccount(input: {
    environmentId: string;
    mandateId: string;
    parentAccountId: string | null;
    currency: string;
    availableMinor: number;
  }): Promise<LedgerAccount> {
    const { data, error } = await this.client
      .rpc("create_ledger_account", {
        p_environment_id: input.environmentId,
        p_mandate_id: input.mandateId,
        p_parent_account_id: input.parentAccountId,
        p_currency: input.currency,
        p_available_minor: input.availableMinor,
      })
      .single();
    if (error) throw error;
    return mapAccount(data as Row);
  }

  async getAccount(environmentId: string, accountId: string): Promise<LedgerAccount | null> {
    const { data, error } = await this.client
      .from("ledger_accounts")
      .select("id,parent_account_id,available_minor,reserved_minor,captured_minor")
      .eq("environment_id", environmentId)
      .eq("id", accountId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAccount(data as Row) : null;
  }

  async allocate(input: {
    environmentId: string;
    parentAccountId: string;
    childAccountId: string;
    amountMinor: number;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<{ parent: LedgerAccount; child: LedgerAccount }> {
    const { error } = await this.client.rpc("allocate_budget_idempotent", {
      p_environment_id: input.environmentId,
      p_parent_account_id: input.parentAccountId,
      p_child_account_id: input.childAccountId,
      p_amount_minor: input.amountMinor,
      p_idempotency_key: input.idempotencyKey,
      p_request_hash: input.requestHash,
    });
    if (error) throw error;
    const [parent, child] = await Promise.all([
      this.getAccount(input.environmentId, input.parentAccountId),
      this.getAccount(input.environmentId, input.childAccountId),
    ]);
    if (!parent || !child) throw new Error("ACCOUNT_NOT_FOUND");
    return { parent, child };
  }

  async authorizeAndReserve(input: {
    environmentId: string;
    agentId: string;
    mandateId: string;
    ledgerAccountId: string;
    idempotencyKey: string;
    requestHash: string;
    action: string;
    amountMinor: number;
    currency: string;
  }): Promise<{ action: ProtectedAction; reservation: Reservation }> {
    const { data, error } = await this.client
      .rpc("authorize_and_reserve_action", {
        p_environment_id: input.environmentId,
        p_agent_id: input.agentId,
        p_mandate_id: input.mandateId,
        p_ledger_account_id: input.ledgerAccountId,
        p_idempotency_key: input.idempotencyKey,
        p_request_hash: input.requestHash,
        p_action: input.action,
        p_amount_minor: input.amountMinor,
        p_currency: input.currency,
      })
      .single();
    if (error) throw error;
    const row = data as Row;
    return {
      action: mapAction(row.action as Row),
      reservation: mapReservation(row.reservation as Row),
    };
  }

  async getAction(environmentId: string, actionId: string): Promise<ProtectedAction | null> {
    const { data, error } = await this.client
      .from("protected_actions")
      .select(
        "id,environment_id,agent_id,mandate_id,idempotency_key,request_hash,action,amount_minor,currency,authorization_state,execution_state,created_at",
      )
      .eq("environment_id", environmentId)
      .eq("id", actionId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAction(data as Row) : null;
  }

  async capture(environmentId: string, actionId: string): Promise<Reservation> {
    const { data, error } = await this.client.rpc("capture_reservation", {
      p_environment_id: environmentId,
      p_action_id: actionId,
    });
    if (error) throw error;
    return mapReservation(data as Row);
  }

  async release(environmentId: string, actionId: string, reason: string): Promise<Reservation> {
    const { data, error } = await this.client.rpc("release_reservation", {
      p_environment_id: environmentId,
      p_action_id: actionId,
      p_reason: reason,
    });
    if (error) throw error;
    return mapReservation(data as Row);
  }

  async getReservation(environmentId: string, actionId: string): Promise<Reservation | null> {
    const { data, error } = await this.client
      .from("reservations")
      .select("action_id,ledger_account_id,amount_minor,state")
      .eq("action_id", actionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const action = await this.getAction(environmentId, actionId);
    return action ? mapReservation(data as Row) : null;
  }
}

function mapAccount(row: Row): LedgerAccount {
  return {
    id: String(row.id),
    parentId: row.parent_account_id ? String(row.parent_account_id) : null,
    availableMinor: Number(row.available_minor),
    reservedMinor: Number(row.reserved_minor),
    capturedMinor: Number(row.captured_minor),
  };
}

function mapAction(row: Row): ProtectedAction {
  return {
    id: String(row.id),
    environmentId: String(row.environment_id),
    agentId: String(row.agent_id),
    mandateId: String(row.mandate_id),
    idempotencyKey: String(row.idempotency_key),
    requestHash: String(row.request_hash),
    action: String(row.action),
    amountMinor: Number(row.amount_minor),
    currency: String(row.currency),
    authorizationState: String(row.authorization_state),
    executionState: String(row.execution_state),
    createdAt: String(row.created_at),
  };
}

function mapReservation(row: Row): Reservation {
  return {
    actionId: String(row.action_id),
    accountId: String(row.ledger_account_id ?? row.account_id),
    amountMinor: Number(row.amount_minor),
    state: row.state as Reservation["state"],
  };
}

export function createLedgerStore(client: SupabaseClient | null): LedgerStore {
  if ((process.env.DATABASE_MODE ?? "memory") === "supabase") {
    if (!client)
      throw new Error("DATABASE_MODE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return new SupabaseLedgerStore(client);
  }
  return new InMemoryLedgerStore();
}
