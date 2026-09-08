/**
 * @license
 * @dsh-supreme/router
 * Multi-factor weighted LLM model and provider routing engine with hard policy gates and circuit breakers.
 */

import { Context, Service } from 'cordis';
import type {
  CircuitBreakerState,
  CostClass,
  ExecutionClass,
  ModelCandidate,
  RouteDecision,
  RouteRequest,
} from '../../types.ts';

export interface RouterWeights {
  historicalQuality: number; // 0.30
  health: number;            // 0.20
  quotaHeadroom: number;     // 0.15
  reliability: number;       // 0.10
  latency: number;           // 0.10
  capabilityFit: number;     // 0.10
  failureDiversity: number;  // 0.05
}

export interface SupremeRouterConfig {
  minHistoricalSamples?: number;
  weights?: Partial<RouterWeights>;
  defaultFailureDomain?: string;
}

export class SupremeRouterService extends Service {
  static provide = 'supremeRouter';
  public config: Required<Omit<SupremeRouterConfig, 'weights'>> & { weights: RouterWeights };
  private candidates: Map<string, ModelCandidate> = new Map();
  private circuitBreakers: Map<string, { state: CircuitBreakerState; failureCount: number; lastFailureTime: number }> = new Map();

  constructor(ctx: Context, config: SupremeRouterConfig = {}) {
    super(ctx, 'supremeRouter');

    const rawWeights: RouterWeights = {
      historicalQuality: config.weights?.historicalQuality ?? 0.30,
      health: config.weights?.health ?? 0.20,
      quotaHeadroom: config.weights?.quotaHeadroom ?? 0.15,
      reliability: config.weights?.reliability ?? 0.10,
      latency: config.weights?.latency ?? 0.10,
      capabilityFit: config.weights?.capabilityFit ?? 0.10,
      failureDiversity: config.weights?.failureDiversity ?? 0.05,
    };

    // Normalize weights to sum strictly to 1.0
    const totalWeight = Object.values(rawWeights).reduce((a, b) => a + b, 0);
    const normalizedWeights: RouterWeights = {
      historicalQuality: rawWeights.historicalQuality / totalWeight,
      health: rawWeights.health / totalWeight,
      quotaHeadroom: rawWeights.quotaHeadroom / totalWeight,
      reliability: rawWeights.reliability / totalWeight,
      latency: rawWeights.latency / totalWeight,
      capabilityFit: rawWeights.capabilityFit / totalWeight,
      failureDiversity: rawWeights.failureDiversity / totalWeight,
    };

    this.config = {
      minHistoricalSamples: config.minHistoricalSamples ?? 5,
      defaultFailureDomain: config.defaultFailureDomain ?? 'default',
      weights: normalizedWeights,
    };
  }

