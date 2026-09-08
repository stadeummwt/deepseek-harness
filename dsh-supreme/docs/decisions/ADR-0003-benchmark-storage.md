# ADR-0003: Benchmark Evidence Storage

## STATUS
ACCEPTED

## CONTEXT
The benchmark service records task evaluations to provide historical empirical evidence for `supremeRouter`.

## DECISION
Implement storage in `data/benchmark/benchmarks.jsonl` with an in-memory index for fast aggregation.
- Schema includes `run_id`, `task_id`, `category`, `provider`, `model`, `latency_ms`, `success`, `quality_score`, `failure_class`, and `verification_result`.
- Corrupt records are dropped with warning logs rather than crashing query operations.
- Historical queries calculate moving averages and failure distributions.

## EVIDENCE
JSONL meets the criteria of simple portable storage with zero third-party database dependencies.

## ALTERNATIVES
1. Separate relational DB: Rejected to keep the suite self-contained.
2. In-memory only: Rejected because routing benefits from persistent benchmark history across agent restarts.

## CONSEQUENCES
Router can query historical task performance reliably.

## ROLLBACK
Abstract storage interface allows drop-in replacement with SQLite or DuckDB if scale requires.
