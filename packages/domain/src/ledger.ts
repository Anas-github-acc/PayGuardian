import { createHash, randomUUID } from "node:crypto";

export type LedgerAccount = {
  id: string;
  parentId: string | null;
  availableMinor: number;
  reservedMinor: number;
  capturedMinor: number;
};

export type Reservation = {
  actionId: string;
  accountId: string;
  amountMinor: number;
  state: "held" | "captured" | "released";
};

export type BalanceState = {
  availableMinor: number;
  reservedMinor: number;
  capturedMinor: number;
};

export type LedgerTransitionType =
  | "create"
  | "allocation_in"
  | "allocation_out"
  | "reclaim_in"
  | "reclaim_out"
  | "reserve"
  | "capture"
  | "release";

export type LedgerTransition = {
  id: string;
  environmentId?: string;
  accountId: string;
  sequence: number;
  transitionType: LedgerTransitionType;
  amountMinor: number;
  balanceBefore: BalanceState;
  balanceAfter: BalanceState;
  referenceId: string | null;
  createdAt: string;
  previousHash: string | null;
  transitionHash: string;
};

export type IntegrityVerificationResult = {
  valid: boolean;
  reason?: string;
  transitionsVerified: number;
};

export class LedgerError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ACCOUNT_NOT_FOUND"
      | "INVALID_AMOUNT"
      | "INSUFFICIENT_AVAILABLE"
      | "RESERVATION_CONFLICT"
      | "RESERVATION_NOT_FOUND"
      | "INVALID_STATE"
      | "WALLET_INTEGRITY_VIOLATION",
  ) {
    super(message);
  }
}

