import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "live-deploy");

async function testAuth() {
  console.log("=== Testing Authentication Flows on Live Vercel Deploy ===");
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  try {
    // 1. Visit Login
    console.log("Navigating to https://payguardiana3.vercel.app/login ...");
    await page.goto("https://payguardiana3.vercel.app/login", { waitUntil: "networkidle2" });

    // Verify Google button
    const googleBtnSelector = "button:has-text('Continue with Google')";
    // Use evaluate to find the button
    const gBtnFound = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.textContent?.includes("Continue with Google"));
      return !!btn;
    });
    console.log("Continue with Google button found:", gBtnFound);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "google_login_button.png") });

    // Intercept navigation on Google button click
    console.log("Clicking 'Continue with Google' to verify OAuth flow...");
    const [targetCreated] = await Promise.all([
      new Promise((resolve) => {
        browser.on("targetcreated", async (target) => {
          const url = target.url();
          console.log("[New Target Opened]:", url);
          resolve(target);
        });
        page.on("framenavigated", (frame) => {
          if (frame === page.mainFrame()) {
            console.log("[Main Frame Navigated to]:", frame.url());
            resolve(null);
          }
        });
      }),
      page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.includes("Continue with Google"));
        btn?.click();
      }),
    ]);

    await new Promise((r) => setTimeout(r, 4000));
    const currentUrl = page.url();
    console.log("Current URL after Google OAuth trigger:", currentUrl);

    const isGoogleOrSupabaseAuth =
      currentUrl.includes("supabase.co") ||
      currentUrl.includes("accounts.google.com") ||
      currentUrl.includes("google.com");

    console.log("Google OAuth flow redirected successfully:", isGoogleOrSupabaseAuth);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "google_oauth_redirect.png") });
  } finally {
    await page.close();
    await browser.disconnect();
  }
}

testAuth().catch(console.error);
