import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 02] Running Create Environment Flow...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    await page.goto(WEB_BASE_URL, { waitUntil: "networkidle2" });

    // Locate form inputs
    const form = await page.$("form.form");
    assert.ok(form, "Create environment form must exist");

    const inputs = await page.$$("form.form input");
    assert.equal(inputs.length, 3, "Form must have 3 inputs (name, purpose, budget)");

    // Type custom values into inputs
    const envName = `Kyoto-${Date.now()}`;
    const envPurpose = "AI Delegation Research Summit";
    const envBudget = "50000";

    // Clear and fill name
    await inputs[0].click();
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await inputs[0].type(envName);

    // Clear and fill purpose
    await inputs[1].click();
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await inputs[1].type(envPurpose);

    // Clear and fill budget
    await inputs[2].click();
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyA");
    await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await inputs[2].type(envBudget);

    // Click submit button
    const submitBtn = await page.$('form.form button[type="submit"]');
    assert.ok(submitBtn, "Submit button must be present");
    await submitBtn.click();

    // Wait for the newly created environment to appear in the list
    await page.waitForFunction(
      (name) => {
        const buttons = Array.from(
          document.querySelectorAll("section.card ul li button.link-button"),
        );
        return buttons.some((b) => b.textContent.trim() === name);
      },
      { timeout: 5000 },
      envName,
    );

    const messageText = await page.$eval("section.card .note", (el) => el.textContent.trim());
    assert.match(
      messageText,
      /Environment created/i,
      "Success message should confirm environment creation",
    );

    await takeScreenshot("02_create_environment_flow");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log("  [Scenario 02] PASSED: Environment created successfully via UI form.");
    return { passed: true, name: "02-create-environment-flow", envName };
  } finally {
    await page.close();
  }
}
