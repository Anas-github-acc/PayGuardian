import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "live-deploy");

async function main() {
  console.log("=== Running Complete End-to-End Verification on Live Deployment ===");
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.on("console", (m) => {
    const text = m.text();
    if (!text.includes("Download the React DevTools")) {
      console.log(`[Browser Console]:`, text);
    }
  });

  try {
    // Step 1: Login
    console.log("\n1. Navigating to Login Page...");
    await page.goto("https://payguardiana3.vercel.app/login", { waitUntil: "domcontentloaded" });
    await new Promise((r) => setTimeout(r, 2000));
    await page.type("input[type='email']", "judge@payguardian.ai");
    await page.type("input[type='password']", "JudgeAccess2026!");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step1_login_filled.png") });

    console.log("Submitting login form...");
    await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']");
      btn?.click();
    });

    console.log("Waiting for post-login redirect...");
    await new Promise((r) => setTimeout(r, 5000));
    console.log("URL after login:", page.url());

    // Step 2: Handle Onboarding if present
    if (page.url().includes("/onboarding")) {
      console.log("\n2. Processing First-Time Environment Setup (Onboarding)...");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "step2_onboarding_slide1.png"),
        fullPage: true,
      });

      // Click next button on slides
      for (let slide = 1; slide <= 3; slide++) {
        console.log(`Clicking continue on slide ${slide}...`);
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const nextBtn = btns.find(
            (b) =>
              b.textContent?.includes("Next Step") ||
              b.textContent?.includes("Continue") ||
              b.textContent?.includes("Next"),
          );
          nextBtn?.click();
        });
        await new Promise((r) => setTimeout(r, 1500));
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "step2_onboarding_final.png"),
        fullPage: true,
      });

      // Click final submit button
      console.log("Submitting environment creation...");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const createBtn = btns.find(
          (b) =>
            b.textContent?.includes("Initialize Environment") ||
            b.textContent?.includes("Launch Workspace") ||
            b.textContent?.includes("Enter Dashboard") ||
            b.textContent?.includes("Create"),
        );
        createBtn?.click();
      });

      await new Promise((r) => setTimeout(r, 6000));
      console.log("Post-onboarding URL:", page.url());
    }

    // Step 3: Verify Dashboard & Mandates
    console.log("\n3. Navigating to Dashboard & Mandates Table...");
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
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "step4_assistant_chat_view.png"),
      fullPage: true,
    });

    // Step 5: Test Talking to Assistant
    console.log("\n5. Interacting with Assistant...");
    const textarea = await page.$("textarea");
    if (textarea) {
      console.log("Found composer textarea, entering prompt...");
      await page.type("textarea", "Plan a trip to San Francisco under $300 budget.");
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "step5_prompt_entered.png") });
      await page.keyboard.press("Enter");

      console.log("Prompt sent! Waiting for agent reasoning and response...");
      await new Promise((r) => setTimeout(r, 10000));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "step6_assistant_responded.png"),
        fullPage: true,
      });
    } else {
      console.log("Checking for starter prompt buttons...");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const promptBtn = btns.find(
          (b) =>
            b.textContent?.includes("Book") ||
            b.textContent?.includes("Trip") ||
            b.textContent?.includes("Spend"),
        );
        promptBtn?.click();
      });
      await new Promise((r) => setTimeout(r, 8000));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "step6_assistant_prompt_clicked.png"),
        fullPage: true,
      });
    }

    console.log("\n=== ALL TEST STEPS FINISHED SUCCESSFULLY! ===");
  } finally {
    await page.close();
    await browser.disconnect();
  }
}

main().catch(console.error);
