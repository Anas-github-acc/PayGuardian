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
}

export type ApprovalFilter = "all" | "pending" | "approved" | "rejected";

export const DEFAULT_APPROVALS: ApprovalItem[] = [
  {
    id: "appr-flight-901",
    environmentId: "env-sandbox-travel-01",
    mandateId: "man-travel-4001",
    agentId: "agent-travel",
    agentName: "Travel Subagent",
    agentRole: "subagent",
    action: "flight.procure",
    purpose: "Round-trip direct flight Goa (GOI) to Mumbai (BOM) on IndiGo Airlines",
    recipient: "IndiGo Airlines Ltd",
    merchantCategory: "Airlines & Air Travel",
    amountMinor: 65000, // $650.00
    currency: "USD",
    requestHash: "0x7a39d841b52c0f68e919248560123fabce8765432109876543210fedcba98765",
    status: "pending",
    reasonForSignOff: "Amount $650.00 exceeds agent's single-action autonomous limit of $500.00",
    remainingBudgetAfterPaymentMinor: 210000, // $2,100.00 left
    parentMandateLimitMinor: 400000, // $4,000.00
    isHardLimitExceeded: false,
    expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45m from now
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15m ago
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    ancestorChain: [
      { id: "user-root", name: "You (Operator)", role: "Root Authority" },
      { id: "orchestrator-root", name: "Main Orchestrator", role: "Environment Overseer" },
      { id: "agent-travel", name: "Travel Subagent", role: "Flight & Rail Procurement" },
    ],
    agentSays:
      "I have located direct departure flight 6E-204 at 09:15 AM matching your morning schedule constraint. Standard business class fare is $650.00. Because this exceeds my autonomous single-action cap of $500.00, I require human cryptographic confirmation.",
    parameters: {
      flightNumber: "6E-204",
      departure: "GOI",
      arrival: "BOM",
      travelClass: "Business",
      passenger: "Lead Operator",
      fareBreakdownMinor: 65000,
    },
  },
  {
    id: "appr-hotel-902",
    environmentId: "env-sandbox-travel-01",
    mandateId: "man-hotel-4002",
    agentId: "agent-hotel",
    agentName: "Hotel Subagent",
    agentRole: "subagent",
    action: "lodging.reserve",
    purpose: "5 nights accommodation at Grand Hyatt Goa during conference week",
    recipient: "Grand Hyatt Goa",
    merchantCategory: "Lodging & Hotels",
    amountMinor: 450000, // $4,500.00
    currency: "USD",
    requestHash: "0x4b81c2f90a78341e56729103cba45678901234567890abcdef1234567890abcd",
    status: "pending",
    reasonForSignOff: "Amount $4,500.00 exceeds subagent allocated budget of $4,000.00",
    remainingBudgetAfterPaymentMinor: -50000, // Negative budget
    parentMandateLimitMinor: 400000, // $4,000.00 allocated
    isHardLimitExceeded: true,
    hardLimitExceededReason: "Parent mandate budget is $4,000.00 ($2,800.00 available). Requested amount of $4,500.00 exceeds available headroom.",
    expiresAt: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    ancestorChain: [
      { id: "user-root", name: "You (Operator)", role: "Root Authority" },
      { id: "orchestrator-root", name: "Main Orchestrator", role: "Environment Overseer" },
      { id: "agent-hotel", name: "Hotel Subagent", role: "Hospitality & Accommodations" },
    ],
    agentSays:
      "All standard tier rooms were booked. I have reserved the Club Oceanfront Suite at Grand Hyatt Goa to ensure proximity to conference venue. Total exceeds my allocated pool. Please amend limit or approve with emergency override.",
    parameters: {
      property: "Grand Hyatt Goa",
      checkIn: "2026-11-12",
      checkOut: "2026-11-17",
      roomType: "Club Oceanfront Suite",
      ratePerNightMinor: 90000,
    },
  },
  {
    id: "appr-sim-903",
    environmentId: "env-sandbox-travel-01",
    mandateId: "man-travel-4001",
    agentId: "agent-travel",
    agentName: "Travel Subagent",
    agentRole: "subagent",
    action: "ground.transit",
    purpose: "Airport executive chauffeur transfer to venue",
    recipient: "Goa Luxury Cabs Ltd",
    merchantCategory: "Ground Transportation",
    amountMinor: 8500, // $85.00
    currency: "USD",
    requestHash: "0x12a93b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f901a2b3c4d5",
    status: "approved",
    reasonForSignOff: "Autonomous threshold sign-off",
    remainingBudgetAfterPaymentMinor: 275000,
    parentMandateLimitMinor: 400000,
    isHardLimitExceeded: false,
    expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    approvedBy: "operator@payguardian.local",
    approvedAt: new Date(Date.now() - 2.8 * 3600 * 1000).toISOString(),
    rejectionReason: null,
    ancestorChain: [
      { id: "user-root", name: "You (Operator)", role: "Root Authority" },
      { id: "orchestrator-root", name: "Main Orchestrator", role: "Environment Overseer" },
      { id: "agent-travel", name: "Travel Subagent", role: "Flight & Rail Procurement" },
    ],
    agentSays: "Confirmed airport pickup service upon flight landing.",
  },
  {
    id: "appr-reject-904",
    environmentId: "env-sandbox-travel-01",
    mandateId: "man-hotel-4002",
    agentId: "agent-hotel",
    agentName: "Hotel Subagent",
    agentRole: "subagent",
    action: "entertainment.event",
    purpose: "VIP concert tickets for team networking night",
    recipient: "Goa Sunsplash Ticketing",
    merchantCategory: "Entertainment & Nightlife",
    amountMinor: 120000, // $1,200.00
    currency: "USD",
    requestHash: "0x98f7e6d5c4b3a210987654321fedcba0123456789abcdef0123456789abcdef0",
    status: "rejected",
    reasonForSignOff: "Disallowed merchant category: Entertainment & Nightlife",
    remainingBudgetAfterPaymentMinor: 280000,
    parentMandateLimitMinor: 400000,
    isHardLimitExceeded: false,
    expiresAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    approvedBy: null,
    approvedAt: null,
    rejectionReason: "Policy violation: Category Entertainment is excluded from Travel environment mandate allowlist.",
    ancestorChain: [
      { id: "user-root", name: "You (Operator)", role: "Root Authority" },
      { id: "orchestrator-root", name: "Main Orchestrator", role: "Environment Overseer" },
      { id: "agent-hotel", name: "Hotel Subagent", role: "Hospitality & Accommodations" },
    ],
    agentSays: "Proposed entertainment pass procurement for networking.",
  },
];
