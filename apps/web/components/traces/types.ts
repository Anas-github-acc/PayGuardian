export type TraceStatus =
  | "completed"
  | "authorized"
  | "pending_capture"
  | "rejected"
  | "failed";

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

export const DEFAULT_TRACES: Record<string, PaymentTrace> = {
  "trace-pay-9018": {
    id: "trace-pay-9018",
    actionId: "act-pay-9018-ind",
    environmentId: "env-sandbox-travel-01",
    environmentName: "Travel & Hospitality",
    transactionId: "txn_pp_982194820",
    recipient: "IndiGo Airlines Ltd",
    merchantCategory: "Airlines & Air Travel",
    amountMinor: 24500, // $245.00
    currency: "USD",
    rail: "PayPal",
    status: "completed",
    initiatedAt: "2026-10-31T13:58:12Z",
    completedAt: "2026-10-31T13:58:45Z",
    totalLatencyMs: 330,
    requestingAgent: {
      id: "agent-travel",
      name: "Travel Subagent",
      role: "Flight & Rail Procurement",
    },
    authChain: [
      {
        id: "node-root",
        name: "Lead Operator (You)",
        role: "Root User Authority",
        mandateId: "man-root-9081",
        allocatedMinor: 1000000,
        spentMinor: 245000,
        reservedMinor: 150000,
        availableMinor: 605000,
        currency: "USD",
        status: "active",
        policyRule: "Root Environment Budget: $10,000.00 max cap",
        depth: 0,
      },
      {
        id: "node-orch",
        name: "Main Orchestrator",
        role: "Environment Overseer",
        mandateId: "man-orch-9082",
        allocatedMinor: 1000000,
        spentMinor: 245000,
        reservedMinor: 150000,
        availableMinor: 605000,
        currency: "USD",
        status: "active",
        policyRule: "Max Sub-delegation Depth: 2 levels allowed",
        depth: 1,
      },
      {
        id: "node-travel",
        name: "Travel Subagent",
        role: "Flight & Rail Procurement",
        mandateId: "man-travel-4001",
        allocatedMinor: 400000,
        spentMinor: 125000,
        reservedMinor: 50000,
        availableMinor: 225000,
        currency: "USD",
        status: "active",
        policyRule: "Single-action limit: $500.00 (Spend: $245.00 <= $500.00)",
        depth: 2,
      },
      {
        id: "node-res",
        name: "Ledger Reservation",
        role: "Double-Entry Balance Escrow",
        mandateId: "res-tx-982194820",
        allocatedMinor: 24500,
        spentMinor: 24500,
        reservedMinor: 0,
        availableMinor: 0,
        currency: "USD",
        status: "active",
        policyRule: "Debits = Credits: Zero net drift",
        depth: 3,
      },
    ],
    stages: [
      {
        key: "initiated",
        name: "1. Request Initiated",
        description: "Agent signed call with canonical SHA-256 hash & idempotency key",
        status: "completed",
        timestamp: "2026-10-31T13:58:12.100Z",
        latencyMs: 14,
        details: {
          idempotencyKey: "idem-fly-6e204-981",
          callerAgent: "agent-travel",
          parametersHash: "0x89f41b2a7e93c07d391ef41908bc21",
        },
      },
      {
        key: "mandate_evaluated",
        name: "2. Mandate Evaluated",
        description: "Authority tree evaluated across 3 levels: budget, action, and category verified",
        status: "completed",
        timestamp: "2026-10-31T13:58:12.145Z",
        latencyMs: 45,
        details: {
          mandatesChecked: ["man-root-9081", "man-orch-9082", "man-travel-4001"],
          allowedAction: "flight.procure",
          categoryMatch: "Airlines & Air Travel in allowlist",
        },
      },
      {
        key: "human_approved_bypass",
        name: "3. Autonomous Bypass",
        description: "Spend ($245.00) is below the $500.00 human approval threshold; autonomous bypass granted",
        status: "completed",
        timestamp: "2026-10-31T13:58:12.155Z",
        latencyMs: 10,
        details: {
          thresholdMinor: 50000,
          requestedMinor: 24500,
          bypassGranted: true,
        },
      },
      {
        key: "paypal_captured",
        name: "4. PayPal Rail Captured",
        description: "Dispatched order to PayPal REST API v2; capture confirmed with capture_id",
        status: "completed",
        timestamp: "2026-10-31T13:58:12.380Z",
        latencyMs: 225,
        details: {
          paypalOrderId: "PP-ORDER-9810239",
          captureId: "PP-CAP-449102",
          railFeeMinor: 0,
        },
      },
      {
        key: "settled_reconciled",
        name: "5. Settled & Hash Chained",
        description: "Reservation debited to spent; immutable audit log appended with SHA-256 hash link",
        status: "completed",
        timestamp: "2026-10-31T13:58:12.430Z",
        latencyMs: 50,
        details: {
          auditEventId: "evt-audit-10294",
          previousEventHash: "0x33b1e7c9f80214a6012489bcdae",
          currentEventHash: "0x77fa4219c00184ef4b201948ba2",
        },
      },
    ],
    checklist: [
      {
        id: "chk-budget",
        name: "Budget Limit Check",
        description: "Verifies requested spend does not exceed allocated and available mandate pool",
        passed: true,
        details: "Available: $2,250.00 >= Requested: $245.00",
      },
      {
        id: "chk-rail",
        name: "Rail Allowance Check",
        description: "Confirms target payment rail is permitted by the environment configuration",
        passed: true,
        details: "PayPal rail is active and authorized for env-sandbox-travel-01",
      },
      {
        id: "chk-merchant",
        name: "Merchant Category Check",
        description: "Ensures recipient category exists on active category allowlist",
        passed: true,
        details: "Category 'Airlines & Air Travel' matches permitted scope",
      },
      {
        id: "chk-hash",
        name: "Parameter Hash Integrity Check",
        description: "Validates canonical payload hash matches SHA-256 digest in signed token",
        passed: true,
        details: "Cryptographic digest match: 0x89f41b2a...7e93c07d",
      },
      {
        id: "chk-ledger",
        name: "Double-Entry Conservation Check",
        description: "Ensures sum of debit entries precisely equals credit entries with zero float",
        passed: true,
        details: "Debits ($245.00) = Credits ($245.00). Ledger net delta = 0",
      },
    ],
    rawRecord: {
      traceId: "trace-pay-9018",
      actionId: "act-pay-9018-ind",
      environmentId: "env-sandbox-travel-01",
      initiator: "agent-travel",
      targetMerchant: "IndiGo Airlines Ltd",
      amountMinor: 24500,
      currency: "USD",
      rail: "PayPal",
      lifecycle: "completed",
      idempotencyKey: "idem-fly-6e204-981",
      paypalOrderId: "PP-ORDER-9810239",
      paypalCaptureId: "PP-CAP-449102",
      authSignatures: [
        {
          signer: "agent-travel",
          keyId: "secp256k1-agt-01",
          sig: "3045022100e4b81c2f90a78341e56729103cba45678901234567890abcdef1234567890abcd",
        },
        {
          signer: "gateway-validator",
          keyId: "fido2-cred-91823",
          sig: "304402207a39d841b52c0f68e919248560123fabce8765432109876543210fedcba98765",
        },
      ],
      ledgerEntries: [
        { account: "travel_subagent_reserved", type: "debit", amountMinor: 24500 },
        { account: "paypal_settlement_clearing", type: "credit", amountMinor: 24500 },
      ],
      auditChain: {
        eventId: "evt-audit-10294",
        previousHash: "0x33b1e7c9f80214a6012489bcdae",
        recordHash: "0x77fa4219c00184ef4b201948ba2",
      },
    },
  },
  "trace-rej-7712": {
    id: "trace-rej-7712",
    actionId: "act-rej-7712-hyatt",
    environmentId: "env-sandbox-travel-01",
    environmentName: "Travel & Hospitality",
    recipient: "Grand Hyatt Luxury Villas",
    merchantCategory: "Lodging & Accommodations",
    amountMinor: 500000, // $5,000.00
    currency: "USD",
    rail: "PayPal",
    status: "rejected",
    initiatedAt: "2026-10-31T13:12:00Z",
    totalLatencyMs: 65,
    requestingAgent: {
      id: "agent-hotel",
      name: "Hotel Subagent",
      role: "Hospitality & Accommodations",
    },
    authChain: [
      {
        id: "node-root",
        name: "Lead Operator (You)",
        role: "Root User Authority",
        mandateId: "man-root-9081",
        allocatedMinor: 1000000,
        spentMinor: 245000,
        reservedMinor: 150000,
        availableMinor: 605000,
        currency: "USD",
        status: "active",
        depth: 0,
      },
      {
        id: "node-hotel",
        name: "Hotel Subagent",
        role: "Hospitality & Accommodations",
        mandateId: "man-hotel-4002",
        allocatedMinor: 400000,
        spentMinor: 120000,
        reservedMinor: 100000,
        availableMinor: 180000, // $1,800.00 available
        currency: "USD",
        status: "active",
        policyRule: "Available headroom: $1,800.00 (< $5,000.00 requested)",
        depth: 2,
      },
    ],
    stages: [
      {
        key: "initiated",
        name: "1. Request Initiated",
        description: "Agent signed call with canonical SHA-256 hash",
        status: "completed",
        timestamp: "2026-10-31T13:12:00.010Z",
        latencyMs: 12,
      },
      {
        key: "mandate_evaluated",
        name: "2. Mandate Evaluated",
        description: "Gateway rejected spend: Requested $5,000.00 exceeds agent available balance ($1,800.00)",
        status: "failed",
        timestamp: "2026-10-31T13:12:00.065Z",
        latencyMs: 53,
      },
      {
        key: "human_approved_bypass",
        name: "3. Human Approved / Bypass",
        description: "Evaluation halted due to mandate budget violation",
        status: "skipped",
        timestamp: "—",
        latencyMs: 0,
      },
      {
        key: "paypal_captured",
        name: "4. Payment Rail Execution",
        description: "Halted prior to external provider dispatch",
        status: "skipped",
        timestamp: "—",
        latencyMs: 0,
      },
      {
        key: "settled_reconciled",
        name: "5. Ledger Settlement",
        description: "Zero funds moved; denial event recorded in immutable audit log",
        status: "completed",
        timestamp: "2026-10-31T13:12:00.075Z",
        latencyMs: 10,
      },
    ],
    checklist: [
      {
        id: "chk-budget",
        name: "Budget Limit Check",
        description: "Verifies requested spend does not exceed allocated mandate pool",
        passed: false,
        errorCode: "BUDGET_EXCEEDED",
        details: "Available balance: $1,800.00 < Requested amount: $5,000.00 (Shortfall: $3,200.00)",
        remediation: "Request an authority allocation increase from Main Orchestrator or reduce booking duration.",
      },
      {
        id: "chk-rail",
        name: "Rail Allowance Check",
        description: "Confirms target payment rail is permitted",
        passed: true,
        details: "PayPal rail authorized",
      },
      {
        id: "chk-merchant",
        name: "Merchant Category Check",
        description: "Ensures recipient category exists on allowlist",
        passed: true,
        details: "Category 'Lodging & Accommodations' permitted",
      },
      {
        id: "chk-hash",
        name: "Parameter Hash Integrity Check",
        description: "Validates canonical payload hash matches digest",
        passed: true,
        details: "Cryptographic hash match confirmed",
      },
      {
        id: "chk-ledger",
        name: "Double-Entry Conservation Check",
        description: "Ensures debit entries balance credits",
        passed: true,
        details: "Zero balance affected (denial recorded cleanly)",
      },
    ],
    rawRecord: {
      traceId: "trace-rej-7712",
      outcome: "denied",
      reasonCode: "BUDGET_EXCEEDED",
      requestedMinor: 500000,
      availableMinor: 180000,
      shortfallMinor: 320000,
      ruleReference: "Rule #POL-8820 (Max Sub-Allocation)",
      timestamp: "2026-10-31T13:12:00Z",
    },
  },
  "trace-pend-4401": {
    id: "trace-pend-4401",
    actionId: "act-pend-4401-car",
    environmentId: "env-sandbox-travel-01",
    environmentName: "Travel & Hospitality",
    transactionId: "txn_pp_pending_88123",
    recipient: "Hertz Rent-A-Car Goa",
    merchantCategory: "Vehicle Rental",
    amountMinor: 38000, // $380.00
    currency: "USD",
    rail: "PayPal",
    status: "pending_capture",
    initiatedAt: "2026-10-31T14:15:30Z",
    totalLatencyMs: 820,
    uncertainStateNotice:
      "Waiting for confirmation from payment provider. The money is held in reservation, not spent.",
    requestingAgent: {
      id: "agent-travel",
      name: "Travel Subagent",
      role: "Flight & Rail Procurement",
    },
    authChain: [
      {
        id: "node-root",
        name: "Lead Operator (You)",
        role: "Root User Authority",
        mandateId: "man-root-9081",
        allocatedMinor: 1000000,
        spentMinor: 245000,
        reservedMinor: 188000,
        availableMinor: 567000,
        currency: "USD",
        status: "active",
        depth: 0,
      },
      {
        id: "node-travel",
        name: "Travel Subagent",
        role: "Flight & Rail Procurement",
        mandateId: "man-travel-4001",
        allocatedMinor: 400000,
        spentMinor: 125000,
        reservedMinor: 88000,
        availableMinor: 187000,
        currency: "USD",
        status: "active",
        depth: 2,
      },
    ],
    stages: [
      {
        key: "initiated",
        name: "1. Request Initiated",
        description: "Agent signed call with canonical SHA-256 hash",
        status: "completed",
        timestamp: "2026-10-31T14:15:30.010Z",
        latencyMs: 15,
      },
      {
        key: "mandate_evaluated",
        name: "2. Mandate Evaluated",
        description: "All mandate and category checks passed",
        status: "completed",
        timestamp: "2026-10-31T14:15:30.055Z",
        latencyMs: 45,
      },
      {
        key: "human_approved_bypass",
        name: "3. Autonomous Bypass",
        description: "$380.00 is below $500.00 approval limit",
        status: "completed",
        timestamp: "2026-10-31T14:15:30.065Z",
        latencyMs: 10,
      },
      {
        key: "paypal_captured",
        name: "4. PayPal Authorization Dispatched",
        description: "Order authorized; polling for asynchronous payment capture webhook",
        status: "active",
        timestamp: "2026-10-31T14:15:30.820Z",
        latencyMs: 755,
      },
      {
        key: "settled_reconciled",
        name: "5. Ledger Settlement",
        description: "Held in reservation escrow pending capture confirmation",
        status: "active",
        timestamp: "—",
        latencyMs: 0,
      },
    ],
    checklist: [
      {
        id: "chk-budget",
        name: "Budget Limit Check",
        description: "Verifies requested spend does not exceed allocated pool",
        passed: true,
        details: "Available: $1,870.00 >= Requested: $380.00",
      },
      {
        id: "chk-rail",
        name: "Rail Allowance Check",
        description: "Confirms payment rail is configured",
        passed: true,
        details: "PayPal active",
      },
      {
        id: "chk-merchant",
        name: "Merchant Category Check",
        description: "Ensures recipient category exists on allowlist",
        passed: true,
        details: "Vehicle Rental in allowlist",
      },
      {
        id: "chk-hash",
        name: "Parameter Hash Integrity Check",
        description: "Validates canonical payload hash matches",
        passed: true,
        details: "Hash verified",
      },
      {
        id: "chk-ledger",
        name: "Double-Entry Conservation Check",
        description: "Ensures debit entries balance credits",
        passed: true,
        details: "Reserved in escrow pending capture ($380.00)",
      },
    ],
    rawRecord: {
      traceId: "trace-pend-4401",
      status: "pending_capture",
      heldReservationMinor: 38000,
      escrowState: "HELD_PENDING_PAYPAL_CAPTURE",
    },
  },
};
