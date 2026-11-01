export interface MandateRow {
  id: string;
  holderAgentId: string;
  agentName: string;
  role: "orchestrator" | "subagent";
  parentMandateId: string | null;
  parentAgentName: string;
  budgetLimitMinor: number;
  allocatedMinor: number;
  spentMinor: number;
  reservedMinor: number;
  availableMinor: number;
  currency: string;
  state: "active" | "expired" | "revoked";
  expiresAt: string;
  canDelegate: boolean;
  maxDelegationDepth: number;
  permittedActions: string[];
}

export interface ActivityAuditRow {
  id: string;
  actionId: string;
  environmentId: string;
  eventType: string;
  actorType: "user" | "agent" | "system" | "service";
  actorId: string;
  actorName: string;
  amountMinor?: number;
  currency?: string;
  outcome: "success" | "denied" | "failure";
  reasonCode?: string | null;
  eventHash: string;
  previousHash: string | null;
  createdAt: string;
  isSimulation?: boolean;
  payload?: Record<string, unknown>;
}

export interface PolicyRow {
  id: string;
  agentId: string;
  agentName: string;
  role: "orchestrator" | "subagent";
  maxSharePercent: number;
  singleActionLimitMinor: number;
  approvalThresholdMinor: number;
  currency: string;
  allowedCategories: string[];
  maxDelegationDepth: number;
  updatedAt: string;
}

export const DEFAULT_MANDATES: MandateRow[] = [
  {
    id: "man-root-9081",
    holderAgentId: "orchestrator-root",
    agentName: "Main Orchestrator",
    role: "orchestrator",
    parentMandateId: null,
    parentAgentName: "Lead Operator (You)",
    budgetLimitMinor: 1000000, // $10,000.00
    allocatedMinor: 800000, // $8,000.00 delegated
    spentMinor: 245000, // $2,450.00
    reservedMinor: 150000, // $1,500.00
    availableMinor: 605000, // $6,050.00
    currency: "USD",
    state: "active",
    expiresAt: "2026-12-31T23:59:59Z",
    canDelegate: true,
    maxDelegationDepth: 2,
    permittedActions: ["travel.*", "lodging.*", "flight.*"],
  },
  {
    id: "man-travel-4001",
    holderAgentId: "agent-travel",
    agentName: "Travel Subagent",
    role: "subagent",
    parentMandateId: "man-root-9081",
    parentAgentName: "Main Orchestrator",
    budgetLimitMinor: 400000, // $4,000.00
    allocatedMinor: 0,
    spentMinor: 125000, // $1,250.00
    reservedMinor: 50000, // $500.00
    availableMinor: 225000, // $2,250.00
    currency: "USD",
    state: "active",
    expiresAt: "2026-12-15T23:59:59Z",
    canDelegate: true,
    maxDelegationDepth: 1,
    permittedActions: ["flight.procure", "ground.transit", "rail.ticket"],
  },
  {
    id: "man-hotel-4002",
    holderAgentId: "agent-hotel",
    agentName: "Hotel Subagent",
    role: "subagent",
    parentMandateId: "man-root-9081",
    parentAgentName: "Main Orchestrator",
    budgetLimitMinor: 400000, // $4,000.00
    allocatedMinor: 200000, // $2,000.00
    spentMinor: 120000, // $1,200.00
    reservedMinor: 100000, // $1,000.00
    availableMinor: 180000, // $1,800.00
    currency: "USD",
    state: "active",
    expiresAt: "2026-12-15T23:59:59Z",
    canDelegate: true,
    maxDelegationDepth: 1,
    permittedActions: ["lodging.reserve", "hospitality.booking"],
  },
  {
    id: "man-booking-gw-4003",
    holderAgentId: "agent-booking-gw",
    agentName: "Booking Gateway",
    role: "subagent",
    parentMandateId: "man-hotel-4002",
    parentAgentName: "Hotel Subagent",
    budgetLimitMinor: 200000, // $2,000.00
    allocatedMinor: 0,
    spentMinor: 0,
    reservedMinor: 0,
    availableMinor: 200000,
    currency: "USD",
    state: "active",
    expiresAt: "2026-11-30T23:59:59Z",
    canDelegate: false,
    maxDelegationDepth: 0,
    permittedActions: ["payment.settle"],
  },
  {
    id: "man-flights-unfunded-4004",
    holderAgentId: "agent-flights-unfunded",
    agentName: "Flight Scraper",
    role: "subagent",
    parentMandateId: "man-travel-4001",
    parentAgentName: "Travel Subagent",
    budgetLimitMinor: 0,
    allocatedMinor: 0,
    spentMinor: 0,
    reservedMinor: 0,
    availableMinor: 0,
    currency: "USD",
    state: "active",
    expiresAt: "2026-12-31T23:59:59Z",
    canDelegate: false,
    maxDelegationDepth: 0,
    permittedActions: ["flight.read_schedule"],
  },
];

