import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 07] Running Payment Operations AG Grid verification...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    await page.goto(WEB_BASE_URL, { waitUntil: "networkidle2" });

    // Verify presence of payment operations section
    const gridEl = await page.waitForSelector('[data-testid="payment-operations-grid"]', {
      timeout: 5000,
    });
    assert.ok(gridEl, "Payment operations AG Grid must exist in DOM");

    // Open column controls dropdown
    const colDetails = await page.$(".payment-grid-block details.column-controls summary");
    assert.ok(colDetails, "Payment grid column controls dropdown must exist");
    await colDetails.click();
    await new Promise((r) => setTimeout(r, 300));

    // Verify all 8 column labels are present in the options
    const columnLabels = await page.$$eval(".payment-grid-block .column-options label", (labels) =>
      labels.map((l) => l.textContent.trim()),
    );
    const expectedHeaders = [
      "PayPal order",
      "Amount",
      "Status",
      "Provider status",
      "Reconciliation",
      "Capture",
      "Execution",
      "Updated",
    ];

    for (const expected of expectedHeaders) {
      assert.ok(
        columnLabels.includes(expected),
        `Column control option '${expected}' must be available in payment operations grid`,
      );
    }

    // Toggle the first checkbox (PayPal order)
    const firstCheckbox = await page.$(
      '.payment-grid-block .column-options label input[type="checkbox"]',
    );
    assert.ok(firstCheckbox, "First column checkbox must be clickable");
    await firstCheckbox.click();
    await new Promise((r) => setTimeout(r, 300));
    // Toggle back
    await firstCheckbox.click();
    await new Promise((r) => setTimeout(r, 300));

    // Test clicking a column header for sorting
    const headerCell = await page.$('[data-testid="payment-operations-grid"] .ag-header-cell-text');
    if (headerCell) {
      await headerCell.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    await takeScreenshot("07_payment_operations_grid");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log("  [Scenario 07] PASSED: Payment operations AG Grid controls verified.");
    return { passed: true, name: "07-payment-operations-grid" };
  } finally {
    await page.close();
  }
}
