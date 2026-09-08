# DSH Supreme — Master Plugin Suite v1

DSH Supreme is a carefully engineered plugin and composition layer built on **DeepSeek Harness (DSH)** using the **Cordis** micro-framework (`v4.x`).

## 1. Plugin Suite Scope

| Package | Service | Description |
|---------|---------|-------------|
| `@dsh-supreme/policy` | `ctx.supremePolicy` | Centralizes deterministic policy, cost gates, and execution classes. |
| `@dsh-supreme/observability` | `ctx.supremeObservability` | Append-only, secret-sanitized operational event tracing. |
| `@dsh-supreme/benchmark` | `ctx.supremeBenchmark` | Structured end-to-end task benchmarking and routing evidence. |
| `@dsh-supreme/router` | `ctx.supremeRouter` | Multi-factor weighted LLM model and provider routing engine. |
| `@dsh-supreme/verifier` | `ctx.supremeVerifier` | Deterministic validator registry (exact, regex, schema, file, exit). |
| `@dsh-supreme/memory-policy` | `ctx.supremeMemoryPolicy` | Budgeted context, project file, and memory selection policy. |
| `@dsh-supreme/workflow-policy`| `ctx.supremeWorkflowPolicy`| Governs subagent delegation, workflow depth, and degradation ladders. |

## 2. Compositions

- **`config/core.cordis.yml`**: Clean baseline DSH with core policy gating.
- **`config/standard.cordis.yml`**: Standard agent profile (policy, observability, memory policy, verifier).
- **`config/supreme.cordis.yml`**: Complete supreme profile with all 7 plugins and upstream services.
- **`config/lab.cordis.yml`**: Diagnostic, experimental profile with test adapters and overrides.

## 3. Running Tests & Loader Smokes

```bash
# Run the complete test suite
npx tsx dsh-supreme/tests/run-all-tests.ts
```
