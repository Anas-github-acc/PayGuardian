/**
 * PayGuardian Gateway REST & Event Contracts (Phase 7 API Specification)
 */

export const apiVersion = "v1" as const;

export type HealthResponse = {
  status: "ok";
  service: string;
  phase: string;
};

export type SystemStatusResponse = {
  service: string;
  authorityEnforcement: string;
  message: string;
};

// --- Environments ---
export type EnvironmentDto = {
  id: string;
  name: string;
  purpose: string;
  currency: string;
  budgetLimitMinor: number;
  status: "active" | "paused" | "revoked";
  createdAt: string;
};

export type CreateEnvironmentRequest = {
  name: string;
  purpose: string;
  currency: string;
  budgetLimitMinor: number;
};

// --- Agents ---
export type AgentDto = {
  id: string;
  environmentId: string;
  name: string;
  kind: string;
  parentAgentId: string | null;
  status: "active" | "disabled" | "revoked";
  createdAt: string;
};

export type CreateRootAgentRequest = {
  name: string;
  capabilities?: string[];
};

export type RegisterChildAgentRequest = {
  parentAgentId: string;
  name: string;
  kind: string;
  capabilities?: string[];
};

// --- Mandates & Delegation ---
export type MandateDto = {
  id: string;
  environmentId: string;
  issuerUserId: string;
  holderAgentId: string;
  parentMandateId: string | null;
  budgetLimitMinor: number;
  allocatedMinor: number;
  spentMinor: number;
  reservedMinor: number;
  currency: string;
  permittedActions: string[];
  expiresAt: string;
  canDelegate: boolean;
  maxDelegationDepth: number;
  approvalRequired: boolean;
  state: "active" | "expired" | "revoked";
  revokedAt: string | null;
  createdAt: string;
};

export type CreateRootMandateRequest = {
  holderAgentId: string;
  budgetLimitMinor: number;
  currency: string;
  permittedActions: string[];
  expiresAt: string;
  canDelegate: boolean;
  maxDelegationDepth: number;
  approvalRequired: boolean;
};

export type DelegateMandateRequest = {
  holderAgentId: string;
  budgetLimitMinor: number;
  currency: string;
  permittedActions: string[];
  expiresAt: string;
  canDelegate: boolean;
  maxDelegationDepth: number;
  approvalRequired: boolean;
};

export type PolicyDecisionDto = {
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

// --- Ledger & Protected Actions ---
export type LedgerAccountDto = {
  id: string;
  environmentId: string;
  mandateId: string;
  parentAccountId: string | null;
  currency: string;
  availableMinor: number;
  reservedMinor: number;
  capturedMinor: number;
};

export type ActionReserveRequest = {
  agentId: string;
  mandateId: string;
  ledgerAccountId: string;
  idempotencyKey: string;
  requestHash: string;
  action: string;
  amountMinor: number;
  currency: string;
  approvalId?: string;
};

export type ActionReserveResponse = {
  action: {
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
  reservation: {
    actionId: string;
    accountId: string;
    amountMinor: number;
    state: "held" | "captured" | "released";
  };
};

// --- Approvals ---
export type ApprovalDecision = "allow_once" | "allow" | "deny";

export type DelegationGrantStatus = "active" | "consumed" | "revoked" | "expired";

export type DelegationGrantDto = {
  jti: string;
  environmentId: string;
  agentId: string;
  parentMandateId: string;
  allowedChildAgents: string[];
  permittedActions: string[];
  maxBudgetMinor: number;
  amountUsedMinor: number;
  maxDepth: number;
  approvalStrictness: "allow_once" | "allow";
  expiresAt: string;
  status: DelegationGrantStatus;
  requestHash: string;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalDto = {
  id: string;
  environmentId: string;
  mandateId: string;
  agentId: string;
  action: string;
  amountMinor: number;
  currency: string;
  requestHash: string;
  status: "pending" | "approved" | "rejected";
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

// --- Sessions & Runs ---
export type SessionDto = {
  id: string;
  environmentId: string;
  agentId: string | null;
  name: string;
  status: "active" | "paused" | "completed" | "cancelled";
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SessionRunDto = {
  id: string;
  sessionId: string;
  agentId: string;
  status: "running" | "paused" | "completed" | "failed";
  checkpoint: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

// --- PayPal Provider Operations ---
export type PayPalOrderRequest = {
  agentId: string;
  mandateId: string;
  ledgerAccountId: string;
  idempotencyKey: string;
  requestHash: string;
  action: string;
  amountMinor: number;
  currency: "USD";
  approvalId?: string;
  returnUrl?: string;
  cancelUrl?: string;
};

export type PayPalOperationSummaryDto = {
  actionId: string;
  provider: "paypal";
  providerOrderId: string | null;
  status: string;
  observedProviderStatus: string | null;
  captureId: string | null;
  reconciliationState: "pending" | "resolved" | "uncertain";
  amountMinor: number | null;
  currency: string | null;
  authorizationState: string | null;
  executionState: string | null;
  lastCheckedAt: string | null;
  lastEventAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

// --- Audit Events ---
export type AuditEventDto = {
  id: string;
  environmentId: string;
  actorType: "user" | "agent" | "service" | "system";
  actorId: string | null;
  sessionId: string | null;
  mandateId: string | null;
  actionId: string | null;
  eventType: string;
  outcome: "success" | "denied" | "failure";
  reasonCode: string | null;
  payload: Record<string, unknown>;
  previousHash: string | null;
  eventHash: string;
  createdAt: string;
};
