# ADR-0004: Router Scoring Algorithm & Hard Gates

## STATUS
ACCEPTED

## CONTEXT
The router selects candidate LLM providers/models based on cost, policy, capability, reliability, and historical performance.

## DECISION
1. **Hard Gates (Non-negotiable Pre-filter)**:
   - Cost policy check (reject PAID, TRIAL, UNKNOWN if policy forbids)
   - Health circuit breaker status (reject OPEN)
   - Context capacity (reject if task tokens > model window)
   - Required capability matching (tools, vision, reasoning)
   - Quota headroom check
2. **Normalized Multi-Factor Scoring**:
   - 30% Historical task quality
   - 20% Health state
   - 15% Quota headroom
   - 10% Recent reliability
   - 10% Latency score
   - 10% Capability fit
   - 5% Failure-domain diversity
3. **Exploration Cold-Start**:
   - Until a candidate has $\ge 5$ benchmark samples, rely on static capability fit + health to avoid biasing against new models.
4. **No Paid Fallback**:
   - If no eligible candidate passes hard gates, return `BLOCKED_NO_ELIGIBLE_ROUTE`.

## EVIDENCE
Ensures strict compliance with user cost constraints while optimizing for task quality and uptime.

## ALTERNATIVES
1. Pure round-robin: Inefficient and ignores quality/latency.
2. Silent failover to commercial paid models: Explicitly forbidden by policy and user trust guidelines.

## CONSEQUENCES
Deterministic, auditable routing decisions with clear reason codes.
