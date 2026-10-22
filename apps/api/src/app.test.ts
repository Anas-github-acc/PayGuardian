import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const apps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

describe("Phase 0 gateway", () => {
  it("exposes a health endpoint without enabling authority", async () => {
    const app = buildApp();
    apps.add(app);

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "gateway-api" });
  });

  it("exposes the explicit Phase 0 status", async () => {
    const app = buildApp();
    apps.add(app);

    const response = await app.inject({ method: "GET", url: "/v1/system/status" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ authorityEnforcement: "not-enabled" });
  });

  it("publishes the health and status routes in the OpenAPI document", async () => {
    const app = buildApp();
    apps.add(app);

    const response = await app.inject({ method: "GET", url: "/docs/json" });

    expect(response.statusCode).toBe(200);
    expect(response.json().paths).toMatchObject({
      "/health": expect.any(Object),
      "/v1/system/status": expect.any(Object),
    });
  });
});
