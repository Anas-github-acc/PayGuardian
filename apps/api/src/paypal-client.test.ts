import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpPayPalClient } from "./paypal.js";

const action = {
  id: "action-1",
  environmentId: "environment-1",
  agentId: "agent-1",
  mandateId: "mandate-1",
  idempotencyKey: "request-1",
  requestHash: "hash-1",
  action: "paypal_order",
  amountMinor: 1234,
  currency: "USD",
  authorizationState: "authorized",
  executionState: "pending",
  createdAt: "2026-10-22T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("PayPal HTTP client", () => {
  it("uses OAuth, USD minor-unit conversion, approval links, and request idempotency", async () => {
    vi.stubEnv("PAYPAL_BASE_URL", "https://api-m.sandbox.paypal.com");
    vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("PAYPAL_CURRENCY", "USD");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-token", expires_in: 300 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "order-1",
            status: "CREATED",
            links: [{ rel: "payer-action", href: "https://paypal.test/approve/order-1" }],
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "order-1",
            status: "COMPLETED",
            purchase_units: [
              { payments: { captures: [{ id: "capture-1", status: "COMPLETED" }] } },
            ],
          }),
          { status: 201 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new HttpPayPalClient();
    const order = await client.createOrder({
      action,
      requestId: "paypal-request-1",
      returnUrl: "https://app.test/paypal/return",
      cancelUrl: "https://app.test/paypal/cancel",
    });
    const capture = await client.captureOrder({ orderId: order.id, requestId: "paypal-capture-1" });

    expect(order).toMatchObject({
      id: "order-1",
      approvalUrl: "https://paypal.test/approve/order-1",
      amountMinor: 1234,
      currency: "USD",
    });
    expect(capture).toEqual({ orderId: "order-1", status: "COMPLETED", captureId: "capture-1" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject({
      "PayPal-Request-Id": "paypal-request-1",
      authorization: "Bearer access-token",
    });
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toMatchObject({
      intent: "CAPTURE",
      purchase_units: [{ amount: { currency_code: "USD", value: "12.34" } }],
    });
  });
});
