import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "live-deploy");

async function main() {
  console.log("=== Testing PayGuardian Complete Live Deployment Flow via CDP ===");
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.on("console", (m) => console.log(`[Browser ${m.type()}]:`, m.text()));
  page.on("pageerror", (err) => console.log(`[Browser PageError]:`, err.message));

  try {
    // 1. Visit Dashboard or Login
    console.log("1. Navigating to Dashboard...");
    await page.goto("https://payguardiana3.vercel.app/dashboard", {
      waitUntil: "domcontentloaded",
    });
    await new Promise((r) => setTimeout(r, 4000));
    console.log("Current URL:", page.url());

    // If redirected to login
    if (page.url().includes("/login")) {
      console.log("On login page. Submitting credentials...");
      await page.waitForSelector("input[type='email']", { timeout: 10000 });
      await page.type("input[type='email']", "judge@payguardian.ai");
      await page.type("input[type='password']", "JudgeAccess2026!");
      const submitBtn = await page.$("button[type='submit']");
      if (submitBtn) {
        await submitBtn.click();
      }
      await new Promise((r) => setTimeout(r, 5000));
      console.log("URL after login submit:", page.url());
    }

    // If redirected to onboarding
    if (page.url().includes("/onboarding")) {
      console.log("\n2. Walking through 4-step Environment Onboarding...");

      // Step 1 -> 2
      console.log("Clicking 'Set your spending authority'...");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.includes("Set your spending authority"));
        btn?.click();
      });
      await new Promise((r) => setTimeout(r, 1500));

      // Step 2 -> 3
      console.log("Clicking 'Define delegation rules'...");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.includes("Define delegation rules"));
        btn?.click();
      });
      await new Promise((r) => setTimeout(r, 1500));

      // Step 3 -> 4
      console.log("Clicking 'Review & activate'...");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.includes("Review & activate"));
        btn?.click();
      });
      await new Promise((r) => setTimeout(r, 1500));

      // Step 4: Activate Environment
      console.log("Clicking 'Activate Environment'...");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.includes("Activate Environment"));
        btn?.click();
      });

      console.log("Waiting for environment activation and redirect...");
      await new Promise((r) => setTimeout(r, 8000));
      console.log("URL after activation:", page.url());
    }

    // Step 3: Verify Mandates Table
    console.log("\n3. Verifying Mandates Governance Table...");
    await page.goto("https://payguardiana3.vercel.app/dashboard?tab=tables&sub=mandates", {
      waitUntil: "domcontentloaded",
    });
    await new Promise((r) => setTimeout(r, 4000));
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "step3_mandates_table.png"),
      fullPage: true,
    });
    console.log("Mandates Page Title:", await page.title());

    // Step 4: Verify Assistant Chat
    console.log("\n4. Navigating to Assistant Chat...");
    await page.goto("https://payguardiana3.vercel.app/dashboard?tab=assistant", {
      waitUntil: "domcontentloaded",
    });
    await new Promise((r) => setTimeout(r, 4000));
    console.log("Assistant Tab URL:", page.url());
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "step4_assistant_chat_view.png"),
      fullPage: true,
    });

    // Step 5: Test Prompting the Assistant
    console.log("\n5. Testing Assistant Prompting...");
    const textarea = await page.$("textarea");
    if (textarea) {
      console.log("Entering prompt into textarea...");
      await page.type("textarea", "Plan a quick business trip to San Francisco under $300 budget.");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step5_prompt_entered.png") });
      await page.keyboard.press("Enter");

      console.log("Prompt submitted! Waiting for agent execution & response...");
      // Wait up to 15 seconds for LLM reasoning and response stream
      for (let i = 1; i <= 6; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        console.log(`Checking response (elapsed ${i * 3}s)...`);
        const bodyText = await page.evaluate(() => document.body.innerText);
        if (bodyText.includes("San Francisco") || bodyText.includes("budget") || bodyText.includes("$300")) {
          console.log("Detected response text containing prompt keywords!");
        }
      }
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "step6_assistant_responded.png"),
        fullPage: true,
      });
    } else {
      console.log("Textarea not found on page, checking quick starter prompt buttons...");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find(
          (b) =>
            b.textContent?.includes("Book") ||
            b.textContent?.includes("Trip") ||
            b.textContent?.includes("Spend"),
        );
        btn?.click();
      });
      await new Promise((r) => setTimeout(r, 12000));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "step6_assistant_responded.png"),
        fullPage: true,
      });
    }

    console.log("\n=== Complete End-to-End Verification Finished! ===");
  } finally {
    await page.close();
    await browser.disconnect();
  }
}

main().catch(console.error);
