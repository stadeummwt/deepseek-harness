/**
 * @license
 * @dsh-supreme/workflow-policy
 * Workflow governance, recursion depth limits, step budgets, and loop detection for DeepSeek Harness.
 */

import { Context, Service } from 'cordis';
import crypto from 'node:crypto';
import type {
  CostClass,
  RiskClass,
  WorkflowExecutionState,
  WorkflowStatus,
} from '../../types.ts';

export interface SupremeWorkflowPolicyConfig {
  defaultMaxDepth?: number;
  defaultMaxSteps?: number;
  loopThreshold?: number; // Repetition count triggering loop detection
}

export class SupremeWorkflowPolicyService extends Service {
  static provide = 'supremeWorkflowPolicy';
  public config: Required<SupremeWorkflowPolicyConfig>;
  private workflows: Map<string, WorkflowExecutionState> = new Map();

  constructor(ctx: Context, config: SupremeWorkflowPolicyConfig = {}) {
    super(ctx, 'supremeWorkflowPolicy');

    this.config = {
      defaultMaxDepth: config.defaultMaxDepth ?? 3,
      defaultMaxSteps: config.defaultMaxSteps ?? 20,
      loopThreshold: config.loopThreshold ?? 3,
    };
  }

  /**
   * Start and register a new governed workflow execution
   */
  public startWorkflow(params: {
    name: string;
    depth?: number;
    max_depth?: number;
    max_steps?: number;
    cost_ceiling_class?: CostClass;
    risk_class?: RiskClass;
  }): { allowed: boolean; workflow_id: string; reason?: string } {
    const policy = (this.ctx as any).supremePolicy;
    const depth = params.depth ?? 0;
    const risk = params.risk_class ?? 'LOW';

    // 1. Delegation policy evaluation
    if (policy && typeof policy.evaluateDelegation === 'function') {
      const evalRes = policy.evaluateDelegation(depth, risk);
      if (!evalRes.permitted) {
        return {
          allowed: false,
          workflow_id: '',
          reason: evalRes.reason || `Delegation denied at depth ${depth}`,
        };
      }
    }

    const workflowId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const maxDepth = params.max_depth ?? this.config.defaultMaxDepth;

    if (depth > maxDepth) {
      return {
        allowed: false,
        workflow_id: workflowId,
        reason: `Starting depth ${depth} exceeds maximum workflow depth ${maxDepth}`,
      };
    }

    const state: WorkflowExecutionState = {
      workflow_id: workflowId,
      name: params.name,
      status: 'RUNNING',
      depth,
      max_depth: maxDepth,
      step_count: 0,
      max_steps: params.max_steps ?? this.config.defaultMaxSteps,
      cost_ceiling_class: params.cost_ceiling_class ?? 'FREE_CONFIRMED',
      loop_signature_history: [],
      checkpoints: [],
    };

    this.workflows.set(workflowId, state);
    return { allowed: true, workflow_id: workflowId };
  }

  public getWorkflow(workflowId: string): WorkflowExecutionState | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Step authorization and loop detection pre-flight check
   */
  public recordStep(
    workflowId: string,
    stepName: string,
    stepPayload: any = {}
  ): { allowed: boolean; reason?: string; status: WorkflowStatus } {
    const wf = this.workflows.get(workflowId);
    if (!wf) {
      return { allowed: false, reason: 'Workflow not found', status: 'FAILED' };
    }

    if (wf.status !== 'RUNNING') {
      return { allowed: false, reason: `Workflow is not in RUNNING state (${wf.status})`, status: wf.status };
    }

    // Check step count limit
    if (wf.step_count >= wf.max_steps) {
      wf.status = 'MAX_STEPS_EXCEEDED';
      return { allowed: false, reason: `Maximum step budget ${wf.max_steps} exceeded`, status: wf.status };
    }

    // Loop detection via cryptographic signature of step name and payload
    const payloadStr = typeof stepPayload === 'object' ? JSON.stringify(stepPayload) : String(stepPayload);
    const sig = crypto.createHash('sha256').update(`${stepName}:${payloadStr}`).digest('hex').slice(0, 16);

    wf.loop_signature_history.push(sig);

    // Count identical consecutive or recent signatures
    const recentSigs = wf.loop_signature_history.slice(-10);
    const count = recentSigs.filter((s) => s === sig).length;

    if (count >= this.config.loopThreshold) {
      wf.status = 'LOOP_DETECTED';
      return {
        allowed: false,
        reason: `Repetitive loop detected: signature '${sig}' repeated ${count} times`,
        status: wf.status,
      };
    }

    wf.step_count++;
    return { allowed: true, status: 'RUNNING' };
  }

  /**
   * Record a verification checkpoint
   */
  public recordCheckpoint(
    workflowId: string,
    checkpointName: string,
    passed: boolean,
    details?: string
  ): { ok: boolean; status: WorkflowStatus } {
    const wf = this.workflows.get(workflowId);
    if (!wf) return { ok: false, status: 'FAILED' };

    wf.checkpoints.push({
      checkpoint_name: checkpointName,
      passed,
      timestamp: new Date().toISOString(),
      details: (details || '').slice(0, 200),
    });

    if (!passed) {
      wf.status = 'VERIFICATION_FAILED';
      return { ok: false, status: 'VERIFICATION_FAILED' };
    }

    return { ok: true, status: wf.status };
  }

  public completeWorkflow(workflowId: string, success: boolean): void {
    const wf = this.workflows.get(workflowId);
    if (wf && wf.status === 'RUNNING') {
      wf.status = success ? 'COMPLETED' : 'FAILED';
    }
  }

  public cancelWorkflow(workflowId: string, reason: string = 'User cancelled'): void {
    const wf = this.workflows.get(workflowId);
    if (wf) {
      wf.status = 'CANCELLED';
    }
  }

  public listActiveWorkflows(): WorkflowExecutionState[] {
    return Array.from(this.workflows.values()).filter((w) => w.status === 'RUNNING');
  }
}

// Module augmentation
declare module 'cordis' {
  interface Context {
    supremeWorkflowPolicy: SupremeWorkflowPolicyService;
  }
}

export const SupremeWorkflowPolicyPlugin = SupremeWorkflowPolicyService;
export default SupremeWorkflowPolicyPlugin;
