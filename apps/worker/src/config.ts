import { hostname } from "node:os";

export type WorkerConfig = {
  workerId: string;
  batchSize: number;
  pollIntervalMs: number;
  leaseDurationMs: number;
  leaseRenewalIntervalMs: number;
  databaseMode: "supabase";
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  paypalReturnUrl: string;
  paypalCancelUrl: string;
};

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const supabaseUrl = requireValue(env.SUPABASE_URL, "SUPABASE_URL");
  const supabaseServiceRoleKey = requireValue(
    env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  const leaseDurationMs = positiveInteger(env.WORKER_LEASE_DURATION_MS, 60_000);
  const leaseRenewalIntervalMs = positiveInteger(
    env.WORKER_LEASE_RENEWAL_INTERVAL_MS,
    Math.max(1_000, Math.floor(leaseDurationMs / 2)),
  );

  return {
    workerId: env.WORKER_ID?.trim() || `${hostname()}-${process.pid}`,
    batchSize: positiveInteger(env.WORKER_BATCH_SIZE, 5),
    pollIntervalMs: positiveInteger(env.WORKER_POLL_INTERVAL_MS, 5_000),
    leaseDurationMs,
    leaseRenewalIntervalMs: Math.min(leaseRenewalIntervalMs, leaseDurationMs),
    databaseMode: "supabase",
    supabaseUrl,
    supabaseServiceRoleKey,
    paypalReturnUrl: env.PAYPAL_RETURN_URL ?? "http://localhost:3000/paypal/return",
    paypalCancelUrl: env.PAYPAL_CANCEL_URL ?? "http://localhost:3000/paypal/cancel",
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("WORKER_CONFIG_INVALID_INTEGER");
  }
  return parsed;
}

function requireValue(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name}_REQUIRED`);
  return value;
}
