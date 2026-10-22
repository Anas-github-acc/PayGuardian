import { describe, expect, it } from "vitest";
import { InMemoryLedger, LedgerError } from "./ledger.js";

describe("ledger accounting", () => {
  it("conserves funds through nested allocation and capture", () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount({ id: "personal", parentId: null, availableMinor: 10000 });
    ledger.createAccount({ id: "travel", parentId: "personal", availableMinor: 0 });
    ledger.createAccount({ id: "food", parentId: "personal", availableMinor: 0 });
    ledger.createAccount({ id: "activities", parentId: "personal", availableMinor: 0 });
    ledger.createAccount({ id: "hotel", parentId: "travel", availableMinor: 0 });
    ledger.createAccount({ id: "transport", parentId: "travel", availableMinor: 0 });

    ledger.allocate("personal", "travel", 6000);
    ledger.allocate("personal", "food", 2000);
    ledger.allocate("personal", "activities", 2000);
    ledger.allocate("travel", "hotel", 4000);
    ledger.allocate("travel", "transport", 2000);
    expect(ledger.conservation().totalMinor).toBe(10000);

    ledger.reserve("hotel-action", "hotel", 1000);
    expect(ledger.conservation()).toMatchObject({ totalMinor: 10000, reservedMinor: 1000 });
    ledger.capture("hotel-action");
    expect(ledger.conservation()).toMatchObject({
      totalMinor: 10000,
      capturedMinor: 1000,
      reservedMinor: 0,
    });
  });

  it("is idempotent and rejects overspending", () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount({ id: "root", parentId: null, availableMinor: 100 });
    const first = ledger.reserve("same-action", "root", 80);
    const retry = ledger.reserve("same-action", "root", 80);
    expect(retry).toEqual(first);
    expect(() => ledger.reserve("different-details", "root", 30)).toThrowError(LedgerError);
    expect(() => ledger.reserve("same-action", "root", 70)).toThrowError(/Idempotency/);
  });

  it("does not release uncertain/captured funds", () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount({ id: "root", parentId: null, availableMinor: 100 });
    ledger.reserve("action", "root", 40);
    ledger.capture("action");
    expect(() => ledger.release("action")).toThrowError(/held reservations/);
  });
});
