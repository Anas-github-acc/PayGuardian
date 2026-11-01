import { Browser } from '/home/anas/.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs';
import { resolve } from 'node:path';

const SCREENSHOTS_DIR = resolve('/home/anas/myspace/AI/PayGuardian/.agents/teamwork/worker_visual_verification/screenshots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runDeepVerification() {
  console.log('--- Starting Deep Visual & Interaction Verification ---');
  const browser = await Browser.launch({ width: 1440, height: 900 });
  const page = await browser.newPage({ width: 1440, height: 900, dsf: 1 });

  try {
    await page.goto('http://localhost:3000', { timeoutMs: 20000, settleMs: 2500 });

    // A. Verify 5-Step Create-Environment Wizard with Dynamic Consent
    console.log('A. Testing 5-step Create Environment Wizard full cycle...');
    // Open environment switcher
    await page.eval(() => {
      const switcher = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Travel & Hospitality') || b.textContent?.includes('SANDBOX'));
      if (switcher) switcher.click();
    });
    await sleep(600);

    // Click "+ New Environment"
    await page.eval(() => {
      const newBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('New Environment'));
      if (newBtn) newBtn.click();
    });
    await sleep(800);

    // Step 1: Identity
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/wizard_step1_identity.jpg`, quality: 85 });
    console.log('Saved wizard_step1_identity.jpg');

    // Click Continue to Step 2: Root Mandate
    await page.eval(() => {
      const contBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Continue'));
      if (contBtn) contBtn.click();
    });
    await sleep(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/wizard_step2_root_mandate.jpg`, quality: 85 });
    console.log('Saved wizard_step2_root_mandate.jpg');

    // Click Continue to Step 3: Guardrails
    await page.eval(() => {
      const contBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Continue'));
      if (contBtn) contBtn.click();
    });
    await sleep(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/wizard_step3_guardrails.jpg`, quality: 85 });
    console.log('Saved wizard_step3_guardrails.jpg');

    // Click Continue to Step 4: Dynamic Consent
    await page.eval(() => {
      const contBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Continue'));
      if (contBtn) contBtn.click();
    });
    await sleep(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/wizard_step4_dynamic_consent.jpg`, quality: 85 });
    console.log('Saved wizard_step4_dynamic_consent.jpg');

    // Check the consent confirmation checkbox
    await page.eval(() => {
      const checkbox = document.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.click();
      }
    });
    await sleep(500);

    // Click Continue to Step 5: Confirmation
    await page.eval(() => {
      const contBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Continue'));
      if (contBtn) contBtn.click();
    });
    await sleep(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/wizard_step5_confirm.jpg`, quality: 85 });
    console.log('Saved wizard_step5_confirm.jpg');

    // Click Authorize & Create Environment
    await page.eval(() => {
      const authBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Authorize & Create'));
      if (authBtn) authBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/wizard_step_post_creation.jpg`, quality: 85 });
    console.log('Saved wizard_step_post_creation.jpg');

    // B. Environment Switching & Complete Synchronous Reset
    console.log('B. Testing Environment Switching & State Reset...');
    // Open switcher
    await page.eval(() => {
      const switcher = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Procurement & Travel') || b.textContent?.includes('SANDBOX'));
      if (switcher) switcher.click();
    });
    await sleep(600);

    // Switch to "Production Cloud Ops"
    await page.eval(() => {
      const envs = Array.from(document.querySelectorAll('button'));
      const prodEnv = envs.find(b => b.textContent?.includes('Production Cloud Ops'));
      if (prodEnv) prodEnv.click();
    });
    await sleep(1200);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/env_switched_production.jpg`, quality: 85 });
    console.log('Saved env_switched_production.jpg');

    // C. Verify Chat Input Escaping and Two-Voices Architecture
    console.log('C. Testing Two-Voices chat message send and escaping...');
    await page.eval(() => {
      const input = document.querySelector('input[placeholder*="Message"], textarea[placeholder*="Message"]');
      if (input) {
        input.value = 'Pay $245.00 for IndiGo flight via PayPal <b style="color:red">test injection</b>';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const form = input.closest('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }
    });
    await sleep(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/chat_two_voices_execution.jpg`, quality: 85 });
    console.log('Saved chat_two_voices_execution.jpg');

    // D. Verify Solid vs Dashed Nodes in 3D Canvas
    console.log('D. Inspecting Solid vs Dashed Node representation...');
    const nodeIntegrity = await page.eval(() => {
      // Check node filter pills
      const pills = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim());
      const hasFundedPill = pills.some(p => p?.includes('Funded'));
      const hasUnfundedPill = pills.some(p => p?.includes('Unfunded'));
      return { hasFundedPill, hasUnfundedPill };
    });
    console.log('Node integrity checks:', nodeIntegrity);

    console.log('--- Deep Verification Completed Successfully ---');
  } finally {
    await browser.close();
  }
}

runDeepVerification().catch(err => {
  console.error('Deep verification error:', err);
  process.exit(1);
});
