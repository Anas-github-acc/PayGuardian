import { describe, expect, it } from "vitest";
import { formatMinorUnits, calculateAvailableMinor } from "../../app/lib/currency";
import { workspaceStore } from "../../app/lib/workspace-store";
import { DEFAULT_GRAPH_NODES, INITIAL_ACTIVITIES } from "./workspace-defaults";

describe("Workspace Redesign Data & Arithmetic Invariants", () => {
  it("strictly validates financial authority arithmetic for the KPI metrics", () => {
    const totalLimitMinor = 1000000; // $10,000.00
    const spentMinor = 245000;       // $2,450.00
    const reservedMinor = 150000;    // $1,500.00

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

  it("verifies topology nodes match the 5-node delegation hierarchy", () => {
    expect(DEFAULT_GRAPH_NODES).toHaveLength(5);

    const root = DEFAULT_GRAPH_NODES.find((n) => n.id === "orchestrator-root");
    expect(root).toBeDefined();
    expect(root?.name).toBe("Main Orchestrator");
    expect(root?.role).toBe("orchestrator");
    expect(root?.allocatedMinor).toBe(1000000);

    const travel = DEFAULT_GRAPH_NODES.find((n) => n.id === "agent-travel");
    expect(travel?.allocatedMinor).toBe(400000); // $4,000 limit

    const hotel = DEFAULT_GRAPH_NODES.find((n) => n.id === "agent-hotel");
    expect(hotel?.allocatedMinor).toBe(400000); // $4,000 limit

    const scraper = DEFAULT_GRAPH_NODES.find((n) => n.id === "agent-flights-unfunded");
    expect(scraper?.status).toBe("unfunded");
    expect(scraper?.isFunded).toBe(false);

    const gateway = DEFAULT_GRAPH_NODES.find((n) => n.id === "agent-booking-gw");
    expect(gateway?.status).toBe("active");
  });

  it("verifies dynamic subagent mapping for pipeline visualization", () => {
    const subagents = DEFAULT_GRAPH_NODES.filter((n) => n.role === "subagent");
    expect(subagents).toHaveLength(4);

    const activeCount = subagents.filter((s) => s.status === "active").length;
    expect(activeCount).toBeGreaterThanOrEqual(2);

    const unfunded = subagents.find((s) => s.status === "unfunded");
    expect(unfunded?.id).toBe("agent-flights-unfunded");
    expect(unfunded?.allocatedMinor).toBe(0);
  });

  it("verifies semantic recent activities include Paid, Blocked, and Reserved states", () => {
    expect(INITIAL_ACTIVITIES.length).toBeGreaterThanOrEqual(3);

    // Paid $245
    const paid = INITIAL_ACTIVITIES.find((a) => a.action.includes("IndiGo Flight"));
    expect(paid).toBeDefined();
    expect(paid?.amountMinor).toBe(24500); // $245.00
    expect(paid?.outcome).toBe("success");

    // Blocked $5,000
    const blocked = INITIAL_ACTIVITIES.find((a) => a.outcome === "denied");
    expect(blocked).toBeDefined();
    expect(blocked?.amountMinor).toBe(500000); // $5,000.00
    expect(blocked?.reasonCode).toBe("BUDGET_EXCEEDED");

    // Reserved $1,000
    const reserved = INITIAL_ACTIVITIES.find((a) => a.action.includes("Reserved room"));
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
});
