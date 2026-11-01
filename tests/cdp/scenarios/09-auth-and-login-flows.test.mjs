import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 09] Running Auth Boundary & Login Page Flow...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    // 1. In standard local development mode, navigating to /login redirects to dashboard
    await page.goto(`${WEB_BASE_URL}/login`, { waitUntil: "networkidle2" });
    const currentUrl = page.url();
    assert.match(
      currentUrl,
      /localhost:3000\/?$/,
      "Local dev auth should auto-redirect from /login to dashboard root /",
    );

    // 2. Visit /login?preview=true to inspect login UI components without redirect
    const customPage = await browser.newPage();
    await customPage.setViewport({ width: 1280, height: 900 });

    await customPage.goto(`${WEB_BASE_URL}/login?preview=true`, { waitUntil: "networkidle2" });

    // Verify login card heading and note are present
    const authCardExists = await customPage.waitForSelector(".auth-card", { timeout: 5000 });
    assert.ok(authCardExists, "Auth card must be rendered on /login?preview=true");

    const authHeading = await customPage.$eval("h1#auth-title", (el) => el.textContent.trim());
    assert.match(
      authHeading,
      /Welcome back|Create your account/i,
      "Login heading must be displayed",
    );

    const noteText = await customPage.$eval(".note", (el) => el.textContent.trim());
    assert.match(
      noteText,
      /Supabase Auth is not configured/i,
      "Note should inform about local development auth identity",
    );

    await customPage.screenshot({
      path: "tests/cdp/screenshots/09_auth_and_login_flows.png",
      fullPage: true,
    });
    await customPage.close();

    console.log("  [Scenario 09] PASSED: Auth boundary and login page flows verified.");
    return { passed: true, name: "09-auth-and-login-flows" };
  } finally {
    await page.close();
  }
}
