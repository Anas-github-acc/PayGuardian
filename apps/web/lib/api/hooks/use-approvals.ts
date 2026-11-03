"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../client";
import { mapApprovalsToItems } from "../mappers/approvals";
import type { ApprovalItem } from "@/components/approvals/types";
import type { ApprovalDto, AgentDto, MandateDto } from "@payguardian/contracts";

export interface UseApprovalsResult {
  approvals: ApprovalItem[];
  rawApprovals: ApprovalDto[];
  isLoading: boolean;
  error: Error | null;
  approve: (approvalId: string) => Promise<ApprovalDto>;
  reject: (approvalId: string, reason?: string) => Promise<ApprovalDto>;
  refetch: () => Promise<void>;
}

export function useApprovals(
  environmentId?: string | null,
  statusFilter?: "pending" | "approved" | "rejected",
): UseApprovalsResult {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [rawApprovals, setRawApprovals] = useState<ApprovalDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(environmentId));
  const [error, setError] = useState<Error | null>(null);

  const fetchApprovals = useCallback(async () => {
    if (!environmentId) {
      setApprovals([]);
      setRawApprovals([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [fetchedApprovals, fetchedAgents, fetchedMandates] = await Promise.all([
        apiClient.approvals.list(environmentId, statusFilter),
        apiClient.agents.list(environmentId).catch(() => [] as AgentDto[]),
        apiClient.mandates.list(environmentId).catch(() => [] as MandateDto[]),
      ]);

      setRawApprovals(fetchedApprovals);

      const items = mapApprovalsToItems(fetchedApprovals, fetchedAgents, fetchedMandates);
      setApprovals(items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [environmentId, statusFilter]);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  // Zero optimistic update - strictly update upon confirmed server response
  const approve = async (approvalId: string): Promise<ApprovalDto> => {
    if (!environmentId) throw new Error("No active environment.");
    const updated = await apiClient.approvals.approve(environmentId, approvalId);
    await fetchApprovals();
    return updated;
  };

  // Zero optimistic update - strictly update upon confirmed server response
  const reject = async (approvalId: string, reason?: string): Promise<ApprovalDto> => {
    if (!environmentId) throw new Error("No active environment.");
    const updated = await apiClient.approvals.reject(environmentId, approvalId, reason);
    await fetchApprovals();
    return updated;
  };

  return {
    approvals,
    rawApprovals,
    isLoading,
    error,
    approve,
    reject,
    refetch: fetchApprovals,
  };
}
