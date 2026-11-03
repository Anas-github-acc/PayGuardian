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
}

export function useEnvironments(): UseEnvironmentsResult {
  const { environmentsList, currentEnvironment, isEnvironmentsLoaded } = useWorkspaceStore();
  const [isLoading, setIsLoading] = React.useState(!isEnvironmentsLoaded);
  const [error, setError] = React.useState<string | null>(null);

  const fetchEnvironments = React.useCallback(async () => {
    setIsLoading(true);
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
    if (!isEnvironmentsLoaded) {
      void fetchEnvironments();
    }
  }, [isEnvironmentsLoaded, fetchEnvironments]);

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

      // 4. Optionally register starter child agents with delegated sub-mandates
      let agentCount = 1;
      if (options.bootstrapChildAgents && options.budgetLimitMinor >= 400000) {
        try {
          const travelChild = await apiClient.agents.registerChild(envId, {
            parentAgentId: rootAgent.id,
            name: "Travel Subagent",
            kind: "specialist",
            capabilities: ["flight.search", "flight.book"],
          });
          agentCount++;

          const travelLimit = Math.min(400000, Math.floor(options.budgetLimitMinor * 0.4));
          await apiClient.mandates.delegate(rootMandate.id, {
            holderAgentId: travelChild.id,
            budgetLimitMinor: travelLimit,
            currency: options.currency,
            permittedActions: ["flight.*"],
            expiresAt,
            canDelegate: true,
            maxDelegationDepth: 1,
            approvalRequired: false,
          });

          const hotelChild = await apiClient.agents.registerChild(envId, {
            parentAgentId: rootAgent.id,
            name: "Hotel Subagent",
            kind: "specialist",
            capabilities: ["hotel.search", "hotel.book"],
          });
          agentCount++;

          const hotelLimit = Math.min(300000, Math.floor(options.budgetLimitMinor * 0.3));
          await apiClient.mandates.delegate(rootMandate.id, {
            holderAgentId: hotelChild.id,
            budgetLimitMinor: hotelLimit,
            currency: options.currency,
            permittedActions: ["hotel.*"],
            expiresAt,
            canDelegate: true,
            maxDelegationDepth: 1,
            approvalRequired: false,
          });
        } catch (subErr) {
          // Log and continue, root environment + root agent + root mandate are ready
          console.warn("Child agent bootstrap partial warning:", subErr);
        }
      }

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

  return {
    environments: environmentsList,
    currentEnvironment,
    isLoading: isLoading && !isEnvironmentsLoaded,
    error,
    isEmpty: isEnvironmentsLoaded && environmentsList.length === 0,
    isEnvironmentsLoaded,
    refetch: fetchEnvironments,
    createAndBootstrap,
  };
}
