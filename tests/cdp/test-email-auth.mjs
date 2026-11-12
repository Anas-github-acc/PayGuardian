import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "live-deploy");

async function testEmailAuth() {
  console.log("=== Testing Email Signup & Login ===");
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.on("console", (m) => console.log("[Console]", m.text()));

  try {
    await page.goto("https://payguardiana3.vercel.app/login", { waitUntil: "networkidle2" });

    // Switch to sign up mode
    console.log("Clicking 'Need an account? Sign up'...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const signupBtn = btns.find((b) => b.textContent?.includes("Need an account? Sign up"));
      signupBtn?.click();
    });

    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "signup_mode.png") });

    const isSignUpMode = await page.evaluate(() => {
      return (
        document.body.innerText.includes("Create an account") ||
        document.body.innerText.includes("Sign up")
      );
    });
    console.log("Switched to Sign Up mode:", isSignUpMode);

    // Let's test signing up a unique test judge email
    const testEmail = `judge_${Date.now()}@payguardian-test.dev`;
    const testPassword = `TestPassword!987#`;

    console.log(`Entering credentials: ${testEmail}...`);
    await page.type("input[type='email']", testEmail);
    await page.type("input[type='password']", testPassword);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "signup_filled.png") });

    console.log("Submitting sign up form...");
    await page.evaluate(() => {
      const submitBtn = document.querySelector("button[type='submit']");
      submitBtn?.click();
    });

    await new Promise((r) => setTimeout(r, 4000));
    console.log("Post-signup URL:", page.url());
    console.log(
      "Post-signup page text (first 300 chars):",
      (await page.evaluate(() => document.body.innerText)).slice(0, 300),
    );
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "signup_result.png") });
  } finally {
    await page.close();
    await browser.disconnect();
  }
}

testEmailAuth().catch(console.error);
