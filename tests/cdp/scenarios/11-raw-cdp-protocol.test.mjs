import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { executeRawCdpCommand, SCREENSHOTS_DIR } from "../harness.mjs";

export async function run() {
  console.log("  [Scenario 11] Running Direct Low-Level Chrome DevTools Protocol verification...");

  // 1. Browser.getVersion
  const version = await executeRawCdpCommand("Browser.getVersion");
  assert.ok(version.product, "Browser.getVersion must return product");
  assert.ok(version.protocolVersion, "Browser.getVersion must return protocolVersion");
  console.log(`    CDP Browser: ${version.product}, Protocol: ${version.protocolVersion}`);

  // 2. Target.getTargets
  const targets = await executeRawCdpCommand("Target.getTargets");
  assert.ok(Array.isArray(targets.targetInfos), "Target.getTargets must return targetInfos array");
  assert.ok(targets.targetInfos.length > 0, "There must be at least one target in Brave Beta");

  // 3. Page.captureScreenshot (Low-level raw CDP command)
  const screenshotData = await executeRawCdpCommand("Page.captureScreenshot", { format: "png" });
  assert.ok(screenshotData.data, "Page.captureScreenshot must return base64 encoded data");

  const screenshotBuffer = Buffer.from(screenshotData.data, "base64");
  const rawScreenshotPath = path.join(SCREENSHOTS_DIR, "11_raw_cdp_protocol.png");
  await writeFile(rawScreenshotPath, screenshotBuffer);

  // 4. Page.getLayoutMetrics
  const layout = await executeRawCdpCommand("Page.getLayoutMetrics");
  assert.ok(layout.cssLayoutViewport, "Page.getLayoutMetrics must return cssLayoutViewport");

  // 5. DOM.getDocument
  const doc = await executeRawCdpCommand("DOM.getDocument", { depth: 1 });
  assert.ok(doc.root, "DOM.getDocument must return root DOM node");
  assert.equal(doc.root.nodeName, "#document", "Root DOM node must be #document");

  console.log("  [Scenario 11] PASSED: Raw CDP Protocol operations verified successfully.");
  return { passed: true, name: "11-raw-cdp-protocol" };
}
