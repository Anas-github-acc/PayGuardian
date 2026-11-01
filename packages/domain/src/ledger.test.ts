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

  it("reclaims unspent funds from child back to parent while preserving conservation", () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount({ id: "personal", parentId: null, availableMinor: 10000 });
    ledger.createAccount({ id: "travel", parentId: "personal", availableMinor: 0 });
    ledger.createAccount({ id: "hotel", parentId: "travel", availableMinor: 0 });

    ledger.allocate("personal", "travel", 6000);
    ledger.allocate("travel", "hotel", 4000);
    expect(ledger.getAccount("personal").availableMinor).toBe(4000);
    expect(ledger.getAccount("travel").availableMinor).toBe(2000);
    expect(ledger.getAccount("hotel").availableMinor).toBe(4000);

    // Hotel spends 1000
    ledger.reserve("hotel-book", "hotel", 1000);
    ledger.capture("hotel-book");
    expect(ledger.getAccount("hotel").availableMinor).toBe(3000);

    // Travel reclaims 1500 of the remaining 3000 from Hotel
    ledger.reclaim("travel", "hotel", 1500);
    expect(ledger.getAccount("hotel").availableMinor).toBe(1500);
    expect(ledger.getAccount("travel").availableMinor).toBe(3500);

    // Personal reclaims 2000 from Travel
    ledger.reclaim("personal", "travel", 2000);
    expect(ledger.getAccount("travel").availableMinor).toBe(1500);
    expect(ledger.getAccount("personal").availableMinor).toBe(6000);

    // Conservation is strictly maintained at 10000
    expect(ledger.conservation().totalMinor).toBe(10000);
    expect(ledger.conservation().capturedMinor).toBe(1000);

    // Attempting to reclaim more than child available throws
    expect(() => ledger.reclaim("travel", "hotel", 5000)).toThrowError(LedgerError);

    // Non-parent cannot reclaim from child
    expect(() => ledger.reclaim("personal", "hotel", 500)).toThrowError(/not owned by parent/);
  });

  it("safely rejects over-allocation and over-reservation under simulated concurrency", async () => {
    const ledger = new InMemoryLedger();
    ledger.createAccount({ id: "account", parentId: null, availableMinor: 100 });

    // Simulate concurrent reservation attempts totaling 150 against balance of 100
    const results = await Promise.allSettled([
      new Promise<void>((resolve, reject) => {
        try {
          ledger.reserve("res-1", "account", 80);
          resolve();
        } catch (err) {
          reject(err);
        }
      }),
      new Promise<void>((resolve, reject) => {
        try {
          ledger.reserve("res-2", "account", 70);
          resolve();
        } catch (err) {
          reject(err);
        }
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(LedgerError);
    expect(ledger.getAccount("account").reservedMinor).toBeLessThanOrEqual(100);
  });
});
