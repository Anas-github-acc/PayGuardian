"use client";

import * as React from "react";
import { apiClient } from "../client";
import { mapEnvironmentDto } from "../mappers/environment";
import { useWorkspaceStore, workspaceStore, type Environment } from "../../../app/lib/workspace-store";

export interface CreateAndBootstrapOptions {
  name: string;
  purpose: string;
  currency: string;
  budgetLimitMinor: number;
  approvalThresholdMinor?: number;
  maxDelegationDepth?: number;
  allowedRails?: string[];
  expiresAt?: string;
  type?: "sandbox" | "production";
  rootAgentName?: string;
  bootstrapChildAgents?: boolean;
}

export interface UseEnvironmentsResult {
  environments: Environment[];
  currentEnvironment: Environment | null;
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  isEnvironmentsLoaded: boolean;
  refetch: () => Promise<void>;
  createAndBootstrap: (options: CreateAndBootstrapOptions) => Promise<Environment>;
  deleteEnvironment: (environmentId: string) => Promise<boolean>;
}

export function useEnvironments(): UseEnvironmentsResult {
  const { environmentsList, currentEnvironment, isEnvironmentsLoaded } = useWorkspaceStore();
  const [isLoading, setIsLoading] = React.useState(!isEnvironmentsLoaded && !currentEnvironment);
  const [error, setError] = React.useState<string | null>(null);

  const fetchEnvironments = React.useCallback(async () => {
    if (!workspaceStore.getState().currentEnvironment) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const dtoList = await apiClient.environments.list();
      const mappedEnvs = dtoList.map((dto) => mapEnvironmentDto(dto));
      workspaceStore.setEnvironmentsList(mappedEnvs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load environments from Gateway";
      setError(msg);
      // Mark as loaded so UI can render the error/zero state instead of hanging in skeleton
      workspaceStore.setEnvironmentsLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchEnvironments();
  }, [fetchEnvironments]);

  const createAndBootstrap = React.useCallback(
    async (options: CreateAndBootstrapOptions): Promise<Environment> => {
      // 1. Create Environment in backend
      const createdEnvDto = await apiClient.environments.create({
        name: options.name,
        purpose: options.purpose,
        currency: options.currency,
        budgetLimitMinor: options.budgetLimitMinor,
      });

      const envId = createdEnvDto.id;

      // 2. Register Root Agent in this environment
      const rootAgent = await apiClient.agents.createRoot(envId, {
        name: options.rootAgentName || "Main Orchestrator",
        capabilities: ["delegate", "simulate", "spend", "reserve"],
      });

      // 3. Create Root Mandate bound to Root Agent
      const expiresAt =
        options.expiresAt || new Date(Date.now() + 90 * 86400 * 1000).toISOString();
      const rootMandate = await apiClient.mandates.createRoot(envId, {
        holderAgentId: rootAgent.id,
        budgetLimitMinor: options.budgetLimitMinor,
        currency: options.currency,
        permittedActions: ["*"],
        expiresAt,
        canDelegate: true,
        maxDelegationDepth: options.maxDelegationDepth ?? 2,
        approvalRequired: true,
      });

      // 4. Clean root state: child agents and sub-mandates are created on-demand via agent delegation
      const agentCount = 1;

      // Map to full frontend Environment
      const fullEnv = mapEnvironmentDto(createdEnvDto, {
        type: options.type ?? "sandbox",
        agentCount,
        maxDelegationDepth: options.maxDelegationDepth ?? 2,
        approvalThresholdMinor:
          options.approvalThresholdMinor ?? Math.round(options.budgetLimitMinor * 0.1),
        allowedRails: options.allowedRails ?? ["PayPal", "Simulation"],
        expiresAt,
      });

      // Add to store and switch into it (executes atomic reset)
      workspaceStore.addEnvironment(fullEnv);
      return fullEnv;
    },
    [],
  );

  const deleteEnvironment = React.useCallback(
    async (environmentId: string): Promise<boolean> => {
      try {
        await apiClient.environments.delete(environmentId);
        workspaceStore.removeEnvironment(environmentId);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete environment";
        setError(msg);
        return false;
      }
    },
    [],
  );

  return {
    environments: environmentsList,
    currentEnvironment,
    isLoading: isLoading && !isEnvironmentsLoaded,
    error,
    isEmpty: isEnvironmentsLoaded && environmentsList.length === 0,
    isEnvironmentsLoaded,
    refetch: fetchEnvironments,
    createAndBootstrap,
    deleteEnvironment,
  };
}
