import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL, API_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 05] Running Mandate Management and Revocation Flow...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    // 1. Create dedicated environment
    const envRes = await fetch(`${API_BASE_URL}/v1/environments`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-local-user-id": "local-user" },
      body: JSON.stringify({
        name: `Mandate-Env-${Date.now()}`,
        purpose: "Testing mandate revocation",
        currency: "INR",
        budgetLimitMinor: 40000,
      }),
    });
    const { environment } = await envRes.json();
    const envId = environment.id;

    // 2. Register agent
    const agentRes = await fetch(`${API_BASE_URL}/v1/environments/${envId}/agents/root`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-local-user-id": "local-user" },
      body: JSON.stringify({ name: "Personal Mandate Holder" }),
    });
    const { agent } = await agentRes.json();

    // 3. Create root mandate
    const mandateRes = await fetch(`${API_BASE_URL}/v1/environments/${envId}/mandates/root`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-local-user-id": "local-user" },
      body: JSON.stringify({
        holderAgentId: agent.id,
        budgetLimitMinor: 15000,
        currency: "INR",
        permittedActions: ["travel.booking"],
        expiresAt: "2026-12-31T23:59:59.000Z",
        canDelegate: true,
        maxDelegationDepth: 2,
        approvalRequired: false,
      }),
    });
    const { mandate } = await mandateRes.json();
    const mandateId = mandate.id;

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

    // Verify Mandate appears in Mandates card
    await page.waitForFunction(
      (mId) => {
        const card = document.querySelector('[aria-labelledby="mandates-title"]');
        return card && card.textContent.includes(mId);
      },
      { timeout: 5000 },
      mandateId,
    );

    const mandateCardText = await page.$eval(
      '[aria-labelledby="mandates-title"]',
      (el) => el.textContent,
    );
    assert.ok(mandateCardText.includes(mandateId), "Mandate ID must appear in Mandates list");
    assert.ok(mandateCardText.includes("active"), "Mandate must initially show active state");

    // Click "Revoke mandate"
    const revokeMandateBtn = await page.waitForSelector(
      '[aria-labelledby="mandates-title"] button.danger-button',
      { timeout: 5000 },
    );
    assert.ok(revokeMandateBtn, "Revoke mandate button must exist");
    await revokeMandateBtn.click();

    // Wait for message confirmation
    await page.waitForFunction(
      () => {
        const note = document.querySelector(".card .note");
        return note && note.textContent.includes("Mandate revoked");
      },
      { timeout: 5000 },
    );

    // Verify mandate state in card transitions to revoked
    await page.waitForFunction(
      (mId) => {
        const card = document.querySelector('[aria-labelledby="mandates-title"]');
        return card && card.textContent.includes(mId) && card.textContent.includes("revoked");
      },
      { timeout: 5000 },
      mandateId,
    );

    // Verify Activity log records mandate.revoked event
    const activityText = await page.$eval(
      '[aria-labelledby="activity-title"]',
      (el) => el.textContent,
    );
    assert.ok(
      activityText.includes("mandate.revoked"),
      "Activity audit list must record mandate.revoked event",
    );

    await takeScreenshot("05_mandate_revocation");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log("  [Scenario 05] PASSED: Mandate revocation and activity audit verified.");
    return { passed: true, name: "05-mandate-revocation" };
  } finally {
    await page.close();
  }
}
