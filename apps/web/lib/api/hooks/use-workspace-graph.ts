"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../client";
import { mapWorkspaceGraph } from "../mappers/workspace-graph";
import type { AgentNodeData, AgentEdgeData } from "@/app/lib/workspace-store";
import type { AgentDto, MandateDto, LedgerAccountDto } from "@payguardian/contracts";

export interface UseWorkspaceGraphOptions {
  pollingIntervalMs?: number;
}

export interface UseWorkspaceGraphResult {
  nodes: AgentNodeData[];
  edges: AgentEdgeData[];
  agents: AgentDto[];
  mandates: MandateDto[];
  ledgerAccounts: LedgerAccountDto[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  revokeAgent: (agentId: string) => Promise<AgentDto>;
}

export function useWorkspaceGraph(
  environmentId?: string | null,
  options: UseWorkspaceGraphOptions = {},
): UseWorkspaceGraphResult {
  const { pollingIntervalMs } = options;
  const [nodes, setNodes] = useState<AgentNodeData[]>([]);
  const [edges, setEdges] = useState<AgentEdgeData[]>([]);
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [mandates, setMandates] = useState<MandateDto[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(environmentId));
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!environmentId) {
      setNodes([]);
      setEdges([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [fetchedAgents, fetchedMandates, fetchedAccounts] = await Promise.all([
        apiClient.agents.list(environmentId),
        apiClient.mandates.list(environmentId).catch(() => [] as MandateDto[]),
        apiClient.ledger.listAccounts(environmentId).catch(() => [] as LedgerAccountDto[]),
      ]);

      setAgents(fetchedAgents);
      setMandates(fetchedMandates);
      setLedgerAccounts(fetchedAccounts);

      const mapped = mapWorkspaceGraph(fetchedAgents, fetchedMandates, fetchedAccounts);
      setNodes(mapped.nodes);
      setEdges(mapped.edges);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [environmentId]);

  useEffect(() => {
    void fetchData();

    if (pollingIntervalMs && pollingIntervalMs > 0 && environmentId) {
      const interval = setInterval(() => {
        void fetchData();
      }, pollingIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchData, environmentId, pollingIntervalMs]);

  // Wire Agent Revocation mutation: call apiClient.agents.revoke(environmentId, agentId)
  // Update UI ONLY upon confirmed server response (HTTP 200/201). Strictly NO optimistic updates.
  const revokeAgent = useCallback(
    async (agentId: string): Promise<AgentDto> => {
      if (!environmentId) {
        throw new Error("No active environment specified for agent revocation.");
      }
      const updated = await apiClient.agents.revoke(environmentId, agentId);
      // Strictly update UI only upon confirmed response
      await fetchData();
      return updated;
    },
    [environmentId, fetchData],
  );

  return {
    nodes,
    edges,
    agents,
    mandates,
    ledgerAccounts,
    isLoading,
    error,
    refetch: fetchData,
    revokeAgent,
  };
}
