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

  describe("wallet integrity verification", () => {
    it("maintains a valid cryptographic transition chain and verifies against account state", () => {
      const ledger = new InMemoryLedger();
      ledger.createAccount({ id: "parent", parentId: null, availableMinor: 10000 });
      ledger.createAccount({ id: "child", parentId: "parent", availableMinor: 0 });

      ledger.allocate("parent", "child", 3000);
      ledger.reserve("action-1", "child", 1000);
      ledger.capture("action-1");
      ledger.reserve("action-2", "child", 500);
      ledger.release("action-2");
      ledger.reclaim("parent", "child", 1000);

      const parentIntegrity = ledger.verifyAccountIntegrity("parent");
      expect(parentIntegrity.valid).toBe(true);
      expect(parentIntegrity.transitionsVerified).toBe(3); // create, allocation_out, reclaim_in

      const childIntegrity = ledger.verifyAccountIntegrity("child");
      expect(childIntegrity.valid).toBe(true);
      expect(childIntegrity.transitionsVerified).toBe(7);

      const transitions = ledger.getTransitions("child");
      expect(transitions).toHaveLength(7);
      expect(transitions[0].sequence).toBe(1);
      expect(transitions[0].previousHash).toBeNull();
      expect(transitions[1].previousHash).toBe(transitions[0].transitionHash);
      expect(transitions[2].previousHash).toBe(transitions[1].transitionHash);
    });

    it("fails closed when account balance state is tampered directly", () => {
      const ledger = new InMemoryLedger();
      ledger.createAccount({ id: "acc", parentId: null, availableMinor: 5000 });

      // Before tamper: integrity is valid
      expect(ledger.verifyAccountIntegrity("acc").valid).toBe(true);

      // Malicious tamper: increase available funds by 10000 out of thin air
      ledger.tamperAccount("acc", (account) => {
        account.availableMinor = 15000;
      });

      const integrity = ledger.verifyAccountIntegrity("acc");
      expect(integrity.valid).toBe(false);
      expect(integrity.reason).toMatch(
        /Account balance does not match cryptographic balance record/,
      );

      // Attempting to reserve/spend fails closed with WALLET_INTEGRITY_VIOLATION
      expect(() => ledger.reserve("spend-attempt", "acc", 100)).toThrowError(
        expect.objectContaining({
          code: "WALLET_INTEGRITY_VIOLATION",
        }),
      );
    });

    it("fails closed when transition hash or previous hash is tampered", () => {
      const ledger = new InMemoryLedger();
      ledger.createAccount({ id: "acc", parentId: null, availableMinor: 5000 });
      ledger.reserve("act-1", "acc", 1000);

      // Tamper with sequence 1 transition hash
      ledger.tamperTransition("acc", 0, (t) => {
        t.transitionHash = "deadbeef".repeat(8);
      });

      const integrity = ledger.verifyAccountIntegrity("acc");
      expect(integrity.valid).toBe(false);
      expect(integrity.reason).toMatch(/Transition hash mismatch/);

      expect(() => ledger.reserve("spend-attempt", "acc", 500)).toThrowError(
        expect.objectContaining({
          code: "WALLET_INTEGRITY_VIOLATION",
        }),
      );
    });

    it("fails closed when transition balance math is forged", () => {
      const ledger = new InMemoryLedger();
      ledger.createAccount({ id: "acc", parentId: null, availableMinor: 5000 });

      // Tamper with balanceAfter
      ledger.tamperTransition("acc", 0, (t) => {
        t.balanceAfter.availableMinor = 99999;
      });

      const integrity = ledger.verifyAccountIntegrity("acc");
      expect(integrity.valid).toBe(false);

      expect(() => ledger.reserve("spend-attempt", "acc", 100)).toThrowError(
        expect.objectContaining({
          code: "WALLET_INTEGRITY_VIOLATION",
        }),
      );
    });
  });
});
