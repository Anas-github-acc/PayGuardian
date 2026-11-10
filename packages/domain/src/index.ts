export type MandateState = "active" | "expired" | "revoked" | "superseded";

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
  mandateSeriesId?: string;
  version?: number;
  previousMandateId?: string | null;
  supersededAt?: string | null;
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
    | "APPROVAL_REQUIRED"
    | "WALLET_INTEGRITY_VIOLATION"
    | "GRANT_NOT_FOUND"
    | "GRANT_INACTIVE"
    | "GRANT_EXPIRED"
    | "GRANT_BUDGET_EXCEEDED"
    | "CHILD_AGENT_NOT_ALLOWED_BY_GRANT"
    | "ACTION_NOT_PERMITTED_BY_GRANT"
    | "AGENT_IDENTITY_MISMATCH"
    | "AUTHORITY_TARGET_NOT_FOUND";
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
  if (parent.includes("*")) return true;
  const parentSet = new Set(parent);
  return child.every((item) => {
    if (parentSet.has(item)) return true;
    for (const p of parent) {
      if (p.endsWith(".*") && item.startsWith(p.slice(0, -1))) {
        return true;
      }
    }
    return false;
  });
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
  mandateSeriesId?: string;
  version?: number;
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
    mandateSeriesId: input.mandateSeriesId ?? input.id,
    version: input.version ?? 1,
    previousMandateId: null,
    supersededAt: null,
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
    isAncestor?: boolean;
  },
): PolicyDecision {
  if (!mandate) return { allowed: false, code: "MANDATE_NOT_FOUND", reason: "Mandate not found." };
  if (mandate.state === "revoked")
    return { allowed: false, code: "MANDATE_REVOKED", reason: "Mandate is revoked." };
  if (mandate.state === "superseded")
    return { allowed: false, code: "MANDATE_NOT_FOUND", reason: "Mandate version is superseded." };
  if (isExpired(mandate, input.at))
    return { allowed: false, code: "MANDATE_EXPIRED", reason: "Mandate has expired." };
  if (!isSubset([input.action], mandate.permittedActions)) {
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
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    return {
      allowed: false,
      code: "BUDGET_EXCEEDED",
      reason: "Amount must be a positive integer.",
    };
  }
  if (input.isAncestor) {
    if (input.amountMinor > mandate.budgetLimitMinor) {
      return {
        allowed: false,
        code: "BUDGET_EXCEEDED",
        reason: "Amount exceeds ancestor mandate budget limit.",
      };
    }
  } else if (input.amountMinor > availableBudget(mandate)) {
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

export function evaluateAuthorityChain(
  chain: Mandate[],
  targetMandateId: string,
  input: {
    action: string;
    amountMinor: number;
    currency: string;
    at: Date;
    approvalGranted: boolean;
  },
): PolicyDecision {
  if (chain.length === 0) {
    return { allowed: false, code: "MANDATE_NOT_FOUND", reason: "Mandate not found." };
  }
  const target = chain.find((item) => item.id === targetMandateId);
  if (!target) {
    return {
      allowed: false,
      code: "MANDATE_NOT_FOUND",
      reason: "Target mandate not found in chain.",
    };
  }
  for (const item of chain) {
    const isAncestor = item.id !== targetMandateId;
    const decision = evaluateMandate(item, { ...input, isAncestor });
    if (!decision.allowed) return decision;
  }
  return { allowed: true, code: "ALLOW", reason: "The full mandate chain permits this action." };
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
    mandateSeriesId: input.id,
    version: 1,
    previousMandateId: null,
    supersededAt: null,
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

export type TopupRequest = {
  additionalBudgetMinor: number;
  permittedActions?: string[];
  expiresAt?: string;
  canDelegate?: boolean;
  maxDelegationDepth?: number;
  approvalRequired?: boolean;
};

export function topupMandate(
  parent: Mandate,
  previous: Mandate,
  input: TopupRequest & { id: string; createdAt: string },
  at: Date,
): { mandate: Mandate | null; decision: PolicyDecision } {
  if (parent.state === "revoked")
    return {
      mandate: null,
      decision: { allowed: false, code: "MANDATE_REVOKED", reason: "Parent mandate is revoked." },
    };
  if (parent.state === "superseded")
    return {
      mandate: null,
      decision: { allowed: false, code: "MANDATE_NOT_FOUND", reason: "Parent mandate is superseded." },
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
  if (previous.state !== "active")
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "MANDATE_NOT_FOUND",
        reason: "Previous mandate version is not active.",
      },
    };
  if (previous.currency !== parent.currency)
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "CURRENCY_MISMATCH",
        reason: "Child currency differs from parent currency.",
      },
    };
  if (input.additionalBudgetMinor <= 0 || input.additionalBudgetMinor > availableBudget(parent)) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "BUDGET_EXCEEDED",
        reason: "Child allocation exceeds parent available budget.",
      },
    };
  }

  // Permission inheritance: subset of both previous and parent
  const targetActions = input.permittedActions ?? previous.permittedActions;
  if (!isSubset(targetActions, parent.permittedActions)) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "ACTION_NOT_PERMITTED",
        reason: "Top-up actions exceed parent permitted actions.",
      },
    };
  }
  if (!isSubset(targetActions, previous.permittedActions)) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "ACTION_NOT_PERMITTED",
        reason: "Top-up actions cannot expand previous permissions.",
      },
    };
  }

  // Expiry cannot exceed previous or parent expiry
  const targetExpiresAt = input.expiresAt ?? previous.expiresAt;
  if (new Date(targetExpiresAt).getTime() > new Date(parent.expiresAt).getTime()) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "MANDATE_EXPIRED",
        reason: "Child expiry exceeds parent expiry.",
      },
    };
  }
  if (new Date(targetExpiresAt).getTime() > new Date(previous.expiresAt).getTime()) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "MANDATE_EXPIRED",
        reason: "Child expiry cannot exceed previous mandate expiry.",
      },
    };
  }

  // Approval requirements cannot be weakened
  const targetApproval =
    input.approvalRequired !== undefined ? input.approvalRequired : previous.approvalRequired;
  if (parent.approvalRequired && !targetApproval) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "APPROVAL_REQUIRED",
        reason: "Child authority cannot weaken the parent approval requirement.",
      },
    };
  }
  if (previous.approvalRequired && !targetApproval) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "APPROVAL_REQUIRED",
        reason: "Child authority cannot weaken the previous approval requirement.",
      },
    };
  }

  // Delegation depth cannot increase
  const targetDepth =
    input.maxDelegationDepth !== undefined ? input.maxDelegationDepth : previous.maxDelegationDepth;
  if (targetDepth >= parent.maxDelegationDepth || targetDepth > previous.maxDelegationDepth) {
    return {
      mandate: null,
      decision: {
        allowed: false,
        code: "DELEGATION_DEPTH_EXCEEDED",
        reason: "Delegation depth cannot increase beyond previous or parent limit.",
      },
    };
  }

  // Retire previous version
  previous.state = "superseded";
  previous.supersededAt = input.createdAt;

  // New version carries forward spentMinor, reservedMinor, allocatedMinor
  const newMandate: Mandate = {
    id: input.id,
    mandateSeriesId: previous.mandateSeriesId ?? previous.id,
    version: (previous.version ?? 1) + 1,
    previousMandateId: previous.id,
    supersededAt: null,
    issuerUserId: previous.issuerUserId,
    environmentId: previous.environmentId,
    holderAgentId: previous.holderAgentId,
    parentMandateId: parent.id,
    budgetLimitMinor: previous.budgetLimitMinor + input.additionalBudgetMinor,
    allocatedMinor: previous.allocatedMinor,
    spentMinor: previous.spentMinor,
    reservedMinor: previous.reservedMinor,
    currency: previous.currency,
    permittedActions: unique(targetActions),
    expiresAt: targetExpiresAt,
    canDelegate: input.canDelegate !== undefined ? input.canDelegate : previous.canDelegate,
    maxDelegationDepth: targetDepth,
    approvalRequired: targetApproval,
    state: "active",
    revokedAt: null,
    createdAt: input.createdAt,
  };

  // Parent allocated increases only by the additional allocation
  parent.allocatedMinor += input.additionalBudgetMinor;

  return {
    mandate: newMandate,
    decision: { allowed: true, code: "ALLOW", reason: "Top-up delegation permitted." },
  };
}

export function revokeMandate(mandate: Mandate, at: Date): Mandate {
  return { ...mandate, state: "revoked", revokedAt: at.toISOString() };
}

export * from "./ledger.js";
export * from "./provider-jobs.js";
