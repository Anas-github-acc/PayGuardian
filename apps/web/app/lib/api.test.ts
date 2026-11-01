import { describe, expect, it } from "vitest";
import { buildApiHeaders } from "./api";

describe("dashboard API authentication headers", () => {
  it("uses the Supabase bearer token for authenticated requests", () => {
    const headers = buildApiHeaders(
      { access_token: "supabase-access-token" },
      "local-user",
      { "x-local-user-id": "stale-local-user" },
      true,
    );

    expect(headers.get("authorization")).toBe("Bearer supabase-access-token");
    expect(headers.get("x-local-user-id")).toBeNull();
  });

  it("keeps local authentication available only outside production", () => {
    const developmentHeaders = buildApiHeaders(null, "local-user", undefined, false);
    const productionHeaders = buildApiHeaders(null, "local-user", undefined, true);

    expect(developmentHeaders.get("x-local-user-id")).toBe("local-user");
    expect(productionHeaders.get("x-local-user-id")).toBeNull();
  });

  it("preserves caller headers while adding JSON content type", () => {
    const headers = buildApiHeaders(null, undefined, { "x-request-id": "request-1" }, false);

    expect(headers.get("x-request-id")).toBe("request-1");
    expect(headers.get("content-type")).toBe("application/json");
  });
});

describe("apiRequest", () => {
  it("omits content-type on bodyless requests so Fastify does not reject empty JSON", async () => {
    let capturedHeaders: Headers | undefined;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return {
        ok: true,
        json: async () => ({ success: true }),
      } as unknown as Response;
    }) as typeof fetch;

    try {
      const { apiRequest } = await import("./api");
      await apiRequest("http://mock-api", "/test", null, { method: "POST" }, "local-user");
      expect(capturedHeaders?.has("content-type")).toBe(false);
      expect(capturedHeaders?.get("x-local-user-id")).toBe("local-user");

      await apiRequest(
        "http://mock-api",
        "/test",
        null,
        { method: "POST", body: JSON.stringify({ a: 1 }) },
        "local-user",
      );
      expect(capturedHeaders?.get("content-type")).toBe("application/json");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
