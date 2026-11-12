export type SecuritySeverity = "CRITICAL" | "WARNING" | "INFO";

export interface SecurityEventItem {
  id: string;
  severity: SecuritySeverity;
  timestamp: string;
  agentId: string;
  agentName: string;
  ruleViolated: string;
  actionAttempted: string;
  amountMinor?: number;
  currency?: string;
  requestHash?: string;
  traceId?: string;
  isSimulation?: boolean;
  details?: string;
}

export interface RevocationSubtreeImpact {
  targetMandateId: string;
  targetAgentName: string;
  cascadeAgentsCount: number;
  cascadeMandatesCount: number;
  heldReservationsMinor: number;
  currency: string;
  childAgentNames: string[];
}

export const DEFAULT_SECURITY_EVENTS: SecurityEventItem[] = [
  {
    id: "sec-evt-01",
    severity: "CRITICAL",
    timestamp: "2026-10-31T13:12:05Z",
    agentId: "agent-hotel",
    agentName: "Hotel Subagent",
    ruleViolated: "Rule #POL-8820: Budget Overspend Prevented",
    actionAttempted: "lodging.reserve ($5,000.00)",
    amountMinor: 500000,
    currency: "USD",
    requestHash: "0x55a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c",
    traceId: "trace-rej-7712",
    details:
      "Subagent attempted to spend $5,000.00 with only $1,800.00 available in delegated pool.",
  },
  {
    id: "sec-evt-02",
    severity: "CRITICAL",
    timestamp: "2026-10-31T11:45:00Z",
    agentId: "agent-flights-unfunded",
    agentName: "Flight Scraper",
    ruleViolated: "Secp256k1 Cryptographic Signature Failure",
    actionAttempted: "delegation.claim ($8,000.00)",
    amountMinor: 800000,
    currency: "USD",
    requestHash: "0x44c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
    traceId: "trace-sim-6011",
    isSimulation: true,
    details:
      "Forged parent delegation signature rejected by gateway. Injected by Sandbox Attack Simulator.",
  },
  {
    id: "sec-evt-03",
    severity: "WARNING",
    timestamp: "2026-10-31T10:30:15Z",
    agentId: "agent-travel",
    agentName: "Travel Subagent",
    ruleViolated: "Rule #POL-3001: Category Scope Mismatch",
    actionAttempted: "electronics.purchase ($1,200.00)",
    amountMinor: 120000,
    currency: "USD",
    requestHash: "0x99a8b7c6d5e4f302192837465019283746501928374650192837465019283746",
    traceId: "trace-rej-7712",
    details:
      "Agent requested purchase outside permitted categories ('Airlines', 'Railways', 'Ground Transport').",
  },
  {
    id: "sec-evt-04",
    severity: "WARNING",
    timestamp: "2026-10-31T09:18:40Z",
    agentId: "agent-hotel",
    agentName: "Hotel Subagent",
    ruleViolated: "Idempotency Key Conflict: Simultaneous Spend",
    actionAttempted: "lodging.reserve ($1,000.00)",
    amountMinor: 100000,
    currency: "USD",
    requestHash: "0x8877665544332211009988776655443322110099887766554433221100998877",
    traceId: "trace-pay-9018",
    isSimulation: true,
    details:
      "Replay attack simulation blocked. Duplicate transaction key detected within active reservation window.",
  },
  {
    id: "sec-evt-05",
    severity: "INFO",
    timestamp: "2026-10-30T16:00:00Z",
    agentId: "orchestrator-root",
    agentName: "Main Orchestrator",
    ruleViolated: "Autonomous Bypass Applied",
    actionAttempted: "payment.settle ($245.00)",
    amountMinor: 24500,
    currency: "USD",
    requestHash: "0x89f41b2a7e93c07d391ef41908bc210081234567890abcdef1234567890abcd",
    traceId: "trace-pay-9018",
    details:
      "Spend <= $500.00 human approval threshold; autonomous execution permitted without human sign-off.",
  },
];
