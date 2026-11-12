import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "live-deploy");

async function main() {
  console.log("=== Testing Redesigned Auth Pages via CDP ===");
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  try {
    // 1. Visit Login (Sign In mode)
    console.log("Navigating to https://payguardiana3.vercel.app/login?preview=true ...");
    await page.goto("https://payguardiana3.vercel.app/login?preview=true", {
      waitUntil: "domcontentloaded",
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Verify disabled buttons
    const disabledButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const github = btns.find((b) => b.textContent?.includes("GitHub"));
      const apple = btns.find((b) => b.textContent?.includes("Apple"));
      const google = btns.find((b) => b.textContent?.includes("Google"));
      return {
        githubDisabled: github?.disabled,
        appleDisabled: apple?.disabled,
        googleDisabled: google?.disabled,
      };
    });
    console.log("Button disabled states:", disabledButtons);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "redesign_signin_live.png"),
      fullPage: true,
    });

    // 2. Switch to Sign Up mode
    console.log("Toggling to Sign Up mode...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const signupToggle = btns.find((b) => b.textContent?.trim() === "Sign Up");
      signupToggle?.click();
    });
    await new Promise((r) => setTimeout(r, 1500));

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, "redesign_signup_live.png"),
      fullPage: true,
    });

    console.log("Captured screenshots cleanly!");
  } finally {
    await page.close();
    await browser.disconnect();
  }
}

main().catch(console.error);
