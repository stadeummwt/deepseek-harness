/**
 * @license
 * @dsh-supreme/policy
 * Centralized deterministic project policy, cost gating, and risk evaluation.
 */

import { Context, Service } from 'cordis';
import type {
  CostClass,
  ExecutionClass,
  RiskClass,
  VerificationLevel,
} from '../../types.ts';

export interface SupremePolicyConfig {
  executionClass?: ExecutionClass;
  allowPaid?: boolean;
  allowTrial?: boolean;
  allowUnknownCost?: boolean;
  requireVerificationForHighRisk?: boolean;
  maxDelegationDepth?: number;
  forbiddenProviders?: string[];
  allowedCostClasses?: CostClass[];
}

export interface RouteEvaluationResult {
  permitted: boolean;
  reason: string;
  costClass: CostClass;
  executionClass: ExecutionClass;
}

export interface DelegationEvaluationResult {
  permitted: boolean;
  maxDepth: number;
  currentDepth: number;
  reason?: string;
}

export class SupremePolicyService extends Service {
  static provide = 'supremePolicy';
  public config: Required<SupremePolicyConfig>;

  constructor(ctx: Context, config: SupremePolicyConfig = {}) {
    super(ctx, 'supremePolicy');

    const executionClass = config.executionClass || 'STANDARD';
    const isLab = executionClass === 'LAB';

    const allowPaid = isLab ? (config.allowPaid ?? false) : false;
    const allowTrial = isLab ? (config.allowTrial ?? false) : false;
    const allowUnknownCost = isLab ? (config.allowUnknownCost ?? false) : false;

    const defaultAllowed: CostClass[] = ['FREE_CONFIRMED', 'FREE_LIMITED'];
    if (allowTrial) defaultAllowed.push('TRIAL');
    if (allowPaid) defaultAllowed.push('PAID');
    if (allowUnknownCost) defaultAllowed.push('UNKNOWN');

    // Production defaults: Conservative security by default
    this.config = {
      executionClass,
      allowPaid,
      allowTrial,
      allowUnknownCost,
      requireVerificationForHighRisk: config.requireVerificationForHighRisk ?? true,
      maxDelegationDepth: config.maxDelegationDepth ?? 3,
      forbiddenProviders: config.forbiddenProviders ?? [],
      allowedCostClasses: config.allowedCostClasses ?? defaultAllowed,
    };
  }

  /**
   * Evaluate whether a candidate route is permitted by current policy
   */
  public evaluateRoute(
    candidate: { cost_class: CostClass; provider?: string; model?: string },
    context?: { executionClass?: ExecutionClass }
  ): RouteEvaluationResult {
    const effectiveExecClass = context?.executionClass || this.config.executionClass;
    const costClass = candidate.cost_class || 'UNKNOWN';

    // Check provider blocklist
    if (candidate.provider && this.config.forbiddenProviders.includes(candidate.provider)) {
      return {
        permitted: false,
        reason: `Provider '${candidate.provider}' is explicitly blocked by policy`,
        costClass,
        executionClass: effectiveExecClass,
      };
    }

    // Gating rule: UNKNOWN must never be permitted implicitly
    if (costClass === 'UNKNOWN' && !this.config.allowUnknownCost) {
      return {
        permitted: false,
        reason: 'Cost class UNKNOWN is denied by conservative policy (UNKNOWN -> DENY)',
        costClass,
        executionClass: effectiveExecClass,
      };
    }

    // Gating rule: PAID is denied unless explicitly permitted in LAB
    if (costClass === 'PAID' && !this.config.allowPaid) {
      return {
        permitted: false,
        reason: 'Cost class PAID is denied by default policy (No paid fallback permitted)',
        costClass,
        executionClass: effectiveExecClass,
      };
    }

    // Gating rule: TRIAL is denied unless permitted
    if (costClass === 'TRIAL' && !this.config.allowTrial) {
      return {
        permitted: false,
        reason: 'Cost class TRIAL is denied by policy',
        costClass,
        executionClass: effectiveExecClass,
      };
    }

    // Check allowedCostClasses
    if (!this.config.allowedCostClasses.includes(costClass)) {
      return {
        permitted: false,
        reason: `Cost class ${costClass} is not in allowed list [${this.config.allowedCostClasses.join(', ')}]`,
        costClass,
        executionClass: effectiveExecClass,
      };
    }

    return {
      permitted: true,
      reason: 'Route permitted by policy',
      costClass,
      executionClass: effectiveExecClass,
    };
  }

  /**
   * Evaluate whether delegation to a subagent or workflow is permitted
   */
  public evaluateDelegation(
    depth: number,
    risk: RiskClass,
    targetProvider?: string
  ): DelegationEvaluationResult {
    if (depth >= this.config.maxDelegationDepth) {
      return {
        permitted: false,
        maxDepth: this.config.maxDelegationDepth,
        currentDepth: depth,
        reason: `Delegation depth ${depth} exceeds maximum bounded depth ${this.config.maxDelegationDepth}`,
      };
    }

    if (risk === 'HIGH' && depth > 1 && this.config.executionClass !== 'LAB') {
      return {
        permitted: false,
        maxDepth: this.config.maxDelegationDepth,
        currentDepth: depth,
        reason: 'Recursive delegation for HIGH risk tasks is denied in production profiles',
      };
    }

    if (targetProvider && this.config.forbiddenProviders.includes(targetProvider)) {
      return {
        permitted: false,
        maxDepth: this.config.maxDelegationDepth,
        currentDepth: depth,
        reason: `Delegation target provider '${targetProvider}' is forbidden`,
      };
    }

    return {
      permitted: true,
      maxDepth: this.config.maxDelegationDepth,
      currentDepth: depth,
    };
  }

  /**
   * Return the required verification level based on task risk and cost
   */
  public verificationRequirement(risk: RiskClass, cost: CostClass = 'FREE_CONFIRMED'): VerificationLevel {
    if (risk === 'HIGH') {
      return 'STRICT';
    }
    if (risk === 'MEDIUM' || cost === 'PAID' || cost === 'TRIAL') {
      return 'REQUIRED';
    }
    return 'BASIC';
  }

  /**
   * Return execution policy details for an execution class
   */
  public executionPolicy(executionClass: ExecutionClass): SupremePolicyConfig {
    return {
      executionClass,
      allowPaid: executionClass === 'LAB',
      allowTrial: executionClass === 'LAB',
      allowUnknownCost: false,
      requireVerificationForHighRisk: true,
      maxDelegationDepth: executionClass === 'CORE' ? 1 : executionClass === 'STANDARD' ? 2 : 3,
    };
  }

  public getSanitizedConfig(): Record<string, any> {
    return {
      executionClass: this.config.executionClass,
      allowPaid: this.config.allowPaid,
      allowTrial: this.config.allowTrial,
      allowUnknownCost: this.config.allowUnknownCost,
      requireVerificationForHighRisk: this.config.requireVerificationForHighRisk,
      maxDelegationDepth: this.config.maxDelegationDepth,
      allowedCostClasses: this.config.allowedCostClasses,
    };
  }
}

// Module augmentation for Cordis Context
declare module 'cordis' {
  interface Context {
    supremePolicy: SupremePolicyService;
  }
}

export const SupremePolicyPlugin = SupremePolicyService;
export default SupremePolicyPlugin;
