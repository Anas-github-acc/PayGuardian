import type { AgentDto } from "@payguardian/contracts";
import type { SpecialistAgent } from "@/components/agents/types";

export function mapAgentDtoToSpecialist(agent: AgentDto): SpecialistAgent {
  const isRoot = !agent.parentAgentId;

  return {
    id: agent.id,
    name: agent.name,
    tagline: isRoot
      ? "Root Orchestrator overseeing environment authority"
      : `Specialized child agent in ${agent.kind}`,
    description: `Registered agent '${agent.name}' operating in ${agent.kind} role.`,
    specialty: agent.kind,
    role: isRoot ? "orchestrator" : "subagent",
    category: "procurement",
    authorityTier: isRoot ? "Tier 1: Root Overseer" : "Tier 2: Autonomous Micro-Transactions",
    tierLevel: isRoot ? 1 : 2,
    recommendedBudgetMinor: 100000,
    currency: "USD",
    supportedRails: ["PayPal", "Simulation"],
    publisher: "Official PayGuardian",
    avatarIcon: isRoot ? "shield-check" : "network",
    permissions: ["Execute bounded transactions", "Check mandate authority"],
    samplePrompts: [`Execute task with agent ${agent.name}`],
    securityAudit: {
      auditedBy: "PayGuardian Security Engine",
      auditDate: agent.createdAt,
      cveVulnerabilities: 0,
      status: "certified",
      signatureHash: "0xsha256verified",
      sandboxTested: true,
    },
    isAttached: true,
  };
}
