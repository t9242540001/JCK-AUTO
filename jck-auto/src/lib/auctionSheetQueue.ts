/**
 * @file auctionSheetQueue.ts
 * @description Server-side in-memory queue for auction-sheet requests.
 *              Concurrency=1, max queue=10, completed-jobs TTL=15min.
 *              Designed for single PM2 process on single VDS — do NOT
 *              add Redis/DB persistence without explicit ADR.
 * @runs VDS (single Node.js process)
 * @rule Concurrency MUST stay 1 — DashScope upstream soft-throttles
 *       concurrent requests per API key, and concurrency=1 is the
 *       whole point of this module. See decisions.md ADR.
 * @rule Queue state is in-memory; lost on process restart.
 *       Active job is aborted; clients must resubmit.
 *       Do NOT attempt to persist without a full ADR.
 * @rule jobId uses crypto.randomUUID() — RFC 9562 v4, 122 bits entropy.
 *       Do NOT replace with shorter / custom ID schemes.
 */

import { randomUUID } from 'node:crypto';

export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface JobStatusSnapshot {
  jobId: string; status: JobStatus; position: number; etaSec: number;
  result?: unknown; error?: string;
  enqueuedAt: number; startedAt: number | null; completedAt: number | null;
}

export interface QueueStatsSnapshot {
  currentSize: number; activeJobId: string | null;
  peakQueueSize: number; peakTimestamp: string | null;
  totalJobsEnqueued: number; totalJobsCompleted: number;
  totalJobsFailed: number; totalJobsRejected: number;
  avgWaitTimeSec: number; avgProcessingTimeSec: number;
  startedAt: string;
}

export class QueueFullError extends Error {
  public readonly code = 'queue_full';
  constructor(public readonly queueSize: number, public readonly maxSize: number) {
    super(`Queue is full (${queueSize}/${maxSize})`);
    this.name = 'QueueFullError';
  }
}

interface QueuedJob {
  jobId: string; jobFn: () => Promise<unknown>;
  enqueuedAt: number; startedAt: number | null;
}

interface CompletedJob {
  jobId: string; status: 'done' | 'failed';
  result?: unknown; error?: string;
  enqueuedAt: number; startedAt: number; completedAt: number;
}

const freshStats = () => ({
  peakQueueSize: 0, peakTimestamp: null as string | null,
  totalJobsEnqueued: 0, totalJobsCompleted: 0, totalJobsFailed: 0, totalJobsRejected: 0,
  avgWaitTimeSec: 0, avgProcessingTimeSec: 0,
  startedAt: new Date().toISOString(),
});

class AuctionSheetQueue {
  readonly CONCURRENCY = 1;
  readonly MAX_QUEUE_SIZE = 10;
  readonly TTL_MS = 15 * 60 * 1000;

  #pending: QueuedJob[] = [];
  #activeJob: QueuedJob | null = null;
  #completed = new Map<string, CompletedJob>();
  #workerRunning = false;
  #sweeperInterval: NodeJS.Timeout | null = null;
  #stats = freshStats();

  constructor() {
    this.#sweeperInterval = setInterval(() => this.#sweep(), 60_000);
    this.#sweeperInterval.unref();
  }

  enqueue(jobFn: () => Promise<unknown>): string {
    const current = this.#pending.length + (this.#activeJob ? 1 : 0);
    if (current >= this.MAX_QUEUE_SIZE) {
      this.#stats.totalJobsRejected += 1;
      throw new QueueFullError(current, this.MAX_QUEUE_SIZE);
    }
    const jobId = randomUUID();
    this.#pending.push({ jobId, jobFn, enqueuedAt: Date.now(), startedAt: null });
    this.#stats.totalJobsEnqueued += 1;
    const size = this.#pending.length + (this.#activeJob ? 1 : 0);
    if (size > this.#stats.peakQueueSize) {
      this.#stats.peakQueueSize = size;
      this.#stats.peakTimestamp = new Date().toISOString();
    }
    console.log(`[queue] enqueued jobId=${jobId} position=${this.#pending.length} queueSize=${size}`);
    void this.#runWorker();
    return jobId;
  }

