import type { ApprovalDto, AgentDto, MandateDto } from "@payguardian/contracts";
import type { ApprovalItem, ApprovalStatus, ApprovalAncestor } from "@/components/approvals/types";

export function mapApprovalDtoToItem(
  dto: ApprovalDto,
  agents: AgentDto[] = [],
  mandates: MandateDto[] = [],
): ApprovalItem {
  const agent = agents.find((a) => a.id === dto.agentId);
  const mandate = mandates.find((m) => m.id === dto.mandateId);

  const agentName = agent?.name ?? `Agent ${dto.agentId.slice(0, 8)}`;
  const agentRole = agent?.parentAgentId ? "subagent" : "orchestrator";

  const ancestorChain: ApprovalAncestor[] = [
    { id: "user-root", name: "You (Operator)", role: "Root Authority" },
  ];
  if (agent) {
    if (agent.parentAgentId) {
      const parentAgent = agents.find((a) => a.id === agent.parentAgentId);
      if (parentAgent) {
        ancestorChain.push({
          id: parentAgent.id,
          name: parentAgent.name,
          role: "Environment Overseer",
        });
      }
    }
    ancestorChain.push({
      id: agent.id,
      name: agent.name,
      role: agentRole === "orchestrator" ? "Environment Overseer" : "Procurement Agent",
    });
  }

  const parentMandateLimitMinor = mandate?.budgetLimitMinor ?? dto.amountMinor;
  const spentMinor = mandate?.spentMinor ?? 0;
  const remainingBudgetAfterPaymentMinor = Math.max(0, parentMandateLimitMinor - spentMinor - dto.amountMinor);
  const isHardLimitExceeded = dto.amountMinor > parentMandateLimitMinor;

  const status: ApprovalStatus =
    dto.status === "approved"
      ? "approved"
      : dto.status === "rejected"
      ? "rejected"
      : "pending";

  const rawDto = dto as unknown as { allowed_actions?: string[]; allowedActions?: string[] };
  const backendAllowed = rawDto.allowed_actions ?? rawDto.allowedActions;
  const allowedActions: ("approve" | "reject" | string)[] = Array.isArray(backendAllowed)
    ? backendAllowed
    : (status === "pending"
        ? (isHardLimitExceeded ? ["reject"] : ["approve", "reject"])
        : []);

  return {
    id: dto.id,
    environmentId: dto.environmentId,
    mandateId: dto.mandateId,
    agentId: dto.agentId,
    agentName,
    agentRole,
    action: dto.action,
    purpose: `Authorized action execution for ${dto.action}`,
    recipient: "Gateway Recipient",
    merchantCategory: "Financial Authority Rail",
    amountMinor: dto.amountMinor,
    currency: dto.currency,
    requestHash: dto.requestHash,
    status,
    reasonForSignOff: `Action ${dto.action} requires operator confirmation`,
    remainingBudgetAfterPaymentMinor,
    parentMandateLimitMinor,
    isHardLimitExceeded,
    hardLimitExceededReason: isHardLimitExceeded
      ? `Requested amount exceeds limit of ${parentMandateLimitMinor}`
      : undefined,
    expiresAt: new Date(new Date(dto.createdAt).getTime() + 2 * 3600 * 1000).toISOString(),
    createdAt: dto.createdAt,
    approvedBy: dto.approvedBy,
    approvedAt: dto.approvedAt,
    rejectionReason: dto.rejectionReason,
    ancestorChain,
    agentSays: `Execution of ${dto.action} reserved for ${dto.amountMinor} ${dto.currency}. Cryptographic confirmation required.`,
    allowedActions,
  };
}

export function mapApprovalsToItems(
  dtos: ApprovalDto[],
  agents: AgentDto[] = [],
  mandates: MandateDto[] = [],
): ApprovalItem[] {
  return dtos.map((d) => mapApprovalDtoToItem(d, agents, mandates));
}
