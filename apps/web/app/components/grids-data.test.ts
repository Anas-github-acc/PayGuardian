import { describe, expect, it } from "vitest";
import { buildMandateRows } from "./mandates-grid-data";
import { buildApprovalRows } from "./approvals-grid-data";
import { buildActivityRows } from "./activity-grid-data";

describe("AG Grid data builders", () => {
  it("formats mandate rows with computed available balance", () => {
    const rows = buildMandateRows([
      {
        id: "m-1",
        holderAgentId: "agent-1",
        state: "active",
        budgetLimitMinor: 10000,
        spentMinor: 2000,
        allocatedMinor: 1000,
        reservedMinor: 1500,
        currency: "USD",
        permittedActions: ["book_hotel", "pay"],
        approvalRequired: true,
        expiresAt: "2027-01-01T00:00:00.000Z",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].budgetLimit).toBe("100.00 USD");
    expect(rows[0].spent).toBe("20.00 USD");
    expect(rows[0].available).toBe("55.00 USD");
    expect(rows[0].approvalRequired).toBe("Yes");
    expect(rows[0].permittedActions).toBe("book_hotel, pay");
  });

  it("formats approval inbox rows", () => {
    const rows = buildApprovalRows([
      {
        id: "appr-1",
        status: "pending",
        action: "book_hotel",
        amountMinor: 25000,
        currency: "USD",
        agentId: "agent-hotel",
        mandateId: "mandate-1",
        approvedBy: null,
        rejectionReason: null,
        createdAt: "2026-10-22T00:00:00.000Z",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].amount).toBe("250.00 USD");
    expect(rows[0].approvedBy).toBe("—");
  });

  it("formats activity audit trail rows", () => {
    const rows = buildActivityRows([
      {
        id: "evt-1",
        eventType: "action.reserved",
        outcome: "success",
        actorType: "user",
        reasonCode: null,
        createdAt: "2026-10-22T00:00:00.000Z",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe("action.reserved");
    expect(rows[0].outcome).toBe("success");
    expect(rows[0].reasonCode).toBe("—");
  });
});