export function computeTransitionHash(
  transition: Omit<LedgerTransition, "transitionHash">,
): string {
  const canonical = JSON.stringify({
    accountId: transition.accountId,
    amountMinor: transition.amountMinor,
    balanceAfter: {
      availableMinor: transition.balanceAfter.availableMinor,
      capturedMinor: transition.balanceAfter.capturedMinor,
      reservedMinor: transition.balanceAfter.reservedMinor,
    },
    balanceBefore: {
      availableMinor: transition.balanceBefore.availableMinor,
      capturedMinor: transition.balanceBefore.capturedMinor,
      reservedMinor: transition.balanceBefore.reservedMinor,
    },
    createdAt: new Date(transition.createdAt).toISOString(),
    environmentId: transition.environmentId ?? null,
    id: transition.id,
    previousHash: transition.previousHash,
    referenceId: transition.referenceId ?? null,
    sequence: transition.sequence,
    transitionType: transition.transitionType,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function verifyWalletIntegrity(
  account: LedgerAccount,
  transitions: readonly LedgerTransition[],
): IntegrityVerificationResult {
  if (transitions.length === 0) {
    if (
      account.availableMinor === 0 &&
      account.reservedMinor === 0 &&
      account.capturedMinor === 0
    ) {
      return { valid: true, transitionsVerified: 0 };
    }
    return {
      valid: false,
      reason: "No cryptographic balance transitions recorded for funded account.",
      transitionsVerified: 0,
    };
  }

  let expectedPreviousHash: string | null = null;
  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    if (t.accountId !== account.id) {
      return {
        valid: false,
        reason: `Transition account ID mismatch at sequence ${t.sequence}: expected ${account.id}, got ${t.accountId}.`,
        transitionsVerified: i,
      };
    }
    if (t.sequence !== i + 1) {
      return {
        valid: false,
        reason: `Sequence gap or mismatch at index ${i}: expected ${i + 1}, got ${t.sequence}.`,
        transitionsVerified: i,
      };
    }
    if (t.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        reason: `Previous hash mismatch at sequence ${t.sequence}: expected ${expectedPreviousHash}, got ${t.previousHash}.`,
        transitionsVerified: i,
      };
    }
    const computed = computeTransitionHash(t);
    if (t.transitionHash !== computed) {
      return {
        valid: false,
        reason: `Transition hash mismatch at sequence ${t.sequence}: expected ${computed}, got ${t.transitionHash}.`,
        transitionsVerified: i,
      };
    }

    if (i === 0) {
      if (
        t.balanceBefore.availableMinor !== 0 ||
        t.balanceBefore.reservedMinor !== 0 ||
        t.balanceBefore.capturedMinor !== 0
      ) {
        return {
          valid: false,
          reason: "Initial transition must start from zero balance.",
          transitionsVerified: i,
        };
      }
    } else {
      const prev = transitions[i - 1];
      if (
        t.balanceBefore.availableMinor !== prev.balanceAfter.availableMinor ||
        t.balanceBefore.reservedMinor !== prev.balanceAfter.reservedMinor ||
        t.balanceBefore.capturedMinor !== prev.balanceAfter.capturedMinor
      ) {
        return {
          valid: false,
          reason: `Balance discontinuity at sequence ${t.sequence}.`,
          transitionsVerified: i,
        };
      }
    }

    switch (t.transitionType) {
      case "create":
      case "allocation_in":
      case "reclaim_in":
        if (
          t.balanceAfter.availableMinor !== t.balanceBefore.availableMinor + t.amountMinor ||
          t.balanceAfter.reservedMinor !== t.balanceBefore.reservedMinor ||
          t.balanceAfter.capturedMinor !== t.balanceBefore.capturedMinor
        ) {
          return {
            valid: false,
            reason: `Invalid balance calculation for transition ${t.transitionType} at sequence ${t.sequence}.`,
            transitionsVerified: i,
          };
        }
        break;
      case "allocation_out":
      case "reclaim_out":
        if (
          t.balanceAfter.availableMinor !== t.balanceBefore.availableMinor - t.amountMinor ||
          t.balanceAfter.reservedMinor !== t.balanceBefore.reservedMinor ||
          t.balanceAfter.capturedMinor !== t.balanceBefore.capturedMinor
        ) {
          return {
            valid: false,
            reason: `Invalid balance calculation for transition ${t.transitionType} at sequence ${t.sequence}.`,
            transitionsVerified: i,
          };
        }
        break;
      case "reserve":
        if (
          t.balanceAfter.availableMinor !== t.balanceBefore.availableMinor - t.amountMinor ||
          t.balanceAfter.reservedMinor !== t.balanceBefore.reservedMinor + t.amountMinor ||
          t.balanceAfter.capturedMinor !== t.balanceBefore.capturedMinor
        ) {
          return {
            valid: false,
            reason: `Invalid balance calculation for transition reserve at sequence ${t.sequence}.`,
            transitionsVerified: i,
          };
        }
        break;
      case "capture":
        if (
          t.balanceAfter.availableMinor !== t.balanceBefore.availableMinor ||
          t.balanceAfter.reservedMinor !== t.balanceBefore.reservedMinor - t.amountMinor ||
          t.balanceAfter.capturedMinor !== t.balanceBefore.capturedMinor + t.amountMinor
        ) {
          return {
            valid: false,
            reason: `Invalid balance calculation for transition capture at sequence ${t.sequence}.`,
            transitionsVerified: i,
          };
        }
        break;
      case "release":
        if (
          t.balanceAfter.availableMinor !== t.balanceBefore.availableMinor + t.amountMinor ||
          t.balanceAfter.reservedMinor !== t.balanceBefore.reservedMinor - t.amountMinor ||
          t.balanceAfter.capturedMinor !== t.balanceBefore.capturedMinor
        ) {
          return {
            valid: false,
            reason: `Invalid balance calculation for transition release at sequence ${t.sequence}.`,
            transitionsVerified: i,
          };
        }
        break;
    }

    expectedPreviousHash = t.transitionHash;
  }

  const lastTransition = transitions[transitions.length - 1];
  if (
    account.availableMinor !== lastTransition.balanceAfter.availableMinor ||
    account.reservedMinor !== lastTransition.balanceAfter.reservedMinor ||
    account.capturedMinor !== lastTransition.balanceAfter.capturedMinor
  ) {
    return {
      valid: false,
      reason: `Account balance does not match cryptographic balance record: current={avail:${account.availableMinor},res:${account.reservedMinor},cap:${account.capturedMinor}}, recorded={avail:${lastTransition.balanceAfter.availableMinor},res:${lastTransition.balanceAfter.reservedMinor},cap:${lastTransition.balanceAfter.capturedMinor}}.`,
      transitionsVerified: transitions.length,
    };
  }

  return { valid: true, transitionsVerified: transitions.length };
}

export class InMemoryLedger {
  private readonly accounts = new Map<string, LedgerAccount>();
  private readonly reservations = new Map<string, Reservation>();
  private readonly transitions = new Map<string, LedgerTransition[]>();

  createAccount(input: {
    id: string;
    parentId: string | null;
    availableMinor: number;
    environmentId?: string;
  }): LedgerAccount {
    if (!Number.isSafeInteger(input.availableMinor) || input.availableMinor < 0) {
      throw new LedgerError("Account amount must be a non-negative integer.", "INVALID_AMOUNT");
    }
    const account = {
      id: input.id,
      parentId: input.parentId,
      availableMinor: input.availableMinor,
      reservedMinor: 0,
      capturedMinor: 0,
    };
    this.accounts.set(account.id, account);

    this.appendTransition(
      account.id,
      "create",
      input.availableMinor,
      { availableMinor: 0, reservedMinor: 0, capturedMinor: 0 },
      { availableMinor: input.availableMinor, reservedMinor: 0, capturedMinor: 0 },
      input.parentId,
      input.environmentId,
    );

    return account;
  }

  getAccount(id: string): LedgerAccount {
    const account = this.accounts.get(id);
    if (!account) throw new LedgerError("Ledger account not found.", "ACCOUNT_NOT_FOUND");
    return { ...account };
  }

  allocate(parentId: string, childId: string, amountMinor: number): void {
    this.validateAmount(amountMinor);
    const parentIntegrity = this.verifyAccountIntegrity(parentId);
    if (!parentIntegrity.valid) {
      throw new LedgerError(
        `Wallet integrity verification failed for parent account: ${parentIntegrity.reason}`,
        "WALLET_INTEGRITY_VIOLATION",
      );
    }
    const childIntegrity = this.verifyAccountIntegrity(childId);
    if (!childIntegrity.valid) {
      throw new LedgerError(
        `Wallet integrity verification failed for child account: ${childIntegrity.reason}`,
        "WALLET_INTEGRITY_VIOLATION",
      );
    }

    const parent = this.getMutable(parentId);
    const child = this.getMutable(childId);
    if (child.parentId !== parent.id)
      throw new LedgerError("Child account is not owned by parent.", "INVALID_STATE");
    if (parent.availableMinor < amountMinor) {
      throw new LedgerError("Allocation exceeds available parent funds.", "INSUFFICIENT_AVAILABLE");
    }

    const parentBefore = { ...parent };
    const childBefore = { ...child };

    parent.availableMinor -= amountMinor;
    child.availableMinor += amountMinor;

    this.appendTransition(
      parent.id,
      "allocation_out",
      amountMinor,
      parentBefore,
      {
        availableMinor: parent.availableMinor,
        reservedMinor: parent.reservedMinor,
        capturedMinor: parent.capturedMinor,
      },
      child.id,
    );
    this.appendTransition(
      child.id,
      "allocation_in",
      amountMinor,
      childBefore,
      {
        availableMinor: child.availableMinor,
        reservedMinor: child.reservedMinor,
        capturedMinor: child.capturedMinor,
      },
      parent.id,
    );
  }

  reclaim(parentId: string, childId: string, amountMinor: number): void {
    this.validateAmount(amountMinor);
    const parentIntegrity = this.verifyAccountIntegrity(parentId);
    if (!parentIntegrity.valid) {
      throw new LedgerError(
        `Wallet integrity verification failed for parent account: ${parentIntegrity.reason}`,
        "WALLET_INTEGRITY_VIOLATION",
      );
    }
    const childIntegrity = this.verifyAccountIntegrity(childId);
    if (!childIntegrity.valid) {
      throw new LedgerError(
        `Wallet integrity verification failed for child account: ${childIntegrity.reason}`,
        "WALLET_INTEGRITY_VIOLATION",
      );
    }

    const parent = this.getMutable(parentId);
    const child = this.getMutable(childId);
    if (child.parentId !== parent.id)
      throw new LedgerError("Child account is not owned by parent.", "INVALID_STATE");
    if (child.availableMinor < amountMinor) {
      throw new LedgerError("Reclaim exceeds available child funds.", "INSUFFICIENT_AVAILABLE");
    }

    const parentBefore = { ...parent };
    const childBefore = { ...child };

    child.availableMinor -= amountMinor;
    parent.availableMinor += amountMinor;

    this.appendTransition(
      child.id,
      "reclaim_out",
      amountMinor,
      childBefore,
      {
        availableMinor: child.availableMinor,
        reservedMinor: child.reservedMinor,
        capturedMinor: child.capturedMinor,
      },
      parent.id,
    );
    this.appendTransition(
      parent.id,
      "reclaim_in",
      amountMinor,
      parentBefore,
      {
        availableMinor: parent.availableMinor,
        reservedMinor: parent.reservedMinor,
        capturedMinor: parent.capturedMinor,
      },
      child.id,
    );
  }

  reserve(actionId: string, accountId: string, amountMinor: number): Reservation {
    this.validateAmount(amountMinor);

    // Wallet integrity verification against current account state before allowing spending
    const integrity = this.verifyAccountIntegrity(accountId);
    if (!integrity.valid) {
      throw new LedgerError(
        `Wallet integrity verification failed: ${integrity.reason}`,
        "WALLET_INTEGRITY_VIOLATION",
      );
    }

    const existing = this.reservations.get(actionId);
    if (existing) {
      if (existing.accountId !== accountId || existing.amountMinor !== amountMinor) {
        throw new LedgerError(
          "Idempotency key is bound to different reservation details.",
          "RESERVATION_CONFLICT",
        );
      }
      return { ...existing };
    }
    const account = this.getMutable(accountId);
    if (account.availableMinor < amountMinor) {
      throw new LedgerError("Reservation exceeds available funds.", "INSUFFICIENT_AVAILABLE");
    }

    const accountBefore = { ...account };
    account.availableMinor -= amountMinor;
    account.reservedMinor += amountMinor;
    const reservation: Reservation = { actionId, accountId, amountMinor, state: "held" };
    this.reservations.set(actionId, reservation);

    this.appendTransition(
      account.id,
      "reserve",
      amountMinor,
      accountBefore,
      {
        availableMinor: account.availableMinor,
        reservedMinor: account.reservedMinor,
        capturedMinor: account.capturedMinor,
      },
      actionId,
    );

    return { ...reservation };
  }

  capture(actionId: string): Reservation {
    const reservation = this.requireReservation(actionId);
    if (reservation.state === "captured") return { ...reservation };
    if (reservation.state !== "held")
      throw new LedgerError("Only held reservations can be captured.", "INVALID_STATE");

    const integrity = this.verifyAccountIntegrity(reservation.accountId);
    if (!integrity.valid) {
      throw new LedgerError(
        `Wallet integrity verification failed: ${integrity.reason}`,
        "WALLET_INTEGRITY_VIOLATION",
      );
    }

    const account = this.getMutable(reservation.accountId);
    const accountBefore = { ...account };
    account.reservedMinor -= reservation.amountMinor;
    account.capturedMinor += reservation.amountMinor;
    reservation.state = "captured";

    this.appendTransition(
      account.id,
      "capture",
      reservation.amountMinor,
      accountBefore,
      {
        availableMinor: account.availableMinor,
        reservedMinor: account.reservedMinor,
        capturedMinor: account.capturedMinor,
      },
      actionId,
    );

    return { ...reservation };
  }

  release(actionId: string): Reservation {
    const reservation = this.requireReservation(actionId);
    if (reservation.state === "released") return { ...reservation };
    if (reservation.state !== "held")
      throw new LedgerError("Only held reservations can be released.", "INVALID_STATE");

    const integrity = this.verifyAccountIntegrity(reservation.accountId);
    if (!integrity.valid) {
      throw new LedgerError(
        `Wallet integrity verification failed: ${integrity.reason}`,
        "WALLET_INTEGRITY_VIOLATION",
      );
    }

    const account = this.getMutable(reservation.accountId);
    const accountBefore = { ...account };
    account.reservedMinor -= reservation.amountMinor;
    account.availableMinor += reservation.amountMinor;
    reservation.state = "released";

    this.appendTransition(
      account.id,
      "release",
      reservation.amountMinor,
      accountBefore,
      {
        availableMinor: account.availableMinor,
        reservedMinor: account.reservedMinor,
        capturedMinor: account.capturedMinor,
      },
      actionId,
    );

    return { ...reservation };
  }

  getReservation(actionId: string): Reservation | null {
    const reservation = this.reservations.get(actionId);
    return reservation ? { ...reservation } : null;
  }

  getTransitions(accountId: string): LedgerTransition[] {
    return (this.transitions.get(accountId) ?? []).map((t) => ({ ...t }));
  }

  verifyAccountIntegrity(accountId: string): IntegrityVerificationResult {
    const account = this.accounts.get(accountId);
    if (!account) {
      return { valid: false, reason: "Account not found.", transitionsVerified: 0 };
    }
    const transitions = this.transitions.get(accountId) ?? [];
    return verifyWalletIntegrity(account, transitions);
  }

  tamperAccount(accountId: string, mutator: (acc: LedgerAccount) => void): void {
    const account = this.getMutable(accountId);
    mutator(account);
  }

  tamperTransition(accountId: string, index: number, mutator: (t: LedgerTransition) => void): void {
    const list = this.transitions.get(accountId);
    if (list && list[index]) {
      mutator(list[index]);
    }
  }

  private appendTransition(
    accountId: string,
    transitionType: LedgerTransitionType,
    amountMinor: number,
    balanceBefore: BalanceState,
    balanceAfter: BalanceState,
    referenceId: string | null = null,
    environmentId?: string,
  ): LedgerTransition {
    const history = this.transitions.get(accountId) ?? [];
    const previous = history.at(-1) ?? null;
    const transition: LedgerTransition = {
      id: randomUUID(),
      environmentId,
      accountId,
      sequence: history.length + 1,
      transitionType,
      amountMinor,
      balanceBefore: { ...balanceBefore },
      balanceAfter: { ...balanceAfter },
      referenceId,
      createdAt: new Date().toISOString(),
      previousHash: previous ? previous.transitionHash : null,
      transitionHash: "",
    };
    transition.transitionHash = computeTransitionHash(transition);
    history.push(transition);
    this.transitions.set(accountId, history);
    return transition;
  }

  conservation(): {
    availableMinor: number;
    reservedMinor: number;
    capturedMinor: number;
    totalMinor: number;
  } {
    let availableMinor = 0;
    let reservedMinor = 0;
    let capturedMinor = 0;
    for (const account of this.accounts.values()) {
      if (account.parentId === null) {
        availableMinor += account.availableMinor;
        reservedMinor += account.reservedMinor;
        capturedMinor += account.capturedMinor;
      }
    }
    for (const account of this.accounts.values()) {
      if (account.parentId !== null) {
        availableMinor += account.availableMinor;
        reservedMinor += account.reservedMinor;
        capturedMinor += account.capturedMinor;
      }
    }
    return {
      availableMinor,
      reservedMinor,
      capturedMinor,
      totalMinor: availableMinor + reservedMinor + capturedMinor,
    };
  }

  private validateAmount(amountMinor: number): void {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new LedgerError("Amount must be a positive integer.", "INVALID_AMOUNT");
    }
  }

  private getMutable(id: string): LedgerAccount {
    const account = this.accounts.get(id);
    if (!account) throw new LedgerError("Ledger account not found.", "ACCOUNT_NOT_FOUND");
    return account;
  }

  private requireReservation(actionId: string): Reservation {
    const reservation = this.reservations.get(actionId);
    if (!reservation) throw new LedgerError("Reservation not found.", "RESERVATION_NOT_FOUND");
    return reservation;
  }
}
