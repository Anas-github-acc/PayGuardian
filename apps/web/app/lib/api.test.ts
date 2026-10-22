import { describe, expect, it } from "vitest";
import { buildApiHeaders } from "./api";

describe("dashboard API authentication headers", () => {
  it("uses the Supabase bearer token for authenticated requests", () => {
    const headers = buildApiHeaders(
      { access_token: "supabase-access-token" },
      "local-user",
      { "x-local-user-id": "stale-local-user" },
      true,
    );

    expect(headers.get("authorization")).toBe("Bearer supabase-access-token");
    expect(headers.get("x-local-user-id")).toBeNull();
  });

  it("keeps local authentication available only outside production", () => {
    const developmentHeaders = buildApiHeaders(null, "local-user", undefined, false);
    const productionHeaders = buildApiHeaders(null, "local-user", undefined, true);

    expect(developmentHeaders.get("x-local-user-id")).toBe("local-user");
    expect(productionHeaders.get("x-local-user-id")).toBeNull();
  });

  it("preserves caller headers while adding JSON content type", () => {
    const headers = buildApiHeaders(null, undefined, { "x-request-id": "request-1" }, false);

    expect(headers.get("x-request-id")).toBe("request-1");
    expect(headers.get("content-type")).toBe("application/json");
  });
});
