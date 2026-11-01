import puppeteer from "puppeteer-core";
import { exec, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");

export const BRAVE_CDP_URL = process.env.BRAVE_CDP_URL || "http://localhost:9222";
export const WEB_BASE_URL = process.env.WEB_BASE_URL || "http://localhost:3000";
export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";

/**
 * Checks if an HTTP URL is responding.
 */
export async function isUrlReachable(url, timeoutMs = 2000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Ensures Brave Beta, Next.js web server, and API gateway are running.
 */
export async function ensureServices() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  // 1. Check API server
  const apiOk = await isUrlReachable(`${API_BASE_URL}/health`);
  if (!apiOk) {
    console.log("[Harness] Starting Gateway API server on port 3001...");
    const apiProc = spawn(
      "pnpm",
      ["--filter", "@payguardian/api", "exec", "tsx", "src/server.ts"],
      {
        cwd: path.resolve(__dirname, "../.."),
        env: {
          ...process.env,
          DATABASE_MODE: "memory",
          ENABLE_LOCAL_DEV_AUTH: "true",
          API_PORT: "3001",
        },
        detached: true,
        stdio: "ignore",
      },
    );
    apiProc.unref();
    await waitForUrl(`${API_BASE_URL}/health`, 15000);
  }

  // 2. Check Next.js web server
  const webOk = await isUrlReachable(WEB_BASE_URL);
  if (!webOk) {
    console.log("[Harness] Starting Next.js web server on port 3000...");
    const webProc = spawn("pnpm", ["--filter", "@payguardian/web", "dev"], {
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: API_BASE_URL, PORT: "3000" },
      detached: true,
      stdio: "ignore",
    });
    webProc.unref();
    await waitForUrl(WEB_BASE_URL, 20000);
  }

  // 3. Check Brave Beta CDP port 9222
  const cdpOk = await isUrlReachable(`${BRAVE_CDP_URL}/json/version`);
  if (!cdpOk) {
    console.log("[Harness] Launching Brave Beta with remote debugging on port 9222...");
    const braveProc = spawn(
      "brave-beta",
      [
        "--headless=new",
        "--remote-debugging-port=9222",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--user-data-dir=/tmp/brave-cdp-profile",
      ],
      {
        detached: true,
        stdio: "ignore",
        env: {
          ...process.env,
          USER_FLAGS: "--no-first-run",
          BRAVE_FLAGS: "--no-default-browser-check",
          FLAG: "--disable-sync",
        },
      },
    );
    braveProc.unref();
    await waitForUrl(`${BRAVE_CDP_URL}/json/version`, 10000);
  }

  console.log("[Harness] All required services verified active.");
}

async function waitForUrl(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isUrlReachable(url, 1000)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout waiting for ${url} to become reachable after ${timeoutMs}ms`);
}

/**
 * Connects to the active Brave Beta browser via CDP.
 */
export async function connectBraveBrowser() {
  await ensureServices();
  const browser = await puppeteer.connect({
    browserURL: BRAVE_CDP_URL,
    defaultViewport: { width: 1280, height: 900 },
  });
  return browser;
}

/**
 * Sets up a test page with deterministic mock wallet and RPC interceptors.
 */
export async function setupTestPage(browser, options = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleLogs = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  // Automatically accept confirmation dialogs (for Revoke actions)
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  // Inject deterministic Mock Web3 Wallet (window.ethereum) and Solana (window.solana)
  await page.evaluateOnNewDocument(() => {
    // Deterministic Mock EIP-1193 Ethereum Wallet Provider
    const mockAccounts = ["0x71C8364665BA10b891866a983b88b26499317544"];
    const mockChainId = "0x1"; // Ethereum Mainnet

    const listeners = {};

    window.ethereum = {
      isMetaMask: true,
      isConnected: () => true,
      chainId: mockChainId,
      selectedAddress: mockAccounts[0],
      networkVersion: "1",
      on(event, handler) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler);
        return this;
      },
      removeListener(event, handler) {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
        return this;
      },
      async request({ method, params }) {
        switch (method) {
          case "eth_requestAccounts":
          case "eth_accounts":
            return mockAccounts;
          case "eth_chainId":
            return mockChainId;
          case "net_version":
            return "1";
          case "personal_sign":
            return "0x789abc0001mock_signature_for_payguardian_delegation_authority";
          case "eth_signTypedData_v4":
            return "0x987fedcba0001mock_eip712_signature_delegated_mandate_proof";
          case "eth_sendTransaction":
            return "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
          case "wallet_switchEthereumChain":
            return null;
          default:
            return null;
        }
      },
    };

    // Deterministic Mock Solana Wallet Provider (Phantom)
    window.solana = {
      isPhantom: true,
      isConnected: true,
      publicKey: {
        toBase58: () => "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
        toString: () => "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
      },
      async connect() {
        return { publicKey: this.publicKey };
      },
      async disconnect() {},
      async signTransaction(tx) {
        return tx;
      },
      async signAllTransactions(txs) {
        return txs;
      },
      async signMessage(message) {
        return {
          signature: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
          publicKey: this.publicKey,
        };
      },
    };
  });

  // Enable request interception for mocking RPC calls
  await page.setRequestInterception(true);
  page.on("request", (interceptedRequest) => {
    const url = interceptedRequest.url();
    const method = interceptedRequest.method();

    // Deterministically intercept any JSON-RPC or EVM RPC network calls
    if (url.includes("/rpc") || url.includes("alchemy") || url.includes("infura")) {
      const postData = interceptedRequest.postData();
      let reqId = 1;
      try {
        const parsed = JSON.parse(postData || "{}");
        if (parsed.id) reqId = parsed.id;
      } catch {}

      interceptedRequest.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: reqId,
          result: "0x1",
        }),
      });
      return;
    }

    interceptedRequest.continue();
  });

  return {
    page,
    consoleLogs,
    pageErrors,
    async takeScreenshot(name) {
      const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      return filePath;
    },
  };
}

/**
 * Raw CDP WebSocket protocol invoker.
 */
export async function executeRawCdpCommand(method, params = {}, targetType) {
  const isBrowserCmd = method.startsWith("Browser.") || method.startsWith("Target.");
  const type = targetType || (isBrowserCmd ? "browser" : "page");

  let wsUrl;
  if (type === "browser") {
    const versionRes = await fetch(`${BRAVE_CDP_URL}/json/version`);
    const version = await versionRes.json();
    wsUrl = version.webSocketDebuggerUrl;
  } else {
    const targetsRes = await fetch(`${BRAVE_CDP_URL}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === "page") || targets[0];
    if (!pageTarget) throw new Error("No page target available for CDP command");
    wsUrl = pageTarget.webSocketDebuggerUrl;
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const id = Math.floor(Math.random() * 100000);

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`CDP command ${method} timed out`));
    }, 5000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ id, method, params }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        clearTimeout(timer);
        ws.close();
        if (msg.error) {
          reject(new Error(`CDP Error: ${msg.error.message}`));
        } else {
          resolve(msg.result);
        }
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      reject(err);
    };
  });
}
