import type { RetryPolicy } from "@payguardian/domain";
import { defaultProviderRetryPolicy } from "@payguardian/domain";
import { classifyWorkerError, retryAtFor, type ProviderJobExecutor } from "./executor.js";
import type { ProviderJob, WorkerJobStore } from "./store.js";

export type PollingWorkerOptions = {
  workerId: string;
  batchSize: number;
  pollIntervalMs: number;
  leaseDurationMs: number;
  leaseRenewalIntervalMs: number;
  retryPolicy?: RetryPolicy;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: Pick<Console, "error">;
};

export type PollResult = {
  claimed: number;
  completed: number;
  failed: number;
};

export class PollingWorker {
  private stopping = false;
  private loopPromise: Promise<void> | null = null;
  private wake: (() => void) | null = null;

  constructor(
    private readonly store: WorkerJobStore,
    private readonly executor: Pick<ProviderJobExecutor, "execute">,
    private readonly options: PollingWorkerOptions,
  ) {}

  async runOnce(): Promise<PollResult> {
    const jobs = await this.store.claim({
      workerId: this.options.workerId,
      limit: this.options.batchSize,
      leaseDurationMs: this.options.leaseDurationMs,
    });
    let completed = 0;
    let failed = 0;
    for (const job of jobs) {
      const result = await this.process(job);
      if (result === "completed") completed += 1;
      if (result === "failed") failed += 1;
    }
    return { claimed: jobs.length, completed, failed };
  }

  start(): Promise<void> {
    if (!this.loopPromise) {
      this.stopping = false;
      this.loopPromise = this.loop().finally(() => {
        this.loopPromise = null;
      });
    }
    return this.loopPromise;
  }

  async stop(): Promise<void> {
    this.requestStop();
    if (this.loopPromise) await this.loopPromise;
  }

  requestStop(): void {
    this.stopping = true;
    this.wake?.();
  }

  private async loop(): Promise<void> {
    while (!this.stopping) {
      await this.runOnce();
      if (!this.stopping) await this.wait(this.options.pollIntervalMs);
    }
  }

  private async process(job: ProviderJob): Promise<"completed" | "failed"> {
    if (!job.leaseToken) {
      this.options.logger?.error("Provider job claim did not include a lease token.");
      return "failed";
    }
    const leaseToken = job.leaseToken;
    let leaseLost = false;
    const renewal = setInterval(() => {
      void this.store
        .renew({
          jobId: job.id,
          workerId: this.options.workerId,
          leaseToken,
          leaseDurationMs: this.options.leaseDurationMs,
        })
        .then((renewed) => {
          if (!renewed) leaseLost = true;
        })
        .catch(() => {
          leaseLost = true;
        });
    }, this.options.leaseRenewalIntervalMs);

    try {
      await this.executor.execute(job);
      if (leaseLost) return "failed";
      const completed = await this.store.complete({
        jobId: job.id,
        workerId: this.options.workerId,
        leaseToken,
      });
      return completed ? "completed" : "failed";
    } catch (error) {
      const classified = classifyWorkerError(error);
      const failed = await this.store.fail({
        jobId: job.id,
        workerId: this.options.workerId,
        leaseToken,
        errorCode: classified.code,
        errorMessage: classified.message,
        retry: classified.retry,
        retryAt: classified.retry
          ? retryAtFor(
              job.attempts,
              this.now(),
              this.options.retryPolicy ?? defaultProviderRetryPolicy,
            )
          : null,
      });
      if (!failed) this.options.logger?.error("Provider job lease was lost while failing a job.");
      return "failed";
    } finally {
      clearInterval(renewal);
    }
  }

  private async wait(milliseconds: number): Promise<void> {
    if (this.options.sleep) {
      await this.options.sleep(milliseconds);
      return;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.wake = null;
        resolve();
      }, milliseconds);
      this.wake = () => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
    });
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }
}
