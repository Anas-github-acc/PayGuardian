import assert from "node:assert/strict";
import { setupTestPage, WEB_BASE_URL } from "../harness.mjs";

export async function run(browser) {
  console.log("  [Scenario 10] Running Deterministic Wallet & RPC Mocking verification...");
  const { page, takeScreenshot, pageErrors } = await setupTestPage(browser);

  try {
    await page.goto(WEB_BASE_URL, { waitUntil: "networkidle2" });

    // 1. Verify EIP-1193 Ethereum provider injection
    const ethState = await page.evaluate(async () => {
      if (!window.ethereum) return { exists: false };
      const isMetaMask = window.ethereum.isMetaMask;
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: ["Authorize Delegation Policy", accounts[0]],
      });
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ to: accounts[0], value: "0x0" }],
      });

      return {
        exists: true,
        isMetaMask,
        accounts,
        chainId,
        signature,
        txHash,
      };
    });

    assert.equal(ethState.exists, true, "window.ethereum mock provider must exist");
    assert.equal(ethState.isMetaMask, true, "window.ethereum.isMetaMask must be true");
    assert.deepEqual(
      ethState.accounts,
      ["0x71C8364665BA10b891866a983b88b26499317544"],
      "eth_requestAccounts must return deterministic mock address",
    );
    assert.equal(ethState.chainId, "0x1", "eth_chainId must return 0x1");
    assert.match(
      ethState.signature,
      /^0x789abc/,
      "personal_sign must return deterministic signature",
    );
    assert.match(
      ethState.txHash,
      /^0x123456/,
      "eth_sendTransaction must return deterministic tx hash",
    );

    // 2. Verify Solana Phantom provider injection
    const solState = await page.evaluate(async () => {
      if (!window.solana) return { exists: false };
      const isPhantom = window.solana.isPhantom;
      const connection = await window.solana.connect();
      const pubkey = connection.publicKey.toBase58();
      return {
        exists: true,
        isPhantom,
        pubkey,
      };
    });

    assert.equal(solState.exists, true, "window.solana mock provider must exist");
    assert.equal(solState.isPhantom, true, "window.solana.isPhantom must be true");
    assert.equal(
      solState.pubkey,
      "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
      "Solana public key must match deterministic mock",
    );

    // 3. Verify RPC network interception over CDP
    const rpcResponse = await page.evaluate(async () => {
      const res = await fetch("/rpc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 999, method: "eth_blockNumber", params: [] }),
      });
      return res.json();
    });

    assert.equal(rpcResponse.jsonrpc, "2.0", "RPC response must be JSON-RPC 2.0");
    assert.equal(rpcResponse.id, 999, "RPC response must preserve request ID");
    assert.equal(rpcResponse.result, "0x1", "RPC response must return deterministic mocked result");

    await takeScreenshot("10_wallet_and_rpc_mocking");
    assert.equal(pageErrors.length, 0, `Page errors encountered: ${pageErrors.join(", ")}`);
    console.log("  [Scenario 10] PASSED: Deterministic wallet and RPC mocking verified.");
    return { passed: true, name: "10-wallet-and-rpc-mocking" };
  } finally {
    await page.close();
  }
}
