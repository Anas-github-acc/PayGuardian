import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL, API_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 06] Running Emergency Controls Environment Lifecycle...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    // 1. Create dedicated environment
    const envRes = await fetch(`${API_BASE_URL}/v1/environments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-local-user-id": "local-user" },
      body: JSON.stringify({
        name: `Emergency-Env-${Date.now()}`,
        purpose: "Testing pause resume and revoke emergency controls",
        currency: "INR",
        budgetLimitMinor: 50000,
      }),
    });
    const { environment } = await envRes.json();

    await page.goto(WEB_BASE_URL, { waitUntil: "networkidle2" });

    // Select this environment
    const envLink = await page.waitForSelector(
      `button.link-button ::-p-text(${environment.name})`,
      {
        timeout: 5000,
      },
    );
    await envLink.click();
    await new Promise((r) => setTimeout(r, 800));

    // 2. Locate and click "Pause environment"
    const pauseBtn = await page.waitForSelector(
      'div[aria-label="Environment emergency controls"] button ::-p-text("Pause environment")',
      { timeout: 5000 },
    );
    assert.ok(pauseBtn, "Pause environment button must be present when active");
    await pauseBtn.click();

    // Verify transition to paused: button changes to "Resume environment"
    await page.waitForFunction(
      () => {
        const ctrl = document.querySelector('div[aria-label="Environment emergency controls"]');
        return ctrl && ctrl.textContent.includes("Resume environment");
      },
      { timeout: 5000 },
    );

    // 3. Locate and click "Resume environment"
    const resumeBtn = await page.waitForSelector(
      'div[aria-label="Environment emergency controls"] button ::-p-text("Resume environment")',
      { timeout: 5000 },
    );
    assert.ok(resumeBtn, "Resume environment button must be present when paused");
    await resumeBtn.click();

    // Verify transition back to active: button changes back to "Pause environment"
    await page.waitForFunction(
      () => {
        const ctrl = document.querySelector('div[aria-label="Environment emergency controls"]');
        return ctrl && ctrl.textContent.includes("Pause environment");
      },
      { timeout: 5000 },
    );

    // 4. Locate and click "Revoke environment" (dialog auto-accepted)
    const revokeBtn = await page.waitForSelector(
      'div[aria-label="Environment emergency controls"] button.danger-button ::-p-text("Revoke environment")',
      { timeout: 5000 },
    );
    assert.ok(revokeBtn, "Revoke environment button must be present");
    await revokeBtn.click();

    // Wait for message confirmation
    await page.waitForFunction(
      () => {
        const note = document.querySelector(".card .note");
        return note && note.textContent.includes("Environment revoked");
      },
      { timeout: 5000 },
    );

    // Verify emergency control action row no longer offers pause/resume/revoke
    await page.waitForFunction(
      () => {
        const actionRow = document.querySelector(
          'div[aria-label="Environment emergency controls"] .action-row',
        );
        return actionRow && actionRow.querySelectorAll("button").length === 0;
      },
      { timeout: 5000 },
    );

    await takeScreenshot("06_emergency_controls_lifecycle");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log("  [Scenario 06] PASSED: Emergency controls lifecycle verified.");
    return { passed: true, name: "06-emergency-controls-lifecycle" };
  } finally {
    await page.close();
  }
}
