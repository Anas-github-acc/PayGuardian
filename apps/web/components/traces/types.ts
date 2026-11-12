export type TraceStatus = "completed" | "authorized" | "pending_capture" | "rejected" | "failed";

export type TraceRail = "PayPal" | "Simulation" | "Card";

export interface TraceAuthNode {
  id: string;
  name: string;
  role: string;
  mandateId: string;
  allocatedMinor: number;
  spentMinor: number;
  reservedMinor: number;
  availableMinor: number;
  currency: string;
  status: "active" | "revoked" | "exhausted";
  policyRule?: string;
  depth: number;
}

export type LifecycleStageKey =
  | "initiated"
  | "mandate_evaluated"
  | "human_approved_bypass"
  | "paypal_captured"
  | "settled_reconciled";

export interface TraceLifecycleStage {
  key: LifecycleStageKey;
  name: string;
  description: string;
  status: "completed" | "active" | "failed" | "skipped";
  timestamp: string;
  latencyMs: number;
  details?: Record<string, unknown>;
}

export interface TraceVerificationCheck {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  errorCode?: string;
  details?: string;
  remediation?: string;
}

export interface PaymentTrace {
  id: string;
  actionId: string;
  environmentId: string;
  environmentName: string;
  transactionId?: string;
  recipient: string;
  merchantCategory: string;
  amountMinor: number;
  currency: string;
  rail: TraceRail;
  status: TraceStatus;
  initiatedAt: string;
  completedAt?: string;
  totalLatencyMs: number;
  requestingAgent: {
    id: string;
    name: string;
    role: string;
  };
  authChain: TraceAuthNode[];
  stages: TraceLifecycleStage[];
  checklist: TraceVerificationCheck[];
  rawRecord: Record<string, unknown>;
  uncertainStateNotice?: string;
}
