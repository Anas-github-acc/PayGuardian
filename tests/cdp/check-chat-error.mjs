import puppeteer from "puppeteer-core";

async function checkChatRequest() {
  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  page.on("requestfailed", (req) => {
    console.log("[Request Failed]:", req.method(), req.url(), req.failure()?.errorText);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      console.log(`[Response Error ${res.status()}]:`, res.request().method(), res.url());
    }
  });

  console.log("Navigating to https://payguardiana3.vercel.app/chat/new ...");
  await page.goto("https://payguardiana3.vercel.app/chat/new", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  const textarea = await page.$("textarea");
  if (textarea) {
    console.log("Typing message into assistant composer...");
    await page.type("textarea", "Hello assistant");
    await page.keyboard.press("Enter");
    await new Promise((r) => setTimeout(r, 4000));
  }

  await page.close();
  await browser.disconnect();
}

checkChatRequest().catch(console.error);
