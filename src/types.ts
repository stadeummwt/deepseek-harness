export type ProfileType = 'core' | 'standard' | 'supreme' | 'lab';

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
  circuitState: 'HEALTHY' | 'DEGRADED' | 'RATE_LIMITED' | 'CIRCUIT_OPEN';
  score: number;
  failureDomain: string;
}

export interface BenchmarkTaskItem {
  id: string;
  suite: string;
  description: string;
  riskClass: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedType: string;
  lastScore: number;
  passed: boolean;
}

export interface SecurityTraceItem {
  id: string;
  timestamp: string;
  type: string;
  target: string;
  redactionStatus: 'CLEAN' | 'REDACTED_BY_SUPREME_OBSERVABILITY';
  contentSnippet: string;
}
