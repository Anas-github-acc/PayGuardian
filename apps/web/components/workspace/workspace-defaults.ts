import type { AgentNodeData, AgentEdgeData, ChatMessage } from "../../app/lib/workspace-store";

export interface SessionItem {
  id: string;
  title: string;
  description?: string;
  status: "active" | "waiting for you" | "done";
  lastActivity: string;
  agentCount: number;
}

export interface MemoryItem {
  id: string;
  category: "session" | "environment" | "agent";
  key: string;
  value: string;
  contextSnippet?: string;
  agentName?: string;
  savedAt: string;
  isRevoked?: boolean;
}

export interface ActivityFeedItem {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  amountMinor?: number;
  currency?: string;
  outcome: "success" | "denied" | "pending";
  reasonCode?: string;
  isSimulation?: boolean;
  traceId?: string;
}

export const INITIAL_SESSIONS: SessionItem[] = [
  {
    id: "sess-goa-01",
    title: "Goa Tech Conference Logistics",
    description:
      "Flights, stadium-adjacent hotel and ground transfers for the team's conference trip. Two sign-offs waiting.",
    status: "waiting for you",
    lastActivity: "2 mins ago",
    agentCount: 3,
  },
  {
    id: "sess-cloud-02",
    title: "AWS Cluster Scale Out",
    description:
      "Cost-capped instance provisioning for the production cluster scale-out window.",
    status: "active",
    lastActivity: "18 mins ago",
    agentCount: 2,
  },
  {
    id: "sess-tax-03",
    title: "Q3 Vendor Audit & Receipts",
    description:
      "Collecting and reconciling vendor receipts for the quarterly audit filing.",
    status: "done",
    lastActivity: "Yesterday",
    agentCount: 1,
  },
];

export const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: "mem-01",
    category: "environment",
    key: "dietary_preference",
    value: "Vegetarian meals only for all airline bookings; seat 3A or window preference",
    contextSnippet: "Operator requested default travel dietary preferences",
    agentName: "Travel Subagent",
    savedAt: "2026-10-30T10:15:00Z",
  },
  {
    id: "mem-02",
    category: "session",
    key: "hotel_proximity",
    value: "Hotel must be within 5km radius of Dr. Shyama Prasad Mukherjee Stadium",
    contextSnippet: "Session Goa Tech Conference Logistics",
    agentName: "Hotel Subagent",
    savedAt: "2026-10-31T09:30:00Z",
  },
  {
    id: "mem-03",
    category: "agent",
    key: "preferred_airline",
    value: "IndiGo or Air India direct routes only, avoid overnight layovers",
    contextSnippet: "Direct agent rule configuration",
    agentName: "Travel Subagent",
    savedAt: "2026-10-29T16:00:00Z",
  },
];

export const INITIAL_ACTIVITIES: ActivityFeedItem[] = [
  {
    id: "act-01",
    timestamp: "14:02:18",
    actorName: "Hotel Subagent",
    action: "Reserved room at Grand Hyatt Goa",
    amountMinor: 100000,
    currency: "USD",
    outcome: "success",
    isSimulation: false,
    traceId: "trace-pay-9018",
  },
  {
    id: "act-02",
    timestamp: "13:58:45",
    actorName: "Travel Subagent",
    action: "Paid IndiGo Flight 6E-204 via PayPal",
    amountMinor: 24500,
    currency: "USD",
    outcome: "success",
    isSimulation: false,
    traceId: "trace-pay-9019",
  },
  {
    id: "act-03",
    timestamp: "13:40:10",
    actorName: "Flight Scraper",
    action: "Attached as structural helper (unfunded)",
    amountMinor: 0,
    currency: "USD",
    outcome: "success",
    isSimulation: true,
    traceId: "trace-att-1029",
  },
  {
    id: "act-04",
    timestamp: "13:12:05",
    actorName: "Hotel Subagent",
    action: "Gateway blocked spend: $5,000 > remaining budget",
    amountMinor: 500000,
    currency: "USD",
    outcome: "denied",
    reasonCode: "BUDGET_EXCEEDED",
    isSimulation: false,
    traceId: "trace-rej-7712",
  },
];

