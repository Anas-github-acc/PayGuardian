export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalAncestor {
  id: string;
  name: string;
  role: string;
}

export interface ApprovalItem {
  id: string;
  environmentId: string;
  mandateId: string;
  agentId: string;
  agentName: string;
  agentRole?: "orchestrator" | "subagent";
  action: string;
  purpose: string;
  recipient: string;
  merchantCategory: string;
  amountMinor: number;
  currency: string;
  requestHash: string;
  status: ApprovalStatus;
  reasonForSignOff: string;
  remainingBudgetAfterPaymentMinor: number;
  parentMandateLimitMinor: number;
  isHardLimitExceeded: boolean;
  hardLimitExceededReason?: string;
  expiresAt: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  ancestorChain: ApprovalAncestor[];
  agentSays?: string;
  parameters?: Record<string, unknown>;
  allowedActions?: ("approve" | "reject" | string)[];
}

export type ApprovalFilter = "all" | "pending" | "approved" | "rejected";
