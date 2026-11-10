import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  InMemoryLedger,
  type IntegrityVerificationResult,
  type LedgerAccount,
  type LedgerTransition,
  type Reservation,
} from "@payguardian/domain";

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
  getAccountByMandate(environmentId: string, mandateId: string): Promise<LedgerAccount | null>;
  listAccounts(environmentId: string): Promise<LedgerAccount[]>;
  allocate(input: {
    environmentId: string;
    parentAccountId: string;
    childAccountId: string;
    amountMinor: number;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<{ parent: LedgerAccount; child: LedgerAccount }>;
  reclaim(input: {
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
  verifyAccountIntegrity(environmentId: string, accountId: string): Promise<IntegrityVerificationResult>;
  verifyEnvironmentIntegrity(environmentId: string): Promise<IntegrityVerificationResult>;
  getTransitions(environmentId: string, accountId: string): Promise<LedgerTransition[]>;
  tamperAccount?(environmentId: string, accountId: string, mutator: (acc: LedgerAccount) => void): Promise<void>;
  linkMandateVersion?(environmentId: string, newMandateId: string, existingMandateOrSeriesId: string): void;
};

function validateAmount(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly ledger = new InMemoryLedger();
  private readonly accountEnvironments = new Map<string, string>();
  private readonly mandateAccounts = new Map<string, string>();
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
      environmentId: input.environmentId,
    });
    this.accountEnvironments.set(account.id, input.environmentId);
    this.mandateAccounts.set(`${input.environmentId}:${input.mandateId}`, account.id);
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

  async getAccountByMandate(environmentId: string, mandateId: string): Promise<LedgerAccount | null> {
    const accountId = this.mandateAccounts.get(`${environmentId}:${mandateId}`);
    if (!accountId) return null;
    return this.getAccount(environmentId, accountId);
  }

  linkMandateVersion(environmentId: string, newMandateId: string, existingMandateOrSeriesId: string): void {
    const accountId = this.mandateAccounts.get(`${environmentId}:${existingMandateOrSeriesId}`);
    if (accountId) {
      this.mandateAccounts.set(`${environmentId}:${newMandateId}`, accountId);
    }
  }

  async verifyAccountIntegrity(
    environmentId: string,
    accountId: string,
  ): Promise<IntegrityVerificationResult> {
    if (this.accountEnvironments.get(accountId) !== environmentId) {
      return { valid: false, reason: "Account not found in environment.", transitionsVerified: 0 };
    }
    return this.ledger.verifyAccountIntegrity(accountId);
  }

  async verifyEnvironmentIntegrity(environmentId: string): Promise<IntegrityVerificationResult> {
    let total = 0;
    for (const [id, envId] of this.accountEnvironments.entries()) {
      if (envId === environmentId) {
        const res = this.ledger.verifyAccountIntegrity(id);
        if (!res.valid) return res;
        total += res.transitionsVerified;
      }
    }
    return { valid: true, transitionsVerified: total };
  }

  async getTransitions(environmentId: string, accountId: string): Promise<LedgerTransition[]> {
    if (this.accountEnvironments.get(accountId) !== environmentId) return [];
    return this.ledger.getTransitions(accountId);
  }

  async tamperAccount(
    environmentId: string,
    accountId: string,
    mutator: (acc: LedgerAccount) => void,
  ): Promise<void> {
    if (this.accountEnvironments.get(accountId) !== environmentId) throw new Error("ACCOUNT_NOT_FOUND");
    this.ledger.tamperAccount(accountId, mutator);
  }

  async listAccounts(environmentId: string): Promise<LedgerAccount[]> {
    const result: LedgerAccount[] = [];
    for (const [id, envId] of this.accountEnvironments.entries()) {
      if (envId === environmentId) {
        try {
          result.push(this.ledger.getAccount(id));
        } catch {
          // ignore
        }
      }
    }
    return result;
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

  async reclaim(input: {
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
    const existing = this.actions.get(`reclaim:${input.idempotencyKey}`);
    if (existing) {
      if (existing.requestHash !== input.requestHash) throw new Error("IDEMPOTENCY_CONFLICT");
      const parent = await this.getAccount(input.environmentId, input.parentAccountId);
      const child = await this.getAccount(input.environmentId, input.childAccountId);
      if (!parent || !child) throw new Error("ACCOUNT_NOT_FOUND");
      return { parent, child };
    }
    validateAmount(input.amountMinor);
    this.ledger.reclaim(input.parentAccountId, input.childAccountId, input.amountMinor);
    this.actions.set(`reclaim:${input.idempotencyKey}`, {
      id: `reclaim:${input.idempotencyKey}`,
      environmentId: input.environmentId,
      agentId: "",
      mandateId: "",
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      action: "ledger.reclaim",
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
    const integrity = await this.verifyAccountIntegrity(input.environmentId, input.ledgerAccountId);
    if (!integrity.valid) {
      throw new Error(`WALLET_INTEGRITY_VIOLATION: ${integrity.reason}`);
    }

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

  async getAccountByMandate(environmentId: string, mandateId: string): Promise<LedgerAccount | null> {
    const { data, error } = await this.client
      .from("ledger_accounts")
      .select("id,parent_account_id,available_minor,reserved_minor,captured_minor")
      .eq("environment_id", environmentId)
      .eq("mandate_id", mandateId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAccount(data as Row) : null;
  }

  async verifyAccountIntegrity(
    environmentId: string,
    accountId: string,
  ): Promise<IntegrityVerificationResult> {
    const { data, error } = await this.client.rpc("verify_ledger_account_integrity", {
      p_environment_id: environmentId,
      p_account_id: accountId,
    });
    if (error) throw error;
    if (data !== true) {
      return {
        valid: false,
        reason: "Cryptographic ledger balance record verification failed.",
        transitionsVerified: 0,
      };
    }
    return { valid: true, transitionsVerified: 1 };
  }

  async verifyEnvironmentIntegrity(environmentId: string): Promise<IntegrityVerificationResult> {
    const { data, error } = await this.client.rpc("verify_wallet_integrity", {
      p_environment_id: environmentId,
    });
    if (error) throw error;
    if (data !== true) {
      return {
        valid: false,
        reason: "Cryptographic ledger balance record verification failed for environment.",
        transitionsVerified: 0,
      };
    }
    return { valid: true, transitionsVerified: 1 };
  }

  async getTransitions(environmentId: string, accountId: string): Promise<LedgerTransition[]> {
    const { data, error } = await this.client
      .from("ledger_balance_transitions")
      .select("*")
      .eq("environment_id", environmentId)
      .eq("account_id", accountId)
      .order("sequence", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapTransition);
  }

  async listAccounts(environmentId: string): Promise<LedgerAccount[]> {
    const { data, error } = await this.client
      .from("ledger_accounts")
      .select("id,parent_account_id,available_minor,reserved_minor,captured_minor")
      .eq("environment_id", environmentId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapAccount(row as Row));
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

  async reclaim(input: {
    environmentId: string;
    parentAccountId: string;
    childAccountId: string;
    amountMinor: number;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<{ parent: LedgerAccount; child: LedgerAccount }> {
    const { error } = await this.client.rpc("reclaim_budget_idempotent", {
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

function mapTransition(row: Row): LedgerTransition {
  return {
    id: String(row.id),
    environmentId: row.environment_id ? String(row.environment_id) : undefined,
    accountId: String(row.account_id),
    sequence: Number(row.sequence),
    transitionType: row.transition_type as LedgerTransition["transitionType"],
    amountMinor: Number(row.amount_minor),
    balanceBefore: row.balance_before as LedgerTransition["balanceBefore"],
    balanceAfter: row.balance_after as LedgerTransition["balanceAfter"],
    referenceId: row.reference_id ? String(row.reference_id) : null,
    createdAt: String(row.created_at),
    previousHash: row.previous_hash ? String(row.previous_hash) : null,
    transitionHash: String(row.transition_hash),
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
