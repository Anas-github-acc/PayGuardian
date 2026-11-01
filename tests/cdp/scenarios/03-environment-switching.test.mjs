import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL, API_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 03] Running Environment Switching and Multi-env selection...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    // Ensure at least two environments exist by seeding via API
    const envA_name = `Env-A-${Date.now()}`;
    const envB_name = `Env-B-${Date.now()}`;

    for (const name of [envA_name, envB_name]) {
      await fetch(`${API_BASE_URL}/v1/environments`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-local-user-id": "local-user" },
        body: JSON.stringify({
          name,
          purpose: `Testing switching for ${name}`,
          currency: "INR",
          budgetLimitMinor: 20000,
        }),
      });
    }

    await page.goto(WEB_BASE_URL, { waitUntil: "networkidle2" });

    // Find environment buttons
    const envButtons = await page.$$("section.card ul li button.link-button");
    assert.ok(envButtons.length >= 2, "There must be at least 2 environment buttons in list");

    // Click the first button
    await envButtons[0].click();
    await new Promise((r) => setTimeout(r, 600));

    // Get text of first environment
    const firstEnvText = await page.evaluate((el) => el.textContent.trim(), envButtons[0]);

    // Click the second button
    await envButtons[1].click();
    await new Promise((r) => setTimeout(r, 600));

    const secondEnvText = await page.evaluate((el) => el.textContent.trim(), envButtons[1]);
    assert.notEqual(firstEnvText, secondEnvText, "Two environments must have distinct names");

    // Click back to the first button
    await envButtons[0].click();
    await new Promise((r) => setTimeout(r, 600));

    await takeScreenshot("03_environment_switching");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log("  [Scenario 03] PASSED: Environment switching tested and verified.");
    return { passed: true, name: "03-environment-switching" };
  } finally {
    await page.close();
  }
}
