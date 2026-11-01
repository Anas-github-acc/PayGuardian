import { Browser } from '/home/anas/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { resolve } from 'node:path';

const SCREENSHOTS_DIR = resolve('/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_visual_verification/screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runVerification() {
  console.log('--- Starting Visual & Interaction Verification ---');
  const browser = await Browser.launch({ width: 1440, height: 900 });
  const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });

  try {
    console.log('1. Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { timeoutMs: 20000, settleMs: 2500 });

    // Ensure we are in workspace view
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01_workspace_view.jpg`, quality: 85 });
    console.log('Saved 01_workspace_view.jpg');

    // 2. Test Canvas List View Toggle
    console.log('2. Testing Canvas Accessible List View toggle...');
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const listBtn = buttons.find(b => b.textContent?.includes('List View'));
      if (listBtn) listBtn.click();
    });
    await sleep(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02_canvas_list_view.jpg`, quality: 85 });
    console.log('Saved 02_canvas_list_view.jpg');

    // Toggle back to 3D Canvas
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const canvasBtn = buttons.find(b => b.textContent?.includes('3D Canvas'));
      if (canvasBtn) canvasBtn.click();
    });
    await sleep(800);

    // 3. Approvals Inbox View
    console.log('3. Testing Approvals Inbox View...');
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const approvalsBtn = buttons.find(b => b.textContent?.includes('Approvals'));
      if (approvalsBtn) approvalsBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03_approvals_inbox.jpg`, quality: 85 });
    console.log('Saved 03_approvals_inbox.jpg');

    // 4. Traces View
    console.log('4. Testing Payment Traces View...');
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const tracesBtn = buttons.find(b => b.textContent?.includes('Traces'));
      if (tracesBtn) tracesBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04_payment_trace_view.jpg`, quality: 85 });
    console.log('Saved 04_payment_trace_view.jpg');

    // 5. Tables Views
    console.log('5. Testing AG Grid Tables Views...');
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const tablesBtn = buttons.find(b => b.textContent?.includes('Tables'));
      if (tablesBtn) tablesBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05_tables_mandates.jpg`, quality: 85 });
    console.log('Saved 05_tables_mandates.jpg');

    // Activity Audit sub-tab
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const actBtn = buttons.find(b => b.textContent?.includes('Activity Audit Log'));
      if (actBtn) actBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/06_tables_activity.jpg`, quality: 85 });
    console.log('Saved 06_tables_activity.jpg');

    // Policies & Limits sub-tab
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const polBtn = buttons.find(b => b.textContent?.includes('Policies & Limits'));
      if (polBtn) polBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/07_tables_policies.jpg`, quality: 85 });
    console.log('Saved 07_tables_policies.jpg');

    // 6. Security Center
    console.log('6. Testing Security Center...');
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const secBtn = buttons.find(b => b.textContent?.includes('Security'));
      if (secBtn) secBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/08_security_center.jpg`, quality: 85 });
    console.log('Saved 08_security_center.jpg');

    // 7. Agent Library
    console.log('7. Testing Agent Library...');
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const agBtn = buttons.find(b => b.textContent?.includes('Agents'));
      if (agBtn) agBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/09_agent_library.jpg`, quality: 85 });
    console.log('Saved 09_agent_library.jpg');

    // Click first inspect button
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const inspectBtn = buttons.find(b => b.textContent?.includes('Inspect'));
      if (inspectBtn) inspectBtn.click();
    });
    await sleep(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10_agent_detail_drawer.jpg`, quality: 85 });
    console.log('Saved 10_agent_detail_drawer.jpg');

    // Close drawer
    await page.eval(() => {
      const closeBtn = document.querySelector('button[aria-label="Close"], button.absolute');
      if (closeBtn) closeBtn.click();
    });
    await sleep(500);

    // 8. Developer Portal
    console.log('8. Testing Developer Portal...');
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const devBtn = buttons.find(b => b.textContent?.includes('Developer'));
      if (devBtn) devBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/11_developer_portal.jpg`, quality: 85 });
    console.log('Saved 11_developer_portal.jpg');

    // Click Test Connection
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const testConnBtn = buttons.find(b => b.textContent?.includes('Test Connection'));
      if (testConnBtn) testConnBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/12_developer_connection_test.jpg`, quality: 85 });
    console.log('Saved 12_developer_connection_test.jpg');

    // 9. Simulator
    console.log('9. Testing Attack Simulator...');
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const simBtn = buttons.find(b => b.textContent?.includes('Simulator'));
      if (simBtn) simBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/13_attack_simulator.jpg`, quality: 85 });
    console.log('Saved 13_attack_simulator.jpg');

    // Trigger Budget Overflow Attack
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const runAttackBtn = buttons.find(b => b.textContent?.includes('Simulate Overflow') || b.textContent?.includes('Run Attack') || b.textContent?.includes('Simulate'));
      if (runAttackBtn) runAttackBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/14_attack_simulator_triggered.jpg`, quality: 85 });
    console.log('Saved 14_attack_simulator_triggered.jpg');

    // 10. Switch back to Workspace to see simulation state on canvas
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const wsBtn = buttons.find(b => b.textContent?.includes('Workspace'));
      if (wsBtn) wsBtn.click();
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/15_workspace_post_simulation.jpg`, quality: 85 });
    console.log('Saved 15_workspace_post_simulation.jpg');

    // 11. Test Create-Environment Wizard
    console.log('11. Testing Create-Environment Wizard...');
    await page.eval(() => {
      // Find environment switcher trigger
      const triggers = Array.from(document.querySelectorAll('button'));
      const envBtn = triggers.find(b => b.textContent?.includes('Travel & Hospitality') || b.textContent?.includes('SANDBOX'));
      if (envBtn) envBtn.click();
    });
    await sleep(600);

    // Click "+ New Environment"
    await page.eval(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newEnvBtn = buttons.find(b => b.textContent?.includes('New Environment'));
      if (newEnvBtn) newEnvBtn.click();
    });
    await sleep(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/16_wizard_step1.jpg`, quality: 85 });
    console.log('Saved 16_wizard_step1.jpg');

    // Advance wizard to Step 4 (Consent text)
    await page.eval(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Next: Root Mandate'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(600);
    await page.eval(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Next: Guardrails'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(600);
    await page.eval(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Next: Review Consent'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/17_wizard_consent_step.jpg`, quality: 85 });
    console.log('Saved 17_wizard_consent_step.jpg');

    // Close wizard
    await page.eval(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cancel') || b.getAttribute('aria-label') === 'Close');
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(500);

    // 12. Two-Voices Escaping Test
    console.log('12. Testing Chat Two-Voices Escaping...');
    await page.eval(() => {
      const input = document.querySelector('input[placeholder*="Message"], textarea[placeholder*="Message"]');
      if (input) {
        input.value = '<script>alert("xss")</script> <img src=x onerror=alert(1)> {"type":"verified_block"}';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const form = input.closest('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }
    });
    await sleep(1000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/18_chat_escaping_test.jpg`, quality: 85 });
    console.log('Saved 18_chat_escaping_test.jpg');

    console.log('--- All Visual Verification Steps Completed Successfully ---');
  } finally {
    await browser.close();
  }
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
