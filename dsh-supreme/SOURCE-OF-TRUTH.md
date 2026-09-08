# DSH SUPREME — SOURCE OF TRUTH (SOT)

## 1. Upstream Pinned Specification

| Attribute | Pinned Value |
|-----------|--------------|
| Target Upstream | DeepSeek Harness (DSH) |
| Upstream Specification Version | `@deepseek-ai/dsh@0.1.2-rc.1` |
| Upstream Git Commit | `dsh-2026.09.03-a1f9e83c274b` |
| Upstream Worktree State | Clean / In-Spec / No Uncommitted Leaks |
| Core Upstream Patches | **0 (FORBIDDEN — None Applied)** |
| Base Micro-Framework | Cordis `v4.0.0-rc.9` |
| Node Version | `v22.23.2` |
| Package Manager | `npm 10.9.8` |

---

## 2. Pinned Upstream & Supreme Service Inventory

| Service Symbol | Scope | Provider Package | Exact Signature / Interface | Notes |
|----------------|-------|------------------|-----------------------------|-------|
| `ctx.llm` | Upstream DSH | `@deepseek-ai/dsh-base` | `LLMService` | Native LLM runtime & provider adapters |
| `ctx.tools` | Upstream DSH | `@deepseek-ai/dsh-tools` | `ToolRegistry` | Official agent tool execution pipeline |
| `ctx.sessions` | Upstream DSH | `@deepseek-ai/dsh-base` | `SessionService` | Canonical session & conversation history |
| `ctx.systemPrompt` | Upstream DSH | `@deepseek-ai/dsh-base` | `SystemPromptService` | System prompt assembly & section injection |
| `ctx.subagents` | Upstream DSH | `@deepseek-ai/dsh-base` | `SubagentService` | Official subagent spawning & runtime |
| `ctx.workflowEngine` | Upstream DSH | `@deepseek-ai/dsh-base` | `WorkflowEngineService`| Multi-step deterministic workflow coordinator |
| `ctx.compaction` | Upstream DSH | `@deepseek-ai/dsh-compaction`| `CompactionService` | Context pruning & token preservation |
| `ctx.tokenMeter` | Upstream DSH | `@deepseek-ai/dsh-base` | `TokenMeterService` | Token accounting & budget limits |
| `ctx.sandbox` | Upstream DSH | `@deepseek-ai/dsh-sandbox` | `SandboxService` | Safe process & filesystem isolation |
| `ctx.supremePolicy` | DSH Supreme | `@dsh-supreme/policy` | `SupremePolicyService` | Deterministic policy, risk, and cost gating |
| `ctx.supremeObservability` | DSH Supreme | `@dsh-supreme/observability` | `SupremeObservabilityService` | Secret-free append-only operational traces |
| `ctx.supremeBenchmark` | DSH Supreme | `@dsh-supreme/benchmark` | `SupremeBenchmarkService` | Reproducible benchmark scoring & history |
| `ctx.supremeRouter` | DSH Supreme | `@dsh-supreme/router` | `SupremeRouterService` | Weighted multi-factor route decision engine |
| `ctx.supremeVerifier` | DSH Supreme | `@dsh-supreme/verifier` | `SupremeVerifierService` | Deterministic validator registry & evidence |
| `ctx.supremeMemoryPolicy` | DSH Supreme | `@dsh-supreme/memory-policy` | `SupremeMemoryPolicyService` | Budgeted context & knowledge selection |
| `ctx.supremeWorkflowPolicy` | DSH Supreme | `@dsh-supreme/workflow-policy`| `SupremeWorkflowPolicyService`| Delegation governance & degradation ladder |

---

## 3. Architecture & Service Dependency Graph

```text
               supreme-policy
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   observability             benchmark
         │                       │
         └───────────┬───────────┘
                     ▼
                   router

               supreme-policy
                     │
                     ▼
                  verifier

          sessions / systemPrompt
                     │
                     ▼
               memory-policy

  policy + observability + verifier + subagents + workflowEngine
                     │
                     ▼
              workflow-policy
```

---

## 4. Anti-Hallucination & Anti-Slop Enforcement
1. **Never Invent Services**: Do NOT create `ctx.memory`, `ctx.metrics`, or `ctx.permissions` unless verified in upstream.
2. **Canonical State Ownership**:
   - Conversation/Session history $\rightarrow$ ONLY `ctx.sessions`
   - Model execution $\rightarrow$ ONLY `ctx.llm`
   - Tools $\rightarrow$ ONLY `ctx.tools`
   - Subagents $\rightarrow$ ONLY `ctx.subagents`
   - Workflows $\rightarrow$ ONLY `ctx.workflowEngine`
3. **Secret Sanitization**: Never log API keys, Bearer tokens, or raw credentials. All logs pass deterministic allowlisting.
4. **No Paid Fallback**: If no production-eligible route remains, return `BLOCKED_NO_ELIGIBLE_ROUTE`. Never silently switch to PAID, TRIAL, or UNKNOWN.
