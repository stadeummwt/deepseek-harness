/**
 * @license
 * DSH Supreme v1 — Master Plugin Suite
 * Canonical types and interfaces
 */

export type ExecutionClass = 'CORE' | 'STANDARD' | 'SUPREME' | 'LAB';

export type CostClass = 'FREE_CONFIRMED' | 'FREE_LIMITED' | 'TRIAL' | 'PAID' | 'UNKNOWN';

export type RiskClass = 'LOW' | 'MEDIUM' | 'HIGH';

export type VerificationLevel = 'NONE' | 'BASIC' | 'REQUIRED' | 'STRICT';

export type FailureClass =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'QUOTA'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'SERVER'
  | 'INVALID_MODEL'
  | 'INVALID_SCHEMA'
  | 'WRONG_TOOL'
  | 'TOOL_EXECUTION'
  | 'WRONG_ANSWER'
  | 'FORMAT'
  | 'CONTEXT'
  | 'COST_POLICY'
  | 'VERIFICATION'
  | 'UNKNOWN';

export type CircuitBreakerState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'RATE_LIMITED'
  | 'QUOTA_EXHAUSTED'
  | 'AUTH_FAILED'
  | 'MODEL_INVALID'
  | 'PROVIDER_DOWN'
  | 'UNKNOWN'
  | 'CIRCUIT_OPEN';

export type MemoryClass = 'CORE_PROFILE' | 'PROJECT_CONTEXT' | 'TASK_RELEVANT' | 'LONG_TERM';

export type WorkflowDecision = 'DIRECT' | 'SUBAGENT' | 'WORKFLOW' | 'SUPREME_WORKFLOW' | 'DENY';

export type WorkflowStatus =
  | 'INITIALIZING'
  | 'RUNNING'
  | 'HALTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'LOOP_DETECTED'
  | 'MAX_STEPS_EXCEEDED'
  | 'STEP_BUDGET_EXCEEDED'
  | 'VERIFICATION_FAILED'
  | 'CANCELLED';

export interface WorkflowExecutionState {
  workflow_id: string;
  name?: string;
  depth: number;
  max_depth: number;
  step_count: number;
  max_steps: number;
  cost_ceiling_class?: CostClass;
  status: WorkflowStatus;
  loop_signature_history?: string[];
  step_history?: Array<{
    step_id: string;
    signature_hash: string;
    tool_name?: string;
    action_type: string;
    timestamp: string;
  }>;
  checkpoints: Array<{
    checkpoint_name: string;
    passed: boolean;
    timestamp: string;
    details?: string;
  }>;
}

// Observability types
export interface SafeObservabilityEvent {
  event_id: string;
  timestamp: string;
  type: string;
  session_id?: string;
  turn_id?: string | number;
  correlation_id?: string;
  provider?: string;
  model?: string;
  latency_ms?: number;
  ttft_ms?: number;
  tool_name?: string;
  tool_latency_ms?: number;
  subagent_provider?: string;
  workflow_step?: string;
  compaction_occurred?: boolean;
  token_pressure?: number;
  error_class?: string;
  verification_outcome?: string;
  routing_decision_id?: string;
  benchmark_run_id?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

// Benchmark types
export interface BenchmarkTask {
  task_id: string;
  category: 'code' | 'reasoning' | 'tool_use' | 'formatting' | 'long_context';
  description: string;
  expected_output_type: string;
  validator_id?: string;
  risk_class: RiskClass;
}

export interface BenchmarkRun {
  run_id: string;
  task_id: string;
  task_category: string;
  session_id?: string;
  provider: string;
  model: string;
  execution_profile: ExecutionClass;
  start_time: string;
  end_time: string;
  latency_ms: number;
  ttft_ms?: number;
  tool_count: number;
  subagent_count: number;
  workflow_count: number;
  success: boolean;
  quality_score: number; // 0.0 to 1.0
  failure_class?: FailureClass;
  verification_result?: string;
}

export interface BenchmarkScore {
  quality_score: number;
  success: boolean;
  failure_class?: FailureClass;
  verification_result?: string;
  notes?: string;
}

// Router Candidate & Decision types
export interface ModelCandidate {
  provider: string;
  model: string;
  family?: string;
  cost_class: CostClass;
  capabilities: string[]; // e.g. ['tools', 'vision', 'reasoning', 'json']
  context_capacity: number; // in tokens
  health_state: CircuitBreakerState;
  quota_state: {
    available_tokens: number;
    headroom_ratio: number; // 0.0 to 1.0
  };
  recent_reliability: number; // 0.0 to 1.0
  recent_latency_ms: number;
  failure_domain: string; // e.g. 'us-east', 'eu-west', 'local'
  last_verified_time?: string;
}

export interface RouteRequest {
  task_category?: string;
  prompt_tokens: number;
  required_capabilities?: string[];
  risk_class?: RiskClass;
  session_id?: string;
}

export interface RouteDecision {
  decision_id: string;
  provider: string | null;
  model: string | null;
  score: number;
  hard_gate_results: Record<string, boolean>;
  reason_codes: string[];
  degraded: boolean;
  blocked: boolean;
  alternatives: Array<{ provider: string; model: string; score: number }>;
}

// Verifier types
export type ValidatorType =
  | 'exact-text'
  | 'regex'
  | 'json-parse'
  | 'json-schema'
  | 'file-exists'
  | 'file-hash'
  | 'command-exit'
  | 'test-suite'
  | 'custom';

export interface ValidatorResult {
  validator_id: string;
  status: 'PASS' | 'FAIL' | 'ERROR' | 'UNAVAILABLE';
  evidence: string;
  duration_ms: number;
  reason_code: string;
}

// Memory Policy types
export interface MemoryItem {
  id: string;
  memory_class: MemoryClass;
  source: string;
  content: string;
  estimated_size?: number;
  priority: number; // higher = more important
  reason?: string;
}

export interface MemorySelectionResult {
  selected_items: MemoryItem[];
  total_size: number;
  budget: number;
  rejection_count: number;
}

// Workflow Policy types
export interface WorkflowTaskRequest {
  task_id: string;
  complexity: 'simple' | 'moderate' | 'complex';
  parallelizable: boolean;
  risk_class: RiskClass;
  required_capabilities: string[];
  sensitive_credentials_needed?: boolean;
  paths?: string[];
}

export interface WorkflowPolicyDecision {
  decision_id: string;
  decision: WorkflowDecision;
  max_concurrent_agents: number;
  max_depth: number;
  timeout_ms: number;
  verification_requirement: VerificationLevel;
  degradation_path: WorkflowDecision[];
  reason: string;
  delegation_scope?: {
    task: string;
    allowed_paths: string[];
    forbidden_paths: string[];
    write_permission: boolean;
    secret_access: boolean;
  };
}
