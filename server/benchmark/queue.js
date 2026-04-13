/**
 * In-Memory Benchmark Job Queue
 *
 * Simple queue with concurrency limiting for Playwright browser instances.
 * No Redis needed — this is sufficient for v1 launch traffic.
 *
 * Features:
 * - Max concurrent jobs (default 3 — one Chromium per job)
 * - Max queue depth (default 20 — reject new jobs when full)
 * - Job timeout (default 5 minutes — kill runaway benchmarks)
 * - Event callbacks for real-time status updates
 */

const { v4: uuidv4 } = require('uuid');

const DEFAULT_CONCURRENCY = 2; // Lower concurrency — 10 runs per benchmark is CPU-heavy
const DEFAULT_MAX_DEPTH = 20;
const DEFAULT_TIMEOUT_MS = 8 * 60 * 1000; // 8 min — 10 runs + AI analysis

class BenchmarkQueue {
  constructor(options = {}) {
    this.concurrency = options.concurrency || DEFAULT_CONCURRENCY;
    this.maxDepth = options.maxDepth || DEFAULT_MAX_DEPTH;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    this.pending = [];     // Jobs waiting to run
    this.active = new Map(); // jobId → { job, timeoutHandle }
    this.completed = new Map(); // jobId → result (kept briefly for polling)
  }

  /**
   * Add a job to the queue.
   * @param {function} taskFn - Async function to execute. Receives (jobId, onProgress).
   * @returns {{ jobId: string, position: number } | null} - null if queue is full
   */
  enqueue(taskFn) {
    if (this.pending.length >= this.maxDepth) {
      return null; // Queue full
    }

    const jobId = uuidv4().substring(0, 12);
    const job = {
      id: jobId,
      taskFn,
      status: 'queued',
      createdAt: Date.now(),
      onProgress: null, // Set by caller
    };

    this.pending.push(job);
    this._tryProcessNext();

    return {
      jobId,
      position: this.pending.length,
      queueDepth: this.pending.length,
      activeCount: this.active.size,
    };
  }

  /**
   * Get current queue status.
   */
  getStatus() {
    return {
      pending: this.pending.length,
      active: this.active.size,
      capacity: this.concurrency,
      maxDepth: this.maxDepth,
      estimatedWaitSec: this.pending.length > 0
        ? Math.round(this.pending.length * 120) // ~2min per benchmark (10 runs + analysis)
        : 0,
    };
  }

  /**
   * Get status of a specific job.
   */
  getJobStatus(jobId) {
    // Check active
    const active = this.active.get(jobId);
    if (active) return { status: 'running', jobId };

    // Check pending
    const pendingIdx = this.pending.findIndex(j => j.id === jobId);
    if (pendingIdx >= 0) return { status: 'queued', jobId, position: pendingIdx + 1 };

    // Check completed
    const completed = this.completed.get(jobId);
    if (completed) return { status: 'completed', jobId, result: completed };

    return { status: 'not_found', jobId };
  }

  /**
   * Try to start the next pending job if under concurrency limit.
   */
  _tryProcessNext() {
    while (this.active.size < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      this._runJob(job);
    }
  }

  async _runJob(job) {
    job.status = 'running';

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      console.error(`[queue] Job ${job.id} timed out after ${this.timeoutMs / 1000}s`);
      this._completeJob(job.id, { error: 'Benchmark timed out' });
    }, this.timeoutMs);

    this.active.set(job.id, { job, timeoutHandle });

    try {
      const result = await job.taskFn(job.id);
      this._completeJob(job.id, { success: true, data: result });
    } catch (err) {
      console.error(`[queue] Job ${job.id} failed:`, err.message);
      this._completeJob(job.id, { error: err.message });
    }
  }

  _completeJob(jobId, result) {
    const active = this.active.get(jobId);
    if (active) {
      clearTimeout(active.timeoutHandle);
      this.active.delete(jobId);
    }

    // Store result briefly for polling (auto-cleanup after 5 min)
    this.completed.set(jobId, result);
    setTimeout(() => this.completed.delete(jobId), 5 * 60 * 1000);

    // Process next in queue
    this._tryProcessNext();
  }
}

// Singleton instance
const benchmarkQueue = new BenchmarkQueue();

module.exports = { BenchmarkQueue, benchmarkQueue };
