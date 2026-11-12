import type { AgentDto, MandateDto, LedgerAccountDto } from "@payguardian/contracts";
import type { AgentNodeData, AgentEdgeData } from "@/app/lib/workspace-store";

export function mapWorkspaceGraph(
  agents: AgentDto[],
  mandates: MandateDto[] = [],
  ledgerAccounts: LedgerAccountDto[] = [],
): { nodes: AgentNodeData[]; edges: AgentEdgeData[] } {
  const mandateByAgent = new Map<string, MandateDto>();
  // Prioritize active mandates, then higher version so superseded ones are not accidentally picked
  const sortedMandates = [...mandates].sort((a, b) => {
    if (a.state === "active" && b.state !== "active") return -1;
    if (b.state === "active" && a.state !== "active") return 1;
    return (b.version ?? 0) - (a.version ?? 0);
  });
  for (const m of sortedMandates) {
    if (!mandateByAgent.has(m.holderAgentId)) {
      mandateByAgent.set(m.holderAgentId, m);
    }
  }

  const accountByMandate = new Map<string, LedgerAccountDto>();
  for (const acc of ledgerAccounts) {
    accountByMandate.set(acc.mandateId, acc);
  }

  const nodes: AgentNodeData[] = [];
  const edges: AgentEdgeData[] = [];

  const rootAgents = agents.filter((a) => !a.parentAgentId);
  const childAgents = agents.filter((a) => !!a.parentAgentId);

  // Position root agent(s)
  rootAgents.forEach((agent, idx) => {
    const mandate = mandateByAgent.get(agent.id);
    const account = mandate ? accountByMandate.get(mandate.id) : undefined;
    const allocatedMinor = mandate?.allocatedMinor ?? mandate?.budgetLimitMinor ?? 0;
    const subDelegatedMinor = mandate?.allocatedMinor ?? 0;
    const spentMinor = account?.capturedMinor ?? mandate?.spentMinor ?? 0;
    const reservedMinor = account?.reservedMinor ?? mandate?.reservedMinor ?? 0;
    const limitMinor = mandate?.budgetLimitMinor ?? allocatedMinor;
    const availableMinor = Math.max(0, limitMinor - subDelegatedMinor - spentMinor - reservedMinor);
    const isFunded = (mandate?.budgetLimitMinor ?? 0) > 0 || allocatedMinor > 0;

    let status: AgentNodeData["status"] = "active";
    if (agent.status === "revoked" || mandate?.state === "revoked") {
      status = "revoked";
    } else if (agent.status === "disabled") {
      status = "paused";
    } else if (!isFunded) {
      status = "unfunded";
    }

    nodes.push({
      id: agent.id,
      name: agent.name,
      role: "orchestrator",
      status,
      allocatedMinor,
      subDelegatedMinor,
      spentMinor,
      reservedMinor,
      availableMinor,
      parentAgentId: null,
      position: [idx * 120, 80, 0],
      isFunded,
    });
  });

  // Position children around root
  const count = childAgents.length;
  childAgents.forEach((agent, idx) => {
    const mandate = mandateByAgent.get(agent.id);
    const account = mandate ? accountByMandate.get(mandate.id) : undefined;
    // For child agents, their allocated authority ceiling is their mandate budget limit
    const allocatedMinor =
      (mandate?.budgetLimitMinor && mandate.budgetLimitMinor > 0)
        ? mandate.budgetLimitMinor
        : (mandate?.allocatedMinor ?? 0);
    const subDelegatedMinor = mandate?.allocatedMinor ?? 0;
    const spentMinor = account?.capturedMinor ?? mandate?.spentMinor ?? 0;
    const reservedMinor = account?.reservedMinor ?? mandate?.reservedMinor ?? 0;
    const availableMinor = Math.max(0, allocatedMinor - subDelegatedMinor - spentMinor - reservedMinor);
    const isFunded = allocatedMinor > 0 && mandate?.state === "active";

    let status: AgentNodeData["status"] = "active";
    if (agent.status === "revoked" || mandate?.state === "revoked") {
      status = "revoked";
    } else if (agent.status === "disabled") {
      status = "paused";
    } else if (!isFunded) {
      status = "unfunded";
    }

    // Arrange in an arc or row below root
    const x = count > 1 ? -140 + idx * (280 / (count - 1)) : 0;
    const y = -40;
    const z = (idx % 2 === 0 ? 1 : -1) * 20;

    nodes.push({
      id: agent.id,
      name: agent.name,
      role: "subagent",
      status,
      allocatedMinor,
      subDelegatedMinor,
      spentMinor,
      reservedMinor,
      availableMinor,
      parentAgentId: agent.parentAgentId,
      position: [x, y, z],
      isFunded,
    });

    if (agent.parentAgentId) {
      edges.push({
        id: `edge-${agent.parentAgentId}-${agent.id}`,
        source: agent.parentAgentId,
        target: agent.id,
        isAuthorized: agent.status === "active" && (mandate?.state === "active" || !mandate),
        status: "idle",
        amountMinor: allocatedMinor,
      });
    }
  });

  return { nodes, edges };
}
