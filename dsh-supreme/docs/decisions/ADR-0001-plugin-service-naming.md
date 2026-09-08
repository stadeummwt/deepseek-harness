# ADR-0001: Plugin Service Naming Conventions

## STATUS
ACCEPTED

## CONTEXT
Cordis micro-framework registers services onto the global application context (`ctx`). To prevent collision with upstream DeepSeek Harness (DSH) native services (`ctx.llm`, `ctx.tools`, `ctx.sessions`, `ctx.systemPrompt`, `ctx.subagents`, `ctx.workflowEngine`, `ctx.compaction`, `ctx.tokenMeter`), a strict naming convention is required.

## DECISION
All custom Supreme plugins will register with the prefix `supreme` followed by the PascalCase service name:
- `ctx.supremePolicy`
- `ctx.supremeObservability`
- `ctx.supremeBenchmark`
- `ctx.supremeRouter`
- `ctx.supremeVerifier`
- `ctx.supremeMemoryPolicy`
- `ctx.supremeWorkflowPolicy`

TypeScript module augmentation will define these properties on `Context`.

## EVIDENCE
Cordis v4 documentation and standard plugin practices show that namespaced context properties avoid collisions with future upstream releases while providing clean intellisense.

## ALTERNATIVES
1. Scoping all services under a single nested namespace like `ctx.supreme.policy`: Rejected because Cordis service injection (`ctx.inject = ['supremePolicy']`) works best with top-level service symbols.
2. Short names like `ctx.policy`, `ctx.router`: Rejected due to severe collision risk with upstream DSH services.

## CONSEQUENCES
Developers and plugins can declare clean dependencies via `inject: ['supremePolicy', 'supremeObservability']`.

## ROLLBACK
Rename the service registration keys in each plugin package's entry point and update the TypeScript definitions.
