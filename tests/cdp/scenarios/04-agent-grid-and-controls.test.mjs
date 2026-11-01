import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL, API_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log(
    "  [Scenario 04] Running Agent Grid, Column Toggling, Sorting, and Agent Controls...",
  );
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    // 1. Create a dedicated environment via API
    const envRes = await fetch(`${API_BASE_URL}/v1/environments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-local-user-id": "local-user" },
      body: JSON.stringify({
        name: `Agent-Test-${Date.now()}`,
        purpose: "Testing agent grid and controls",
        currency: "INR",
        budgetLimitMinor: 30000,
      }),
    });
    const { environment } = await envRes.json();
    const envId = environment.id;

    // 2. Register root agent (Personal Assistant)
    const rootAgentRes = await fetch(`${API_BASE_URL}/v1/environments/${envId}/agents/root`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-local-user-id": "local-user" },
      body: JSON.stringify({ name: "Personal Alpha", capabilities: ["planning"] }),
    });
    const rootData = await rootAgentRes.json();
    const rootAgent = rootData.agent;

    // 3. Register child agent (Travel Agent)
    const childRes = await fetch(`${API_BASE_URL}/v1/environments/${envId}/agents/children`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-local-user-id": "local-user",
      },
      body: JSON.stringify({
        parentAgentId: rootAgent.id,
        name: "Travel Beta",
        kind: "travel",
        capabilities: ["flight", "hotel"],
      }),
    });
    assert.equal(childRes.status, 201, "Child agent creation should succeed with 201");

    await page.goto(WEB_BASE_URL, { waitUntil: "networkidle2" });

    // Click on the created environment button to load its data
    const envLink = await page.waitForSelector(
      `button.link-button ::-p-text(${environment.name})`,
      {
        timeout: 5000,
      },
    );
    await envLink.click();
    await new Promise((r) => setTimeout(r, 800));

    // 4. Verify AG Grid rows
    const gridEl = await page.waitForSelector('[data-testid="agents-grid"]', { timeout: 5000 });
    assert.ok(gridEl, "Agents AG Grid must be visible");

    // Wait for row data to be populated in AG Grid
    await page.waitForFunction(
      () => {
        const grid = document.querySelector('[data-testid="agents-grid"]');
        return grid && grid.textContent.includes("Personal Alpha");
      },
      { timeout: 5000 },
    );

    const gridText = await page.$eval('[data-testid="agents-grid"]', (el) => el.textContent);
    assert.ok(gridText.includes("Personal Alpha"), "AG Grid must render Personal Alpha row");
    assert.ok(gridText.includes("Travel Beta"), "AG Grid must render Travel Beta row");

    // 5. Test Column visibility toggle
    const columnDetails = await page.$(".agent-grid-block details.column-controls summary");
    assert.ok(columnDetails, "Column controls dropdown summary must exist");
    await columnDetails.click();
    await new Promise((r) => setTimeout(r, 300));

    // Find "Type" column checkbox
    const typeCheckbox = await page.$(
      '.agent-grid-block .column-options label input[type="checkbox"]',
    );
    assert.ok(typeCheckbox, "Column toggle checkbox must exist");

    // Click checkbox to toggle column visibility
    await typeCheckbox.click();
    await new Promise((r) => setTimeout(r, 400));
    // Click again to toggle back
    await typeCheckbox.click();
    await new Promise((r) => setTimeout(r, 400));

    // 6. Test AG Grid sorting by clicking header
    const agentHeader = await page.$('[data-testid="agents-grid"] .ag-header-cell-text');
    if (agentHeader) {
      await agentHeader.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    // 7. Test Agent Controls (Disable agent)
    // Find "Disable" button in agent controls
    const disableBtn = await page.waitForSelector('.control-panel button ::-p-text("Disable")', {
      timeout: 5000,
    });
    assert.ok(disableBtn, "Disable button must exist for active agent");
    await disableBtn.click();

    // Wait for agent to transition to disabled
    await page.waitForFunction(
      () => {
        const controls = document.querySelector('div[aria-label="Agent controls"]');
        return controls && controls.textContent.includes("(disabled)");
      },
      { timeout: 5000 },
    );

    const controlsTextAfterDisable = await page.$eval(
      'div[aria-label="Agent controls"]',
      (el) => el.textContent,
    );
    assert.ok(
      controlsTextAfterDisable.includes("(disabled)"),
      "Agent status should transition to (disabled)",
    );

    // 8. Test Agent Controls (Revoke agent)
    const revokeBtn = await page.waitForSelector(
      'div[aria-label="Agent controls"] button.danger-button',
      { timeout: 5000 },
    );
    assert.ok(revokeBtn, "Revoke button must exist in Agent controls");
    await revokeBtn.click();

    // Wait for agent to transition to revoked
    await page.waitForFunction(
      () => {
        const controls = document.querySelector('div[aria-label="Agent controls"]');
        return controls && controls.textContent.includes("(revoked)");
      },
      { timeout: 5000 },
    );

    const controlsTextAfterRevoke = await page.$eval(
      'div[aria-label="Agent controls"]',
      (el) => el.textContent,
    );
    assert.ok(
      controlsTextAfterRevoke.includes("(revoked)"),
      "Agent status should transition to (revoked)",
    );

    await takeScreenshot("04_agent_grid_and_controls");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log(
      "  [Scenario 04] PASSED: Agent grid, column controls, and agent lifecycle verified.",
    );
    return { passed: true, name: "04-agent-grid-and-controls" };
  } finally {
    await page.close();
  }
}
