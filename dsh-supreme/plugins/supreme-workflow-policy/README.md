# @dsh-supreme/workflow-policy

## Purpose
Enforces execution safety bounds on subagents and complex multi-step workflows: recursion depth limits, step budgets, cryptographic loop detection, and deterministic verification checkpoints.

## When to Mount
Mount in `standard`, `supreme`, and `lab` profiles to prevent runaway subagent loops or infinite retries.

## When NOT to Mount
Not needed in single-turn `core` tasks where no subagents or workflows run.

## Dependencies
- Cordis `^4.0.0`
- Provides: `ctx.supremeWorkflowPolicy`

## Minimal cordis.yml
```yaml
plugins:
  supreme-workflow-policy:
    defaultMaxDepth: 3
    defaultMaxSteps: 20
    loopThreshold: 3
```

## Public Service Contract
- `startWorkflow(params)`: Pre-flight checks and initiates tracked workflow.
- `recordStep(workflowId, stepName, payload)`: Hashes step payload, increments step count, checks step budget, and catches repetitive loops.
- `recordCheckpoint(workflowId, checkpointName, passed)`: Enforces pass/fail on verification checkpoints; halts on failure.
- `completeWorkflow(workflowId, success)`: Marks workflow finished.
- `cancelWorkflow(workflowId, reason)`: Aborts running workflow.

## Security Boundary
- Hard recursion depth limits.
- Step signatures are cryptographic hashes; sensitive payloads are not stored in logs.

## Verification Commands
```bash
npx tsx dsh-supreme/tests/unit/test-supreme-workflow-policy.ts
```
