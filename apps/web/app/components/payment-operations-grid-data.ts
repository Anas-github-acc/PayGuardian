export type PaymentOperation = {
  actionId: string;
  provider: "paypal";
  providerOrderId: string;
  status: string;
  observedProviderStatus: string | null;
  captureId: string | null;
  reconciliationState: "pending" | "resolved";
  amountMinor: number | null;
  currency: string | null;
  authorizationState: string | null;
  executionState: string | null;
  lastCheckedAt: string | null;
  lastEventAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentOperationGridRow = {
  id: string;
  providerOrderId: string;
  amount: string;
  status: string;
  observedProviderStatus: string;
  reconciliationState: string;
  captureId: string;
  executionState: string;
  updatedAt: string;
};

function formatAmount(amountMinor: number | null, currency: string | null): string {
  if (amountMinor === null || !currency) return "—";
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

export function buildPaymentOperationRows(
  operations: PaymentOperation[],
): PaymentOperationGridRow[] {
  return operations.map((operation) => ({
    id: operation.actionId,
    providerOrderId: operation.providerOrderId,
    amount: formatAmount(operation.amountMinor, operation.currency),
    status: operation.status,
    observedProviderStatus: operation.observedProviderStatus ?? "—",
    reconciliationState: operation.reconciliationState,
    captureId: operation.captureId ?? "—",
    executionState: operation.executionState ?? "—",
    updatedAt: operation.updatedAt,
  }));
}
