# @dsh-supreme/memory-policy

## Purpose
Enforces memory selection policy, relevance gating, and context budgeting across project knowledge and long-term memory sources, without replicating or competing with DSH `ctx.sessions`.

## When to Mount
Mount in `standard`, `supreme`, and `lab` profiles when project knowledge or supplementary context needs to be safely budgeted into LLM calls.

## When NOT to Mount
Not needed in `core` minimal setups.

## Dependencies
- Cordis `^4.0.0`
- Provides: `ctx.supremeMemoryPolicy`

## Minimal cordis.yml
```yaml
plugins:
  supreme-memory-policy:
    defaultBudgetChars: 2000
    enableProjectKnowledge: true
```

## Public Service Contract
- `registerProjectKnowledge(item)`: Adds sanitized project context item.
- `selectMemoryForTask(taskDescription, options)`: Evaluates relevance and enforces strict char/token budget.
- `generatePromptSection(selection)`: Conditionally produces `<supplemental_context>` block (empty if no relevant items).

## Security Boundary
- Rejects registration of secret-bearing phrases (e.g. `password=`, `key=`, `secret`).
- Never stores session history or chat logs.

## Verification Commands
```bash
npx tsx dsh-supreme/tests/unit/test-supreme-memory-policy.ts
```
