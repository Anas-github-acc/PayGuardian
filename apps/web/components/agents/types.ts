export type AgentCategory =
  | "all"
  | "logistics"
  | "infrastructure"
  | "procurement"
  | "finance"
  | "gateway"
  | "compliance";

export type AuthorityTierLevel = 1 | 2 | 3 | 4;

export interface SecurityAuditInfo {
  auditedBy: string;
  auditDate: string;
  cveVulnerabilities: number;
  status: "certified" | "passed";
  signatureHash: string;
  sandboxTested: boolean;
}

export interface SpecialistAgent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  specialty: string;
  role: "orchestrator" | "subagent";
  category: "logistics" | "infrastructure" | "procurement" | "finance" | "gateway" | "compliance";
  authorityTier: string;
  tierLevel: AuthorityTierLevel;
  recommendedBudgetMinor: number;
  currency: string;
  supportedRails: string[];
  publisher: "Official PayGuardian" | "Verified Partner" | "Custom";
  avatarIcon: "plane" | "cloud" | "shopping-cart" | "dollar-sign" | "network" | "shield-check";
  permissions: string[];
  samplePrompts: string[];
  securityAudit: SecurityAuditInfo;
  isAttached?: boolean;
}

export const CATALOG_AGENTS: SpecialistAgent[] = [
  {
    id: "agent-travel-concierge",
    name: "Travel Concierge",
    tagline: "Autonomous flight booking, hotel procurement, and itinerary management",
    description:
      "Specialist in multi-leg flight routing, lodging reservations, and corporate itinerary management. Operates within strict single-transaction approval boundaries and enforces preferred airline policies.",
    specialty: "Travel & Hospitality",
    role: "subagent",
    category: "logistics",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 250000, // $2,500.00
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "plane",
    permissions: [
      "Initiate PayPal payments up to delegated mandate limit",
      "Query real-time flight availability and hotel room pricing",
      "Hold temporary 30-minute merchant hotel reservations",
      "Read travel preferences from environment durable memory",
    ],
    samplePrompts: [
      "Find and book round-trip direct flights from SFO to BLR under $1,400 for next month's dev summit.",
      "Reserve 4 nights at a hotel within 3km of Moscone Center with flexible cancellation.",
      "Confirm baggage allowances and check in team passengers 24h prior to departure.",
    ],
    securityAudit: {
      auditedBy: "PayGuardian Security Labs",
      auditDate: "2026-10-18",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x892a7fe91c028df4192bce904719ab2",
      sandboxTested: true,
    },
  },
  {
    id: "agent-cloud-optimizer",
    name: "Cloud Cost Optimizer",
    tagline: "Autonomous spot instance scaling, reserved capacity purchasing, and invoice settlement",
    description:
      "Monitors real-time cloud infrastructure compute metrics across AWS, GCP, and Kubernetes clusters. Disburses reserved capacity payments and terminates idle workloads.",
    specialty: "Cloud Infrastructure",
    role: "subagent",
    category: "infrastructure",
    authorityTier: "Tier 3: Delegated Mandate Holder",
    tierLevel: 3,
    recommendedBudgetMinor: 500000, // $5,000.00
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "cloud",
    permissions: [
      "Execute automated cloud infrastructure invoice settlements",
      "Commit compute capacity contracts up to mandate ceiling",
      "Inspect Kubernetes resource telemetry and node pool health",
      "Publish infrastructure spend audit traces to Activity Log",
    ],
    samplePrompts: [
      "Analyze trailing 30-day GPU cluster utilization and purchase 6-month reserved instances.",
      "Automatically settle monthly compute invoices once hash verification matches billing statement.",
      "Downscale idle staging environments during off-peak hours and report minor-unit savings.",
    ],
    securityAudit: {
      auditedBy: "Cure53 Autonomous Audit",
      auditDate: "2026-09-24",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x44f810da52bca7e88921df0195ccbe4",
      sandboxTested: true,
    },
  },
  {
    id: "agent-procurement-bot",
    name: "Procurement Bot",
    tagline: "Automated hardware procurement, software SaaS licensing, and vendor purchase orders",
    description:
      "Processes approved hardware requisition requests and manages recurring software subscriptions with automatic duplicate detection and vendor verification.",
    specialty: "Enterprise Procurement",
    role: "subagent",
    category: "procurement",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 300000, // $3,000.00
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Verified Partner",
    avatarIcon: "shopping-cart",
    permissions: [
      "Disburse approved purchase orders directly to verified merchants",
      "Verify vendor W-9 and cryptographic merchant identity",
      "Route transactions exceeding $500 to Human Approvals Inbox",
      "Store invoice PDFs in durable audit storage",
    ],
    samplePrompts: [
      "Procure 5 ergonomic mechanical keyboards for newly onboarded engineers under $150 each.",
      "Renew the annual Figma Enterprise subscription before November 15.",
      "Compare supplier prices for developer workstations across authorized distributors.",
    ],
    securityAudit: {
      auditedBy: "Trail of Bits Verification",
      auditDate: "2026-10-02",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x12bb99ac0081d5f29910abec491753c",
      sandboxTested: true,
    },
  },
  {
    id: "agent-payroll-disburser",
    name: "Payroll Disburser",
    tagline: "Autonomous contractor milestone disbursements and compliant global compensation",
    description:
      "High-authority financial settlement agent designed for contractor compensation, milestone-based bounty releases, and automated tax withholding calculations.",
    specialty: "Payroll & Disbursal",
    role: "subagent",
    category: "finance",
    authorityTier: "Tier 3: Delegated Mandate Holder",
    tierLevel: 3,
    recommendedBudgetMinor: 1500000, // $15,000.00
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "dollar-sign",
    permissions: [
      "Initiate multi-recipient batch contractor payouts via PayPal Payouts API",
      "Enforce mandatory cryptographic co-signatures for payouts > $2,500",
      "Validate delivery milestone verification signatures prior to funds release",
      "Maintain append-only tax audit records for IRS/GST compliance",
    ],
    samplePrompts: [
      "Release Milestone 4 bounty ($1,250.00) to external security researcher upon auditor sign-off.",
      "Disburse bi-weekly engineering contractor invoices against approved timesheet tokens.",
      "Generate monthly disbursal ledger reconciliation report for treasury review.",
    ],
    securityAudit: {
      auditedBy: "NCC Group Cryptographic Review",
      auditDate: "2026-08-30",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x77ae2409f89d0b6744c882ef99a1945",
      sandboxTested: true,
    },
  },
  {
    id: "agent-api-gateway",
    name: "API Gateway Router",
    tagline: "Metered payment per API token and autonomous LLM inference credit replenishment",
    description:
      "Autonomous machine-to-machine payment routing agent. Replenishes AI inference credits (Anthropic, OpenAI, Replicate) and micro-settles per-request metering.",
    specialty: "API Gateway & Routing",
    role: "subagent",
    category: "gateway",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 100000, // $1,000.00
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "network",
    permissions: [
      "Execute automated micro-metered credit top-ups for API endpoints",
      "Hold pre-authorization reserves during long-running model evaluations",
      "Enforce per-hour rate-limiting and circuit breaker spending thresholds",
      "Stream payment trace records directly into the Live Activity Feed",
    ],
    samplePrompts: [
      "Maintain a minimum $200 buffer on the Anthropic API account; top up via PayPal when balance drops below $50.",
      "Meter and disburse token consumption across 4 multi-agent subtasks.",
      "Trigger circuit breaker and halt inference calls if hourly spend velocity exceeds $100.",
    ],
    securityAudit: {
      auditedBy: "PayGuardian Security Labs",
      auditDate: "2026-10-25",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x3344dca990812eef45100bcda78912e",
      sandboxTested: true,
    },
  },
  {
    id: "agent-tax-sentinel",
    name: "Tax & Compliance Sentinel",
    tagline: "Real-time statutory tax withholding calculation, GST/VAT verification, and reporting",
    description:
      "Passive observation and compliance enforcement agent. Verifies that all autonomous transactions carry valid jurisdiction tax calculations before gateway sign-off.",
    specialty: "Tax & Compliance",
    role: "subagent",
    category: "compliance",
    authorityTier: "Tier 1: Read-Only / Advisory",
    tierLevel: 1,
    recommendedBudgetMinor: 50000, // $500.00
    currency: "USD",
    supportedRails: ["Simulation"],
    publisher: "Verified Partner",
    avatarIcon: "shield-check",
    permissions: [
      "Inspect inbound payment authorization requests for compliance codes",
      "Flag missing invoice tax breakdowns prior to payment execution",
      "Generate monthly regulatory disclosure exports",
    ],
    samplePrompts: [
      "Verify that all hotel reservations in India include appropriate 18% GST itemization.",
      "Audit current quarter cross-border contractor payouts for 1099 reporting compliance.",
      "Flag any payment request that lacks vendor tax residency metadata.",
    ],
    securityAudit: {
      auditedBy: "Deloitte Digital Audit Assurance",
      auditDate: "2026-09-12",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x992318abce00174fa9012bbec409981",
      sandboxTested: true,
    },
  },
];
