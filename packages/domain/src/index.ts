export type MandateState = "active" | "expired" | "revoked";

export type MandateConstraints = {
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

export type Mandate = MandateConstraints & {
  id: string;
  issuerUserId: string;
  parentMandateId: string | null;
  allocatedMinor: number;
  spentMinor: number;
  reservedMinor: number;
  state: MandateState;
  revokedAt: string | null;
  createdAt: string;
};

export type PolicyDecision = {
  allowed: boolean;
  code:
    | "ALLOW"
    | "MANDATE_NOT_FOUND"
    | "MANDATE_REVOKED"
    | "MANDATE_EXPIRED"
    | "ACTION_NOT_PERMITTED"
    | "BUDGET_EXCEEDED"
    | "DELEGATION_NOT_PERMITTED"
    | "DELEGATION_DEPTH_EXCEEDED"
    | "CURRENCY_MISMATCH"
    | "APPROVAL_REQUIRED";
  reason: string;
};

export type DelegationRequest = {
  issuerUserId: string;
  holderAgentId: string;
  budgetLimitMinor: number;
  currency: string;
  permittedActions: string[];
  expiresAt: string;
  canDelegate: boolean;
  maxDelegationDepth: number;
  approvalRequired: boolean;
};

export const domainPhase = "mandates-and-effective-authority" as const;

function isExpired(mandate: Mandate, at: Date): boolean {
  return new Date(mandate.expiresAt).getTime() <= at.getTime();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isSubset(child: string[], parent: string[]): boolean {
  const parentSet = new Set(parent);
  return child.every((item) => parentSet.has(item));
}

export function availableBudget(mandate: Mandate): number {
  return (
    mandate.budgetLimitMinor - mandate.allocatedMinor - mandate.spentMinor - mandate.reservedMinor
  );
}

export function createRootMandate(input: {
  id: string;
  issuerUserId: string;
  createdAt: string;
  constraints: MandateConstraints;
}): Mandate {
  if (
    input.constraints.budgetLimitMinor <= 0 ||
    !Number.isSafeInteger(input.constraints.budgetLimitMinor)
  ) {
    throw new Error("ROOT_BUDGET_INVALID");
  }
  if (
    input.constraints.maxDelegationDepth < 0 ||
    !Number.isInteger(input.constraints.maxDelegationDepth)
  ) {
    throw new Error("ROOT_DEPTH_INVALID");
  }
  return {
    ...input.constraints,
    permittedActions: unique(input.constraints.permittedActions),
    parentMandateId: null,
    id: input.id,
    issuerUserId: input.issuerUserId,
    allocatedMinor: 0,
    spentMinor: 0,
    reservedMinor: 0,
    state: "active",
    revokedAt: null,
    createdAt: input.createdAt,
  };
}

export function evaluateMandate(
  mandate: Mandate | null,
  input: {
    action: string;
    amountMinor: number;
    currency: string;
    at: Date;
    approvalGranted: boolean;
  },
): PolicyDecision {
  if (!mandate) return { allowed: false, code: "MANDATE_NOT_FOUND", reason: "Mandate not found." };
  if (mandate.state === "revoked")
    return { allowed: false, code: "MANDATE_REVOKED", reason: "Mandate is revoked." };
  if (isExpired(mandate, input.at))
    return { allowed: false, code: "MANDATE_EXPIRED", reason: "Mandate has expired." };
  if (!mandate.permittedActions.includes(input.action)) {
    return {
      allowed: false,
      code: "ACTION_NOT_PERMITTED",
      reason: "Action is outside the mandate scope.",
    };
  }
  if (mandate.currency !== input.currency) {
    return {
      allowed: false,
      code: "CURRENCY_MISMATCH",
      reason: "Currency does not match the mandate.",
    };
  }
  if (
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0 ||
    input.amountMinor > availableBudget(mandate)
  ) {
    return {
      allowed: false,
      code: "BUDGET_EXCEEDED",
      reason: "Amount exceeds available mandate budget.",
    };
  }
  if (mandate.approvalRequired && !input.approvalGranted) {
    return { allowed: false, code: "APPROVAL_REQUIRED", reason: "Human approval is required." };
  }
  return { allowed: true, code: "ALLOW", reason: "Action is permitted." };
}

export function delegateMandate(
  parent: Mandate,
  input: DelegationRequest & { id: string; createdAt: string },
  at: Date,
): { mandate: Mandate | null; decision: PolicyDecision } {
  if (parent.state === "revoked")
    return {
      mandate: null,
      decision: { allowed: false, code: "MANDATE_REVOKED", reason: "Parent mandate is revoked." },
    };
  if (isExpired(parent, at))
    return {
      mandate: null,
      decision: { allowed: false, code: "MANDATE_EXPIRED", reason: "Parent mandate has expired." },
    };
  if (!parent.canDelegate)
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "DELEGATION_NOT_PERMITTED",
        reason: "Parent cannot delegate authority.",
      },
    };
  if (parent.maxDelegationDepth <= 0 || input.maxDelegationDepth >= parent.maxDelegationDepth) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "DELEGATION_DEPTH_EXCEEDED",
        reason: "Delegation depth exceeds parent authority.",
      },
    };
  }
  if (input.currency !== parent.currency)
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "CURRENCY_MISMATCH",
        reason: "Child currency differs from parent currency.",
      },
    };
  if (input.budgetLimitMinor <= 0 || input.budgetLimitMinor > availableBudget(parent)) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "BUDGET_EXCEEDED",
        reason: "Child allocation exceeds parent available budget.",
      },
    };
  }
  if (!isSubset(input.permittedActions, parent.permittedActions)) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "ACTION_NOT_PERMITTED",
        reason: "Child scope broadens parent scope.",
      },
    };
  }
  if (new Date(input.expiresAt).getTime() > new Date(parent.expiresAt).getTime()) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "MANDATE_EXPIRED",
        reason: "Child expiry exceeds parent expiry.",
      },
    };
  }
  if (parent.approvalRequired && !input.approvalRequired) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "APPROVAL_REQUIRED",
        reason: "Child authority cannot weaken the parent approval requirement.",
      },
    };
  }
  const mandate: Mandate = {
    ...input,
    permittedActions: unique(input.permittedActions),
    environmentId: parent.environmentId,
    parentMandateId: parent.id,
    allocatedMinor: 0,
    spentMinor: 0,
    reservedMinor: 0,
    state: "active",
    revokedAt: null,
  };
  parent.allocatedMinor += mandate.budgetLimitMinor;
  return {
    mandate,
    decision: { allowed: true, code: "ALLOW", reason: "Delegation is permitted." },
  };
}

export function revokeMandate(mandate: Mandate, at: Date): Mandate {
  return { ...mandate, state: "revoked", revokedAt: at.toISOString() };
}

export * from "./ledger.js";
export * from "./provider-jobs.js";
