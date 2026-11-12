export type AgentCategory =
  "all" | "logistics" | "infrastructure" | "procurement" | "finance" | "gateway" | "compliance";

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
