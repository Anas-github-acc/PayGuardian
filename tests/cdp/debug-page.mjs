import puppeteer from "puppeteer-core";

async function debug() {
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.on("console", (msg) => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on("pageerror", (err) => console.log(`[Browser PageError]:`, err.message));

  console.log("Navigating to /dashboard?preview=true...");
  await page.goto("https://payguardiana3.vercel.app/dashboard?preview=true", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  const text = await page.evaluate(() => document.body.innerText);
  console.log("--- Dashboard Body Text (first 600 chars) ---");
  console.log(text.slice(0, 600));

  console.log("\nNavigating to /dashboard?preview=true&tab=tables&sub=mandates...");
  await page.goto("https://payguardiana3.vercel.app/dashboard?preview=true&tab=tables&sub=mandates", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  const tablesText = await page.evaluate(() => document.body.innerText);
  console.log("--- Tables Body Text (first 600 chars) ---");
  console.log(tablesText.slice(0, 600));

  await page.close();
  await browser.disconnect();
}

debug().catch(console.error);