  getStatus(jobId: string): JobStatusSnapshot | null {
    if (this.#activeJob?.jobId === jobId) {
      const startedAt = this.#activeJob.startedAt ?? Date.now();
      const elapsed = (Date.now() - startedAt) / 1000;
      return {
        jobId, status: 'processing', position: 0,
        etaSec: Math.max(0, this.#stats.avgProcessingTimeSec - elapsed),
        enqueuedAt: this.#activeJob.enqueuedAt, startedAt, completedAt: null,
      };
    }
    const idx = this.#pending.findIndex((j) => j.jobId === jobId);
    if (idx !== -1) {
      const job = this.#pending[idx];
      const position = idx + 1;
      const actElapsed = this.#activeJob?.startedAt ? (Date.now() - this.#activeJob.startedAt) / 1000 : 0;
      const remain = this.#activeJob ? Math.max(0, this.#stats.avgProcessingTimeSec - actElapsed) : 0;
      return {
        jobId, status: 'queued', position,
        etaSec: position * this.#stats.avgProcessingTimeSec + remain,
        enqueuedAt: job.enqueuedAt, startedAt: null, completedAt: null,
      };
    }
    const d = this.#completed.get(jobId);
    if (d) return {
      jobId, status: d.status, position: 0, etaSec: 0,
      result: d.result, error: d.error,
      enqueuedAt: d.enqueuedAt, startedAt: d.startedAt, completedAt: d.completedAt,
    };
    return null;
  }

  getStats(): QueueStatsSnapshot {
    return {
      currentSize: this.#pending.length + (this.#activeJob ? 1 : 0),
      activeJobId: this.#activeJob?.jobId ?? null,
      ...this.#stats,
    };
  }

  getQueueSize(): number { return this.#pending.length; }

  __resetForTests(): void {
    if (this.#sweeperInterval) { clearInterval(this.#sweeperInterval); this.#sweeperInterval = null; }
    this.#pending = [];
    this.#activeJob = null;
    this.#completed.clear();
    this.#workerRunning = false;
    this.#stats = freshStats();
  }

  async #runWorker(): Promise<void> {
    if (this.#workerRunning) return;
    this.#workerRunning = true;
    try {
      while (this.#pending.length > 0) {
        const job = this.#pending.shift()!;
        this.#activeJob = job;
        job.startedAt = Date.now();
        const waitMs = job.startedAt - job.enqueuedAt;
        this.#stats.avgWaitTimeSec = this.#roll(this.#stats.avgWaitTimeSec, waitMs / 1000);
        console.log(`[queue] processing jobId=${job.jobId} waitedMs=${waitMs}`);
        let done: CompletedJob;
        try {
          const result = await job.jobFn();
          done = { jobId: job.jobId, status: 'done', result,
            enqueuedAt: job.enqueuedAt, startedAt: job.startedAt, completedAt: Date.now() };
          this.#stats.totalJobsCompleted += 1;
        } catch (err) {
          const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
          done = { jobId: job.jobId, status: 'failed', error: msg,
            enqueuedAt: job.enqueuedAt, startedAt: job.startedAt, completedAt: Date.now() };
          this.#stats.totalJobsFailed += 1;
        }
        const tookMs = done.completedAt - done.startedAt;
        this.#stats.avgProcessingTimeSec = this.#roll(this.#stats.avgProcessingTimeSec, tookMs / 1000);
        this.#completed.set(job.jobId, done);
        console.log(`[queue] completed jobId=${job.jobId} status=${done.status} tookMs=${tookMs}`);
        this.#activeJob = null;
      }
    } finally {
      this.#workerRunning = false;
    }
  }

  #roll(old: number, sample: number): number {
    return old === 0 ? sample : old * 0.9 + sample * 0.1;
  }

  #sweep(): void {
    const now = Date.now();
    for (const [id, job] of this.#completed) {
      if (now - job.completedAt > this.TTL_MS) this.#completed.delete(id);
    }
  }
}

/** Singleton instance. Do NOT construct new AuctionSheetQueue elsewhere. */
export const auctionSheetQueue = new AuctionSheetQueue();
export { AuctionSheetQueue };
