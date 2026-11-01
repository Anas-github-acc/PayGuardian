#!/usr/bin/env node

/**
 * PayGuardian Phase 7 Authorization Performance Benchmark
 * Target: p95 authorization evaluation latency < 100 ms
 */

import { performance } from "node:perf_hooks";
import { evaluateMandate, createRootMandate } from "../packages/domain/src/index.ts";

async function runBenchmark(iterations = 1000) {
  console.log(`[BENCHMARK] Running ${iterations} authorization policy decisions...`);

  const mandate = createRootMandate({
    id: "bench-mandate-root",
    issuerUserId: "bench-user",
    createdAt: new Date().toISOString(),
    constraints: {
      environmentId: "bench-env",
      holderAgentId: "bench-agent",
      budgetLimitMinor: 1_000_000,
      currency: "USD",
      permittedActions: ["book_hotel", "book_flight", "order_food"],
      expiresAt: "2028-01-01T00:00:00.000Z",
      canDelegate: true,
      maxDelegationDepth: 3,
      approvalRequired: false,
    },
  });

  const latencies = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const decision = evaluateMandate(mandate, {
      action: "book_hotel",
      amountMinor: 1000 + (i % 500),
      currency: "USD",
      at: new Date(),
      approvalGranted: false,
    });
    const durationMs = performance.now() - start;
    latencies.push(durationMs);

    if (!decision.allowed) {
      throw new Error(`Unexpected policy rejection at iteration ${i}`);
    }
  }

  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(iterations * 0.5)];
  const p90 = latencies[Math.floor(iterations * 0.9)];
  const p95 = latencies[Math.floor(iterations * 0.95)];
  const p99 = latencies[Math.floor(iterations * 0.99)];
  const max = latencies[latencies.length - 1];

  console.log(`[BENCHMARK RESULTS]`);
  console.log(`  Total Iterations: ${iterations}`);
  console.log(`  p50: ${p50.toFixed(4)} ms`);
  console.log(`  p90: ${p90.toFixed(4)} ms`);
  console.log(`  p95: ${p95.toFixed(4)} ms (SLA Target: < 100 ms)`);
  console.log(`  p99: ${p99.toFixed(4)} ms`);
  console.log(`  Max: ${max.toFixed(4)} ms`);

  if (p95 >= 100) {
    console.error(`[FAIL] p95 (${p95.toFixed(2)} ms) exceeded 100 ms SLA!`);
    process.exitCode = 1;
  } else {
    console.log(`[PASS] Authorization latency p95 is well within < 100 ms SLA requirement.`);
  }
}

runBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  process.exitCode = 1;
});
