/**
 * @license
 * @dsh-supreme/observability
 * Safe runtime operational event tracing with append-only JSONL storage and secret redaction.
 */

import { Context, Service } from 'cordis';
import fs from 'node:fs';
import path from 'node:path';
import type { SafeObservabilityEvent } from '../../types.ts';

export interface SupremeObservabilityConfig {
  enabled?: boolean;
  logPath?: string;
  bufferFlushIntervalMs?: number;
  maxMemoryEvents?: number;
}

// Secret keywords to detect and sanitize
const FORBIDDEN_SECRET_KEYS = [
  'key',
  'secret',
  'token',
  'auth',
  'password',
  'credential',
  'authorization',
  'cookie',
  'bearer',
  'prompt',
  'response',
];

export class SupremeObservabilityService extends Service {
  static provide = 'supremeObservability';
  public config: Required<SupremeObservabilityConfig>;
  private buffer: SafeObservabilityEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private memoryHistory: SafeObservabilityEvent[] = [];
  private writeErrorsCount: number = 0;

  constructor(ctx: Context, config: SupremeObservabilityConfig = {}) {
    super(ctx, 'supremeObservability');

    const enabled = config.enabled ?? true;
    const defaultLogPath = path.resolve(process.cwd(), 'dsh-supreme/data/observability/traces.jsonl');
    const logPath = config.logPath ?? defaultLogPath;

    this.config = {
      enabled,
      logPath,
      bufferFlushIntervalMs: config.bufferFlushIntervalMs ?? 500,
      maxMemoryEvents: config.maxMemoryEvents ?? 200,
    };

    if (this.config.enabled) {
      this.ensureDirectory();
      this.startFlushTimer();
      this.attachLifecycleHooks(ctx);
    }
  }

  private ensureDirectory() {
    try {
      const dir = path.dirname(this.config.logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // Fail-open: write error counter incremented, never throws
      this.writeErrorsCount++;
    }
  }

  private startFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flushSync();
    }, this.config.bufferFlushIntervalMs);
  }

  private stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private attachLifecycleHooks(ctx: Context) {
    // Listen to standard Cordis / DSH lifecycle events
    ctx.on('internal/service', (name, val) => {
      if (name !== 'supremeObservability') {
        this.recordEvent({
          event_id: `evt-svc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          type: 'service:registered',
          metadata: { serviceName: String(name), available: !!val },
        });
      }
    });

    // Handle context disposal
    (ctx as any).on('dispose', () => {
      this.disposeService();
    });
  }

  /**
   * Deterministic allowlisting and sanitization.
   * Strips all potential secret fields, headers, and tokens.
   */
  public sanitizeMetadata(meta?: Record<string, any>): Record<string, string | number | boolean | null> {
    if (!meta || typeof meta !== 'object') return {};

    const sanitized: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(meta)) {
      const lowerKey = k.toLowerCase();
      const isForbidden = FORBIDDEN_SECRET_KEYS.some((fk) => lowerKey.includes(fk));
      if (isForbidden) {
        // Redact completely
        sanitized[k] = '[REDACTED_BY_SUPREME_OBSERVABILITY]';
        continue;
      }

      if (typeof v === 'string') {
        // If the string contains Bearer or token patterns, redact
        if (/bearer\s+[a-zA-Z0-9_\-\.]+/i.test(v) || /key-[a-zA-Z0-9]+/i.test(v) || /SENTINEL_SECRET/i.test(v)) {
          sanitized[k] = '[REDACTED_BY_SUPREME_OBSERVABILITY]';
        } else {
          sanitized[k] = v.slice(0, 200); // Bounded size
        }
      } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
        sanitized[k] = v;
      } else {
        sanitized[k] = String(v).slice(0, 100);
      }
    }
    return sanitized;
  }

  /**
   * Record a safe operational event
   */
  public recordEvent(event: SafeObservabilityEvent): boolean {
    if (!this.config.enabled) return false;

    const safeEvent: SafeObservabilityEvent = {
      event_id: event.event_id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: event.timestamp || new Date().toISOString(),
      type: event.type,
      session_id: event.session_id,
      turn_id: event.turn_id,
      correlation_id: event.correlation_id,
      provider: event.provider,
      model: event.model,
      latency_ms: event.latency_ms,
      ttft_ms: event.ttft_ms,
      tool_name: event.tool_name,
      tool_latency_ms: event.tool_latency_ms,
      subagent_provider: event.subagent_provider,
      workflow_step: event.workflow_step,
      compaction_occurred: event.compaction_occurred,
      token_pressure: event.token_pressure,
      error_class: event.error_class,
      verification_outcome: event.verification_outcome,
      routing_decision_id: event.routing_decision_id,
      benchmark_run_id: event.benchmark_run_id,
      metadata: this.sanitizeMetadata(event.metadata),
    };

    // Store in bounded memory history
    this.memoryHistory.push(safeEvent);
    if (this.memoryHistory.length > this.config.maxMemoryEvents) {
      this.memoryHistory.shift();
    }

    // Push to write buffer
    this.buffer.push(safeEvent);

    if (this.buffer.length >= 20) {
      this.flushSync();
    }

    return true;
  }

  /**
   * Synchronously flush buffer to disk in append-only JSONL format (fail-open)
   */
  public flushSync(): void {
    if (this.buffer.length === 0) return;

    const eventsToWrite = this.buffer.splice(0);
    const lines = eventsToWrite.map((evt) => JSON.stringify(evt)).join('\n') + '\n';

    try {
      fs.appendFileSync(this.config.logPath, lines, { encoding: 'utf8' });
    } catch {
      // Fail-open: Never crash agent
      this.writeErrorsCount += eventsToWrite.length;
    }
  }

  public getRecentEvents(count: number = 50): SafeObservabilityEvent[] {
    return this.memoryHistory.slice(-count);
  }

  public getWriteErrorCount(): number {
    return this.writeErrorsCount;
  }

  public disposeService(): void {
    this.stopFlushTimer();
    this.flushSync();
  }
}

// Module augmentation
declare module 'cordis' {
  interface Context {
    supremeObservability: SupremeObservabilityService;
  }
}

export const SupremeObservabilityPlugin = SupremeObservabilityService;
export default SupremeObservabilityPlugin;
