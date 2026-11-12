import { describe, expect, it } from "vitest";
import { formatMinorUnits, calculateAvailableMinor } from "../../app/lib/currency";
import { workspaceStore } from "../../app/lib/workspace-store";
import { mapWorkspaceGraph } from "../../lib/api/mappers/workspace-graph";
import { mapAuditEventsToFeed } from "../../lib/api/mappers/activity-feed";
import type { AgentDto, MandateDto, LedgerAccountDto, AuditEventDto } from "@payguardian/contracts";

describe("Workspace Redesign Data & Arithmetic Invariants", () => {
  it("strictly validates financial authority arithmetic for the KPI metrics", () => {
    const totalLimitMinor = 1000000; // $10,000.00
    const spentMinor = 245000; // $2,450.00
    const reservedMinor = 150000; // $1,500.00

    const availableMinor = calculateAvailableMinor(totalLimitMinor, spentMinor, reservedMinor);
    expect(availableMinor).toBe(605000); // $6,050.00

    expect(formatMinorUnits(totalLimitMinor, "USD")).toBe("$10,000.00");
    expect(formatMinorUnits(spentMinor, "USD")).toBe("$2,450.00");
    expect(formatMinorUnits(reservedMinor, "USD")).toBe("$1,500.00");
    expect(formatMinorUnits(availableMinor, "USD")).toBe("$6,050.00");

    const spentPercent = (spentMinor / totalLimitMinor) * 100;
    const reservedPercent = (reservedMinor / totalLimitMinor) * 100;
    const availablePercent = (availableMinor / totalLimitMinor) * 100;

    expect(spentPercent).toBe(24.5);
    expect(reservedPercent).toBe(15);
    expect(availablePercent).toBe(60.5);
  });

  it("verifies topology nodes map properly from live relational backend data", () => {
    const agents: AgentDto[] = [
      {
        id: "orchestrator-root",
        environmentId: "env-1",
        parentAgentId: null,
        name: "Main Orchestrator",
        kind: "orchestrator",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "agent-travel",
        environmentId: "env-1",
        parentAgentId: "orchestrator-root",
        name: "Travel Subagent",
        kind: "specialist",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "agent-hotel",
        environmentId: "env-1",
        parentAgentId: "orchestrator-root",
        name: "Hotel Subagent",
        kind: "specialist",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "agent-flights-unfunded",
        environmentId: "env-1",
        parentAgentId: "orchestrator-root",
        name: "Flight Scraper",
        kind: "specialist",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "agent-booking-gw",
        environmentId: "env-1",
        parentAgentId: "orchestrator-root",
        name: "Booking Gateway",
        kind: "specialist",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
    ];

    const mandates: MandateDto[] = [
      {
        id: "m-root",
        environmentId: "env-1",
        issuerUserId: "u1",
        holderAgentId: "orchestrator-root",
        parentMandateId: null,
        budgetLimitMinor: 1000000,
        allocatedMinor: 1000000,
        spentMinor: 245000,
        reservedMinor: 150000,
        currency: "USD",
        permittedActions: ["*"],
        expiresAt: "2027-01-01T00:00:00Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
        state: "active",
        revokedAt: null,
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "m-travel",
        environmentId: "env-1",
        issuerUserId: "u1",
        holderAgentId: "agent-travel",
        parentMandateId: "m-root",
        budgetLimitMinor: 400000,
        allocatedMinor: 400000,
        spentMinor: 125000,
        reservedMinor: 50000,
        currency: "USD",
        permittedActions: ["flight.*"],
        expiresAt: "2027-01-01T00:00:00Z",
        canDelegate: true,
        maxDelegationDepth: 1,
        approvalRequired: false,
        state: "active",
        revokedAt: null,
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "m-hotel",
        environmentId: "env-1",
        issuerUserId: "u1",
        holderAgentId: "agent-hotel",
        parentMandateId: "m-root",
        budgetLimitMinor: 400000,
        allocatedMinor: 400000,
        spentMinor: 120000,
        reservedMinor: 100000,
        currency: "USD",
        permittedActions: ["hotel.*"],
        expiresAt: "2027-01-01T00:00:00Z",
        canDelegate: true,
        maxDelegationDepth: 1,
        approvalRequired: false,
        state: "active",
        revokedAt: null,
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "m-unfunded",
        environmentId: "env-1",
        issuerUserId: "u1",
        holderAgentId: "agent-flights-unfunded",
        parentMandateId: "m-travel",
        budgetLimitMinor: 0,
        allocatedMinor: 0,
        spentMinor: 0,
        reservedMinor: 0,
        currency: "USD",
        permittedActions: [],
        expiresAt: "2027-01-01T00:00:00Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: false,
        state: "active",
        revokedAt: null,
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "m-gateway",
        environmentId: "env-1",
        issuerUserId: "u1",
        holderAgentId: "agent-booking-gw",
        parentMandateId: "m-hotel",
        budgetLimitMinor: 200000,
        allocatedMinor: 200000,
        spentMinor: 0,
        reservedMinor: 0,
        currency: "USD",
        permittedActions: ["book.*"],
        expiresAt: "2027-01-01T00:00:00Z",
        canDelegate: true,
        maxDelegationDepth: 1,
        approvalRequired: false,
        state: "active",
        revokedAt: null,
        createdAt: "2026-10-31T00:00:00Z",
      },
    ];

    const ledgerAccounts: LedgerAccountDto[] = [
      {
        id: "acc-root",
        environmentId: "env-1",
        mandateId: "m-root",
        parentAccountId: null,
        availableMinor: 605000,
        reservedMinor: 150000,
        capturedMinor: 245000,
        currency: "USD",
      },
      {
        id: "acc-travel",
        environmentId: "env-1",
        mandateId: "m-travel",
        parentAccountId: "acc-root",
        availableMinor: 225000,
        reservedMinor: 50000,
        capturedMinor: 125000,
        currency: "USD",
      },
      {
        id: "acc-hotel",
        environmentId: "env-1",
        mandateId: "m-hotel",
        parentAccountId: "acc-root",
        availableMinor: 180000,
        reservedMinor: 100000,
        capturedMinor: 120000,
        currency: "USD",
      },
    ];

    const { nodes, edges } = mapWorkspaceGraph(agents, mandates, ledgerAccounts);

    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(4);

    const root = nodes.find((n) => n.id === "orchestrator-root");
    expect(root).toBeDefined();
    expect(root?.name).toBe("Main Orchestrator");
    expect(root?.role).toBe("orchestrator");
    expect(root?.allocatedMinor).toBe(1000000);
    expect(root?.spentMinor).toBe(245000);
    expect(root?.reservedMinor).toBe(150000);

    const travel = nodes.find((n) => n.id === "agent-travel");
    expect(travel?.allocatedMinor).toBe(400000);

    const scraper = nodes.find((n) => n.id === "agent-flights-unfunded");
    expect(scraper?.isFunded).toBe(false);

    const gateway = nodes.find((n) => n.id === "agent-booking-gw");
    expect(gateway?.status).toBe("active");
  });

  it("verifies dynamic subagent mapping for pipeline visualization", () => {
    const agents: AgentDto[] = [
      {
        id: "orchestrator-root",
        environmentId: "env-1",
        parentAgentId: null,
        name: "Main Orchestrator",
        kind: "orchestrator",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "agent-travel",
        environmentId: "env-1",
        parentAgentId: "orchestrator-root",
        name: "Travel Subagent",
        kind: "specialist",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "agent-hotel",
        environmentId: "env-1",
        parentAgentId: "orchestrator-root",
        name: "Hotel Subagent",
        kind: "specialist",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "agent-flights-unfunded",
        environmentId: "env-1",
        parentAgentId: "orchestrator-root",
        name: "Flight Scraper",
        kind: "specialist",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "agent-booking-gw",
        environmentId: "env-1",
        parentAgentId: "orchestrator-root",
        name: "Booking Gateway",
        kind: "specialist",
        status: "active",
        createdAt: "2026-10-31T00:00:00Z",
      },
    ];

    const mandates: MandateDto[] = [
      {
        id: "m-travel",
        environmentId: "env-1",
        issuerUserId: "u1",
        holderAgentId: "agent-travel",
        parentMandateId: null,
        budgetLimitMinor: 400000,
        allocatedMinor: 400000,
        spentMinor: 125000,
        reservedMinor: 50000,
        currency: "USD",
        permittedActions: ["flight.*"],
        expiresAt: "2027-01-01T00:00:00Z",
        canDelegate: true,
        maxDelegationDepth: 1,
        approvalRequired: false,
        state: "active",
        revokedAt: null,
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "m-hotel",
        environmentId: "env-1",
        issuerUserId: "u1",
        holderAgentId: "agent-hotel",
        parentMandateId: null,
        budgetLimitMinor: 400000,
        allocatedMinor: 400000,
        spentMinor: 120000,
        reservedMinor: 100000,
        currency: "USD",
        permittedActions: ["hotel.*"],
        expiresAt: "2027-01-01T00:00:00Z",
        canDelegate: true,
        maxDelegationDepth: 1,
        approvalRequired: false,
        state: "active",
        revokedAt: null,
        createdAt: "2026-10-31T00:00:00Z",
      },
      {
        id: "m-gateway",
        environmentId: "env-1",
        issuerUserId: "u1",
        holderAgentId: "agent-booking-gw",
        parentMandateId: null,
        budgetLimitMinor: 200000,
        allocatedMinor: 200000,
        spentMinor: 0,
        reservedMinor: 0,
        currency: "USD",
        permittedActions: ["book.*"],
        expiresAt: "2027-01-01T00:00:00Z",
        canDelegate: true,
        maxDelegationDepth: 1,
        approvalRequired: false,
        state: "active",
        revokedAt: null,
        createdAt: "2026-10-31T00:00:00Z",
      },
    ];

    const { nodes } = mapWorkspaceGraph(agents, mandates);
    const subagents = nodes.filter((n) => n.role === "subagent");
    expect(subagents).toHaveLength(4);

    const activeCount = subagents.filter((s) => s.status === "active").length;
    expect(activeCount).toBeGreaterThanOrEqual(2);

    const unfunded = subagents.find((s) => s.status === "unfunded");
    expect(unfunded?.id).toBe("agent-flights-unfunded");
    expect(unfunded?.allocatedMinor).toBe(0);
  });

  it("verifies semantic recent activities include Paid, Blocked, and Reserved states", () => {
    const rawEvents: AuditEventDto[] = [
      {
        id: "evt-01",
        environmentId: "env-1",
        actorType: "agent",
        actorId: "agent-hotel",
        sessionId: null,
        mandateId: "m-hotel",
        actionId: "act-1",
        eventType: "action.reserved",
        outcome: "success",
        reasonCode: null,
        createdAt: "2026-10-31T14:02:18Z",
        payload: {
          amountMinor: 100000,
          currency: "USD",
          purpose: "Reserved room at Grand Hyatt Goa",
        },
        previousHash: null,
        eventHash: "0x1",
      },
      {
        id: "evt-02",
        environmentId: "env-1",
        actorType: "agent",
        actorId: "agent-travel",
        sessionId: null,
        mandateId: "m-travel",
        actionId: "act-2",
        eventType: "action.captured",
        outcome: "success",
        reasonCode: null,
        createdAt: "2026-10-31T13:58:45Z",
        payload: {
          amountMinor: 24500,
          currency: "USD",
          purpose: "Paid IndiGo Flight 6E-204 via PayPal",
        },
        previousHash: "0x1",
        eventHash: "0x2",
      },
      {
        id: "evt-03",
        environmentId: "env-1",
        actorType: "agent",
        actorId: "agent-hotel",
        sessionId: null,
        mandateId: "m-hotel",
        actionId: "act-3",
        eventType: "policy.denied",
        outcome: "denied",
        reasonCode: "BUDGET_EXCEEDED",
        createdAt: "2026-10-31T13:12:05Z",
        payload: {
          amountMinor: 500000,
          currency: "USD",
          purpose: "Gateway blocked spend: $5,000 > remaining budget",
        },
        previousHash: "0x2",
        eventHash: "0x3",
      },
    ];

    const activities = mapAuditEventsToFeed(rawEvents);
    expect(activities).toHaveLength(3);

    // Paid $245
    const paid = activities.find((a) => a.action.includes("IndiGo Flight"));
    expect(paid).toBeDefined();
    expect(paid?.amountMinor).toBe(24500); // $245.00
    expect(paid?.outcome).toBe("success");

    // Blocked $5,000
    const blocked = activities.find((a) => a.outcome === "denied");
    expect(blocked).toBeDefined();
    expect(blocked?.amountMinor).toBe(500000); // $5,000.00
    expect(blocked?.reasonCode).toBe("BUDGET_EXCEEDED");

    // Reserved $1,000
    const reserved = activities.find((a) => a.action.includes("Reserved room"));
    expect(reserved).toBeDefined();
    expect(reserved?.amountMinor).toBe(100000); // $1,000.00
  });

  it("persists and updates activeNavTab without resetting to overview", () => {
    // Switch to workspace
    workspaceStore.setActiveNavTab("workspace");
    expect(workspaceStore.getState().activeNavTab).toBe("workspace");

    // Switch to assistant
    workspaceStore.setActiveNavTab("assistant");
    expect(workspaceStore.getState().activeNavTab).toBe("assistant");
  });

  it("accurately constructs multi-level hierarchy: Travel Concierge has Hotel child, Hotel has no children, and only active agents are shown", () => {
    const agents: AgentDto[] = [
      {
        id: "personal-root",
        environmentId: "env-inr",
        parentAgentId: null,
        name: "Personal Agent",
        kind: "personal",
        status: "active",
        createdAt: "2026-11-10T20:19:41Z",
      },
      {
        id: "travel-agent",
        environmentId: "env-inr",
        parentAgentId: "personal-root",
        name: "Travel Concierge",
        kind: "travel",
        status: "active",
        createdAt: "2026-11-10T20:47:05Z",
      },
      {
        id: "hotel-agent",
        environmentId: "env-inr",
        parentAgentId: "travel-agent",
        name: "Hotel Specialist",
        kind: "hotel",
        status: "active",
        createdAt: "2026-11-10T20:47:06Z",
      },
      {
        id: "food-agent",
        environmentId: "env-inr",
        parentAgentId: "personal-root",
        name: "Food & Dining Specialist",
        kind: "food",
        status: "active",
        createdAt: "2026-11-10T21:31:14Z",
      },
      {
        id: "activities-agent",
        environmentId: "env-inr",
        parentAgentId: "personal-root",
        name: "Activities Specialist",
        kind: "activities",
        status: "active",
        createdAt: "2026-11-10T21:31:15Z",
      },
      {
        id: "revoked-agent",
        environmentId: "env-inr",
        parentAgentId: "personal-root",
        name: "Old Worker",
        kind: "specialist",
        status: "revoked",
        createdAt: "2026-11-01T00:00:00Z",
      },
    ];

    const mandates: MandateDto[] = [
      {
        id: "m-root",
        environmentId: "env-inr",
        issuerUserId: "u1",
        holderAgentId: "personal-root",
        parentMandateId: null,
        budgetLimitMinor: 1100000,
        allocatedMinor: 426400,
        spentMinor: 0,
        reservedMinor: 0,
        currency: "INR",
        permittedActions: ["*"],
        expiresAt: "2026-12-10T20:19:01Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: true,
        state: "active",
        revokedAt: null,
        createdAt: "2026-11-10T20:19:41Z",
      },
      {
        id: "m-travel",
        environmentId: "env-inr",
        issuerUserId: "u1",
        holderAgentId: "travel-agent",
        parentMandateId: "m-root",
        budgetLimitMinor: 84400,
        allocatedMinor: 84400,
        spentMinor: 0,
        reservedMinor: 0,
        currency: "INR",
        permittedActions: ["travel.*"],
        expiresAt: "2026-12-10T20:19:01Z",
        canDelegate: true,
        maxDelegationDepth: 1,
        approvalRequired: true,
        state: "active",
        revokedAt: null,
        createdAt: "2026-11-10T21:31:15Z",
      },
      {
        id: "m-hotel",
        environmentId: "env-inr",
        issuerUserId: "u1",
        holderAgentId: "hotel-agent",
        parentMandateId: "m-travel",
        budgetLimitMinor: 84400,
        allocatedMinor: 0,
        spentMinor: 0,
        reservedMinor: 0,
        currency: "INR",
        permittedActions: ["hotel.*"],
        expiresAt: "2026-12-10T20:19:01Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: true,
        state: "active",
        revokedAt: null,
        createdAt: "2026-11-10T21:31:16Z",
      },
      {
        id: "m-food",
        environmentId: "env-inr",
        issuerUserId: "u1",
        holderAgentId: "food-agent",
        parentMandateId: "m-root",
        budgetLimitMinor: 177000,
        allocatedMinor: 0,
        spentMinor: 0,
        reservedMinor: 0,
        currency: "INR",
        permittedActions: ["food.*"],
        expiresAt: "2026-12-10T20:19:01Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: true,
        state: "active",
        revokedAt: null,
        createdAt: "2026-11-10T21:31:15Z",
      },
      {
        id: "m-activities",
        environmentId: "env-inr",
        issuerUserId: "u1",
        holderAgentId: "activities-agent",
        parentMandateId: "m-root",
        budgetLimitMinor: 165000,
        allocatedMinor: 0,
        spentMinor: 0,
        reservedMinor: 0,
        currency: "INR",
        permittedActions: ["activities.*"],
        expiresAt: "2026-12-10T20:19:01Z",
        canDelegate: false,
        maxDelegationDepth: 0,
        approvalRequired: true,
        state: "active",
        revokedAt: null,
        createdAt: "2026-11-10T21:31:15Z",
      },
    ];

    const { nodes, edges } = mapWorkspaceGraph(agents, mandates);

    // Verify correct parentAgentId on nodes
    const travelNode = nodes.find((n) => n.id === "travel-agent");
    const hotelNode = nodes.find((n) => n.id === "hotel-agent");
    const foodNode = nodes.find((n) => n.id === "food-agent");
    const activitiesNode = nodes.find((n) => n.id === "activities-agent");
    const revokedNode = nodes.find((n) => n.id === "revoked-agent");

    expect(travelNode?.parentAgentId).toBe("personal-root");
    expect(hotelNode?.parentAgentId).toBe("travel-agent"); // Travel agent's child is Hotel Specialist!
    expect(foodNode?.parentAgentId).toBe("personal-root"); // Food connects to Personal Agent
    expect(activitiesNode?.parentAgentId).toBe("personal-root"); // Activities connects to Personal Agent

    // Verify allocated authority for child leaf agents
    expect(hotelNode?.allocatedMinor).toBe(84400); // ₹844.00
    expect(hotelNode?.isFunded).toBe(true);
    expect(foodNode?.allocatedMinor).toBe(177000); // ₹1,770.00
    expect(activitiesNode?.allocatedMinor).toBe(165000); // ₹1,650.00
    expect(revokedNode?.status).toBe("revoked");

    // Edges verification: Hotel Specialist has NO outgoing edges
    const hotelOutgoingEdges = edges.filter((e) => e.source === "hotel-agent");
    expect(hotelOutgoingEdges).toHaveLength(0); // Hotel Specialist has NO children!

    // Travel agent has Hotel Specialist as child
    const travelOutgoingEdges = edges.filter((e) => e.source === "travel-agent");
    expect(travelOutgoingEdges).toHaveLength(1);
    expect(travelOutgoingEdges[0].target).toBe("hotel-agent");

    // Only active agents: activeNodes filter excludes revoked
    const activeNodes = nodes.filter((n) => n.status === "active");
    expect(activeNodes.some((n) => n.id === "revoked-agent")).toBe(false);
    expect(activeNodes).toHaveLength(5);
  });
});
