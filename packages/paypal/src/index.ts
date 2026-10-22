export type PayPalAction = {
  id: string;
  environmentId: string;
  agentId: string;
  mandateId: string;
  idempotencyKey: string;
  requestHash: string;
  action: string;
  amountMinor: number;
  currency: string;
  authorizationState: string;
  executionState: string;
  createdAt: string;
};

export type PayPalOrder = {
  id: string;
  status: string;
  approvalUrl: string | null;
  currency: string;
  amountMinor: number;
};

export type PayPalCapture = {
  orderId: string;
  status: string;
  captureId: string | null;
};

export type PayPalOrderStatus = {
  orderId: string;
  status: string;
  captureId: string | null;
};

export type PayPalClient = {
  createOrder(input: {
    action: PayPalAction;
    requestId: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<PayPalOrder>;
  captureOrder(input: { orderId: string; requestId: string }): Promise<PayPalCapture>;
  getOrder(input: { orderId: string }): Promise<PayPalOrderStatus>;
  verifyWebhook(input: { headers: Record<string, string>; event: unknown }): Promise<boolean>;
};

export class PayPalError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable: boolean) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

function requirePayPalConfig(): {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  currency: string;
} {
  const baseUrl = process.env.PAYPAL_BASE_URL ?? "https://api-m.sandbox.paypal.com";
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const currency = (process.env.PAYPAL_CURRENCY ?? "USD").toUpperCase();
  if (!clientId || !clientSecret)
    throw new PayPalError("PayPal credentials are not configured.", "PAYPAL_NOT_CONFIGURED", false);
  if (currency !== "USD")
    throw new PayPalError(
      "PayPal Sandbox provider execution currently supports USD only.",
      "PAYPAL_CURRENCY_UNSUPPORTED",
      false,
    );
  return { baseUrl: baseUrl.replace(/\/$/, ""), clientId, clientSecret, currency };
}

async function paypalRequest<T>(
  baseUrl: string,
  token: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const text = await response.text();
  const body: unknown = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  })();
  if (!response.ok) {
    const name =
      typeof body === "object" && body && "name" in body
        ? String(body.name)
        : "PAYPAL_REQUEST_FAILED";
    throw new PayPalError(
      `PayPal request failed: ${name}.`,
      name,
      response.status >= 500 || response.status === 429,
    );
  }
  return body as T;
}

export class HttpPayPalClient implements PayPalClient {
  private accessToken: { value: string; expiresAt: number } | null = null;

  async createOrder(input: {
    action: PayPalAction;
    requestId: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<PayPalOrder> {
    const config = requirePayPalConfig();
    if (input.action.currency !== config.currency) {
      throw new PayPalError(
        "PayPal order currency must be USD.",
        "PAYPAL_CURRENCY_UNSUPPORTED",
        false,
      );
    }
    const token = await this.accessTokenFor(config);
    const body = await paypalRequest<{
      id: string;
      status: string;
      links?: Array<{ rel: string; href: string }>;
    }>(config.baseUrl, token, "/v2/checkout/orders", {
      method: "POST",
      headers: { "PayPal-Request-Id": input.requestId },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.action.id,
            custom_id: input.action.id,
            amount: {
              currency_code: config.currency,
              value: (input.action.amountMinor / 100).toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          user_action: "PAY_NOW",
        },
      }),
    });
    return {
      id: body.id,
      status: body.status,
      approvalUrl:
        body.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href ??
        null,
      currency: config.currency,
      amountMinor: input.action.amountMinor,
    };
  }

  async captureOrder(input: { orderId: string; requestId: string }): Promise<PayPalCapture> {
    const config = requirePayPalConfig();
    const token = await this.accessTokenFor(config);
    const body = await paypalRequest<{
      id: string;
      status: string;
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string; status: string }> } }>;
    }>(config.baseUrl, token, `/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": input.requestId },
      body: JSON.stringify({}),
    });
    const capture = body.purchase_units?.[0]?.payments?.captures?.[0];
    return { orderId: body.id, status: body.status, captureId: capture?.id ?? null };
  }

  async getOrder(input: { orderId: string }): Promise<PayPalOrderStatus> {
    const config = requirePayPalConfig();
    const token = await this.accessTokenFor(config);
    const body = await paypalRequest<{
      id: string;
      status: string;
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>;
    }>(config.baseUrl, token, `/v2/checkout/orders/${encodeURIComponent(input.orderId)}`, {
      method: "GET",
    });
    return {
      orderId: body.id,
      status: body.status,
      captureId: body.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null,
    };
  }

  async verifyWebhook(input: {
    headers: Record<string, string>;
    event: unknown;
  }): Promise<boolean> {
    const config = requirePayPalConfig();
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId)
      throw new PayPalError(
        "PayPal webhook ID is not configured.",
        "PAYPAL_WEBHOOK_NOT_CONFIGURED",
        false,
      );
    const token = await this.accessTokenFor(config);
    const body = await paypalRequest<{ verification_status?: string }>(
      config.baseUrl,
      token,
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          auth_algo: input.headers["paypal-auth-algo"],
          cert_url: input.headers["paypal-cert-url"],
          transmission_id: input.headers["paypal-transmission-id"],
          transmission_sig: input.headers["paypal-transmission-sig"],
          transmission_time: input.headers["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: input.event,
        }),
      },
    );
    return body.verification_status === "SUCCESS";
  }

  private async accessTokenFor(config: {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    currency: string;
  }): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 30_000)
      return this.accessToken.value;
    const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
    const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!response.ok || !body.access_token) {
      throw new PayPalError(
        "PayPal access token request failed.",
        body.error ?? "PAYPAL_AUTH_FAILED",
        response.status >= 500 || response.status === 429,
      );
    }
    this.accessToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 300) * 1000,
    };
    return body.access_token;
  }
}
