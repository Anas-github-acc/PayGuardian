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

export class LedgerError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ACCOUNT_NOT_FOUND"
      | "INVALID_AMOUNT"
      | "INSUFFICIENT_AVAILABLE"
      | "RESERVATION_CONFLICT"
      | "RESERVATION_NOT_FOUND"
      | "INVALID_STATE",
  ) {
    super(message);
  }
}

export class InMemoryLedger {
  private readonly accounts = new Map<string, LedgerAccount>();
  private readonly reservations = new Map<string, Reservation>();

  createAccount(input: {
    id: string;
    parentId: string | null;
    availableMinor: number;
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
    return account;
  }

  getAccount(id: string): LedgerAccount {
    const account = this.accounts.get(id);
    if (!account) throw new LedgerError("Ledger account not found.", "ACCOUNT_NOT_FOUND");
    return { ...account };
  }

  allocate(parentId: string, childId: string, amountMinor: number): void {
    this.validateAmount(amountMinor);
    const parent = this.getMutable(parentId);
    const child = this.getMutable(childId);
    if (child.parentId !== parent.id)
      throw new LedgerError("Child account is not owned by parent.", "INVALID_STATE");
    if (parent.availableMinor < amountMinor) {
      throw new LedgerError("Allocation exceeds available parent funds.", "INSUFFICIENT_AVAILABLE");
    }
    parent.availableMinor -= amountMinor;
    child.availableMinor += amountMinor;
  }

  reserve(actionId: string, accountId: string, amountMinor: number): Reservation {
    this.validateAmount(amountMinor);
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
    account.availableMinor -= amountMinor;
    account.reservedMinor += amountMinor;
    const reservation: Reservation = { actionId, accountId, amountMinor, state: "held" };
    this.reservations.set(actionId, reservation);
    return { ...reservation };
  }

  capture(actionId: string): Reservation {
    const reservation = this.requireReservation(actionId);
    if (reservation.state === "captured") return { ...reservation };
    if (reservation.state !== "held")
      throw new LedgerError("Only held reservations can be captured.", "INVALID_STATE");
    const account = this.getMutable(reservation.accountId);
    account.reservedMinor -= reservation.amountMinor;
    account.capturedMinor += reservation.amountMinor;
    reservation.state = "captured";
    return { ...reservation };
  }

  release(actionId: string): Reservation {
    const reservation = this.requireReservation(actionId);
    if (reservation.state === "released") return { ...reservation };
    if (reservation.state !== "held")
      throw new LedgerError("Only held reservations can be released.", "INVALID_STATE");
    const account = this.getMutable(reservation.accountId);
    account.reservedMinor -= reservation.amountMinor;
    account.availableMinor += reservation.amountMinor;
    reservation.state = "released";
    return { ...reservation };
  }

  getReservation(actionId: string): Reservation | null {
    const reservation = this.reservations.get(actionId);
    return reservation ? { ...reservation } : null;
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
