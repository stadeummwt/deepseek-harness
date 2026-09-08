/**
 * @license
 * @dsh-supreme/benchmark
 * Reproducible end-to-end benchmark recording, scoring, and aggregation service for DeepSeek Harness.
 */

import { Context, Service } from 'cordis';
import fs from 'node:fs';
import path from 'node:path';
import type {
  BenchmarkRun,
  BenchmarkScore,
  BenchmarkTask,
  ExecutionClass,
  FailureClass,
} from '../../types.ts';

export interface SupremeBenchmarkConfig {
  storagePath?: string;
  maxHistoricalSamples?: number;
}

export interface ModelPerformanceAggregate {
  provider: string;
  model: string;
  sampleCount: number;
  avgQuality: number; // 0.0 to 1.0
  successRate: number; // 0.0 to 1.0
  avgLatencyMs: number;
  failureDistribution: Partial<Record<FailureClass, number>>;
}

export class SupremeBenchmarkService extends Service {
  static provide = 'supremeBenchmark';
  public config: Required<SupremeBenchmarkConfig>;
  private tasks: Map<string, BenchmarkTask> = new Map();
  private activeRuns: Map<string, Partial<BenchmarkRun>> = new Map();
  private historicalRuns: BenchmarkRun[] = [];

  constructor(ctx: Context, config: SupremeBenchmarkConfig = {}) {
    super(ctx, 'supremeBenchmark');

    const defaultPath = path.resolve(process.cwd(), 'dsh-supreme/data/benchmark/benchmarks.jsonl');
    this.config = {
      storagePath: config.storagePath ?? defaultPath,
      maxHistoricalSamples: config.maxHistoricalSamples ?? 1000,
    };

    this.ensureDirectory();
    this.loadHistoryFromDisk();
  }

