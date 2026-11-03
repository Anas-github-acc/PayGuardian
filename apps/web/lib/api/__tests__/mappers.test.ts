import { describe, expect, it } from "vitest";
import {
  mapWorkspaceGraph,
  mapBudgetStrip,
  mapAuditEventToFeedItem,
  mapApprovalDtoToItem,
  mapBackendTraceToView,
  mapSessionDtoToItem,
  getMemoryVaultUnavailableState,
} from "../mappers";
import type {
  AgentDto,
  MandateDto,
  LedgerAccountDto,
  EnvironmentDto,
  ApprovalDto,
  AuditEventDto,
  SessionDto,
  PayPalOperationSummaryDto,
} from "@payguardian/contracts";

describe("API Mappers", () => {
  it("maps workspace graph nodes and edges with integer minor units", () => {
    const agents: AgentDto[] = [
      {
        id: "root-1",
        environmentId: "env-1",
        name: "Root Orchestrator",
        kind: "orchestrator",
        parentAgentId: null,
        status: "active",
        createdAt: "2026-11-01T00:00:00Z",
      },
      {
        id: "child-1",
        environmentId: "env-1",
        name: "Travel Agent",
        kind: "travel",
        parentAgentId: "root-1",
        status: "active",
        createdAt: "2026-11-01T00:01:00Z",
      },
    ];

    const mandates: MandateDto[] = [
      {
        id: "mandate-root",
        environmentId: "env-1",
        issuerUserId: "user-1",
        holderAgentId: "root-1",
        parentMandateId: null,
        budgetLimitMinor: 1000000,
        allocatedMinor: 500000,
        spentMinor: 100000,
        reservedMinor: 50000,
        currency: "USD",
        permittedActions: ["*"],
        expiresAt: "2026-12-01T00:00:00Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
        state: "active",
        revokedAt: null,
        createdAt: "2026-11-01T00:00:00Z",
      },
      {
        id: "mandate-child",
        environmentId: "env-1",
        issuerUserId: "user-1",
        holderAgentId: "child-1",
        parentMandateId: "mandate-root",
        budgetLimitMinor: 500000,
        allocatedMinor: 500000,
        spentMinor: 25000,
        reservedMinor: 10000,
        currency: "USD",
        permittedActions: ["flight.procure"],
        expiresAt: "2026-12-01T00:00:00Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: true,
        state: "active",
        revokedAt: null,
        createdAt: "2026-11-01T00:01:00Z",
      },
    ];

    const result = mapWorkspaceGraph(agents, mandates);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);

    const rootNode = result.nodes.find((n) => n.id === "root-1");
    expect(rootNode?.role).toBe("orchestrator");
    expect(rootNode?.allocatedMinor).toBe(500000);
    expect(rootNode?.spentMinor).toBe(100000);
    expect(rootNode?.isFunded).toBe(true);

    const childNode = result.nodes.find((n) => n.id === "child-1");
    expect(childNode?.role).toBe("subagent");
    expect(childNode?.allocatedMinor).toBe(500000);

    const edge = result.edges[0];
    expect(edge.source).toBe("root-1");
    expect(edge.target).toBe("child-1");
    expect(edge.isAuthorized).toBe(true);
  });

  it("maps budget strip preserving integer minor units without lossy arithmetic", () => {
    const envDto: EnvironmentDto = {
      id: "env-travel",
      name: "Travel Operations",
      purpose: "Corporate Travel",
      currency: "USD",
      budgetLimitMinor: 5000000, // $50,000.00
      status: "active",
      createdAt: "2026-11-01T00:00:00Z",
    };

    const ledgerAccounts: LedgerAccountDto[] = [
      {
        id: "acc-1",
        environmentId: "env-travel",
        mandateId: "man-1",
        parentAccountId: null,
        currency: "USD",
        availableMinor: 3500000,
        reservedMinor: 500000,
        capturedMinor: 1000000,
      },
    ];

    const result = mapBudgetStrip(envDto, ledgerAccounts, [], 2, 4);

    expect(result.id).toBe("env-travel");
    expect(result.budgetLimitMinor).toBe(5000000);
    expect(result.availableMinor).toBe(3500000);
    expect(result.reservedMinor).toBe(500000);
    expect(result.spentMinor).toBe(1000000);
    expect(result.pendingApprovalsCount).toBe(2);
    expect(result.agentCount).toBe(4);
  });

  it("maps audit event to activity feed item", () => {
    const event: AuditEventDto = {
      id: "evt-99",
      environmentId: "env-1",
      actorType: "agent",
      actorId: "agent-hotel-01",
      sessionId: "sess-1",
      mandateId: "man-1",
      actionId: "act-1",
      eventType: "room_reserved",
      outcome: "success",
      reasonCode: null,
      payload: {
        amountMinor: 120000,
        currency: "USD",
      },
      previousHash: "0xprev",
      eventHash: "0xcurrent",
      createdAt: "2026-11-01T14:30:00Z",
    };

    const item = mapAuditEventToFeedItem(event, { "agent-hotel-01": "Hotel Subagent" });

    expect(item.id).toBe("evt-99");
    expect(item.actorName).toBe("Hotel Subagent");
    expect(item.action).toBe("room reserved");
    expect(item.amountMinor).toBe(120000);
    expect(item.currency).toBe("USD");
    expect(item.outcome).toBe("success");
    expect(item.traceId).toBe("trace-act-1");
  });

  it("maps approval DTO to item with ancestor chain", () => {
    const approvalDto: ApprovalDto = {
      id: "appr-01",
      environmentId: "env-1",
      mandateId: "man-1",
      agentId: "agent-1",
      action: "flight.procure",
      amountMinor: 65000,
      currency: "USD",
      requestHash: "0xhash123",
      status: "pending",
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      createdAt: "2026-11-01T12:00:00Z",
      updatedAt: "2026-11-01T12:00:00Z",
    };

    const agents: AgentDto[] = [
      {
        id: "agent-1",
        environmentId: "env-1",
        name: "Flight Agent",
        kind: "flight",
        parentAgentId: "root-agent",
        status: "active",
        createdAt: "2026-11-01T10:00:00Z",
      },
      {
        id: "root-agent",
        environmentId: "env-1",
        name: "Main Orchestrator",
        kind: "orchestrator",
        parentAgentId: null,
        status: "active",
        createdAt: "2026-11-01T10:00:00Z",
      },
    ];

    const item = mapApprovalDtoToItem(approvalDto, agents);

    expect(item.id).toBe("appr-01");
    expect(item.agentName).toBe("Flight Agent");
    expect(item.amountMinor).toBe(65000);
    expect(item.status).toBe("pending");
    expect(item.allowedActions).toEqual(["approve", "reject"]);
    expect(item.ancestorChain).toHaveLength(3);
    expect(item.ancestorChain[0].name).toBe("You (Operator)");
  });

  it("maps payment trace from audit event and PayPal operation summary without synthetic stages (R2)", () => {
    const auditEvent: AuditEventDto = {
      id: "evt-pay-1",
      environmentId: "env-1",
      actorType: "agent",
      actorId: "agent-1",
      sessionId: "sess-1",
      mandateId: "man-1",
      actionId: "act-pay-1",
      eventType: "paypal_order_captured",
      outcome: "success",
      reasonCode: null,
      payload: {
        recipient: "IndiGo Airlines",
        merchantCategory: "Airlines",
        amountMinor: 24500,
        currency: "USD",
      },
      previousHash: null,
      eventHash: "0xhash",
      createdAt: "2026-11-01T15:00:00Z",
    };

    const opSummary: PayPalOperationSummaryDto = {
      actionId: "act-pay-1",
      provider: "paypal",
      providerOrderId: "ORDER-12345",
      status: "COMPLETED",
      observedProviderStatus: "COMPLETED",
      captureId: "CAP-67890",
      reconciliationState: "resolved",
      amountMinor: 24500,
      currency: "USD",
      authorizationState: "AUTHORIZED",
      executionState: "SETTLED",
      lastCheckedAt: "2026-11-01T15:01:00Z",
      lastEventAt: "2026-11-01T15:00:30Z",
      lastErrorCode: null,
      createdAt: "2026-11-01T15:00:00Z",
      updatedAt: "2026-11-01T15:01:00Z",
    };

    const trace = mapBackendTraceToView(auditEvent, opSummary, "Test Env");

    expect(trace.id).toBe("trace-act-pay-1");
    expect(trace.transactionId).toBe("ORDER-12345");
    expect(trace.amountMinor).toBe(24500);
    expect(trace.rail).toBe("PayPal");
    expect(trace.status).toBe("completed");
    // Per R2: Never invent synthetic execution latencies or checklists
    expect(trace.stages).toHaveLength(0);
    expect(trace.checklist).toHaveLength(0);
  });

  it("maps payment trace from composite action, agent, and mandate chain", () => {
    const trace = mapBackendTraceToView({
      action: {
        id: "act-4001",
        environmentId: "env-1",
        amountMinor: 35000,
        currency: "USD",
        authorizationState: "authorized",
        executionState: "captured",
        requestHash: "0xhash4001",
        createdAt: "2026-11-01T16:00:00Z",
      },
      agent: {
        id: "agt-hotel",
        environmentId: "env-1",
        name: "Hotel Subagent",
        kind: "hotel",
        parentAgentId: "agt-root",
        status: "active",
        createdAt: "2026-11-01T10:00:00Z",
      },
      mandateChain: [
        {
          id: "man-root",
          environmentId: "env-1",
          issuerUserId: "usr-1",
          holderAgentId: "agt-root",
          parentMandateId: null,
          budgetLimitMinor: 1000000,
          allocatedMinor: 500000,
          spentMinor: 200000,
          reservedMinor: 50000,
          currency: "USD",
          permittedActions: ["*"],
          expiresAt: "2026-12-01T00:00:00Z",
          canDelegate: true,
          maxDelegationDepth: 2,
          approvalRequired: false,
          state: "active",
          revokedAt: null,
          createdAt: "2026-11-01T00:00:00Z",
        },
        {
          id: "man-hotel",
          environmentId: "env-1",
          issuerUserId: "usr-1",
          holderAgentId: "agt-hotel",
          parentMandateId: "man-root",
          budgetLimitMinor: 400000,
          allocatedMinor: 400000,
          spentMinor: 100000,
          reservedMinor: 35000,
          currency: "USD",
          permittedActions: ["lodging.reserve"],
          expiresAt: "2026-12-01T00:00:00Z",
          canDelegate: false,
          maxDelegationDepth: 0,
          approvalRequired: true,
          state: "active",
          revokedAt: null,
          createdAt: "2026-11-01T00:01:00Z",
        },
      ],
      reservation: {
        actionId: "act-4001",
        accountId: "acc-hotel",
        amountMinor: 35000,
        state: "captured",
      },
    });

    expect(trace.id).toBe("trace-act-4001");
    expect(trace.amountMinor).toBe(35000);
    expect(trace.status).toBe("completed");
    expect(trace.authChain).toHaveLength(2);
    expect(trace.authChain[0].name).toBe("Root Authority");
    expect(trace.authChain[1].mandateId).toBe("man-hotel");
    expect(trace.stages).toHaveLength(0);
    expect(trace.checklist).toHaveLength(0);
  });

  it("maps session DTO to session item", () => {
    const sessionDto: SessionDto = {
      id: "sess-1",
      environmentId: "env-1",
      agentId: "agent-1",
      name: "Conference Travel Booking",
      status: "active",
      context: { description: "Booking flight and hotel for conference" },
      createdAt: "2026-11-01T10:00:00Z",
      updatedAt: "2026-11-01T10:05:00Z",
    };

    const item = mapSessionDtoToItem(sessionDto);

    expect(item.id).toBe("sess-1");
    expect(item.title).toBe("Conference Travel Booking");
    expect(item.description).toBe("Booking flight and hotel for conference");
    expect(item.status).toBe("active");
  });

  it("returns explicit unavailable state for memory vault", () => {
    const state = getMemoryVaultUnavailableState();

    expect(state.isUnavailable).toBe(true);
    expect(state.items).toHaveLength(0);
    expect(state.reason).toContain("Memory Vault API is not implemented");
  });
});
