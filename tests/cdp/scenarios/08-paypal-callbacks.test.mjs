import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 08] Running PayPal Callback Pages verification...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    // 1. Visit /paypal/return without query params
    await page.goto(`${WEB_BASE_URL}/paypal/return`, { waitUntil: "networkidle2" });

    const returnHeading = await page.$eval("h1#paypal-title", (el) => el.textContent.trim());
    assert.equal(returnHeading, "Payment status", "Heading must be Payment status on return");

    const returnLede = await page.$eval("p.lede", (el) => el.textContent.trim());
    assert.match(
      returnLede,
      /missing its operation reference/i,
      "Should inform user that operation reference is missing",
    );

    const refreshBtn = await page.$('button[type="button"]');
    assert.ok(refreshBtn, "Refresh provider status button must be present");

    // 2. Visit /paypal/cancel
    await page.goto(`${WEB_BASE_URL}/paypal/cancel`, { waitUntil: "networkidle2" });

    const cancelHeading = await page.$eval("h1#paypal-title", (el) => el.textContent.trim());
    assert.equal(cancelHeading, "Payment cancelled", "Heading must be Payment cancelled on cancel");

    // 3. Visit /paypal/return with mock environment and action query params
    await page.goto(
      `${WEB_BASE_URL}/paypal/return?environment_id=mock-env-id&action_id=mock-action-id`,
      { waitUntil: "networkidle2" },
    );

    // Click "Refresh provider status"
    const reconcileBtn = await page.waitForSelector('button ::-p-text("Refresh provider status")', {
      timeout: 5000,
    });
    assert.ok(reconcileBtn, "Refresh provider status button must exist");
    await reconcileBtn.click();
    await new Promise((r) => setTimeout(r, 600));

    await takeScreenshot("08_paypal_callbacks");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log("  [Scenario 08] PASSED: PayPal return/cancel callback pages verified.");
    return { passed: true, name: "08-paypal-callbacks" };
  } finally {
    await page.close();
  }
}
