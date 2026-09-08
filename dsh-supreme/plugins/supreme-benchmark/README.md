# @dsh-supreme/benchmark

## Purpose
Records reproducible end-to-end task executions, quality scores, latency, and failure classes to serve as empirical evidence for dynamic LLM routing.

## When to Mount
Mount in `supreme` and `lab` profiles to gather benchmark runs, evaluate model reliability, and supply evidence to `supremeRouter`.

## When NOT to Mount
Not needed in `core` or minimal `standard` where static routing or single-model setups suffice.

## Dependencies
- Cordis `^4.0.0`
- Provides: `ctx.supremeBenchmark`

## Minimal cordis.yml
```yaml
plugins:
  supreme-benchmark:
    storagePath: dsh-supreme/data/benchmark/benchmarks.jsonl
    maxHistoricalSamples: 1000
```

## Public Service Contract
- `recordTask(task: BenchmarkTask)`: Registers a reusable benchmark task definition.
- `startRun(taskId, metadata)`: Starts a tracked run and returns `run_id`.
- `finishRun(runId, outcome)`: Concludes the run, persists to JSONL, and indexes metrics.
- `recordScore(runId, score)`: Updates or sets explicit score.
- `queryHistory(filter)`: Queries filtered benchmark history.
- `aggregateModelPerformance(provider, model)`: Computes statistical quality, success rate, and latency.

## Security Boundary
- Benchmark runs store operational metrics (quality score, latency, tool count, failure class).
- Raw prompts and credentials are never stored.

## Verification Commands
```bash
npx tsx dsh-supreme/tests/unit/test-supreme-benchmark.ts
```
