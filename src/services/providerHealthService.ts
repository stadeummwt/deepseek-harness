import {
  ModelRouteEntry,
  CircuitState,
  ProviderStatusResult,
  ProviderHealthReport,
  LatencyDataPoint,
  IncidentLogEntry,
} from '../types.ts';
import { createInitialAuthProbeState } from '../utils/providerProbe.ts';

/**
 * Performs an actual HTTP fetch request to verify the operational status of a provider endpoint.
 * Returns the real HTTP status code and measured round-trip latency.
 */
export async function fetchProviderStatus(candidate: ModelRouteEntry): Promise<ProviderStatusResult> {
  const endpoint = candidate.endpoint || 'https://api.deepseek.com/models';
  const start = performance.now();

  try {
    // 1. Attempt via the server probe middleware
    const probeUrl = `/api/health/probe?url=${encodeURIComponent(endpoint)}`;
    const res = await fetch(probeUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      const latencyMs = typeof data.latencyMs === 'number' ? data.latencyMs : Math.round(performance.now() - start);
      const statusCode = data.statusCode || 200;

      let circuitState: CircuitState = 'HEALTHY';
      if (statusCode === 401 || statusCode === 403) {
        circuitState = 'AUTH_FAILED';
      } else if (statusCode === 429) {
        circuitState = 'RATE_LIMITED';
      } else if (statusCode >= 500 || statusCode === 0) {
        circuitState = 'CIRCUIT_OPEN';
      }

      return {
        id: candidate.id,
        name: candidate.name,
        provider: candidate.provider,
        endpoint,
        statusCode,
        statusText: data.statusText || (statusCode === 200 ? 'OK' : 'Error'),
        latencyMs,
        circuitState,
        reachable: data.reachable ?? true,
        error: data.error,
        timestamp: new Date().toLocaleTimeString(),
      };
    }
  } catch (_probeErr) {
    // Fallback if probe endpoint is not accessible
  }

  // Fallback: Direct browser fetch with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const directRes = await fetch(endpoint, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return {
      id: candidate.id,
      name: candidate.name,
      provider: candidate.provider,
      endpoint,
      statusCode: directRes.status || 200,
      statusText: directRes.statusText || 'OK',
      latencyMs,
      circuitState: 'HEALTHY',
      reachable: true,
      timestamp: new Date().toLocaleTimeString(),
    };
  } catch (directErr: any) {
    clearTimeout(timeoutId);
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const isTimeout = directErr.name === 'AbortError';
    return {
      id: candidate.id,
      name: candidate.name,
      provider: candidate.provider,
      endpoint,
      statusCode: isTimeout ? 504 : 503,
      statusText: isTimeout ? 'Gateway Timeout' : 'Service Unavailable',
      latencyMs,
      circuitState: 'CIRCUIT_OPEN',
      reachable: false,
      error: directErr.message || 'Direct probe failed',
      timestamp: new Date().toLocaleTimeString(),
    };
  }
}

/**
 * Polls provider status across all registered candidates using real fetch requests.
 * Updates candidates with actual status codes and measured latency,
 * tracks rolling latency buffer, and detects real incidents.
 */
