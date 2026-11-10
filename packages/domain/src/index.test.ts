import { describe, expect, it } from "vitest";
import {
  availableBudget,
  createRootMandate,
  delegateMandate,
  evaluateAuthorityChain,
  evaluateMandate,
  revokeMandate,
  topupMandate,
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

  describe("mandate versioning and top-ups", () => {
    it("creates V2 with limit 500 + 1000 = 1500 and carries forward spend, reservation, and child allocation", () => {
      const personal = createRootMandate({
        id: "root-big",
        issuerUserId: "alice",
        createdAt: now.toISOString(),
        constraints: {
          environmentId: "travel",
          holderAgentId: "personal",
          budgetLimitMinor: 500000, // 5000 rs
          currency: "INR",
          permittedActions: ["book_hotel", "book_transport", "buy_food"],
          expiresAt: "2026-02-01T00:00:00.000Z",
          canDelegate: true,
          maxDelegationDepth: 3,
          approvalRequired: false,
        },
      });

      const v1Res = delegateMandate(
        personal,
        {
          id: "m-child-v1",
          issuerUserId: "alice",
          holderAgentId: "subagent-x",
          budgetLimitMinor: 50000, // 500 rs (50000 paise)
          currency: "INR",
          permittedActions: ["book_hotel", "buy_food"],
          expiresAt: "2026-01-20T00:00:00.000Z",
          canDelegate: true,
          maxDelegationDepth: 2,
          approvalRequired: false,
          createdAt: now.toISOString(),
        },
        now,
      );
      expect(v1Res.decision.allowed).toBe(true);
      const v1 = v1Res.mandate!;
      expect(v1.version).toBe(1);
      expect(v1.mandateSeriesId).toBe("m-child-v1");
      expect(v1.previousMandateId).toBeNull();
      expect(v1.state).toBe("active");

      // Simulate prior spending (₹100), active reservation (₹50), and downstream child allocation (₹200)
      v1.spentMinor = 10000; // 100 rs
      v1.reservedMinor = 5000; // 50 rs
      v1.allocatedMinor = 20000; // 200 rs
      expect(availableBudget(v1)).toBe(15000); // 500 - 350 = 150 rs available

      const parentAllocatedBefore = personal.allocatedMinor; // 500 rs

      // Top up with ₹1000 (100000 paise)
      const topupRes = topupMandate(
        personal,
        v1,
        {
          id: "m-child-v2",
          additionalBudgetMinor: 100000,
          createdAt: new Date("2026-01-05T00:00:00.000Z").toISOString(),
        },
        new Date("2026-01-05T00:00:00.000Z"),
      );

      expect(topupRes.decision.allowed).toBe(true);
      const v2 = topupRes.mandate!;

      // Mandate versioning invariants
      expect(v2.version).toBe(2);
      expect(v2.mandateSeriesId).toBe("m-child-v1");
      expect(v2.previousMandateId).toBe("m-child-v1");
      expect(v2.state).toBe("active");
      expect(v1.state).toBe("superseded");
      expect(v1.supersededAt).toBe("2026-01-05T00:00:00.000Z");

      // Mathematical budget & accounting continuity
      expect(v2.budgetLimitMinor).toBe(150000); // 500 + 1000 = 1500 rs
      expect(v2.spentMinor).toBe(10000); // Carried forward ₹100
      expect(v2.reservedMinor).toBe(5000); // Carried forward ₹50
      expect(v2.allocatedMinor).toBe(20000); // Carried forward ₹200
      expect(availableBudget(v2)).toBe(115000); // 1500 - 350 = 1150 rs available

      // Parent allocation increases only by additional allocation (1000 rs)
      expect(personal.allocatedMinor).toBe(parentAllocatedBefore + 100000);

      // Previous version can no longer authorize new transactions
      expect(
        evaluateMandate(v1, {
          action: "buy_food",
          amountMinor: 1000,
          currency: "INR",
          at: new Date("2026-01-06T00:00:00.000Z"),
          approvalGranted: true,
        }).allowed,
      ).toBe(false);

      // New version can authorize transactions
      expect(
        evaluateMandate(v2, {
          action: "buy_food",
          amountMinor: 1000,
          currency: "INR",
          at: new Date("2026-01-06T00:00:00.000Z"),
          approvalGranted: true,
        }).allowed,
      ).toBe(true);
    });

    it("rejects permission escalation, approval weakening, expiry extension, and excessive budget", () => {
      const personal = createRootMandate({
        id: "root-big2",
        issuerUserId: "alice",
        createdAt: now.toISOString(),
        constraints: {
          environmentId: "travel",
          holderAgentId: "personal",
          budgetLimitMinor: 500000, // 5000 rs
          currency: "INR",
          permittedActions: ["book_hotel", "buy_food"],
          expiresAt: "2026-02-01T00:00:00.000Z",
          canDelegate: true,
          maxDelegationDepth: 3,
          approvalRequired: false,
        },
      });

      const v1Res = delegateMandate(
        personal,
        {
          id: "m-base-v1",
          issuerUserId: "alice",
          holderAgentId: "subagent-y",
          budgetLimitMinor: 50000,
          currency: "INR",
          permittedActions: ["book_hotel"],
          expiresAt: "2026-01-15T00:00:00.000Z",
          canDelegate: true,
          maxDelegationDepth: 1,
          approvalRequired: true,
          createdAt: now.toISOString(),
        },
        now,
      );
      expect(v1Res.decision.allowed).toBe(true);
      const v1 = v1Res.mandate!;

      // 1. Permission escalation: cannot add "buy_food" if v1 didn't have it
      const escRes = topupMandate(
        personal,
        v1,
        {
          id: "m-esc",
          additionalBudgetMinor: 10000,
          permittedActions: ["book_hotel", "buy_food"],
          createdAt: now.toISOString(),
        },
        now,
      );
      expect(escRes.decision.code).toBe("ACTION_NOT_PERMITTED");

      // 2. Weakening approval requirement: v1 requires approval, top-up attempts false
      const appRes = topupMandate(
        personal,
        v1,
        {
          id: "m-app",
          additionalBudgetMinor: 10000,
          approvalRequired: false,
          createdAt: now.toISOString(),
        },
        now,
      );
      expect(appRes.decision.code).toBe("APPROVAL_REQUIRED");

      // 3. Extending expiry beyond v1's expiry
      const expRes = topupMandate(
        personal,
        v1,
        {
          id: "m-exp",
          additionalBudgetMinor: 10000,
          expiresAt: "2026-01-20T00:00:00.000Z", // v1 expires 2026-01-15
          createdAt: now.toISOString(),
        },
        now,
      );
      expect(expRes.decision.code).toBe("MANDATE_EXPIRED");

      // 4. Excessive budget: parent has 10000 - 500 = 9500 rs available, request 10000 rs
      const budRes = topupMandate(
        personal,
        v1,
        {
          id: "m-bud",
          additionalBudgetMinor: 1000000,
          createdAt: now.toISOString(),
        },
        now,
      );
      expect(budRes.decision.code).toBe("BUDGET_EXCEEDED");
    });
  });
});
