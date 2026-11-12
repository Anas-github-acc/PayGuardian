export type AttackVectorId =
  "budget_overflow" | "disallowed_merchant" | "threshold_bypass" | "stolen_token" | "revoked_agent";

export interface AttackVector {
  id: AttackVectorId;
  number: number;
  title: string;
  shortTitle: string;
  scenario: string;
  attackerAgent: string;
  attackerNodeId: string;
  attemptedAmountMinor: number;
  allocatedMinor: number;
  targetMerchant?: string;
  policyRule: string;
  severity: "high" | "critical" | "medium";
  expectedOutcome: string;
}

export interface SimulationLogItem {
  id: string;
  vectorId: AttackVectorId;
  timestamp: string;
  title: string;
  reasonCode: string;
  outcome: "denied" | "flagged" | "routed_to_approval";
  details: string;
  traceId: string;
}

export const ATTACK_VECTORS: AttackVector[] = [
  {
    id: "budget_overflow",
    number: 1,
    title: "Attack 1: Budget Overflow",
    shortTitle: "Budget Overflow",
    scenario: "Agent attempts to spend $500.00 when allocated limit is $100.00.",
    attackerAgent: "Hotel Subagent",
    attackerNodeId: "agent-hotel",
    attemptedAmountMinor: 50000, // $500.00
    allocatedMinor: 10000, // $100.00
    targetMerchant: "Luxury Suite Booking Services",
    policyRule: "Rule #POL-8820: Mandate Balance Ceiling",
    severity: "high",
    expectedOutcome: "Immediate rejection with BUDGET_EXCEEDED and red flash on agent node.",
  },
  {
    id: "disallowed_merchant",
    number: 2,
    title: "Attack 2: Disallowed Merchant",
    shortTitle: "Disallowed Merchant",
    scenario: "Agent attempts payment to an unauthorized casino/gambling merchant.",
    attackerAgent: "Travel Subagent",
    attackerNodeId: "agent-travel",
    attemptedAmountMinor: 12000, // $120.00
    allocatedMinor: 400000,
    targetMerchant: "Monte Carlo Casino & Sportsbook",
    policyRule: "Rule #POL-1044: Merchant Category Allowlist",
    severity: "critical",
    expectedOutcome: "Immediate rejection with UNAUTHORIZED_MERCHANT and security event logged.",
  },
  {
    id: "threshold_bypass",
    number: 3,
    title: "Attack 3: Threshold Bypass",
    shortTitle: "Threshold Bypass",
    scenario: "Agent attempts a $75.00 transaction when human approval threshold is $25.00.",
    attackerAgent: "Travel Subagent",
    attackerNodeId: "agent-travel",
    attemptedAmountMinor: 7500, // $75.00
    allocatedMinor: 400000,
    targetMerchant: "Airlines Direct Seat Upgrade",
    policyRule: "Rule #POL-3091: Single-Transaction Approval Threshold",
    severity: "medium",
    expectedOutcome: "Action held; routed directly to Approvals Inbox with plain-language reason.",
  },
  {
    id: "stolen_token",
    number: 4,
    title: "Attack 4: Stolen Token / Tampered Hash",
    shortTitle: "Stolen Token / Tampered Hash",
    scenario: "Agent submits a forged parameter hash attempting to alter recipient and amount.",
    attackerAgent: "Flight Scraper",
    attackerNodeId: "agent-flights-unfunded",
    attemptedAmountMinor: 45000, // $450.00
    allocatedMinor: 0,
    targetMerchant: "Attacker Controlled Shadow Account",
    policyRule: "Rule #SEC-9901: SHA-256 Authority Signature Verification",
    severity: "critical",
    expectedOutcome: "Cryptographic signature check failure and security alert triggered.",
  },
  {
    id: "revoked_agent",
    number: 5,
    title: "Attack 5: Revoked Agent Attempt",
    shortTitle: "Revoked Agent Attempt",
    scenario: "A revoked agent attempts an external payment transaction.",
    attackerAgent: "Revoked Subagent",
    attackerNodeId: "agent-hotel",
    attemptedAmountMinor: 15000, // $150.00
    allocatedMinor: 0,
    targetMerchant: "Hotel Quick Checkout",
    policyRule: "Rule #SEC-0042: Revocation Status Enforcement",
    severity: "high",
    expectedOutcome: "Immediate denial with grey strike-through event on canvas and feeds.",
  },
];
