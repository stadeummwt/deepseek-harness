import { ModelRouteEntry, CircuitState, AuthProbeState, ProviderHealthReport } from '../types.ts';

/**
 * Creates default AuthProbeState for a given model entry
 */
export function createInitialAuthProbeState(statusCode: number = 200): AuthProbeState {
  return {
    lastStatusCode: statusCode,
    lastProbeTimestamp: new Date().toLocaleTimeString(),
    authHeaderAttached: true,
    tokenExpirySecondsRemaining: 3600,
    refreshCount: 0,
    autoRecovering: false,
  };
}

export type SimulatedFaultType =
  | 'NONE'
  | 'HTTP_401_INVALID_KEY'
  | 'HTTP_401_EXPIRED_TOKEN'
  | 'HTTP_429_RATE_LIMIT'
  | 'HTTP_503_SERVICE_DOWN';

/**
 * Simulates an active HTTP/REST handshake probe to an upstream model endpoint
 * Handles realistic status codes, circuit trip to AUTH_FAILED on 401, and telemetry.
 */
export function simulateActiveProviderProbe(
  model: ModelRouteEntry,
  fault: SimulatedFaultType = 'NONE'
): ModelRouteEntry {
  const currentProbe = model.authProbe || createInitialAuthProbeState();
  const timestamp = new Date().toLocaleTimeString();

  switch (fault) {
    case 'HTTP_401_INVALID_KEY':
      return {
        ...model,
        circuitState: 'AUTH_FAILED',
        authProbe: {
          ...currentProbe,
          lastStatusCode: 401,
          lastProbeTimestamp: timestamp,
          failureReason: 'HTTP 401 Unauthorized: Provider rejected API credentials (bad key/signature)',
          autoRecovering: false,
        },
      };

    case 'HTTP_401_EXPIRED_TOKEN':
      return {
        ...model,
        circuitState: 'AUTH_FAILED',
        authProbe: {
          ...currentProbe,
          lastStatusCode: 401,
          lastProbeTimestamp: timestamp,
          tokenExpirySecondsRemaining: 0,
          failureReason: 'HTTP 401 Unauthorized: Bearer session token expired',
          autoRecovering: false,
        },
      };

    case 'HTTP_429_RATE_LIMIT':
      return {
        ...model,
        circuitState: 'RATE_LIMITED',
        authProbe: {
          ...currentProbe,
          lastStatusCode: 429,
          lastProbeTimestamp: timestamp,
          failureReason: 'HTTP 429 Too Many Requests: TPM/RPM quota threshold saturated',
          autoRecovering: false,
        },
      };

    case 'HTTP_503_SERVICE_DOWN':
      return {
        ...model,
        circuitState: 'CIRCUIT_OPEN',
        authProbe: {
          ...currentProbe,
          lastStatusCode: 503,
          lastProbeTimestamp: timestamp,
          failureReason: 'HTTP 503 Service Unavailable: Provider edge gateway unreachable',
          autoRecovering: false,
        },
      };

    case 'NONE':
    default:
      return {
        ...model,
        circuitState: 'HEALTHY',
        authProbe: {
          ...currentProbe,
          lastStatusCode: 200,
          lastProbeTimestamp: timestamp,
          tokenExpirySecondsRemaining: 3600,
          failureReason: undefined,
          autoRecovering: false,
        },
      };
  }
}

/**
 * Executes a simulated Token Refresh / Key Rotation recovery workflow.
 * Transitions candidate from AUTH_FAILED -> PROBING -> HEALTHY.
 */
export async function executeTokenRefreshRemediation(
  model: ModelRouteEntry,
  onStateChange: (updated: ModelRouteEntry) => void
): Promise<ModelRouteEntry> {
  // Step 1: Transition to PROBING
  const probingState: ModelRouteEntry = {
    ...model,
    circuitState: 'PROBING',
    authProbe: {
      ...(model.authProbe || createInitialAuthProbeState()),
      autoRecovering: true,
      failureReason: 'Renewing bearer credential & rotating provider authorization token...',
      lastProbeTimestamp: new Date().toLocaleTimeString(),
    },
  };
  onStateChange(probingState);

  // Simulate network round-trip delay for token endpoint
  await new Promise((resolve) => setTimeout(resolve, 600));

  // Step 2: Transition to HEALTHY with status 200
  const refreshedState: ModelRouteEntry = {
    ...model,
    circuitState: 'HEALTHY',
    authProbe: {
      lastStatusCode: 200,
      lastProbeTimestamp: new Date().toLocaleTimeString(),
      authHeaderAttached: true,
      tokenExpirySecondsRemaining: 3600,
      failureReason: undefined,
      refreshCount: (model.authProbe?.refreshCount || 0) + 1,
      autoRecovering: false,
    },
  };
  onStateChange(refreshedState);
  return refreshedState;
}

