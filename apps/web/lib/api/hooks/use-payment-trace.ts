"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "../client";
import { mapBackendTraceToView, type BackendTracePayload } from "../mappers/payment-trace";
import type { PaymentTrace } from "@/components/traces/types";

export interface UsePaymentTraceResult {
  trace: PaymentTrace | null;
  isLoading: boolean;
  error: Error | null;
  isUnavailable: boolean;
  refetch: () => Promise<void>;
}

export function usePaymentTrace(
  environmentId?: string | null,
  actionId?: string | null,
): UsePaymentTraceResult {
  const [trace, setTrace] = useState<PaymentTrace | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(environmentId && actionId));
  const [error, setError] = useState<Error | null>(null);
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false);

  const fetchTrace = useCallback(async () => {
    if (!environmentId || !actionId) {
      setTrace(null);
      setIsLoading(false);
      setIsUnavailable(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsUnavailable(false);

    try {
      const cleanActionId = actionId.replace(/^trace-/, "");

      // Concurrently query action trace, action detail, PayPal op summary, and audit events
      const [backendTrace, actionData, op, events] = await Promise.all([
        apiClient.actions.getTrace(environmentId, cleanActionId).catch(() => null),
        apiClient.actions.get(environmentId, cleanActionId).catch(() => null),
        apiClient.payments.getPayPalOperation(environmentId, cleanActionId).catch(() => null),
        apiClient.activity.list(environmentId, { limit: 100 }).catch(() => []),
      ]);

      const matchedEvent = events.find(
        (e) => e.actionId === cleanActionId || e.id === cleanActionId,
      );

      // If no entity matched the requested actionId, flag unavailable
      if (!backendTrace && !actionData && !op && !matchedEvent) {
        setIsUnavailable(true);
        setTrace(null);
        return;
      }

      const payload: BackendTracePayload = {
        action: (backendTrace?.action ?? actionData?.action ?? null) as Record<string, unknown> | null,
        agent: backendTrace?.agent ?? null,
        mandateChain: backendTrace?.mandateChain ?? [],
        rootMandate: backendTrace?.rootMandate ?? null,
        reservation: actionData?.reservation ?? null,
        operation: op,
        auditEvent: matchedEvent ?? null,
      };

      const mapped = mapBackendTraceToView(payload, op);
      setTrace(mapped);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [environmentId, actionId]);

  useEffect(() => {
    void fetchTrace();
  }, [fetchTrace]);

  return {
    trace,
    isLoading,
    error,
    isUnavailable,
    refetch: fetchTrace,
  };
}
