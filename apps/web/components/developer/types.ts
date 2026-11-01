export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  secretMasked: string;
  environment: "production" | "sandbox";
  createdAt: string;
  lastUsedAt: string | null;
  scopes: string[];
  status: "active" | "revoked";
}

export interface McpConnectionStatus {
  status: "connected" | "connecting" | "offline";
  latencyMs: number | null;
  endpointUrl: string;
  supportedTools: {
    name: string;
    description: string;
    parameters: string[];
  }[];
  serverVersion: string;
  lastTestedAt: string | null;
}

export const DEFAULT_API_KEYS: ApiKey[] = [
  {
    id: "key-prod-01",
    name: "Production Cloud Ops Agent Key",
    keyPrefix: "pg_live_8f91",
    secretMasked: "pg_live_8f91••••••••••••••••••••3a9d",
    environment: "production",
    createdAt: "2026-10-15T08:30:00Z",
    lastUsedAt: "2026-10-31T13:45:00Z",
    scopes: ["payments:create", "mandates:read", "mandates:delegate", "traces:read"],
    status: "active",
  },
  {
    id: "key-sbx-02",
    name: "Travel Concierge Sandbox Key",
    keyPrefix: "pg_test_4b22",
    secretMasked: "pg_test_4b22••••••••••••••••••••8a41",
    environment: "sandbox",
    createdAt: "2026-10-28T10:00:00Z",
    lastUsedAt: "2026-10-31T14:02:00Z",
    scopes: ["payments:create", "mandates:read", "traces:read"],
    status: "active",
  },
  {
    id: "key-sbx-03",
    name: "Flight Scraper Read-Only Key",
    keyPrefix: "pg_test_90cc",
    secretMasked: "pg_test_90cc••••••••••••••••••••2e75",
    environment: "sandbox",
    createdAt: "2026-10-29T14:20:00Z",
    lastUsedAt: "2026-10-31T12:00:00Z",
    scopes: ["mandates:read", "traces:read"],
    status: "active",
  },
];

export const DEFAULT_MCP_TOOLS = [
  {
    name: "payguardian_request_budget",
    description: "Requests a delegated spending allocation from the parent orchestrator mandate.",
    parameters: ["amountMinor: integer", "currency: string", "purpose: string"],
  },
  {
    name: "payguardian_execute_payment",
    description: "Disburses an authorized payment via PayPal with cryptographic mandate co-signature.",
    parameters: ["recipient: string", "amountMinor: integer", "merchantCategory: string", "idempotencyKey: string"],
  },
  {
    name: "payguardian_delegate_mandate",
    description: "Sub-delegates budget authority to a validated specialist child agent node.",
    parameters: ["childAgentId: string", "allocatedMinor: integer", "permittedActions: string[]"],
  },
  {
    name: "payguardian_query_balance",
    description: "Reads the exact integer minor-unit balance, reserved hold, and remaining ceiling.",
    parameters: ["mandateId: string"],
  },
  {
    name: "payguardian_check_policy",
    description: "Evaluates whether an intended transaction complies with merchant allowlists and approval thresholds.",
    parameters: ["amountMinor: integer", "merchantName: string", "merchantCategory: string"],
  },
];
