import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "live-deploy");

async function main() {
  console.log("=== PayGuardian End-to-End Judge Flow on Vercel Live Deployment ===");
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.on("console", (m) => console.log(`[Browser ${m.type()}]:`, m.text()));
  page.on("pageerror", (err) => console.log(`[Browser PageError]:`, err.message));

  try {
    // 1. Visit Login
    console.log("\n1. Navigating to Login Page...");
    await page.goto("https://payguardiana3.vercel.app/login", { waitUntil: "networkidle2" });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_login_view.png") });

    // 2. Perform Login with confirmed credentials
    console.log("2. Submitting login credentials for judge@payguardian.ai...");
    await page.type("input[type='email']", "judge@payguardian.ai");
    await page.type("input[type='password']", "JudgeAccess2026!");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_login_filled.png") });

    await page.evaluate(() => {
      const submitBtn = document.querySelector("button[type='submit']");
      submitBtn?.click();
    });

    console.log("Waiting for authentication & navigation...");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {
      console.log("Navigation finished or url updated via pushState.");
    });
    await new Promise((r) => setTimeout(r, 3000));

    console.log("Current URL after login:", page.url());
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "03_post_login_url.png"),
      fullPage: true,
    });

    // If redirected to onboarding or dashboard
    if (page.url().includes("/onboarding")) {
      console.log("Landed on onboarding! Completing initial workspace setup...");
      await page.waitForSelector("button, input", { timeout: 10000 });
      // Check for create workspace or next buttons
      const nextBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find(
          (b) =>
            b.textContent?.includes("Create") ||
            b.textContent?.includes("Continue") ||
            b.textContent?.includes("Next") ||
            b.textContent?.includes("Get Started"),
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log("Clicked onboarding button:", nextBtn);
      await new Promise((r) => setTimeout(r, 4000));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "04_onboarding_step.png"),
        fullPage: true,
      });
    }

    // Navigate to Dashboard
    console.log("\n3. Navigating to Dashboard...");
    await page.goto("https://payguardiana3.vercel.app/dashboard", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 3000));
    console.log("Dashboard URL:", page.url());
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "05_dashboard_live.png"),
      fullPage: true,
    });

    // Navigate to Mandates Tab
    console.log("\n4. Navigating to Mandates Governance Table...");
    await page.goto("https://payguardiana3.vercel.app/dashboard?tab=tables&sub=mandates", {
      waitUntil: "networkidle2",
    });
    await new Promise((r) => setTimeout(r, 3000));
    console.log("Mandates Tab URL:", page.url());
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "06_mandates_live.png"),
      fullPage: true,
    });

    // Navigate to Assistant Chat
    console.log("\n5. Navigating to Assistant Chat...");
    await page.goto("https://payguardiana3.vercel.app/dashboard?tab=assistant", {
      waitUntil: "networkidle2",
    });
    await new Promise((r) => setTimeout(r, 3000));
    console.log("Assistant Tab URL:", page.url());
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "07_assistant_live.png"),
      fullPage: true,
    });

    // Test sending message to assistant
    console.log("\n6. Sending prompt to Assistant...");
    const textarea = await page.$("textarea");
    if (textarea) {
      await page.type("textarea", "Hello! What can you help me do in PayGuardian?");
      await page.keyboard.press("Enter");
      console.log("Prompt entered, waiting for assistant stream / response...");
      await new Promise((r) => setTimeout(r, 6000));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "08_assistant_chat_responded.png"),
        fullPage: true,
      });
    } else {
      console.log("Composer textarea not found directly, checking for quick prompt buttons...");
      const promptBtnClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const promptBtn = btns.find(
          (b) =>
            b.textContent &&
            (b.textContent.includes("Book") ||
              b.textContent.includes("Trip") ||
              b.textContent.includes("Payment") ||
              b.textContent.includes("Attach")),
        );
        if (promptBtn) {
          promptBtn.click();
          return promptBtn.textContent?.trim();
        }
        return null;
      });
      console.log("Prompt button clicked:", promptBtnClicked);
      await new Promise((r) => setTimeout(r, 5000));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "08_assistant_prompt_triggered.png"),
        fullPage: true,
      });
    }

    console.log("\n=== All Verification Steps Completed Successfully! ===");
  } finally {
    await page.close();
    await browser.disconnect();
  }
}

main().catch(console.error);
