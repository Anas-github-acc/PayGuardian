import { describe, expect, it } from "vitest";
import {
  availableBudget,
  createRootMandate,
  delegateMandate,
  evaluateAuthorityChain,
  evaluateMandate,
  revokeMandate,
  type Mandate,
} from "./index.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function root(): Mandate {
  return createRootMandate({
    id: "root",
    issuerUserId: "alice",
    createdAt: now.toISOString(),
    constraints: {
      environmentId: "travel",
      holderAgentId: "personal",
      budgetLimitMinor: 10000,
      currency: "INR",
      permittedActions: ["book_hotel", "book_transport", "buy_food"],
      expiresAt: "2026-02-01T00:00:00.000Z",
      canDelegate: true,
      maxDelegationDepth: 3,
      approvalRequired: false,
    },
  });
}

describe("authority engine", () => {
  it("narrows authority and moves allocation instead of copying it", () => {
    const mandate = root();
    const result = delegateMandate(
      mandate,
      {
        id: "travel",
        issuerUserId: "alice",
        holderAgentId: "travel-agent",
        budgetLimitMinor: 6000,
        currency: "INR",
        permittedActions: ["book_hotel", "book_transport"],
        expiresAt: "2026-01-31T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
        createdAt: now.toISOString(),
      },
      now,
    );
    expect(result.decision.allowed).toBe(true);
    expect(result.mandate?.parentMandateId).toBe("root");
    expect(mandate.allocatedMinor).toBe(6000);
    expect(availableBudget(mandate)).toBe(4000);
  });

  it("rejects broadening, overspending, wrong currency, and expired authority", () => {
    const mandate = root();
    expect(
      delegateMandate(
        mandate,
        {
          id: "bad-scope",
          issuerUserId: "alice",
          holderAgentId: "child",
          budgetLimitMinor: 100,
          currency: "INR",
          permittedActions: ["issue_refund"],
          expiresAt: "2026-01-31T00:00:00.000Z",
          canDelegate: false,
          maxDelegationDepth: 2,
          approvalRequired: false,
          createdAt: now.toISOString(),
        },
        now,
      ).decision.code,
    ).toBe("ACTION_NOT_PERMITTED");
    expect(
      evaluateMandate(mandate, {
        action: "buy_food",
        amountMinor: 10001,
        currency: "INR",
        at: now,
        approvalGranted: true,
      }).code,
    ).toBe("BUDGET_EXCEEDED");
    expect(
      evaluateMandate(mandate, {
        action: "buy_food",
        amountMinor: 1,
        currency: "USD",
        at: now,
        approvalGranted: true,
      }).code,
    ).toBe("CURRENCY_MISMATCH");
    expect(
      evaluateMandate(mandate, {
        action: "buy_food",
        amountMinor: 1,
        currency: "INR",
        at: new Date("2026-03-01"),
        approvalGranted: true,
      }).code,
    ).toBe("MANDATE_EXPIRED");
  });

  it("revocation blocks future actions", () => {
    const revoked = revokeMandate(root(), now);
    expect(
      evaluateMandate(revoked, {
        action: "buy_food",
        amountMinor: 1,
        currency: "INR",
        at: now,
        approvalGranted: true,
      }).code,
    ).toBe("MANDATE_REVOKED");
  });

  it("rejects zero budgets and weakening approval requirements", () => {
    expect(() =>
      createRootMandate({
        id: "zero",
        issuerUserId: "alice",
        createdAt: now.toISOString(),
        constraints: { ...root(), budgetLimitMinor: 0 },
      }),
    ).toThrow("ROOT_BUDGET_INVALID");

    const approvalRoot = createRootMandate({
      id: "approval-root",
      issuerUserId: "alice",
      createdAt: now.toISOString(),
      constraints: { ...root(), approvalRequired: true },
    });
    const result = delegateMandate(
      approvalRoot,
      {
        id: "approval-child",
        issuerUserId: "alice",
        holderAgentId: "travel-agent",
        budgetLimitMinor: 100,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-01-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 2,
        approvalRequired: false,
        createdAt: now.toISOString(),
      },
      now,
    );
    expect(result.decision.code).toBe("APPROVAL_REQUIRED");
  });

  it("evaluates effective authority across a complete nested delegation chain", () => {
    const personal = root(); // 10,000 INR
    const travel = delegateMandate(
      personal,
      {
        id: "travel",
        issuerUserId: "alice",
        holderAgentId: "travel-agent",
        budgetLimitMinor: 6000,
        currency: "INR",
        permittedActions: ["book_hotel", "book_transport"],
        expiresAt: "2026-01-31T00:00:00.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
        createdAt: now.toISOString(),
      },
      now,
    ).mandate!;

    const food = delegateMandate(
      personal,
      {
        id: "food",
        issuerUserId: "alice",
        holderAgentId: "food-agent",
        budgetLimitMinor: 2000,
        currency: "INR",
        permittedActions: ["buy_food"],
        expiresAt: "2026-01-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
        createdAt: now.toISOString(),
      },
      now,
    ).mandate!;

    const activities = delegateMandate(
      personal,
      {
        id: "activities",
        issuerUserId: "alice",
        holderAgentId: "activities-agent",
        budgetLimitMinor: 2000,
        currency: "INR",
        permittedActions: ["book_transport"],
        expiresAt: "2026-01-31T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
        createdAt: now.toISOString(),
      },
      now,
    ).mandate!;

    // Personal has allocated all 10,000 units:
    expect(availableBudget(personal)).toBe(0);

    // Travel delegates 4,000 to hotel and 2,000 to transport:
    const hotel = delegateMandate(
      travel,
      {
        id: "hotel",
        issuerUserId: "alice",
        holderAgentId: "hotel-agent",
        budgetLimitMinor: 4000,
        currency: "INR",
        permittedActions: ["book_hotel"],
        expiresAt: "2026-01-25T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
        createdAt: now.toISOString(),
      },
      now,
    ).mandate!;

    const transport = delegateMandate(
      travel,
      {
        id: "transport",
        issuerUserId: "alice",
        holderAgentId: "transport-agent",
        budgetLimitMinor: 2000,
        currency: "INR",
        permittedActions: ["book_transport"],
        expiresAt: "2026-01-25T00:00:00.000Z",
        canDelegate: false,
        maxDelegationDepth: 1,
        approvalRequired: false,
        createdAt: now.toISOString(),
      },
      now,
    ).mandate!;

    expect(availableBudget(personal)).toBe(0);
    expect(availableBudget(food)).toBe(2000);
    expect(availableBudget(activities)).toBe(2000);
    expect(availableBudget(travel)).toBe(0);
    expect(availableBudget(transport)).toBe(2000);
    expect(availableBudget(hotel)).toBe(4000);

    // Hotel action evaluation must succeed even though ancestors' unallocated budget is 0
    const chain = [personal, travel, hotel];
    const checkHotel = {
      action: "book_hotel",
      amountMinor: 1000,
      currency: "INR",
      at: now,
      approvalGranted: false,
    };
    expect(evaluateMandate(hotel, { ...checkHotel, isAncestor: false }).allowed).toBe(true);
    expect(evaluateAuthorityChain(chain, "hotel", checkHotel).allowed).toBe(true);

    // If an ancestor (travel) is revoked, effective authority evaluation fails
    const revokedTravel = revokeMandate(travel, now);
    const brokenChain = [personal, revokedTravel, hotel];
    expect(evaluateMandate(revokedTravel, { ...checkHotel, isAncestor: true }).code).toBe(
      "MANDATE_REVOKED",
    );
    expect(evaluateAuthorityChain(brokenChain, "hotel", checkHotel).allowed).toBe(false);
    expect(evaluateAuthorityChain(brokenChain, "hotel", checkHotel).code).toBe("MANDATE_REVOKED");

    // Child cannot exceed its own available budget
    expect(
      evaluateMandate(hotel, { ...checkHotel, amountMinor: 5000, isAncestor: false }).code,
    ).toBe("BUDGET_EXCEEDED");
  });
});