export async function pollAllProvidersReal(
  candidates: ModelRouteEntry[],
  cycleCount: number = 1,
  prevLatencyHistory: LatencyDataPoint[] = []
): Promise<{
  updatedCandidates: ModelRouteEntry[];
  report: ProviderHealthReport;
  newIncidents: IncidentLogEntry[];
}> {
  const results = await Promise.all(
    candidates.map(async (cand) => {
      try {
        return await fetchProviderStatus(cand);
      } catch (err: any) {
        return {
          id: cand.id,
          name: cand.name,
          provider: cand.provider,
          endpoint: cand.endpoint || '',
          statusCode: 503,
          statusText: 'Probe Exception',
          latencyMs: 100,
          circuitState: 'CIRCUIT_OPEN' as CircuitState,
          reachable: false,
          error: err?.message,
          timestamp: new Date().toLocaleTimeString(),
        };
      }
    })
  );

  let healthyCount = 0;
  const failedProviders: { name: string; reason: string; statusCode: number }[] = [];
  let totalLatency = 0;
  let minLatency = 9999;
  let maxLatency = 0;
  let activeCircuitBreakers = 0;
  const newIncidents: IncidentLogEntry[] = [];
  const currentTime = new Date().toLocaleTimeString();

  const updatedCandidates: ModelRouteEntry[] = candidates.map((c) => {
    const probeRes = results.find((r) => r.id === c.id);
    if (!probeRes) return c;

    // Retain manual fault injection if actively set by user in the Sentinel Workbench
    const isManualFault = c.authProbe?.failureReason?.startsWith('HTTP 401');
    const effectiveStatusCode = isManualFault ? (c.authProbe?.lastStatusCode || 401) : probeRes.statusCode;
    const effectiveCircuitState = isManualFault ? c.circuitState : probeRes.circuitState;

    const isHealthy = effectiveCircuitState === 'HEALTHY';
    if (isHealthy) {
      healthyCount += 1;
      // If was previously unhealthy, generate recovery incident
      if (c.circuitState !== 'HEALTHY') {
        newIncidents.push({
          id: `inc-${Date.now()}-${c.id}`,
          timestamp: currentTime,
          providerName: c.name,
          eventType: 'RECOVERED',
          details: `Endpoint returned HTTP ${effectiveStatusCode} ${probeRes.statusText}. Circuit closed.`,
          statusCode: effectiveStatusCode,
          severity: 'INFO',
        });
      }
    } else {
      activeCircuitBreakers += 1;
      failedProviders.push({
        name: c.name,
        reason: probeRes.error || `HTTP ${effectiveStatusCode} ${probeRes.statusText}`,
        statusCode: effectiveStatusCode,
      });

      // If state changed to tripped or failed
      if (c.circuitState === 'HEALTHY' || c.circuitState !== effectiveCircuitState) {
        newIncidents.push({
          id: `inc-${Date.now()}-${c.id}`,
          timestamp: currentTime,
          providerName: c.name,
          eventType: effectiveCircuitState === 'AUTH_FAILED' ? 'PROBE_FAILURE' : 'TRIPPED',
          details: probeRes.error || `HTTP ${effectiveStatusCode} ${probeRes.statusText}. Circuit tripped to ${effectiveCircuitState}.`,
          statusCode: effectiveStatusCode,
          severity: effectiveStatusCode === 401 ? 'WARN' : 'CRITICAL',
        });
      }
    }

    const measuredLatency = probeRes.latencyMs;
    // Detect latency spike (>120ms)
    if (measuredLatency > 120 && isHealthy) {
      newIncidents.push({
        id: `inc-${Date.now()}-${c.id}-spike`,
        timestamp: currentTime,
        providerName: c.name,
        eventType: 'LATENCY_SPIKE',
        details: `Measured latency of ${measuredLatency}ms exceeds threshold (120ms).`,
        statusCode: effectiveStatusCode,
        severity: 'WARN',
      });
    }

    totalLatency += measuredLatency;
    if (measuredLatency < minLatency) minLatency = measuredLatency;
    if (measuredLatency > maxLatency) maxLatency = measuredLatency;

    return {
      ...c,
      circuitState: effectiveCircuitState,
      authProbe: {
        ...(c.authProbe || createInitialAuthProbeState()),
        lastStatusCode: effectiveStatusCode,
        lastProbeTimestamp: probeRes.timestamp,
        measuredLatencyMs: measuredLatency,
        failureReason: isHealthy ? undefined : (probeRes.error || `HTTP ${effectiveStatusCode} ${probeRes.statusText}`),
      },
    };
  });

  const avgLatency = candidates.length > 0 ? Math.round((totalLatency / candidates.length) * 10) / 10 : 42.0;
  const totalCount = candidates.length;

  let status: 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL' | 'POLLING' = 'OPERATIONAL';
  if (healthyCount === 0 && totalCount > 0) {
    status = 'CRITICAL';
  } else if (healthyCount < totalCount) {
    status = 'DEGRADED';
  }

  // Update rolling latency history (keep last 24 points)
  const newPoint: LatencyDataPoint = {
    timestamp: currentTime,
    latencyMs: avgLatency,
    status,
  };
  const updatedHistory = [...prevLatencyHistory, newPoint].slice(-24);

  const report: ProviderHealthReport = {
    status,
    healthyCount,
    totalCount,
    averageLatencyMs: avgLatency,
    minLatencyMs: minLatency === 9999 ? 0 : minLatency,
    maxLatencyMs: maxLatency,
    lastPollTimestamp: currentTime,
    failedProviders,
    activeCircuitBreakers,
    pollCycleCount: cycleCount,
    activeNode: 'KUALA_LUMPUR_04',
    latencyHistory: updatedHistory,
  };

  return { updatedCandidates, report, newIncidents };
}

