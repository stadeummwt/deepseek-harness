export type ProfileType = 'core' | 'standard' | 'supreme' | 'lab';

export type CircuitState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'RATE_LIMITED'
  | 'CIRCUIT_OPEN'
  | 'AUTH_FAILED'
  | 'PROBING';

export interface AuthProbeState {
  lastStatusCode: number; // 200, 401, 403, 429, 503
  lastProbeTimestamp: string;
  authHeaderAttached: boolean;
  tokenExpirySecondsRemaining: number;
  failureReason?: string;
  refreshCount: number;
  autoRecovering: boolean;
  measuredLatencyMs?: number;
}

export interface PluginMeta {
  id: string;
  name: string;
  category: string;
  variable: string;
  executionStatus: 'STABLE' | 'ACTIVE' | 'PENDING' | 'REJECTED';
  executionClass: 'CORE' | 'STANDARD' | 'SUPREME' | 'LAB';
  version: string;
  description: string;
  metrics: {
    invocations: number;
    latencyMs: number;
    errorRate: string;
  };
  policyGating: string;
}

export interface ModelRouteEntry {
  id: string;
  name: string;
  provider: string;
  costClass: 'FREE_CONFIRMED' | 'FREE_LIMITED' | 'TRIAL' | 'PAID' | 'UNKNOWN';
  contextCapacity: number;
  circuitState: CircuitState;
  score: number;
  failureDomain: string;
  endpoint?: string;
  authProbe?: AuthProbeState;
}

export interface ProviderStatusResult {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  statusCode: number;
  statusText: string;
  latencyMs: number;
  circuitState: CircuitState;
  reachable: boolean;
  error?: string;
  timestamp: string;
}

export interface BenchmarkTaskItem {
  id: string;
  suite: string;
  description: string;
  riskClass: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedType: string;
  lastScore: number;
  passed: boolean;
  sanitizedTracesCount?: number;
}

export interface SecurityTraceItem {
  id: string;
  timestamp: string;
  type: string;
  target: string;
  redactionStatus: 'CLEAN' | 'REDACTED_BY_SUPREME_OBSERVABILITY';
  contentSnippet: string;
}

export interface SanitizationReport {
  interceptedCount: number;
  patternsMatched: string[];
  sensitiveKeysScrubbed: string[];
  zeroLeakVerified: boolean;
  scrubbedTimestamp: string;
}

export interface SanitizedResult<T> {
  sanitized: T;
  report: SanitizationReport;
}

export interface LatencyDataPoint {
  timestamp: string;
  latencyMs: number;
  status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';
}

export interface IncidentLogEntry {
  id: string;
  timestamp: string;
  providerName: string;
  eventType: 'TRIPPED' | 'RECOVERED' | 'LATENCY_SPIKE' | 'PROBE_FAILURE' | 'PROBE_OK';
  details: string;
  statusCode: number;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
}

export interface ProviderHealthReport {
  status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL' | 'POLLING';
  healthyCount: number;
  totalCount: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  lastPollTimestamp: string;
  failedProviders: { name: string; reason: string; statusCode: number }[];
  activeCircuitBreakers: number;
  pollCycleCount: number;
  activeNode: string;
  latencyHistory?: LatencyDataPoint[];
}

export interface BatchPredictionItem {
  id: string;
  cluster: string;
  workload: string;
  actualStatus: 'STABLE' | 'UNSTABLE';
  predictedStatus: 'STABLE' | 'UNSTABLE';
  confidence: number;
  riskScore: number;
  riskClass: 'LOW' | 'MEDIUM' | 'HIGH';
  keyFactor: string;
}

export interface BatchPredictionSummary {
  totalProcessed: number;
  stableCount: number;
  unstableCount: number;
  concordanceRate: number; // match % between actual and predicted
  averageConfidence: number;
  riskBreakdown: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
  };
  predictions: BatchPredictionItem[];
  executedAt: string;
}

