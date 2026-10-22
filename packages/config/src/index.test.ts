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

  it("accepts a fully configured production environment", () => {
    expect(
      loadRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_MODE: "supabase",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
        PAYPAL_EXECUTION_MODE: "worker",
        PAYPAL_CLIENT_ID: "paypal-client-id",
        PAYPAL_CLIENT_SECRET: "paypal-client-secret",
        PAYPAL_WEBHOOK_ID: "paypal-webhook-id",
        PAYPAL_RETURN_URL: "https://app.example.test/paypal/return",
        PAYPAL_CANCEL_URL: "https://app.example.test/paypal/cancel",
        PAYPAL_CURRENCY: "USD",
      }),
    ).toMatchObject({
      nodeEnv: "production",
      databaseMode: "supabase",
      paypalExecutionMode: "worker",
      localDevAuthEnabled: false,
    });
  });

  it("allows startup before a PayPal webhook is registered", () => {
    expect(
      loadRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_MODE: "supabase",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
        PAYPAL_EXECUTION_MODE: "worker",
        PAYPAL_CLIENT_ID: "paypal-client-id",
        PAYPAL_CLIENT_SECRET: "paypal-client-secret",
        PAYPAL_RETURN_URL: "https://app.example.test/paypal/return",
        PAYPAL_CANCEL_URL: "https://app.example.test/paypal/cancel",
        PAYPAL_CURRENCY: "USD",
      }),
    ).toMatchObject({ nodeEnv: "production", paypalExecutionMode: "worker" });
  });

  it("rejects placeholder provider configuration in production", () => {
    expect(() =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_MODE: "supabase",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
        PAYPAL_EXECUTION_MODE: "worker",
        PAYPAL_CLIENT_ID: "replace-with-paypal-sandbox-client-id",
        PAYPAL_CLIENT_SECRET: "paypal-client-secret",
        PAYPAL_WEBHOOK_ID: "paypal-webhook-id",
        PAYPAL_RETURN_URL: "https://app.example.test/paypal/return",
        PAYPAL_CANCEL_URL: "https://app.example.test/paypal/cancel",
      }),
    ).toThrow("PAYPAL_CLIENT_ID must be configured with a production value.");
  });

  it("requires HTTPS callback URLs and the supported production currency", () => {
    const base = {
      NODE_ENV: "production",
      DATABASE_MODE: "supabase",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-value",
      PAYPAL_EXECUTION_MODE: "worker",
      PAYPAL_CLIENT_ID: "paypal-client-id",
      PAYPAL_CLIENT_SECRET: "paypal-client-secret",
      PAYPAL_WEBHOOK_ID: "paypal-webhook-id",
      PAYPAL_RETURN_URL: "https://app.example.test/paypal/return",
      PAYPAL_CANCEL_URL: "https://app.example.test/paypal/cancel",
    };

    expect(() =>
      loadRuntimeConfig({ ...base, PAYPAL_RETURN_URL: "http://app.example.test/return" }),
    ).toThrow("PAYPAL_RETURN_URL must be an HTTPS URL in production.");
    expect(() => loadRuntimeConfig({ ...base, PAYPAL_CURRENCY: "INR" })).toThrow(
      "PAYPAL_CURRENCY=USD is required in production.",
    );
  });
});
