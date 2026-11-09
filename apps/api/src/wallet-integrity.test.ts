import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { InMemoryRegistry } from "./phase1.js";
import { InMemoryAuthorityStore } from "./phase2.js";
import { InMemoryLedgerStore } from "./phase3.js";
import { InMemoryAuditStore } from "./audit.js";

describe("Wallet integrity verification and fail-closed authorization", () => {
  async function setup() {
    const registry = new InMemoryRegistry();
    const authority = new InMemoryAuthorityStore();
    const ledger = new InMemoryLedgerStore();
    const audit = new InMemoryAuditStore();
    const app = buildApp({
      registry,
      authority,
      ledger,
      audit,
      resolvePrincipal: async (_auth, localUserId) =>
        localUserId ? { userId: localUserId, kind: "user" } : null,
    });

    const headers = {
      "x-local-user-id": "user-integrity-1",
    };

    // 1. Create environment
    const envRes = await app.inject({
      method: "POST",
      url: "/v1/environments",
      headers,
      payload: {
        name: "Financial Boundary",
        purpose: "Integrity testing",
        currency: "USD",
        budgetLimitMinor: 100000,
      },
    });
    const environmentId = envRes.json().environment.id as string;

    // 2. Create Root Agent
    const rootAgentRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/root`,
      headers,
      payload: {
        name: "Primary Agent",
        capabilities: ["spend", "delegate"],
      },
    });
    const rootAgentId = rootAgentRes.json().agent.id as string;

    // 3. Create Child Agent
    const childAgentRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/agents/children`,
      headers,
      payload: {
        parentAgentId: rootAgentId,
        name: "Shopping Agent",
        kind: "procurement",
        capabilities: ["spend"],
      },
    });
    const childAgentId = childAgentRes.json().agent.id as string;

    // 4. Create Root Mandate
    const rootMandateRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/mandates/root`,
      headers,
      payload: {
        holderAgentId: rootAgentId,
        budgetLimitMinor: 100000,
        currency: "USD",
        permittedActions: ["purchase", "checkout"],
        expiresAt: "2027-01-01T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      },
    });
    const rootMandateId = rootMandateRes.json().mandate.id as string;

    // 5. Create Root Ledger Account
    const rootAccountRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: {
        mandateId: rootMandateId,
        currency: "USD",
        availableMinor: 100000,
      },
    });
    const rootAccountId = rootAccountRes.json().account.id as string;

    return {
      app,
      registry,
      authority,
      ledger,
      audit,
      headers,
      environmentId,
      rootAgentId,
      childAgentId,
      rootMandateId,
      rootAccountId,
    };
  }

  it("maintains cryptographic transition record and verifies integrity on valid operations", async () => {
    const { app, headers, environmentId, rootMandateId, rootAccountId, childAgentId } = await setup();

    // Delegate to child agent
    const delegationRes = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: childAgentId,
        budgetLimitMinor: 40000,
        currency: "USD",
        permittedActions: ["purchase"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });
    expect(delegationRes.statusCode).toBe(201);
    const childMandateId = delegationRes.json().mandate.id as string;

    // Create Child Ledger Account
    const childAccountRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/accounts`,
      headers,
      payload: {
        mandateId: childMandateId,
        parentAccountId: rootAccountId,
        currency: "USD",
        availableMinor: 0,
      },
    });
    expect(childAccountRes.statusCode).toBe(201);
    const childAccountId = childAccountRes.json().account.id as string;

    // Allocate 40000 from root to child
    const allocateRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/ledger/allocations`,
      headers,
      payload: {
        parentAccountId: rootAccountId,
        childAccountId,
        amountMinor: 40000,
        idempotencyKey: "alloc-test-1",
        requestHash: "hash-alloc-1",
      },
    });
    expect(allocateRes.statusCode).toBe(200);

    // Verify cryptographic transition records
    const transitionsRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/ledger/accounts/${childAccountId}/transitions`,
      headers,
    });
    expect(transitionsRes.statusCode).toBe(200);
    const transitions = transitionsRes.json().transitions;
    expect(transitions).toHaveLength(2); // create, allocation_in
    expect(transitions[0].transitionType).toBe("create");
    expect(transitions[0].sequence).toBe(1);
    expect(transitions[0].previousHash).toBeNull();
    expect(transitions[1].transitionType).toBe("allocation_in");
    expect(transitions[1].sequence).toBe(2);
    expect(transitions[1].previousHash).toBe(transitions[0].transitionHash);

    // Verify account and environment integrity endpoints
    const accountIntegrityRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/ledger/accounts/${childAccountId}/integrity`,
      headers,
    });
    expect(accountIntegrityRes.statusCode).toBe(200);
    expect(accountIntegrityRes.json().valid).toBe(true);

    const envIntegrityRes = await app.inject({
      method: "GET",
      url: `/v1/environments/${environmentId}/ledger/integrity`,
      headers,
    });
    expect(envIntegrityRes.statusCode).toBe(200);
    expect(envIntegrityRes.json().valid).toBe(true);

    // Spending succeeds when integrity is valid
    const spendRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: childAgentId,
        mandateId: childMandateId,
        ledgerAccountId: childAccountId,
        idempotencyKey: "spend-valid-1",
        requestHash: "req-hash-1",
        action: "purchase",
        amountMinor: 5000,
        currency: "USD",
      },
    });
    expect(spendRes.statusCode).toBe(201);
  });

  it("fails closed on spending when wallet integrity verification fails", async () => {
    const { app, ledger, audit, headers, environmentId, rootMandateId, rootAccountId, rootAgentId } = await setup();

    // Verify valid before tamper
    const initialCheck = await ledger.verifyAccountIntegrity(environmentId, rootAccountId);
    expect(initialCheck.valid).toBe(true);

    // Tamper with account balance directly (bypassing transition log)
    await ledger.tamperAccount!(environmentId, rootAccountId, (account) => {
      account.availableMinor = 999999; // forged funds
    });

    // Verification fails
    const tamperedCheck = await ledger.verifyAccountIntegrity(environmentId, rootAccountId);
    expect(tamperedCheck.valid).toBe(false);

    // Spending attempt must fail closed with 403 WALLET_INTEGRITY_VIOLATION
    const spendRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/actions/reserve`,
      headers,
      payload: {
        agentId: rootAgentId,
        mandateId: rootMandateId,
        ledgerAccountId: rootAccountId,
        idempotencyKey: "spend-tampered-1",
        requestHash: "req-hash-tampered-1",
        action: "purchase",
        amountMinor: 1000,
        currency: "USD",
      },
    });

    expect(spendRes.statusCode).toBe(403);
    const body = spendRes.json();
    expect(body.decision.allowed).toBe(false);
    expect(body.decision.code).toBe("WALLET_INTEGRITY_VIOLATION");
    expect(body.decision.reason).toMatch(/Wallet integrity verification failed/);

    // Audit trail must record the integrity violation
    const events = await audit.list(environmentId);
    const lastEvent = events.at(-1);
    expect(lastEvent).toMatchObject({
      eventType: "action.denied",
      outcome: "denied",
      reasonCode: "WALLET_INTEGRITY_VIOLATION",
    });
  });

  it("fails closed on delegation when wallet integrity verification fails", async () => {
    const { app, ledger, audit, headers, environmentId, rootMandateId, rootAccountId, childAgentId } = await setup();

    // Tamper with root account balance
    await ledger.tamperAccount!(environmentId, rootAccountId, (account) => {
      account.availableMinor = 999999;
    });

    // Delegation attempt must fail closed with 403 WALLET_INTEGRITY_VIOLATION
    const delegationRes = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/delegations`,
      headers,
      payload: {
        holderAgentId: childAgentId,
        budgetLimitMinor: 20000,
        currency: "USD",
        permittedActions: ["purchase"],
        expiresAt: "2026-12-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
      },
    });

    expect(delegationRes.statusCode).toBe(403);
    const body = delegationRes.json();
    expect(body.decision.allowed).toBe(false);
    expect(body.decision.code).toBe("WALLET_INTEGRITY_VIOLATION");
    expect(body.decision.reason).toMatch(/Wallet integrity verification failed/);

    // Audit trail must record delegation denied due to WALLET_INTEGRITY_VIOLATION
    const events = await audit.list(environmentId);
    const lastEvent = events.at(-1);
    expect(lastEvent).toMatchObject({
      eventType: "mandate.delegation_denied",
      outcome: "denied",
      reasonCode: "WALLET_INTEGRITY_VIOLATION",
    });
  });

  it("fails closed on payment authorization when wallet integrity verification fails", async () => {
    const { app, ledger, headers, environmentId, rootMandateId, rootAccountId, rootAgentId } = await setup();

    // Tamper with account balance
    await ledger.tamperAccount!(environmentId, rootAccountId, (account) => {
      account.availableMinor = 500; // forged/inconsistent balance
    });

    // Payment attempt via PayPal order must fail closed with 403 WALLET_INTEGRITY_VIOLATION
    const paymentRes = await app.inject({
      method: "POST",
      url: `/v1/environments/${environmentId}/payments/paypal/orders`,
      headers,
      payload: {
        agentId: rootAgentId,
        mandateId: rootMandateId,
        ledgerAccountId: rootAccountId,
        idempotencyKey: "paypal-integrity-order-1",
        requestHash: "hash-paypal-1",
        action: "checkout",
        amountMinor: 2500,
        currency: "USD",
      },
    });

    expect(paymentRes.statusCode).toBe(403);
    const body = paymentRes.json();
    expect(body.decision.allowed).toBe(false);
    expect(body.decision.code).toBe("WALLET_INTEGRITY_VIOLATION");
    expect(body.decision.reason).toMatch(/Wallet integrity verification failed/);
  });

  it("fails closed on authority check when wallet integrity verification fails", async () => {
    const { app, ledger, headers, rootMandateId, rootAccountId, environmentId } = await setup();

    // Tamper with account balance
    await ledger.tamperAccount!(environmentId, rootAccountId, (account) => {
      account.availableMinor = 123456;
    });

    const checkRes = await app.inject({
      method: "POST",
      url: `/v1/mandates/${rootMandateId}/check`,
      headers,
      payload: {
        action: "purchase",
        amountMinor: 500,
        currency: "USD",
      },
    });

    expect(checkRes.statusCode).toBe(403);
    expect(checkRes.json().decision.code).toBe("WALLET_INTEGRITY_VIOLATION");
  });
});
