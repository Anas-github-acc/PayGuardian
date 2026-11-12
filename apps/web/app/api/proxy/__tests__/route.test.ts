import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "../[...path]/route";

describe("Next.js API Proxy Route Handler", () => {
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

  it("proxies GET request to Fastify Gateway with forwarded dev headers", async () => {
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify([{ id: "env-1", name: "Production" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const request = new NextRequest(
      "http://localhost:3000/api/proxy/v1/environments?status=active",
      {
        method: "GET",
      },
    );

    const ctx = {
      params: Promise.resolve({ path: ["v1", "environments"] }),
    };

    const response = await GET(request, ctx);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "env-1", name: "Production" }]);
    expect(capturedUrl).toContain("/v1/environments?status=active");
    expect(capturedInit?.method).toBe("GET");

    const forwardedHeaders = new Headers(capturedInit?.headers);
    expect(forwardedHeaders.get("x-local-user-id")).toBe("local-user");
  });

  it("forwards bearer token from session cookie", async () => {
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }) as typeof fetch;

    const request = new NextRequest("http://localhost:3000/api/proxy/v1/models", {
      method: "GET",
      headers: {
        cookie: "sb-access-token=supabase-secret-token",
      },
    });

    const ctx = {
      params: Promise.resolve({ path: ["v1", "models"] }),
    };

    const response = await GET(request, ctx);
    expect(response.status).toBe(200);

    const forwardedHeaders = new Headers(capturedInit?.headers);
    expect(forwardedHeaders.get("authorization")).toBe("Bearer supabase-secret-token");
    expect(forwardedHeaders.has("x-local-user-id")).toBe(false);
  });

  it("forwards body and content-type on POST", async () => {
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ id: "env-created" }), { status: 201 });
    }) as typeof fetch;

    const payload = { name: "Test Env", purpose: "QA", currency: "USD", budgetLimitMinor: 100000 };
    const request = new NextRequest("http://localhost:3000/api/proxy/v1/environments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const ctx = {
      params: Promise.resolve({ path: ["v1", "environments"] }),
    };

    const response = await POST(request, ctx);
    expect(response.status).toBe(201);
    expect(capturedInit?.method).toBe("POST");
    expect(JSON.parse(capturedInit?.body as string)).toEqual(payload);
  });

  it("returns 502 with structured error when upstream gateway is unavailable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:3001");
    }) as typeof fetch;

    const request = new NextRequest("http://localhost:3000/api/proxy/v1/health", {
      method: "GET",
    });

    const ctx = {
      params: Promise.resolve({ path: ["v1", "health"] }),
    };

    const response = await GET(request, ctx);
    expect(response.status).toBe(502);

    const errorBody = await response.json();
    expect(errorBody.code).toBe("GATEWAY_PROXY_ERROR");
    expect(errorBody.message).toContain("ECONNREFUSED");
  });

  it("handles 204 No Content response on DELETE without TypeError", async () => {
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(null, { status: 204, statusText: "No Content" });
    }) as typeof fetch;

    const request = new NextRequest("http://localhost:3000/api/proxy/v1/environments/env-1", {
      method: "DELETE",
    });

    const ctx = {
      params: Promise.resolve({ path: ["v1", "environments", "env-1"] }),
    };

    const response = await DELETE(request, ctx);
    expect(response.status).toBe(204);
    expect(capturedInit?.method).toBe("DELETE");
    expect(response.body).toBeNull();
  });

  it("does not inject content-type application/json when POST body is empty", async () => {
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ status: "approved" }), { status: 200 });
    }) as typeof fetch;

    const request = new NextRequest("http://localhost:3000/api/proxy/v1/approvals/appr-1/approve", {
      method: "POST",
    });

    const ctx = {
      params: Promise.resolve({ path: ["v1", "approvals", "appr-1", "approve"] }),
    };

    const response = await POST(request, ctx);
    expect(response.status).toBe(200);
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.body).toBeUndefined();

    const forwardedHeaders = new Headers(capturedInit?.headers);
    expect(forwardedHeaders.has("content-type")).toBe(false);
  });
});