export const DEFAULT_ACTIVITY_EVENTS: ActivityAuditRow[] = [
  {
    id: "evt-01",
    actionId: "act-pay-9018",
    environmentId: "env-sandbox-travel-01",
    eventType: "payment.settled",
    actorType: "agent",
    actorId: "agent-travel",
    actorName: "Travel Subagent",
    amountMinor: 24500,
    currency: "USD",
    outcome: "success",
    eventHash: "0x77fa4219c00184ef4b201948ba2c4ef891a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6",
    previousHash: "0x33b1e7c9f80214a6012489bcdae9081234567890abcdef1234567890abcdef0",
    createdAt: "2026-10-31T13:58:45Z",
    payload: {
      recipient: "IndiGo Airlines Ltd",
      rail: "PayPal",
      ticketNumber: "6E-204-9810",
    },
  },
  {
    id: "evt-02",
    actionId: "act-appr-901",
    environmentId: "env-sandbox-travel-01",
    eventType: "approval.created",
    actorType: "agent",
    actorId: "agent-travel",
    actorName: "Travel Subagent",
    amountMinor: 65000,
    currency: "USD",
    outcome: "success",
    eventHash: "0x98f41b2a7e93c07d391ef41908bc210081234567890abcdef1234567890abcd",
    previousHash: "0x77fa4219c00184ef4b201948ba2c4ef891a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6",
    createdAt: "2026-10-31T13:45:00Z",
    payload: {
      reason: "Single action threshold $500.00 exceeded",
      recipient: "IndiGo Airlines Ltd",
    },
  },
  {
    id: "evt-03",
    actionId: "act-rej-7712",
    environmentId: "env-sandbox-travel-01",
    eventType: "mandate.denial",
    actorType: "agent",
    actorId: "agent-hotel",
    actorName: "Hotel Subagent",
    amountMinor: 500000,
    currency: "USD",
    outcome: "denied",
    reasonCode: "BUDGET_EXCEEDED",
    eventHash: "0x55a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c",
    previousHash: "0x98f41b2a7e93c07d391ef41908bc210081234567890abcdef1234567890abcd",
    createdAt: "2026-10-31T13:12:05Z",
    payload: {
      attemptedMerchant: "Grand Hyatt Luxury Villas",
      requestedMinor: 500000,
      availableMinor: 180000,
    },
  },
  {
    id: "evt-04",
    actionId: "act-del-9082",
    environmentId: "env-sandbox-travel-01",
    eventType: "mandate.delegated",
    actorType: "agent",
    actorId: "orchestrator-root",
    actorName: "Main Orchestrator",
    amountMinor: 400000,
    currency: "USD",
    outcome: "success",
    eventHash: "0x33b1e7c9f80214a6012489bcdae9081234567890abcdef1234567890abcdef0",
    previousHash: "0x11029384756abcdef91827364501928374650192837465019283746501928374",
    createdAt: "2026-10-31T12:00:00Z",
    payload: {
      targetAgent: "agent-travel",
      subAllocationMinor: 400000,
    },
  },
  {
    id: "evt-05",
    actionId: "act-sim-vector-01",
    environmentId: "env-sandbox-travel-01",
    eventType: "simulation.attack_blocked",
    actorType: "system",
    actorId: "attack-simulator",
    actorName: "Sandbox Attack Simulator",
    amountMinor: 800000,
    currency: "USD",
    outcome: "denied",
    reasonCode: "FORGED_DELEGATION",
    eventHash: "0x44c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
    previousHash: "0x55a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c",
    createdAt: "2026-10-31T11:45:00Z",
    isSimulation: true,
    payload: {
      attackVector: "Forged Delegation Signature",
      ruleBlocked: "Secp256k1 Ancestor Cryptographic Chain Signature Mismatch",
    },
  },
];

export const DEFAULT_POLICIES: PolicyRow[] = [
  {
    id: "pol-root",
    agentId: "orchestrator-root",
    agentName: "Main Orchestrator",
    role: "orchestrator",
    maxSharePercent: 100,
    singleActionLimitMinor: 100000, // $1,000.00
    approvalThresholdMinor: 100000, // $1,000.00
    currency: "USD",
    allowedCategories: ["travel.*", "lodging.*", "cloud.*"],
    maxDelegationDepth: 2,
    updatedAt: "2026-10-28T10:00:00Z",
  },
  {
    id: "pol-travel",
    agentId: "agent-travel",
    agentName: "Travel Subagent",
    role: "subagent",
    maxSharePercent: 40,
    singleActionLimitMinor: 50000, // $500.00
    approvalThresholdMinor: 50000, // $500.00
    currency: "USD",
    allowedCategories: ["Airlines", "Railways", "Ground Transport"],
    maxDelegationDepth: 1,
    updatedAt: "2026-10-28T10:00:00Z",
  },
  {
    id: "pol-hotel",
    agentId: "agent-hotel",
    agentName: "Hotel Subagent",
    role: "subagent",
    maxSharePercent: 40,
    singleActionLimitMinor: 80000, // $800.00
    approvalThresholdMinor: 50000, // $500.00
    currency: "USD",
    allowedCategories: ["Hotels", "Resorts", "Accommodations"],
    maxDelegationDepth: 1,
    updatedAt: "2026-10-28T10:00:00Z",
  },
  {
    id: "pol-booking-gw",
    agentId: "agent-booking-gw",
    agentName: "Booking Gateway",
    role: "subagent",
    maxSharePercent: 20,
    singleActionLimitMinor: 20000, // $200.00
    approvalThresholdMinor: 20000, // $200.00
    currency: "USD",
    allowedCategories: ["Merchant Clearing"],
    maxDelegationDepth: 0,
    updatedAt: "2026-10-28T10:00:00Z",
  },
];
