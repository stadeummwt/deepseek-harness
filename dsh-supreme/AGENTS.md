# DSH SUPREME AGENT OPERATING MANUAL

This file governs development, test execution, and composition verification for the DSH Supreme v1 plugin suite.

## Core Rules for Operating Agents

1. **No Core Patches**: Never modify DSH or Cordis upstream core code. All functionality must be implemented as Cordis plugins and services.
2. **Build Order Discipline**:
   - Step 0: Minimal Plugin / Loader Verification
   - Step 1: `@dsh-supreme/policy`
   - Step 2: `@dsh-supreme/observability`
   - Step 3: `@dsh-supreme/benchmark`
   - Step 4: `@dsh-supreme/router`
   - Step 5: `@dsh-supreme/verifier`
   - Step 6: `@dsh-supreme/memory-policy`
   - Step 7: `@dsh-supreme/workflow-policy`
   - Step 8: Compositions (`core`, `standard`, `supreme`, `lab`)
   - Step 9: Regression & Security Sentinel Suite
3. **Secret Isolation**: Fake sentinel strings (`SENTINEL_SECRET_TOKEN_DO_NOT_LEAK`) are tested in security test suites. Any appearance in observability logs or benchmarks triggers an immediate fatal failure.
4. **Disposal Lifecycle**: Every Cordis plugin must cleanly deregister event listeners, timers, and storage locks upon `ctx.on('dispose', ...)`.
