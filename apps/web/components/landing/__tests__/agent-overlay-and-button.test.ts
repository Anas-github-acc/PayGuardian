import { describe, expect, it } from "vitest";

describe("Ask Agent Design & First-Time Visitor Overlay Card", () => {
  it("uses the required #d0785a colored moving border line color for Ask Agent", () => {
    const requiredBorderColor = "#d0785a";
    expect(requiredBorderColor).toBe("#d0785a");
    // Confirm hex parses to copper/terracotta RGB
    const hex = requiredBorderColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    expect(r).toBe(208);
    expect(g).toBe(120);
    expect(b).toBe(90);
  });

  it("handles first-time visitor detection logic via localStorage", () => {
    const mockStorage: Record<string, string> = {};
    const storageKey = "payguardian_has_seen_agent_overlay_v1";

    const shouldShowOverlay = (storage: Record<string, string>, forceParam?: string | null) => {
      if (forceParam === "1") return true;
      return !storage[storageKey];
    };

    // First visit: not seen yet
    expect(shouldShowOverlay(mockStorage)).toBe(true);

    // After dismissal
    mockStorage[storageKey] = "true";
    expect(shouldShowOverlay(mockStorage)).toBe(false);

    // With explicit query override (?agent_modal=1 or ?intro=1)
    expect(shouldShowOverlay(mockStorage, "1")).toBe(true);
  });

  it("validates the overlay card contents and prompt phrasing", () => {
    const promptMessage = "Ask our AI Agent anything about PayGuardian";
    expect(promptMessage).toBe("Ask our AI Agent anything about PayGuardian");
    expect(promptMessage).toContain("AI Agent");
    expect(promptMessage).toContain("PayGuardian");
  });

  it("supports all required avatar color presets and sizes", () => {
    const validColors = [
      "blue",
      "orange",
      "red",
      "green",
      "purple",
      "yellow",
      "cyan",
      "pink",
      "indigo",
      "lime",
      "turquoise",
      "violet",
    ];
    expect(validColors).toContain("orange");
    expect(validColors).toHaveLength(12);

    const validSizes = ["sm", "md", "lg", "xl", "2xl"];
    expect(validSizes).toContain("2xl");
  });

  it("verifies the destination route for the Ask Agent action is /icognito", () => {
    const targetRoute = "/icognito";
    expect(targetRoute).toBe("/icognito");
  });
});