  public registerCandidate(candidate: ModelCandidate): void {
    const key = `${candidate.provider}/${candidate.model}`;
    this.candidates.set(key, candidate);
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, { state: candidate.health_state, failureCount: 0, lastFailureTime: 0 });
    }
  }

  public getCandidate(provider: string, model: string): ModelCandidate | undefined {
    return this.candidates.get(`${provider}/${model}`);
  }

  public listCandidates(): ModelCandidate[] {
    return Array.from(this.candidates.values());
  }

  public tripCircuit(provider: string, model: string, state: CircuitBreakerState = 'CIRCUIT_OPEN'): void {
    const key = `${provider}/${model}`;
    const cb = this.circuitBreakers.get(key) || { state: 'HEALTHY', failureCount: 0, lastFailureTime: 0 };
    cb.state = state;
    cb.failureCount++;
    cb.lastFailureTime = Date.now();
    this.circuitBreakers.set(key, cb);

    const cand = this.candidates.get(key);
    if (cand) {
      cand.health_state = state;
    }
  }

  public resetCircuit(provider: string, model: string): void {
    const key = `${provider}/${model}`;
    this.circuitBreakers.set(key, { state: 'HEALTHY', failureCount: 0, lastFailureTime: 0 });
    const cand = this.candidates.get(key);
    if (cand) {
      cand.health_state = 'HEALTHY';
    }
  }

  /**
   * Evaluate a candidate against hard gates
   */
  private checkHardGates(
    cand: ModelCandidate,
    req: RouteRequest,
    policyService?: any
  ): { passed: boolean; gateResults: Record<string, boolean>; reasons: string[] } {
    const gateResults: Record<string, boolean> = {};
    const reasons: string[] = [];

    // 1. Policy Gate (Cost Class check)
    if (policyService && typeof policyService.evaluateRoute === 'function') {
      const polEval = policyService.evaluateRoute({
        cost_class: cand.cost_class,
        provider: cand.provider,
        model: cand.model,
      });
      gateResults.policy = polEval.permitted;
      if (!polEval.permitted) {
        reasons.push(polEval.reason || `Policy denied cost class ${cand.cost_class}`);
      }
    } else {
      // Conservative default if policy not injected: reject PAID and UNKNOWN
      gateResults.policy = cand.cost_class === 'FREE_CONFIRMED' || cand.cost_class === 'FREE_LIMITED';
      if (!gateResults.policy) {
        reasons.push(`Policy denied ${cand.cost_class} (fallback conservative gating)`);
      }
    }

    // 2. Health & Circuit Breaker Gate
    const key = `${cand.provider}/${cand.model}`;
    const cb = this.circuitBreakers.get(key);
    const health = cb?.state || cand.health_state;
    const isUnhealthy = health === 'CIRCUIT_OPEN' || health === 'PROVIDER_DOWN' || health === 'AUTH_FAILED';
    gateResults.health = !isUnhealthy;
    if (isUnhealthy) {
      reasons.push(`Health circuit gate closed (state: ${health})`);
    }

    // 3. Context Capacity Gate
    const hasCapacity = cand.context_capacity >= req.prompt_tokens;
    gateResults.contextCapacity = hasCapacity;
    if (!hasCapacity) {
      reasons.push(`Context insufficient: required ${req.prompt_tokens} tokens, capacity ${cand.context_capacity}`);
    }

    // 4. Required Capabilities Gate
    if (req.required_capabilities && req.required_capabilities.length > 0) {
      const missing = req.required_capabilities.filter((rc) => !cand.capabilities.includes(rc));
      gateResults.capabilities = missing.length === 0;
      if (missing.length > 0) {
        reasons.push(`Missing required capabilities: [${missing.join(', ')}]`);
      }
    } else {
      gateResults.capabilities = true;
    }

    // 5. Quota Gate
    const hasQuota = cand.quota_state.headroom_ratio > 0;
    gateResults.quota = hasQuota;
    if (!hasQuota) {
      reasons.push('Quota headroom exhausted');
    }

    const passed = Object.values(gateResults).every((v) => v === true);
    return { passed, gateResults, reasons };
  }

  /**
   * Multi-factor scoring for eligible candidates
   */
  private calculateScore(
    cand: ModelCandidate,
    req: RouteRequest,
    benchmarkService?: any
  ): { score: number; isHistoricalActive: boolean } {
    const w = this.config.weights;

    // 1. Historical Quality
    let histQuality = 0.5;
    let isHistoricalActive = false;
    if (benchmarkService && typeof benchmarkService.aggregateModelPerformance === 'function') {
      const agg = benchmarkService.aggregateModelPerformance(cand.provider, cand.model);
      if (agg.sampleCount >= this.config.minHistoricalSamples) {
        histQuality = agg.avgQuality;
        isHistoricalActive = true;
      }
    }

    // 2. Health Score
    const key = `${cand.provider}/${cand.model}`;
    const cb = this.circuitBreakers.get(key);
    const healthState = cb?.state || cand.health_state;
    const healthScore = healthState === 'HEALTHY' ? 1.0 : healthState === 'DEGRADED' ? 0.6 : 0.2;

    // 3. Quota Headroom
    const quotaScore = Math.min(1.0, Math.max(0.0, cand.quota_state.headroom_ratio));

    // 4. Reliability
    const relScore = Math.min(1.0, Math.max(0.0, cand.recent_reliability));

    // 5. Latency (Normalized: lower latency is better, max baseline 2000ms)
    const latNorm = Math.max(0.0, 1.0 - Math.min(cand.recent_latency_ms, 2000) / 2000);

    // 6. Capability Fit
    const capScore = req.required_capabilities?.length
      ? req.required_capabilities.filter((c) => cand.capabilities.includes(c)).length / req.required_capabilities.length
      : 1.0;

    // 7. Failure Diversity
    const diversityScore = cand.failure_domain !== this.config.defaultFailureDomain ? 1.0 : 0.5;

    const finalScore =
      w.historicalQuality * histQuality +
      w.health * healthScore +
      w.quotaHeadroom * quotaScore +
      w.reliability * relScore +
      w.latency * latNorm +
      w.capabilityFit * capScore +
      w.failureDiversity * diversityScore;

    return {
      score: Number(finalScore.toFixed(4)),
      isHistoricalActive,
    };
  }

  /**
   * Main route selection method
   */
  public selectRoute(req: RouteRequest): RouteDecision {
    const decisionId = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const allCandidates = Array.from(this.candidates.values());

    const policy = (this.ctx as any).supremePolicy;
    const benchmark = (this.ctx as any).supremeBenchmark;
    const observability = (this.ctx as any).supremeObservability;

    const evaluated: Array<{
      cand: ModelCandidate;
      passedGates: boolean;
      gateResults: Record<string, boolean>;
      reasons: string[];
      score: number;
    }> = [];

    for (const cand of allCandidates) {
      const gateCheck = this.checkHardGates(cand, req, policy);
      let score = 0;
      if (gateCheck.passed) {
        const scored = this.calculateScore(cand, req, benchmark);
        score = scored.score;
      }
      evaluated.push({
        cand,
        passedGates: gateCheck.passed,
        gateResults: gateCheck.gateResults,
        reasons: gateCheck.reasons,
        score,
      });
    }

    const eligible = evaluated.filter((e) => e.passedGates).sort((a, b) => b.score - a.score);

    // No paid fallback rule:
    // If no candidate passed hard gates, return BLOCKED_NO_ELIGIBLE_ROUTE
    if (eligible.length === 0) {
      const decision: RouteDecision = {
        decision_id: decisionId,
        provider: null,
        model: null,
        score: 0,
        hard_gate_results: evaluated[0]?.gateResults || {},
        reason_codes: ['BLOCKED_NO_ELIGIBLE_ROUTE', ...evaluated.flatMap((e) => e.reasons)],
        degraded: false,
        blocked: true,
        alternatives: [],
      };

      if (observability) {
        observability.recordEvent({
          event_id: `evt-${decisionId}`,
          timestamp: new Date().toISOString(),
          type: 'route:decision',
          routing_decision_id: decisionId,
          error_class: 'COST_POLICY_OR_CAPACITY_BLOCKED',
          metadata: { blocked: true, candidateCount: allCandidates.length },
        });
      }

      return decision;
    }

    const winner = eligible[0];
    const isDegraded = winner.cand.health_state === 'DEGRADED';

    const decision: RouteDecision = {
      decision_id: decisionId,
      provider: winner.cand.provider,
      model: winner.cand.model,
      score: winner.score,
      hard_gate_results: winner.gateResults,
      reason_codes: isDegraded ? ['ROUTE_SELECTED_DEGRADED'] : ['ROUTE_OPTIMAL_SELECTED'],
      degraded: isDegraded,
      blocked: false,
      alternatives: eligible.slice(1, 4).map((alt) => ({
        provider: alt.cand.provider,
        model: alt.cand.model,
        score: alt.score,
      })),
    };

    // Emit safe observability event
    if (observability) {
      observability.recordEvent({
        event_id: `evt-${decisionId}`,
        timestamp: new Date().toISOString(),
        type: 'route:decision',
        routing_decision_id: decisionId,
        provider: decision.provider || undefined,
        model: decision.model || undefined,
        metadata: {
          score: decision.score,
          degraded: decision.degraded,
          alternativesCount: decision.alternatives.length,
        },
      });
    }

    return decision;
  }
}

// Module augmentation
declare module 'cordis' {
  interface Context {
    supremeRouter: SupremeRouterService;
  }
}

export const SupremeRouterPlugin = SupremeRouterService;
export default SupremeRouterPlugin;
