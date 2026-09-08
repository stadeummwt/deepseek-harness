# @dsh-supreme/policy

## Purpose
Centralizes high-level deterministic project policy, cost gating, risk classification, and delegation depth limits across the DeepSeek Harness environment.

## When to Mount
Mount in all standard production profiles (`core.cordis.yml`, `standard.cordis.yml`, `supreme.cordis.yml`, `lab.cordis.yml`) to ensure safe defaults, ban accidental paid model usage, and prevent runaway delegation.

## When NOT to Mount
Do not unmount in production environments unless running an unconstrained offline benchmark fixture.

## Dependencies
- Cordis `^4.0.0`
- Provides: `ctx.supremePolicy`

## Minimal cordis.yml
```yaml
plugins:
  supreme-policy:
    executionClass: STANDARD
    allowPaid: false
    allowTrial: false
    allowUnknownCost: false
    maxDelegationDepth: 3
```

## Public Service Contract
- `evaluateRoute(candidate, context)`: Assesses whether a route is permitted.
- `evaluateDelegation(depth, risk, targetProvider)`: Enforces delegation safety limits.
- `verificationRequirement(risk, cost)`: Calculates the required verification level.
- `executionPolicy(executionClass)`: Retrieves policy parameters.

## Security Boundary
- Unknown cost classes are strictly denied (`UNKNOWN -> DENY`).
- Paid routes are blocked by default in production.
- High-risk multi-depth delegation is forbidden.

## Data Retained
None. Purely deterministic evaluation functions. Zero credentials or prompts stored.

## Verification Commands
```bash
npx tsx dsh-supreme/tests/unit/test-supreme-policy.ts
```
