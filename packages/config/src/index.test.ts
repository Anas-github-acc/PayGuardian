import { describe, expect, it } from "vitest";
import { ConfigurationError, loadRuntimeConfig } from "./index.js";

describe("runtime configuration", () => {
  it("rejects unknown runtime environments", () => {
    expect(() => loadRuntimeConfig({ NODE_ENV: "staging" })).toThrow(
      "NODE_ENV must be development, test, or production.",
    );
  });

  it("rejects local authentication configuration in production", () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        ENABLE_LOCAL_DEV_AUTH: "true",
        DATABASE_MODE: "supabase",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
        PAYPAL_EXECUTION_MODE: "worker",
      }),
    ).toThrowError(
      new ConfigurationError("ENABLE_LOCAL_DEV_AUTH must be false or unset in production."),
    );
  });

  it("requires durable and remote services in production", () => {
    expect(() => loadRuntimeConfig({ NODE_ENV: "production" })).toThrow(
      "DATABASE_MODE=supabase is required in production.",
    );
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_MODE: "supabase",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-placeholder",
      }),
    ).toThrow("PAYPAL_EXECUTION_MODE=worker is required in production.");
  });
});
