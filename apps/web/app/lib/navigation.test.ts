import { describe, it, expect } from "vitest";
import {
  getTabFromSearchParams,
  getSubTabFromSearchParams,
  VALID_NAV_TABS,
  VALID_TABLES_SUBTABS,
} from "./navigation";

describe("Dashboard Navigation (URL SSOT)", () => {
  it("defaults to 'overview' when no tab query parameter is provided", () => {
    const params = new URLSearchParams("");
    expect(getTabFromSearchParams(params)).toBe("overview");
  });

  it("defaults to 'overview' when an unrecognized or invalid tab is provided", () => {
    const params = new URLSearchParams("tab=nonexistent&sub=something");
    expect(getTabFromSearchParams(params)).toBe("overview");
  });

  it("extracts every valid navigation tab correctly from URL query parameters", () => {
    for (const tab of VALID_NAV_TABS) {
      const params = new URLSearchParams(`tab=${tab}`);
      expect(getTabFromSearchParams(params)).toBe(tab);
    }
  });

  it("defaults sub-tab to 'mandates' when not specified or invalid", () => {
    expect(getSubTabFromSearchParams(new URLSearchParams(""))).toBe("mandates");
    expect(getSubTabFromSearchParams(new URLSearchParams("sub=invalid_sub"))).toBe("mandates");
  });

  it("extracts every valid tables sub-tab correctly from URL query parameters", () => {
    for (const sub of VALID_TABLES_SUBTABS) {
      const params = new URLSearchParams(`tab=tables&sub=${sub}`);
      expect(getSubTabFromSearchParams(params)).toBe(sub);
    }
  });
});
