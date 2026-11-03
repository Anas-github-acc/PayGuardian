"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../client";
import { mapBudgetStrip } from "../mappers/budget-strip";
import type { Environment } from "@/app/lib/workspace-store";
import type { EnvironmentDto, LedgerAccountDto, MandateDto } from "@payguardian/contracts";

export interface UseBudgetStripOptions {
  pollingIntervalMs?: number;
}

export interface UseBudgetStripResult {
  environment: Environment | null;
  dto: EnvironmentDto | null;
  ledgerAccounts: LedgerAccountDto[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useBudgetStrip(
  environmentId?: string | null,
  options: UseBudgetStripOptions = {},
): UseBudgetStripResult {
  const { pollingIntervalMs } = options;
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [dto, setDto] = useState<EnvironmentDto | null>(null);
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(environmentId));
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!environmentId) {
      setEnvironment(null);
      setDto(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [fetchedEnv, fetchedAccounts, fetchedMandates, fetchedApprovals, fetchedAgents] =
        await Promise.all([
          apiClient.environments.get(environmentId),
          apiClient.ledger.listAccounts(environmentId).catch(() => [] as LedgerAccountDto[]),
          apiClient.mandates.list(environmentId).catch(() => [] as MandateDto[]),
          apiClient.approvals.list(environmentId, "pending").catch(() => []),
          apiClient.agents.list(environmentId).catch(() => []),
        ]);

      setDto(fetchedEnv);
      setLedgerAccounts(fetchedAccounts);

      const mapped = mapBudgetStrip(
        fetchedEnv,
        fetchedAccounts,
        fetchedMandates,
        fetchedApprovals.length,
        fetchedAgents.length,
      );
      setEnvironment(mapped);
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

  return {
    environment,
    dto,
    ledgerAccounts,
    isLoading,
    error,
    refetch: fetchData,
  };
}
