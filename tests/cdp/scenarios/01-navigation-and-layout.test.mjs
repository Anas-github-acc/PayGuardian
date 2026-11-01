import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 01] Running Navigation and Layout verification...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    await page.goto(WEB_BASE_URL, { waitUntil: "networkidle2" });

    // 1. Title assertion
    const title = await page.title();
    assert.match(title, /PayGuardian/i, "Page title must contain PayGuardian");

    // 2. Heading and eyebrow
    const h1Text = await page.$eval("h1#page-title", (el) => el.textContent.trim());
    assert.equal(h1Text, "PayGuardian", "Hero heading must be PayGuardian");

    const eyebrow = await page.$eval(".eyebrow", (el) => el.textContent.trim());
    assert.match(eyebrow, /Delegation Gateway/i, "Eyebrow text must mention Delegation Gateway");

    // 3. Auth status badge
    const statusText = await page.$eval('div[role="status"]', (el) => el.textContent.trim());
    assert.match(
      statusText,
      /Local development authentication/i,
      "Status should indicate local dev auth",
    );

    // 4. Sign out button
    const signOutBtn = await page.$('button[type="button"]');
    assert.ok(signOutBtn, "Sign out button must be present in topbar");

    // 5. Verify presence of all major dashboard cards
    const expectedCards = [
      "setup-title",
      "environment-title",
      "mandates-title",
      "activity-title",
      "payment-operations-title",
    ];

    for (const cardId of expectedCards) {
      const cardExists = await page.$(`[aria-labelledby="${cardId}"]`);
      assert.ok(cardExists, `Dashboard card with aria-labelledby="${cardId}" must exist`);
    }

    // 6. Screenshot
    await takeScreenshot("01_navigation_and_layout");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log("  [Scenario 01] PASSED: Navigation and Layout verified cleanly.");
    return { passed: true, name: "01-navigation-and-layout" };
  } finally {
    await page.close();
  }
}
