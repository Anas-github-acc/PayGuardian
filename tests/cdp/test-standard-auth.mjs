import puppeteer from "puppeteer-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, "screenshots", "live-deploy");

async function testStandardEmailAuth() {
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.on("console", (m) => console.log("[Console]", m.text()));

  try {
    await page.goto("https://payguardiana3.vercel.app/login", { waitUntil: "networkidle2" });
    
    // Switch to sign up mode
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const signupBtn = btns.find(b => b.textContent?.includes("Need an account? Sign up"));
      signupBtn?.click();
    });

    const testEmail = `payguardian.demo.user@gmail.com`;
    const testPassword = `SecurePassword123!@#`;

    console.log(`Entering standard email: ${testEmail}...`);
    await page.type("input[type='email']", testEmail);
    await page.type("input[type='password']", testPassword);

    console.log("Submitting sign up form...");
    await page.evaluate(() => {
      const submitBtn = document.querySelector("button[type='submit']");
      submitBtn?.click();
    });

    await new Promise((r) => setTimeout(r, 4000));
    console.log("Post-signup URL:", page.url());
    console.log("Post-signup page text (first 300 chars):", (await page.evaluate(() => document.body.innerText)).slice(0, 300));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "signup_standard_result.png") });

  } finally {
    await page.close();
    await browser.disconnect();
  }
}

testStandardEmailAuth().catch(console.error);
