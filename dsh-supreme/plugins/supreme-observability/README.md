# @dsh-supreme/observability

## Purpose
Provides safe runtime operational event tracing, performance metrics, and correlation IDs without duplicating DSH session state or storing user credentials.

## When to Mount
Mount in `standard`, `supreme`, and `lab` profiles to monitor model latency, tool execution, route decisions, verification outcomes, and errors.

## When NOT to Mount
Not required in minimal `core` baseline where zero I/O overhead is required.

## Dependencies
- Cordis `^4.0.0`
- Provides: `ctx.supremeObservability`

## Minimal cordis.yml
```yaml
plugins:
  supreme-observability:
    enabled: true
    logPath: dsh-supreme/data/observability/traces.jsonl
    bufferFlushIntervalMs: 500
```

## Public Service Contract
- `recordEvent(event: SafeObservabilityEvent)`: Queues and writes operational event.
- `sanitizeMetadata(meta)`: Strips secret tokens, passwords, and bearer headers.
- `getRecentEvents(count)`: In-memory window of recent telemetry.
- `flushSync()`: Flushes buffer to disk immediately.
- `getWriteErrorCount()`: Returns count of fail-open handled write failures.

## Security Boundary
- Strict allowlisting and automatic redaction of `[REDACTED_BY_SUPREME_OBSERVABILITY]`.
- Prompts, model completions, passwords, and authorization tokens are strictly forbidden.
- I/O failures fail open without crashing the DSH agent turn.

## Data Retained
- Structured operational event headers (latency, provider, model, tool name, error class) in `dsh-supreme/data/observability/traces.jsonl`.

## Verification Commands
```bash
npx tsx dsh-supreme/tests/unit/test-supreme-observability.ts
```
