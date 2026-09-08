# ADR-0006: Workflow Policy Limits & Degradation Ladder

## STATUS
ACCEPTED

## CONTEXT
Uncontrolled multi-agent fan-out and recursive delegation cause runaway token usage, infinite loops, and race conditions. DSH provides official `ctx.subagents` and `ctx.workflowEngine`, but governance is needed.

## DECISION
1. `supremeWorkflowPolicy` decides execution pattern:
   - `DIRECT`: Single turn agent
   - `SUBAGENT`: Isolated sub-task delegation
   - `WORKFLOW`: Deterministic linear/DAG pipeline
   - `SUPREME_WORKFLOW`: Multi-stage pipeline with verification checkpoints
   - `DENY`: Rejected (e.g. credential inspection, forbidden paths)
2. Safety limits enforced:
   - `maxConcurrentAgents`: default 3
   - `maxTotalAgents`: default 5
   - `maxDepth`: default 2
   - `workflowTimeout`: default 30000ms
   - `subagentTimeout`: default 15000ms
3. Controlled Degradation Ladder:
   `SUPREME_WORKFLOW` $\rightarrow$ `WORKFLOW` $\rightarrow$ `SUBAGENT` $\rightarrow$ `DIRECT` $\rightarrow$ `BLOCKED`
   When resources, quotas, or providers degrade, the policy gracefully drops to simpler execution modes instead of crashing.
4. Absolute Security Boundary:
   Delegated scopes can never receive credential access or unrestricted root filesystem mutation permissions.

## EVIDENCE
Guarantees predictable bounds on concurrency, cost, and recursion.

## ALTERNATIVES
1. Unconstrained agent spawning: Causes unbounded resource exhaustion.
2. Ban subagents entirely: Hinders complex multi-stage tasks.

## CONSEQUENCES
Safe, governed delegation with bounded blast radius.
