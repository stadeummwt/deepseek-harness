# ADR-0002: Observability Storage Mechanism

## STATUS
ACCEPTED

## CONTEXT
Observability must capture operational traces and metrics without impacting agent latency, without crashing the agent on I/O failure, and without persisting secrets or redundant session data.

## DECISION
Adopt an append-only JSON Lines (`.jsonl`) file storage pattern in `data/observability/traces.jsonl`.
- Synchronous/asynchronous non-blocking streaming write with buffering.
- Fail-open policy: Any disk/write error is caught and recorded to an in-memory error counter without interrupting the DSH turn.
- Strict allowlist sanitization: Prompts and raw credentials are never written; only operation metadata, durations, model names, and status codes are stored.

## EVIDENCE
JSONL allows linear append without lock contention, trivial streaming consumption, zero external database dependency, and minimal CPU overhead.

## ALTERNATIVES
1. SQLite/Relational database: Rejected because native binaries introduce cross-platform build friction and overhead.
2. Full conversation transcript logging: Rejected because `ctx.sessions` is the sole source of truth; duplicating conversation transcripts risks secret leakage.

## CONSEQUENCES
Lightweight, crash-resilient observability with deterministic redaction.

## ROLLBACK
Swap the storage adapter in `supremeObservability` without altering the event subscription interface.
