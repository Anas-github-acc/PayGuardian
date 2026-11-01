import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL, API_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 12] Running Human Approvals Inbox & Queue verification...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    // 1. Create dedicated environment
    const envRes = await fetch(`${API_BASE_URL}/v1/environments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-local-user-id": "local-user" },
      body: JSON.stringify({
        name: `Approvals-Env-${Date.now()}`,
        purpose: "Testing human approvals inbox queue and decision buttons",
        currency: "INR",
        budgetLimitMinor: 50000,
      }),
    });
    const { environment } = await envRes.json();
    const envId = environment.id;

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

    // Verify Human Approvals Inbox card is present
    const approvalsCard = await page.waitForSelector('[aria-labelledby="approvals-title"]', {
      timeout: 5000,
    });
    assert.ok(approvalsCard, "Human Approvals Inbox section must exist");

    const approvalsHeading = await page.$eval("h2#approvals-title", (el) => el.textContent.trim());
    assert.equal(
      approvalsHeading,
      "Human Approvals Inbox",
      "Heading must be Human Approvals Inbox",
    );

    // Verify Approvals Grid AG Grid block
    const approvalsGrid = await page.$(".approvals-grid-block");
    assert.ok(approvalsGrid, "Approvals Grid block must be present");

    await takeScreenshot("12_human_approvals_inbox");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log("  [Scenario 12] PASSED: Human Approvals Inbox verified successfully.");
    return { passed: true, name: "12-human-approvals-inbox" };
  } finally {
    await page.close();
  }
}
