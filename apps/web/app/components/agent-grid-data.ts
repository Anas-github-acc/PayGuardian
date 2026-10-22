export type AgentGridAgent = {
  id: string;
  name: string;
  kind: string;
  parentAgentId: string | null;
};

export type AgentGridRow = AgentGridAgent & { parentName: string };

export function buildAgentRows(agents: AgentGridAgent[]): AgentGridRow[] {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  return agents.map((agent) => ({
    ...agent,
    parentName: agent.parentAgentId ? (names.get(agent.parentAgentId) ?? "Unknown") : "Root",
  }));
}
