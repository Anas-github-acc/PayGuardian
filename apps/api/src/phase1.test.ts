import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryRegistry } from "./phase1.js";

const apps = new Set<Awaited<ReturnType<typeof buildApp>>>();

afterEach(async () => {
  await Promise.all([...apps].map((app) => app.close()));
  apps.clear();
});

function testApp() {
  const app = buildApp({
    registry: new InMemoryRegistry(),
    resolvePrincipal: async (_authorization, localUserId) =>
      localUserId ? { userId: localUserId, kind: "user" } : null,
  });
  apps.add(app);
  return app;
}

describe("Phase 1 identity, environments, and registry", () => {
  it("requires authentication", async () => {
    const app = testApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/environments",
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("isolates environments and registers a Personal Agent with a one-time credential", async () => {
    const app = testApp();
    const alice = { "x-local-user-id": "alice" };
    const bob = { "x-local-user-id": "bob" };

    const createEnvironment = await app.inject({
      method: "POST",
      url: "/v1/environments",
      headers: alice,
      payload: {
        name: "Travel",
        purpose: "Trip planning",
        currency: "INR",
        budgetLimitMinor: 1000000,
      },
    });
    expect(createEnvironment.statusCode).toBe(201);
    const environmentId = createEnvironment.json().environment.id as string;

    const bobView = await app.inject({ method: "GET", url: "/v1/environments", headers: bob });
    expect(bobView.json().environments).toHaveLength(0);

    const root = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/root`,
      headers: alice,
      payload: { name: "Personal Agent", capabilities: ["delegate"] },
    });
    expect(root.statusCode).toBe(201);
    expect(root.json().agent.kind).toBe("personal");
    expect(root.json().credential.secret).toMatch(/^pg_/);

    const duplicate = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/root`,
      headers: alice,
      payload: { name: "Another Personal Agent" },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it("allows an authenticated owner to register descendants but not a foreign parent", async () => {
    const app = testApp();
    const headers = { "x-local-user-id": "alice" };
    const environment = await app.inject({
      method: "POST",
      url: "/v1/environments",
      headers,
      payload: {
        name: "Travel",
        purpose: "Trip planning",
        currency: "INR",
        budgetLimitMinor: 1000000,
      },
    });
    const environmentId = environment.json().environment.id as string;
    const root = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/root`,
      headers,
      payload: { name: "Personal Agent" },
    });
    const rootId = root.json().agent.id as string;

    const child = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/children`,
      headers,
      payload: { parentAgentId: rootId, name: "Travel Agent", kind: "travel" },
    });
    expect(child.statusCode).toBe(201);
    expect(child.json().agent.parentAgentId).toBe(rootId);

    const foreignParent = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/children`,
      headers,
      payload: { parentAgentId: "not-owned", name: "Hotel Agent", kind: "hotel" },
    });
    expect(foreignParent.statusCode).toBe(403);
  });

  it("supports credential rotation, revocation, and server-side agent identity resolution", async () => {
    const registry = new InMemoryRegistry();
    const app = buildApp({
      registry,
      config: {
        nodeEnv: "test",
        databaseMode: "memory",
        localDevAuthEnabled: true,
        paypalExecutionMode: "inline",
      },
    });
    apps.add(app);
    const headers = { "x-local-user-id": "alice" };

    const envRes = await app.inject({
      method: "POST",
      url: "/v1/environments",
      headers,
      payload: { name: "Travel", purpose: "Trips", currency: "INR", budgetLimitMinor: 10000 },
    });
    const envId = envRes.json().environment.id;

    const rootRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${envId}/agents/root`,
      headers,
      payload: { name: "Personal Agent" },
    });
    const agentId = rootRes.json().agent.id;
    const initialSecret = rootRes.json().credential.secret;
    const initialCredId = rootRes.json().credential.id;

    // Test that the agent credential secret authenticates the agent via Bearer token
    const authCheckInitial = await app.inject({
      method: "GET",
      url: "/v1/environments",
      headers: { authorization: `Bearer ${initialSecret}` },
    });
    expect(authCheckInitial.statusCode).toBe(200);

    // Rotate credential -> returns a new secret
    const rotateRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${envId}/agents/${agentId}/credentials/rotate`,
      headers,
    });
    expect(rotateRes.statusCode).toBe(201);
    const rotatedSecret = rotateRes.json().credential.secret;
    expect(rotatedSecret).toMatch(/^pg_/);
    expect(rotatedSecret).not.toBe(initialSecret);

    // During overlap, both initial and rotated secrets authenticate
    const authCheckRotated = await app.inject({
      method: "GET",
      url: "/v1/environments",
      headers: { authorization: `Bearer ${rotatedSecret}` },
    });
    expect(authCheckRotated.statusCode).toBe(200);

    const authCheckInitialStillValid = await app.inject({
      method: "GET",
      url: "/v1/environments",
      headers: { authorization: `Bearer ${initialSecret}` },
    });
    expect(authCheckInitialStillValid.statusCode).toBe(200);

    // Revoke the initial credential
    const revokeRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${envId}/agents/${agentId}/credentials/${initialCredId}/revoke`,
      headers,
    });
    expect(revokeRes.statusCode).toBe(200);

    // Revoked credential is now rejected
    const authCheckRevoked = await app.inject({
      method: "GET",
      url: "/v1/environments",
      headers: { authorization: `Bearer ${initialSecret}` },
    });
    expect(authCheckRevoked.statusCode).toBe(401);

    // Rotated credential continues to work
    const authCheckRotatedAfterRevoke = await app.inject({
      method: "GET",
      url: "/v1/environments",
      headers: { authorization: `Bearer ${rotatedSecret}` },
    });
    expect(authCheckRotatedAfterRevoke.statusCode).toBe(200);

    // Forged/spoofed agent secret is rejected
    const authCheckForged = await app.inject({
      method: "GET",
      url: "/v1/environments",
      headers: { authorization: "Bearer pg_forged_secret_xyz" },
    });
    expect(authCheckForged.statusCode).toBe(401);
  });
});