export const DEFAULT_GRAPH_NODES: AgentNodeData[] = [
  {
    id: "orchestrator-root",
    name: "Main Orchestrator",
    role: "orchestrator",
    status: "active",
    allocatedMinor: 1000000,
    spentMinor: 245000,
    reservedMinor: 150000,
    position: [0, 80, 0],
    isFunded: true,
  },
  {
    id: "agent-travel",
    name: "Travel Subagent",
    role: "subagent",
    status: "active",
    allocatedMinor: 400000,
    spentMinor: 125000,
    reservedMinor: 50000,
    position: [-110, -30, 20],
    isFunded: true,
  },
  {
    id: "agent-hotel",
    name: "Hotel Subagent",
    role: "subagent",
    status: "active",
    allocatedMinor: 400000,
    spentMinor: 120000,
    reservedMinor: 100000,
    position: [110, -30, 20],
    isFunded: true,
  },
  {
    id: "agent-flights-unfunded",
    name: "Flight Scraper",
    role: "subagent",
    status: "unfunded",
    allocatedMinor: 0,
    spentMinor: 0,
    reservedMinor: 0,
    position: [-160, -120, -25],
    isFunded: false, // Dashed structural attachment
  },
  {
    id: "agent-booking-gw",
    name: "Booking Gateway",
    role: "subagent",
    status: "active",
    allocatedMinor: 200000,
    spentMinor: 0,
    reservedMinor: 0,
    position: [160, -120, -25],
    isFunded: true,
  },
];

export const DEFAULT_GRAPH_EDGES: AgentEdgeData[] = [
  {
    id: "edge-root-travel",
    source: "orchestrator-root",
    target: "agent-travel",
    isAuthorized: true, // Solid edge
    status: "flowing",
    amountMinor: 400000,
  },
  {
    id: "edge-root-hotel",
    source: "orchestrator-root",
    target: "agent-hotel",
    isAuthorized: true, // Solid edge
    status: "idle",
    amountMinor: 400000,
  },
  {
    id: "edge-travel-scraper",
    source: "agent-travel",
    target: "agent-flights-unfunded",
    isAuthorized: false, // Dashed structural edge
    status: "idle",
    amountMinor: 0,
  },
  {
    id: "edge-hotel-booking",
    source: "agent-hotel",
    target: "agent-booking-gw",
    isAuthorized: true, // Solid edge
    status: "payment_pulse",
    amountMinor: 200000,
  },
];

export const DEFAULT_CHAT_MESSAGES: ChatMessage[] = [
  {
    type: "agent_says",
    id: "msg-init-1",
    sender: "Main Orchestrator",
    timestamp: "2026-10-31T13:45:00Z",
    text: "Welcome to PayGuardian. I have initialized the Travel & Hospitality autonomous environment with a total spending authority limit of $10,000.00. I have drafted the capital delegation plan.",
  },
  {
    type: "verified_block",
    id: "msg-vplan-1",
    cardType: "budget_plan",
    sender: "Gateway Policy Engine",
    timestamp: "2026-10-31T13:46:00Z",
    verifiedAt: "2026-10-31T13:46:00Z",
    payload: {
      title: "Proposed Subagent Allocation Plan",
      parentMandateId: "man-root-9081",
      totalRequestedMinor: 1000000,
      currency: "USD",
      status: "approved",
      subAllocations: [
        { agentId: "agent-travel", agentName: "Travel Subagent", role: "Logistics", amountMinor: 400000 },
        { agentId: "agent-hotel", agentName: "Hotel Subagent", role: "Hospitality", amountMinor: 400000 },
        { agentId: "agent-reserve", agentName: "Unallocated Reserve", role: "Contingency", amountMinor: 200000 },
      ],
      policyNotes: "Total sum matches root mandate budget ($10,000.00). Max depth ≤ 2.",
    },
  },
  {
    type: "agent_says",
    id: "msg-init-2",
    sender: "Travel Subagent",
    timestamp: "2026-10-31T13:58:00Z",
    text: "I have confirmed the flight for the team to Goa on IndiGo 6E-204 and disbursed $245.00 via PayPal. The transaction has completed with cryptographic signature verification.",
  },
  {
    type: "verified_block",
    id: "msg-vpay-1",
    cardType: "payment_result",
    sender: "PayPal Rail Gateway",
    timestamp: "2026-10-31T13:58:45Z",
    verifiedAt: "2026-10-31T13:58:45Z",
    payload: {
      transactionId: "txn_pp_982194820",
      recipient: "IndiGo Airlines Ltd",
      merchantCategory: "Airlines & Air Travel",
      amountMinor: 24500,
      currency: "USD",
      rail: "PayPal",
      authHash: "0x89f41b2a7e93c07d391ef41908bc21",
      currentStage: "completed",
      agentName: "Travel Subagent",
    },
  },
];
