# PayGuardian Performance Benchmarks

## Target SLAs
- **Authorization Decision Latency (p95):** < 100 ms (excluding external payment provider latency).
- **Dashboard Event Visibility Latency:** < 1000 ms.
- **Large-History Usability:** Cursor-based pagination with limit up to 100 per page.

---

## Benchmark 1: Authorization Policy Decisions
- **Script:** `scripts/benchmark-auth.mjs` (Run via `pnpm benchmark:auth`)
- **Workload:** 1,000 policy evaluations across a full mandate hierarchy (root -> child delegation checks, scope verification, integer budget boundary comparisons, expiry validations, approval flags).
- **Environment:** Linux x86_64, Node.js v24.21.0.

### Results
| Metric | Observed Latency | SLA Target | Status |
| --- | --- | --- | --- |
| **p50** | 0.0006 ms | < 50 ms | PASS |
| **p90** | 0.0024 ms | < 80 ms | PASS |
| **p95** | 0.0031 ms | < 100 ms | PASS |
| **p99** | 0.0078 ms | < 150 ms | PASS |
| **Max** | 0.6163 ms | < 200 ms | PASS |

Conclusion: The deterministic policy engine in `@payguardian/domain` executes well within the 100 ms SLA, averaging sub-millisecond evaluation times per request.

---

## Benchmark 2: Cursor Pagination & Large History Usability
- **Endpoints:**
  - `GET /v1/environments/:id/payments/paypal/operations?limit=N&cursor=CURSOR`
  - `GET /v1/environments/:id/activity?since=CURSOR&limit=N`
- **Result:** Tested with multiple page traversals. Both endpoints return O(limit) responses without full-table scanning, preserving low memory overhead and responsive AG Grid rendering on desktop and mobile viewports.