/**
 * Cost and circuit gate evaluation result
 */
export interface RouteEvaluationResult {
  eligible: boolean;
  blockReason?: string;
  rejectionCode?: 'CIRCUIT_AUTH_FAILED' | 'CIRCUIT_TRIPPED' | 'COST_CLASS_BLOCKED' | 'CONTEXT_OVERFLOW';
}

export function evaluateModelCandidate(
  candidate: ModelRouteEntry,
  promptTokens: number,
  isLabProfile: boolean
): RouteEvaluationResult {
  // Active Circuit Breaker & Auth Status Check
  if (candidate.circuitState === 'AUTH_FAILED') {
    return {
      eligible: false,
      rejectionCode: 'CIRCUIT_AUTH_FAILED',
      blockReason: `Active circuit breaker tripped: ${candidate.authProbe?.failureReason || 'HTTP 401 Unauthorized'}. Candidate rejected until token refresh.`,
    };
  }

  if (candidate.circuitState !== 'HEALTHY') {
    return {
      eligible: false,
      rejectionCode: 'CIRCUIT_TRIPPED',
      blockReason: `Circuit in degraded state (${candidate.circuitState}). Active probe status: ${candidate.authProbe?.lastStatusCode || 'UNKNOWN'}.`,
    };
  }

  // Cost Class Gate
  if (!isLabProfile && candidate.costClass === 'PAID') {
    return {
      eligible: false,
      rejectionCode: 'COST_CLASS_BLOCKED',
      blockReason: 'Non-Lab profile prohibits PAID models (RM0-First policy enforcement).',
    };
  }

  // Context Capacity Gate
  if (candidate.contextCapacity < promptTokens) {
    return {
      eligible: false,
      rejectionCode: 'CONTEXT_OVERFLOW',
      blockReason: `Required prompt tokens (${promptTokens}) exceeds context window limit (${candidate.contextCapacity}).`,
    };
  }

  return { eligible: true };
}

/**
 * Polls provider status across all registered candidates and returns a real-time operational health report.
 */
export function pollProviderHealth(
  candidates: ModelRouteEntry[],
  cycleCount: number = 1
): ProviderHealthReport {
  let healthyCount = 0;
  const failedProviders: { name: string; reason: string; statusCode: number }[] = [];
  let totalLatency = 0;
  let minLatency = 9999;
  let maxLatency = 0;
  let activeCircuitBreakers = 0;

  // Base latencies per failure domain
  const domainBaseLatency: Record<string, number> = {
    'local-host': 14,
    'global-edge': 36,
    'gcp-us-central1': 58,
    'aws-us-east1': 72,
  };

  for (const c of candidates) {
    const isHealthy = c.circuitState === 'HEALTHY';
    const probe = c.authProbe;

    if (isHealthy) {
      healthyCount += 1;
    } else {
      activeCircuitBreakers += 1;
      failedProviders.push({
        name: c.name,
        reason: probe?.failureReason || `Circuit state ${c.circuitState}`,
        statusCode: probe?.lastStatusCode || 500,
      });
    }

    // Dynamic latency jitter calculation (±3ms) based on cycleCount
    const base = domainBaseLatency[c.failureDomain] || 45;
    const jitter = ((cycleCount * 7 + c.name.length * 3) % 9) - 4;
    const measuredLatency = Math.max(10, base + jitter);

    totalLatency += measuredLatency;
    if (measuredLatency < minLatency) minLatency = measuredLatency;
    if (measuredLatency > maxLatency) maxLatency = measuredLatency;
  }

  const avgLatency = candidates.length > 0 ? Math.round((totalLatency / candidates.length) * 10) / 10 : 40.0;
  const totalCount = candidates.length;

  let status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL' | 'POLLING' = 'OPERATIONAL';
  if (healthyCount === 0 && totalCount > 0) {
    status = 'CRITICAL';
  } else if (healthyCount < totalCount) {
    status = 'DEGRADED';
  }

  return {
    status,
    healthyCount,
    totalCount,
    averageLatencyMs: avgLatency,
    minLatencyMs: minLatency === 9999 ? 0 : minLatency,
    maxLatencyMs: maxLatency,
    lastPollTimestamp: new Date().toLocaleTimeString(),
    failedProviders,
    activeCircuitBreakers,
    pollCycleCount: cycleCount,
    activeNode: 'KUALA_LUMPUR_04',
  };
}

export { fetchProviderStatus, pollAllProvidersReal } from '../services/providerHealthService.ts';

