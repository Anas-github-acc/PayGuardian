import { describe, expect, it } from "vitest";
import { workerStatus } from "./index.js";

describe("worker runtime boundary", () => {
  it("reports an enabled runtime without starting a polling loop on import", () => {
    expect(workerStatus).toEqual({
      service: "payment-reconciliation-worker",
      phase: "runtime-enabled",
      enabled: true,
    });
  });
});
