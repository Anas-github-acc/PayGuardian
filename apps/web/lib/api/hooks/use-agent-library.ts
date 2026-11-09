"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../client";
import { mapAgentDtoToSpecialist } from "../mappers/library";
import type { SpecialistAgent } from "@/components/agents/types";
import type { AgentDto, RegisterChildAgentRequest } from "@payguardian/contracts";

export interface UseAgentLibraryResult {
  agents: SpecialistAgent[];
  catalogAgents: SpecialistAgent[];
  rawAgents: AgentDto[];
  isLoading: boolean;
  error: Error | null;
  registerChild: (data: RegisterChildAgentRequest) => Promise<AgentDto>;
  refetch: () => Promise<void>;
}

export function useAgentLibrary(environmentId?: string | null): UseAgentLibraryResult {
  const [agents, setAgents] = useState<SpecialistAgent[]>([]);
  const [catalogAgents, setCatalogAgents] = useState<SpecialistAgent[]>([]);
  const [rawAgents, setRawAgents] = useState<AgentDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(environmentId));
  const [error, setError] = useState<Error | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [fetchedEnv, fetchedCatalog] = await Promise.all([
        environmentId ? apiClient.agents.list(environmentId) : Promise.resolve([]),
        apiClient.agents.catalog().catch(() => []),
      ]);

      setRawAgents(fetchedEnv);
      setAgents(fetchedEnv.map(mapAgentDtoToSpecialist));
      setCatalogAgents(fetchedCatalog);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [environmentId]);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const registerChild = async (data: RegisterChildAgentRequest): Promise<AgentDto> => {
    if (!environmentId) throw new Error("No active environment.");
    const created = await apiClient.agents.registerChild(environmentId, data);
    await fetchAgents();
    return created;
  };

  return {
    agents,
    catalogAgents,
    rawAgents,
    isLoading,
    error,
    registerChild,
    refetch: fetchAgents,
  };
}
