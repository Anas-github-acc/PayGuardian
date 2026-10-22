import { fileURLToPath } from "node:url";
import { HttpPayPalClient } from "@payguardian/paypal";
import { loadWorkerConfig, type WorkerConfig } from "./config.js";
import { ProviderJobExecutor } from "./executor.js";
import { PollingWorker } from "./runner.js";
import { createSupabaseWorkerStore, type WorkerStore } from "./store.js";

export const workerStatus = {
  service: "payment-reconciliation-worker",
  phase: "runtime-enabled",
  enabled: true,
} as const;

export function createWorkerRuntime(
  options: {
    config?: WorkerConfig;
    store?: WorkerStore;
    paypal?: ConstructorParameters<typeof ProviderJobExecutor>[0]["paypal"];
  } = {},
): PollingWorker {
  const config = options.config ?? loadWorkerConfig();
  const store =
    options.store ??
    createSupabaseWorkerStore({
      url: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
    });
  const executor = new ProviderJobExecutor({
    paypal: options.paypal ?? new HttpPayPalClient(),
    store,
    returnUrl: config.paypalReturnUrl,
    cancelUrl: config.paypalCancelUrl,
  });
  return new PollingWorker(store, executor, config);
}

export { loadWorkerConfig } from "./config.js";
export {
  ProviderJobExecutor,
  WorkerExecutionError,
  classifyWorkerError,
  paypalRequestId,
  retryAtFor,
} from "./executor.js";
export { PollingWorker } from "./runner.js";
export {
  SupabaseWorkerStore,
  createSupabaseWorkerStore,
  observeOperation,
  type ProviderJob,
  type ProviderOperation,
  type WorkerStore,
} from "./store.js";

async function main(): Promise<void> {
  const runner = createWorkerRuntime();
  const shutdown = async () => {
    await runner.stop();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  await runner.start();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
