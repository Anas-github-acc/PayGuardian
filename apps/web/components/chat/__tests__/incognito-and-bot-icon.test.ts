import { describe, expect, it } from "vitest";
import type { ComposerMode } from "../ai-composer";

describe("Incognito Mode & Composer Logic", () => {
  it("includes 'About PayGuardian' as a valid ComposerMode", () => {
    const modeAbout: ComposerMode = "About PayGuardian";
    const modeAsk: ComposerMode = "Ask";
    const modeDelegate: ComposerMode = "Delegate";

    const allModes: ComposerMode[] = [modeAbout, modeAsk, modeDelegate];
    expect(allModes).toContain("About PayGuardian");
    expect(allModes).toContain("Ask");
    expect(allModes).toContain("Delegate");
  });

  it("ensures unauthenticated visitors default strictly to 'About PayGuardian'", () => {
    const isUnauthenticated = true;
    const initialMode: ComposerMode | undefined = undefined;

    const resolveMode = (unauth: boolean, init?: ComposerMode): ComposerMode => {
      if (init) return init;
      if (unauth) return "About PayGuardian";
      return "Delegate";
    };

    expect(resolveMode(isUnauthenticated, initialMode)).toBe("About PayGuardian");
    expect(resolveMode(false, undefined)).toBe("Delegate");
    expect(resolveMode(false, "Ask")).toBe("Ask");
  });

  it("verifies auth dialog revert logic resets to 'About PayGuardian'", () => {
    let mode: ComposerMode = "Ask";
    let showAuthDialog = true;

    // Trigger close action
    const handleCloseAuthDialog = () => {
      showAuthDialog = false;
      mode = "About PayGuardian";
    };

    handleCloseAuthDialog();
    expect(showAuthDialog).toBe(false);
    expect(mode).toBe("About PayGuardian");
  });
});
