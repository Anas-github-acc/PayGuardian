import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, ApiClientError } from "../client";

describe("ApiClient", () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;

  beforeEach(() => {
    capturedUrl = undefined;
    capturedInit = undefined;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("routes requests through proxy baseUrl and forwards headers", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      } as unknown as Response;
    }) as typeof fetch;

    const client = new ApiClient("/api/proxy");
    const result = await client.get<{ status: string }>("/health");

    expect(result).toEqual({ status: "ok" });
    expect(capturedUrl).toBe("/api/proxy/health");
    expect(capturedInit?.method).toBe("GET");
    expect(capturedInit?.credentials).toBe("same-origin");
  });

  it("attaches bearer token authorization when provided", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: "env-1" }],
      } as unknown as Response;
    }) as typeof fetch;

    const client = new ApiClient();
    await client.environments.list({ token: "test-jwt-token" });

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-jwt-token");
    expect(capturedUrl).toBe("/api/proxy/v1/environments");
  });

  it("attaches x-local-user-id when localUserId is provided without token", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        status: 200,
        json: async () => [],
      } as unknown as Response;
    }) as typeof fetch;

    const client = new ApiClient();
    await client.agents.list("env-1", { localUserId: "dev-user-42" });

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("x-local-user-id")).toBe("dev-user-42");
    expect(headers.has("authorization")).toBe(false);
  });

  it("serializes JSON body for POST/PUT/PATCH and sets content-type", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: "env-new" }),
      } as unknown as Response;
    }) as typeof fetch;

    const client = new ApiClient();
    await client.environments.create({
      name: "New Env",
      purpose: "Testing",
      currency: "USD",
      budgetLimitMinor: 500000,
    });

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(capturedInit?.body as string)).toEqual({
      name: "New Env",
      purpose: "Testing",
      currency: "USD",
      budgetLimitMinor: 500000,
    });
  });

  it("throws ApiClientError with parsed details on upstream failure", async () => {
    globalThis.fetch = vi.fn(async () => {
      return {
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({
          code: "BUDGET_EXCEEDED",
          message: "Action reserve denied: requested amount exceeds mandate limit.",
        }),
      } as unknown as Response;
    }) as typeof fetch;

    const client = new ApiClient();
    await expect(
      client.ledger.reserve("env-1", {
        agentId: "agent-1",
        mandateId: "man-1",
        ledgerAccountId: "acc-1",
        idempotencyKey: "idem-1",
        requestHash: "0xhash",
        action: "flight.procure",
        amountMinor: 99999999,
        currency: "USD",
      }),
    ).rejects.toThrow(ApiClientError);

    try {
      await client.ledger.reserve("env-1", {
        agentId: "agent-1",
        mandateId: "man-1",
        ledgerAccountId: "acc-1",
        idempotencyKey: "idem-1",
        requestHash: "0xhash",
        action: "flight.procure",
        amountMinor: 99999999,
        currency: "USD",
      });
    } catch (err) {
      const apiErr = err as ApiClientError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.code).toBe("BUDGET_EXCEEDED");
      expect(apiErr.message).toContain("Action reserve denied");
    }
  });
});
