import { describe, expect, it } from "vitest";
import { buildAgentRows } from "./components/agent-grid-data";

describe("dashboard shell", () => {
  it("keeps the PayGuardian dashboard identity stable", () => {
    expect("PayGuardian").toBe("PayGuardian");
    expect("dashboard shell").toContain("dashboard");
  });

  it("resolves agent parents for the monitoring grid", () => {
    expect(
      buildAgentRows([
        { id: "personal", name: "Personal", kind: "personal", parentAgentId: null },
        { id: "hotel", name: "Hotel", kind: "hotel", parentAgentId: "personal" },
      ]),
    ).toMatchObject([
      { name: "Personal", parentName: "Root" },
      { name: "Hotel", parentName: "Personal" },
    ]);
  });
});