  private ensureDirectory() {
    try {
      const dir = path.dirname(this.config.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // Fail-open
    }
  }

  private loadHistoryFromDisk() {
    try {
      if (!fs.existsSync(this.config.storagePath)) return;
      const content = fs.readFileSync(this.config.storagePath, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);

      for (const line of lines) {
        try {
          const record = JSON.parse(line) as BenchmarkRun;
          if (record.run_id && record.provider && record.model) {
            this.historicalRuns.push(record);
          }
        } catch {
          // Corrupt record handling: skip corrupt lines gracefully
        }
      }
    } catch {
      // Fail-open
    }
  }

  public recordTask(task: BenchmarkTask): void {
    this.tasks.set(task.task_id, task);
  }

  public getTask(taskId: string): BenchmarkTask | undefined {
    return this.tasks.get(taskId);
  }

  public startRun(
    taskId: string,
    metadata: {
      provider: string;
      model: string;
      execution_profile?: ExecutionClass;
      session_id?: string;
    }
  ): string {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const task = this.tasks.get(taskId);

    this.activeRuns.set(runId, {
      run_id: runId,
      task_id: taskId,
      task_category: task?.category || 'general',
      session_id: metadata.session_id,
      provider: metadata.provider,
      model: metadata.model,
      execution_profile: metadata.execution_profile || 'STANDARD',
      start_time: new Date().toISOString(),
      tool_count: 0,
      subagent_count: 0,
      workflow_count: 0,
    });

    return runId;
  }

  public finishRun(
    runId: string,
    outcome: {
      success: boolean;
      quality_score?: number;
      failure_class?: FailureClass;
      verification_result?: string;
      tool_count?: number;
      subagent_count?: number;
      workflow_count?: number;
    }
  ): BenchmarkRun | null {
    const active = this.activeRuns.get(runId);
    if (!active) return null;

    const endTime = new Date().toISOString();
    const startTime = active.start_time ? new Date(active.start_time).getTime() : Date.now();
    const latencyMs = Math.max(1, Date.now() - startTime);

    const completedRun: BenchmarkRun = {
      run_id: runId,
      task_id: active.task_id || 'unknown',
      task_category: active.task_category || 'general',
      session_id: active.session_id,
      provider: active.provider || 'unknown',
      model: active.model || 'unknown',
      execution_profile: active.execution_profile || 'STANDARD',
      start_time: active.start_time || endTime,
      end_time: endTime,
      latency_ms: latencyMs,
      tool_count: outcome.tool_count ?? active.tool_count ?? 0,
      subagent_count: outcome.subagent_count ?? active.subagent_count ?? 0,
      workflow_count: outcome.workflow_count ?? active.workflow_count ?? 0,
      success: outcome.success,
      quality_score: outcome.quality_score ?? (outcome.success ? 1.0 : 0.0),
      failure_class: outcome.failure_class,
      verification_result: outcome.verification_result,
    };

    this.activeRuns.delete(runId);
    this.historicalRuns.push(completedRun);

    if (this.historicalRuns.length > this.config.maxHistoricalSamples) {
      this.historicalRuns.shift();
    }

    // Persist to disk in append-only JSONL format
    try {
      fs.appendFileSync(this.config.storagePath, JSON.stringify(completedRun) + '\n', 'utf8');
    } catch {
      // Fail-open
    }

    return completedRun;
  }

  public recordScore(runId: string, score: BenchmarkScore): boolean {
    const run = this.historicalRuns.find((r) => r.run_id === runId);
    if (!run) return false;

    run.quality_score = score.quality_score;
    run.success = score.success;
    if (score.failure_class) run.failure_class = score.failure_class;
    if (score.verification_result) run.verification_result = score.verification_result;

    return true;
  }

  public queryHistory(filter?: {
    provider?: string;
    model?: string;
    category?: string;
    successOnly?: boolean;
    limit?: number;
  }): BenchmarkRun[] {
    let results = this.historicalRuns;

    if (filter?.provider) {
      results = results.filter((r) => r.provider === filter.provider);
    }
    if (filter?.model) {
      results = results.filter((r) => r.model === filter.model);
    }
    if (filter?.category) {
      results = results.filter((r) => r.task_category === filter.category);
    }
    if (filter?.successOnly) {
      results = results.filter((r) => r.success);
    }

    const limit = filter?.limit ?? 100;
    return results.slice(-limit);
  }

  /**
   * Aggregate model metrics across historical runs for router scoring
   */
  public aggregateModelPerformance(provider: string, model: string): ModelPerformanceAggregate {
    const matches = this.historicalRuns.filter((r) => r.provider === provider && r.model === model);

    if (matches.length === 0) {
      return {
        provider,
        model,
        sampleCount: 0,
        avgQuality: 0.5, // Default neutral prior
        successRate: 0.5,
        avgLatencyMs: 500,
        failureDistribution: {},
      };
    }

    const sampleCount = matches.length;
    let totalQuality = 0;
    let successCount = 0;
    let totalLatency = 0;
    const failureDist: Partial<Record<FailureClass, number>> = {};

    for (const run of matches) {
      totalQuality += run.quality_score;
      if (run.success) successCount++;
      totalLatency += run.latency_ms;

      if (run.failure_class) {
        failureDist[run.failure_class] = (failureDist[run.failure_class] || 0) + 1;
      }
    }

    return {
      provider,
      model,
      sampleCount,
      avgQuality: Number((totalQuality / sampleCount).toFixed(3)),
      successRate: Number((successCount / sampleCount).toFixed(3)),
      avgLatencyMs: Math.round(totalLatency / sampleCount),
      failureDistribution: failureDist,
    };
  }

  public getAllRecords(): BenchmarkRun[] {
    return [...this.historicalRuns];
  }
}

// Module augmentation
declare module 'cordis' {
  interface Context {
    supremeBenchmark: SupremeBenchmarkService;
  }
}

export const SupremeBenchmarkPlugin = SupremeBenchmarkService;
export default SupremeBenchmarkPlugin;
