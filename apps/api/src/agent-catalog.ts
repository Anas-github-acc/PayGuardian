export interface CatalogAgent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  specialty: string;
  role: "orchestrator" | "subagent";
  category: "logistics" | "infrastructure" | "procurement" | "finance" | "gateway" | "compliance";
  authorityTier: string;
  tierLevel: 1 | 2 | 3 | 4;
  recommendedBudgetMinor: number;
  currency: string;
  supportedRails: string[];
  publisher: "Official PayGuardian" | "Verified Partner" | "Custom";
  avatarIcon: "plane" | "cloud" | "shopping-cart" | "dollar-sign" | "network" | "shield-check";
  permissions: string[];
  samplePrompts: string[];
  securityAudit: {
    auditedBy: string;
    auditDate: string;
    cveVulnerabilities: number;
    status: "certified" | "passed";
    signatureHash: string;
    sandboxTested: boolean;
  };
  isAttached?: boolean;
}

export const AGENT_CATALOG: CatalogAgent[] = [
  {
    id: "agent-travel-concierge",
    name: "Travel Concierge",
    tagline: "Autonomous flight booking, hotel procurement, and itinerary management",
    description:
      "Specialist in multi-leg flight routing, lodging reservations, and corporate itinerary management. Operates within strict single-transaction approval boundaries and enforces preferred airline policies.",
    specialty: "travel",
    role: "subagent",
    category: "logistics",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 250000,
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
    id: "agent-merchant-attach",
    name: "MerchantAttach",
    tagline: "Autonomous merchant catalog search, price comparison, and bounded checkout",
    description:
      "Simulates searching regional merchant product catalogs (e.g. chai, biscuits, artisanal pantry goods), evaluates vendor unit pricing and bundle discounts over a 3-minute workflow, and executes checkout within authorized mandate limits.",
    specialty: "custom",
    role: "subagent",
    category: "procurement",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 100000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "shopping-cart",
    permissions: [
      "Search local merchant product catalogs",
      "Compare vendor unit pricing and promotional bundles",
      "Execute authorized payments within mandate boundaries",
    ],
    samplePrompts: [
      "Use MerchantAttach to search products like biscuit and chai and proceed with payment.",
      "Procure provisions from regional vendors within a $10.00 mandate limit.",
    ],
    securityAudit: {
      auditedBy: "PayGuardian Security Engine",
      auditDate: "2026-11-05",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x5f9c0e4a7b21e8d91024",
      sandboxTested: true,
    },
  },
  {
    id: "agent-hotel-specialist",
    name: "Hotel Specialist",
    tagline: "Curated accommodations, flexible cancellations, and lodging bookings",
    description:
      "Finds high-reputation hotels, boutique suites, and business lodgings near specified destination hubs with verified cancellation terms.",
    specialty: "hotel",
    role: "subagent",
    category: "logistics",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 150000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "shield-check",
    permissions: [
      "Book verified boutique hotels within mandate ceiling",
      "Validate cancellation policies and security standards",
    ],
    samplePrompts: [
      "Book a 3-night hotel near city center under $150/night.",
    ],
    securityAudit: {
      auditedBy: "PayGuardian Security Labs",
      auditDate: "2026-10-20",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x9812ba47c01ef94812",
      sandboxTested: true,
    },
  },
  {
    id: "agent-food-dining",
    name: "Food & Dining Specialist",
    tagline: "Curated culinary bookings, meal allowances, and dietary preference reservations",
    description:
      "Coordinates restaurant dining, dietary-tailored catering, and team meal allowances within allocated budget bounds.",
    specialty: "food",
    role: "subagent",
    category: "logistics",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 50000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "shopping-cart",
    permissions: [
      "Reserve culinary dining spots",
      "Process restaurant reservations up to mandate limit",
    ],
    samplePrompts: [
      "Find top-rated ramen spots and reserve dinner for two under $50.",
    ],
    securityAudit: {
      auditedBy: "PayGuardian Security Engine",
      auditDate: "2026-10-22",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x12bb80ac4991defa01",
      sandboxTested: true,
    },
  },
  {
    id: "agent-transport-coordinator",
    name: "Transport Coordinator",
    tagline: "Airport transfers, commuter rail, and ground transit passes",
    description:
      "Arranges city cards, rail tickets, and airport transfers for seamless point-to-point transit.",
    specialty: "transport",
    role: "subagent",
    category: "logistics",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 30000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "plane",
    permissions: [
      "Purchase transit passes and express rail tickets",
      "Coordinate local transit transfers",
    ],
    samplePrompts: [
      "Reserve Narita Express airport transfer and 72-hour subway pass.",
    ],
    securityAudit: {
      auditedBy: "PayGuardian Security Engine",
      auditDate: "2026-10-23",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x34fc9018baed001249",
      sandboxTested: true,
    },
  },
  {
    id: "agent-activities-guide",
    name: "Activities & Culture Guide",
    tagline: "Museum admissions, historic walking tours, and event tickets",
    description:
      "Schedules sightseeing highlights, verified guided walking tours, and museum entries.",
    specialty: "activities",
    role: "subagent",
    category: "logistics",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 40000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "shield-check",
    permissions: [
      "Book verified museum and cultural admissions",
    ],
    samplePrompts: [
      "Book art museum passes and historic quarter walking tour.",
    ],
    securityAudit: {
      auditedBy: "PayGuardian Security Engine",
      auditDate: "2026-10-24",
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0x78ab0912ecf4109823",
      sandboxTested: true,
    },
  },
  {
    id: "agent-cloud-optimizer",
    name: "Cloud Cost Optimizer",
    tagline: "Autonomous spot instance scaling, reserved capacity purchasing, and invoice settlement",
    description:
      "Monitors real-time cloud infrastructure compute metrics across AWS, GCP, and Kubernetes clusters. Disburses reserved capacity payments and terminates idle workloads.",
    specialty: "custom",
    role: "subagent",
    category: "infrastructure",
    authorityTier: "Tier 3: Delegated Mandate Holder",
    tierLevel: 3,
    recommendedBudgetMinor: 500000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "cloud",
    permissions: [
      "Execute automated cloud infrastructure invoice settlements",
      "Commit compute capacity contracts up to mandate ceiling",
      "Inspect Kubernetes resource telemetry and node pool health",
    ],
    samplePrompts: [
      "Analyze trailing 30-day GPU cluster utilization and purchase 6-month reserved instances.",
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
    specialty: "custom",
    role: "subagent",
    category: "procurement",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 800000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "shopping-cart",
    permissions: [
      "Create bounded purchase orders with verified corporate merchants",
      "Disburse single-transaction software license fees under $800",
    ],
    samplePrompts: [
      "Order 5 ergonomic monitors for the new design team members.",
    ],
    securityAudit: {
      auditedBy: "PayGuardian Security Labs",
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
    specialty: "custom",
    role: "subagent",
    category: "finance",
    authorityTier: "Tier 3: Delegated Mandate Holder",
    tierLevel: 3,
    recommendedBudgetMinor: 1500000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "dollar-sign",
    permissions: [
      "Initiate multi-recipient batch contractor payouts via PayPal Payouts API",
      "Validate delivery milestone verification signatures prior to funds release",
    ],
    samplePrompts: [
      "Release Milestone 4 bounty ($1,250.00) to external security researcher upon auditor sign-off.",
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
    specialty: "custom",
    role: "subagent",
    category: "gateway",
    authorityTier: "Tier 2: Autonomous Micro-Transactions",
    tierLevel: 2,
    recommendedBudgetMinor: 100000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: "network",
    permissions: [
      "Execute automated micro-metered credit top-ups for API endpoints",
      "Hold pre-authorization reserves during long-running model evaluations",
    ],
    samplePrompts: [
      "Maintain a minimum $200 buffer on the Anthropic API account; top up via PayPal when balance drops below $50.",
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
    specialty: "custom",
    role: "subagent",
    category: "compliance",
    authorityTier: "Tier 1: Read-Only / Advisory",
    tierLevel: 1,
    recommendedBudgetMinor: 50000,
    currency: "USD",
    supportedRails: ["Simulation"],
    publisher: "Verified Partner",
    avatarIcon: "shield-check",
    permissions: [
      "Inspect inbound payment authorization requests for compliance codes",
      "Flag missing invoice tax breakdowns prior to payment execution",
    ],
    samplePrompts: [
      "Verify that all hotel reservations in India include appropriate 18% GST itemization.",
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
