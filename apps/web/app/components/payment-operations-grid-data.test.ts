import { describe, expect, it } from "vitest";
import { buildPaymentOperationRows } from "./payment-operations-grid-data";

describe("payment operation grid data", () => {
  it("maps safe API summaries into readable monitoring rows", () => {
    expect(
      buildPaymentOperationRows([
        {
          actionId: "action-1",
          provider: "paypal",
          providerOrderId: "order-1",
          status: "CREATED",
          observedProviderStatus: null,
          captureId: null,
          reconciliationState: "pending",
          amountMinor: 1250,
          currency: "USD",
          authorizationState: "authorized",
          executionState: "pending",
          lastCheckedAt: null,
          lastEventAt: null,
          lastErrorCode: null,
          createdAt: "2026-10-22T00:00:00.000Z",
          updatedAt: "2026-10-22T00:00:00.000Z",
        },
        {
          actionId: "action-2",
          provider: "paypal",
          providerOrderId: "order-2",
          status: "COMPLETED",
          observedProviderStatus: "COMPLETED",
          captureId: "capture-2",
          reconciliationState: "resolved",
          amountMinor: null,
          currency: null,
          authorizationState: null,
          executionState: null,
          lastCheckedAt: null,
          lastEventAt: null,
          lastErrorCode: null,
          createdAt: "2026-10-22T00:00:00.000Z",
          updatedAt: "2026-10-22T00:01:00.000Z",
        },
      ]),
    ).toMatchObject([
      {
        id: "action-1",
        providerOrderId: "order-1",
        amount: "12.50 USD",
        observedProviderStatus: "—",
        captureId: "—",
      },
      { id: "action-2", amount: "—", captureId: "capture-2" },
    ]);
  });
});
