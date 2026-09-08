# ADR-0005: Memory Provider Boundary & Context Budgeting

## STATUS
ACCEPTED

## CONTEXT
Session history is owned entirely by upstream `ctx.sessions`. The Supreme layer needs a memory policy plugin to selectively budget and pull project context and long-term knowledge without duplicating session state or introducing unbounded prompt growth.

## DECISION
1. `supremeMemoryPolicy` manages memory **selection policy**, not primary conversation storage.
2. Distinct memory classes:
   - `CORE_PROFILE`: System instructions & operating bounds
   - `PROJECT_CONTEXT`: Relevant local documentation, configs, schemas
   - `TASK_RELEVANT`: Extracted relevant facts for current query
   - `LONG_TERM`: Cross-session user preferences (via pluggable provider)
3. Support a `NOOP` long-term provider by default, pluggable with custom file or vector providers.
4. Hard context token/char budgets enforced per query. Priority sorting discards lower-priority items when budget is exceeded.
5. System prompt injection is strictly conditional.

## EVIDENCE
Prevents context window bloat and ensures session state remains single-authored.

## ALTERNATIVES
1. Standalone external memory database: Over-engineering that violates DSH architectural boundaries.
2. Ingesting entire codebase on every turn: Exceeds context limits and increases latency.

## CONSEQUENCES
Lightweight, bounded context augmentation that respects upstream session authority.
