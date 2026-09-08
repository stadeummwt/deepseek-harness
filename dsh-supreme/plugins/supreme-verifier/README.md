# @dsh-supreme/verifier

## Purpose
Provides a deterministic validator registry to replace model self-evaluations with verifiable evidence:
`DETERMINISTIC EVIDENCE > MODEL SELF-CONFIDENCE`

## When to Mount
Mount in `standard`, `supreme`, and `lab` compositions to enforce quality checkpoints, test results, JSON schemas, file hashes, and exit codes.

## When NOT to Mount
Not needed in minimalist `core` configurations without output validation rules.

## Dependencies
- Cordis `^4.0.0`
- Provides: `ctx.supremeVerifier`

## Minimal cordis.yml
```yaml
plugins:
  supreme-verifier:
    maxEvidenceLength: 500
    timeoutMs: 5000
```

## Public Service Contract
- `registerValidator(def: ValidatorDefinition)`: Adds a validator.
- `verify(validatorId, target, options)`: Evaluates target and returns `ValidatorResult`.
- Supported types: `exact-text`, `regex`, `json-parse`, `json-schema`, `file-exists`, `file-hash`, `command-exit`, `custom`.
- Return statuses: `PASS`, `FAIL`, `ERROR`, `UNAVAILABLE`.

## Security Boundary
- Does not bypass sandbox or tool permissions.
- Evidence strings are bounded and automatically sanitized from secret tokens.

## Verification Commands
```bash
npx tsx dsh-supreme/tests/unit/test-supreme-verifier.ts
```
