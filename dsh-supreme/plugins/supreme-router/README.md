# @dsh-supreme/router

## Purpose
Selects the optimal provider, model, and execution configuration based on deterministic policy gates, model health, quota headroom, latency, and historical benchmark evidence.

## When to Mount
Mount in `supreme` and `lab` profiles (or in `standard` when multiple eligible provider routes exist).

## When NOT to Mount
Not needed when only a single hardcoded LLM adapter is configured without alternatives.

## Dependencies
- Cordis `^4.0.0`
- `supremePolicy` (hard cost and security gating)
- `supremeObservability` (safe telemetry emission)
- `supremeBenchmark` (historical quality scoring)
- Provides: `ctx.supremeRouter`

## Minimal cordis.yml
```yaml
plugins:
  supreme-router:
    minHistoricalSamples: 5
    weights:
      historicalQuality: 0.30
      health: 0.20
      quotaHeadroom: 0.15
      reliability: 0.10
      latency: 0.10
      capabilityFit: 0.10
      failureDiversity: 0.05
```

## Public Service Contract
- `registerCandidate(candidate: ModelCandidate)`: Adds an LLM candidate.
- `selectRoute(req: RouteRequest)`: Executes hard gates, normalizes weights, and returns `RouteDecision`.
- `tripCircuit(provider, model, state)`: Opens circuit breaker on persistent failure.
- `resetCircuit(provider, model)`: Restores healthy status.

## Security Boundary & Hard Gates
- Conservative default: `BLOCKED_NO_ELIGIBLE_ROUTE` when no candidate passes policy and health.
- NEVER automatically falls back to PAID, TRIAL, or UNKNOWN models.

## Verification Commands
```bash
npx tsx dsh-supreme/tests/unit/test-supreme-router.ts
```
