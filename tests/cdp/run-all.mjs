import { connectBraveBrowser } from "./harness.mjs";
import { run as run01 } from "./scenarios/01-navigation-and-layout.test.mjs";
import { run as run02 } from "./scenarios/02-create-environment-flow.test.mjs";
import { run as run03 } from "./scenarios/03-environment-switching.test.mjs";
import { run as run04 } from "./scenarios/04-agent-grid-and-controls.test.mjs";
import { run as run05 } from "./scenarios/05-mandate-revocation.test.mjs";
import { run as run06 } from "./scenarios/06-emergency-controls-lifecycle.test.mjs";
import { run as run07 } from "./scenarios/07-payment-operations-grid.test.mjs";
import { run as run08 } from "./scenarios/08-paypal-callbacks.test.mjs";
import { run as run09 } from "./scenarios/09-auth-and-login-flows.test.mjs";
import { run as run10 } from "./scenarios/10-wallet-and-rpc-mocking.test.mjs";
import { run as run11 } from "./scenarios/11-raw-cdp-protocol.test.mjs";
import { run as run12 } from "./scenarios/12-human-approvals-inbox.test.mjs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("===============================================================");
  console.log("PayGuardian Browser CDP Interaction Test Suite (Brave Beta)");
  console.log("===============================================================\n");

  const startTime = Date.now();
  const browser = await connectBraveBrowser();
  const browserVersion = await browser.version();
  console.log(`Connected to Brave Beta over CDP: ${browserVersion}\n`);

  const scenarios = [
    { name: "01-navigation-and-layout", fn: () => run01(browser) },
    { name: "02-create-environment-flow", fn: () => run02(browser) },
    { name: "03-environment-switching", fn: () => run03(browser) },
    { name: "04-agent-grid-and-controls", fn: () => run04(browser) },
    { name: "05-mandate-revocation", fn: () => run05(browser) },
    { name: "06-emergency-controls-lifecycle", fn: () => run06(browser) },
    { name: "07-payment-operations-grid", fn: () => run07(browser) },
    { name: "08-paypal-callbacks", fn: () => run08(browser) },
    { name: "09-auth-and-login-flows", fn: () => run09(browser) },
    { name: "10-wallet-and-rpc-mocking", fn: () => run10(browser) },
    { name: "11-raw-cdp-protocol", fn: () => run11() },
    { name: "12-human-approvals-inbox", fn: () => run12(browser) },
  ];

  const results = [];

  for (const scenario of scenarios) {
    const sStart = Date.now();
    try {
      const res = await scenario.fn();
      const durationMs = Date.now() - sStart;
      results.push({ name: scenario.name, status: "PASSED", durationMs, details: res });
    } catch (err) {
      const durationMs = Date.now() - sStart;
      console.error(`  [FAILED] ${scenario.name}: ${err.message}`);
      results.push({
        name: scenario.name,
        status: "FAILED",
        durationMs,
        error: err.message,
        stack: err.stack,
      });
    }
    console.log();
  }

  await browser.disconnect();

  const totalDurationMs = Date.now() - startTime;
  const passedCount = results.filter((r) => r.status === "PASSED").length;
  const failedCount = results.filter((r) => r.status === "FAILED").length;

  console.log("===============================================================");
  console.log("Test Suite Execution Summary:");
  console.log(`Total Scenarios : ${scenarios.length}`);
  console.log(`Passed          : ${passedCount}`);
  console.log(`Failed          : ${failedCount}`);
  console.log(`Total Time      : ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log("===============================================================\n");

  const report = {
    timestamp: new Date().toISOString(),
    browser: browserVersion,
    totalScenarios: scenarios.length,
    passed: passedCount,
    failed: failedCount,
    totalDurationMs,
    results,
  };

  await writeFile(path.join(__dirname, "test-report.json"), JSON.stringify(report, null, 2));

  let summaryMd = `# PayGuardian Browser CDP Interaction Test Summary\n\n`;
  summaryMd += `**Execution Date**: ${report.timestamp}  \n`;
  summaryMd += `**Browser**: ${browserVersion} (via CDP on \`http://localhost:9222\`)  \n`;
  summaryMd += `**Overall Result**: ${failedCount === 0 ? "PASSED (100%)" : "FAILED"}  \n\n`;
  summaryMd += `| # | Test Scenario | Status | Duration |\n`;
  summaryMd += `|---|---|---|---|\n`;

  results.forEach((r, idx) => {
    summaryMd += `| ${idx + 1} | \`${r.name}\` | **${r.status}** | ${r.durationMs}ms |\n`;
  });

  await writeFile(path.join(__dirname, "test-summary.md"), summaryMd);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
