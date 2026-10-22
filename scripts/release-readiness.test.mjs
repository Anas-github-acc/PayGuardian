import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseRemoteMigrationVersions, validateHealthResponse } from "./release-readiness.mjs";

describe("release readiness helpers", () => {
  it("reads remote-only and matched migrations from Supabase table output", () => {
    const output = [
      "LOCAL      │     REMOTE     │     TIME (UTC)",
      "───────────┼────────────────┼──────────────────────",
      "           │ 20261022000000 │ 2026-10-22 00:00:00",
      "20261022001000_phase2_authority │ 20261022001000 │ 2026-10-22 00:10:00",
      "20261022002000_phase3_ledger_audit │                │ 2026-10-22 00:20:00",
    ].join("\n");

    assert.deepEqual([...parseRemoteMigrationVersions(output)].sort(), [
      "20261022000000",
      "20261022001000",
    ]);
  });

  it("reads remote versions from structured output without counting local-only values", () => {
    const output = JSON.stringify([
      {
        local: "20261022002000_phase3_ledger_audit",
        remote: "20261022002000",
      },
      {
        local: "20261022003000_provider_jobs",
        remote: null,
      },
    ]);

    assert.deepEqual([...parseRemoteMigrationVersions(output)], ["20261022002000"]);
  });

  it("accepts only the expected successful health contract", () => {
    assert.deepEqual(
      validateHealthResponse(200, { status: "ok", service: "gateway-api" }, "gateway-api"),
      {
        ok: true,
      },
    );
    assert.equal(
      validateHealthResponse(503, { status: "ok", service: "gateway-api" }, "gateway-api").ok,
      false,
    );
    assert.equal(
      validateHealthResponse(200, { status: "ok", service: "other" }, "gateway-api").ok,
      false,
    );
  });
});
