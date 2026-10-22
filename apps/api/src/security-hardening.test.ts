import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryAuditStore } from "./audit.js";
import { createPrincipalResolver } from "./auth.js";
import { InMemoryAuthorityStore } from "./phase2.js";
import { InMemoryLedgerStore } from "./phase3.js";
import { InMemoryRegistry } from "./phase1.js";
import { validateAuditPayload, verifyAuditChain } from "@payguardian/observability";

const apps = new Set<Awaited<ReturnType<typeof buildApp>>>();
const originalEnvironment = process.env.NODE_ENV;
const originalLocalAuth = process.env.ENABLE_LOCAL_DEV_AUTH;
const originalDatabaseMode = process.env.DATABASE_MODE;
const originalPayPalMode = process.env.PAYPAL_EXECUTION_MODE;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
  restore("NODE_ENV", originalEnvironment);
  restore("ENABLE_LOCAL_DEV_AUTH", originalLocalAuth);
  restore("DATABASE_MODE", originalDatabaseMode);
  restore("PAYPAL_EXECUTION_MODE", originalPayPalMode);
  restore("SUPABASE_URL", originalSupabaseUrl);
  restore("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseServiceRoleKey);
});

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function testApp(audit = new InMemoryAuditStore()) {
  const app = buildApp({
    registry: new InMemoryRegistry(),
    authority: new InMemoryAuthorityStore(),
    ledger: new InMemoryLedgerStore(),
    audit,
    resolvePrincipal: async (_authorization, localUserId) =>
      localUserId ? { userId: localUserId, kind: "user" } : null,
  });
  apps.add(app);
  return { app, audit };
}

describe("Phase 7 security hardening", () => {
  it("rejects sensitive fields even when nested in an audit payload", () => {
    expect(() => validateAuditPayload({ metadata: { accessToken: "redacted" } })).toThrow(
      "AUDIT_PAYLOAD_SENSITIVE_KEY",
    );
    expect(() => validateAuditPayload({ metadata: { apiKey: "redacted" } })).toThrow(
      "AUDIT_PAYLOAD_SENSITIVE_KEY",
    );
  });

  it("rejects cross-tenant reads and mutations for guessed resource IDs", async () => {
    const { app } = testApp();
    const alice = { "x-local-user-id": "alice" };
    const bob = { "x-local-user-id": "bob" };
    const environment = await app.inject({
      method: "POST",
      url: "/v1/environments",
      headers: alice,
      payload: {
        name: "Travel",
        purpose: "Trip planning",
        currency: "USD",
        budgetLimitMinor: 10000,
      },
    });
    const environmentId = environment.json().environment.id as string;
    const root = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/root`,
      headers: alice,
      payload: { name: "Personal Agent" },
    });
    const rootAgentId = root.json().agent.id as string;

    const foreignRead = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/agents`,
      headers: bob,
    });
    expect(foreignRead.statusCode).toBe(404);

    const foreignMutation = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/children`,
      headers: bob,
      payload: { parentAgentId: rootAgentId, name: "Foreign Child", kind: "hotel" },
    });
    expect(foreignMutation.statusCode).toBe(404);
    expect(foreignMutation.json().code).toBe("ENVIRONMENT_NOT_FOUND");
  });

  it("rejects local authentication configuration before a production app starts", () => {
    process.env.NODE_ENV = "production";
    process.env.ENABLE_LOCAL_DEV_AUTH = "true";
    process.env.DATABASE_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
    process.env.PAYPAL_EXECUTION_MODE = "worker";

    expect(() => buildApp()).toThrow("ENABLE_LOCAL_DEV_AUTH must be false or unset in production.");
  });

  it("does not resolve a local identity when production auth is configured", async () => {
    const resolvePrincipal = createPrincipalResolver(null, {
      nodeEnv: "production",
      databaseMode: "supabase",
      localDevAuthEnabled: false,
      paypalExecutionMode: "worker",
    });

    await expect(resolvePrincipal(undefined, "alice")).resolves.toBeNull();
  });

  it("audits sensitive mutations with a validated, tamper-evident chain", async () => {
    const { app, audit } = testApp();
    const headers = { "x-local-user-id": "alice" };
    const environment = await app.inject({
      method: "POST",
      url: "/v1/environments",
      headers,
      payload: {
        name: "Travel",
        purpose: "Trip planning",
        currency: "USD",
        budgetLimitMinor: 10000,
      },
    });
    const environmentId = environment.json().environment.id as string;
    const root = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/root`,
      headers,
      payload: { name: "Personal Agent" },
    });
    const agentId = root.json().agent.id as string;
    const mandate = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/mandates/root`,
      headers,
      payload: {
        holderAgentId: agentId,
        budgetLimitMinor: 10000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2027-01-01T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: false,
      },
    });
    expect(mandate.statusCode).toBe(201);
    const mandateId = mandate.json().mandate.id as string;
    const account = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: { mandateId, currency: "USD", availableMinor: 10000 },
    });
    const reserved = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: account.json().account.id,
        idempotencyKey: "audit-action-1",
        requestHash: "audit-request-1",
        action: "book_hotel",
        amountMinor: 1500,
        currency: "USD",
      },
    });
    expect(reserved.statusCode).toBe(201);

    const events = await audit.list(environmentId);
    expect(events.map((event) => event.eventType)).toEqual([
      "environment.created",
      "agent.created",
      "mandate.created",
      "ledger.account_created",
      "action.reserved",
    ]);
    expect(events.every((event) => event.actorId === "alice")).toBe(true);
    expect(
      events.every((event) => !JSON.stringify(event).match(/secret|token|password|authorization/i)),
    ).toBe(true);
    expect(audit.verify(environmentId)).toBe(true);

    const tampered = events.map((event) => ({ ...event, payload: { ...event.payload } }));
    tampered[0] = {
      ...tampered[0],
      payload: { ...tampered[0].payload, amountMinor: 999999 },
    };
    expect(verifyAuditChain(tampered)).toBe(false);
  });

  it("records denied protected mutations without exposing request secrets", async () => {
    const { app, audit } = testApp();
    const headers = { "x-local-user-id": "alice" };
    const environment = await app.inject({
      method: "POST",
      url: "/v1/environments",
      headers,
      payload: {
        name: "Travel",
        purpose: "Trip planning",
        currency: "USD",
        budgetLimitMinor: 10000,
      },
    });
    const environmentId = environment.json().environment.id as string;
    const root = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/root`,
      headers,
      payload: { name: "Personal Agent" },
    });
    const agentId = root.json().agent.id as string;
    const mandate = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/mandates/root`,
      headers,
      payload: {
        holderAgentId: agentId,
        budgetLimitMinor: 10000,
        currency: "USD",
        permittedActions: ["book_hotel"],
        expiresAt: "2027-01-01T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: false,
      },
    });
    const mandateId = mandate.json().mandate.id as string;
    const denied = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId,
        mandateId,
        ledgerAccountId: "not-used-after-denial",
        idempotencyKey: "denied-action-1",
        requestHash: "denied-request-1",
        action: "refund",
        amountMinor: 1,
        currency: "USD",
      },
    });
    expect(denied.statusCode).toBe(403);
    expect((await audit.list(environmentId)).at(-1)).toMatchObject({
      eventType: "action.denied",
      outcome: "denied",
      reasonCode: "ACTION_NOT_PERMITTED",
    });
    expect(JSON.stringify(await audit.list(environmentId))).not.toMatch(
      /secret|token|password|authorization/i,
    );
    expect(audit.verify(environmentId)).toBe(true);
  });
});
