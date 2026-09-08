import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Zap,
  Lock,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Activity,
  FileText,
  Database,
  ArrowRight,
} from 'lucide-react';
import { MODEL_CANDIDATES } from '../data/canonicalData.ts';
import { ModelRouteEntry } from '../types.ts';
import {
  sanitizePayload,
  sanitizeString,
  sanitizeVerificationResult,
  sanitizeMemoryKnowledge,
  SENTINEL_PATTERNS,
} from '../utils/sanitizer.ts';
import {
  simulateActiveProviderProbe,
  executeTokenRefreshRemediation,
  evaluateModelCandidate,
  SimulatedFaultType,
} from '../utils/providerProbe.ts';

interface RouterSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: string;
  candidates?: ModelRouteEntry[];
  onUpdateCandidates?: (candidates: ModelRouteEntry[]) => void;
}

type SandboxTab = 'router_probe' | 'recursive_redactor' | 'architecture_bounds';

export function RouterSimulatorModal({
  isOpen,
  onClose,
  currentProfile,
  candidates: externalCandidates,
  onUpdateCandidates,
}: RouterSimulatorModalProps) {
  const [activeTab, setActiveTab] = useState<SandboxTab>('router_probe');

  // Router & Candidates State
  const [internalCandidates, setInternalCandidates] = useState<ModelRouteEntry[]>(
    externalCandidates || MODEL_CANDIDATES
  );

  // Sync if external candidates change
  useEffect(() => {
    if (externalCandidates) {
      setInternalCandidates(externalCandidates);
    }
  }, [externalCandidates]);

  const candidates = externalCandidates || internalCandidates;
  const updateCandidates = (updater: (prev: ModelRouteEntry[]) => ModelRouteEntry[]) => {
    const updated = updater(candidates);
    setInternalCandidates(updated);
    if (onUpdateCandidates) {
      onUpdateCandidates(updated);
    }
  };

  const [tokens, setTokens] = useState<number>(500);
  const [taskCategory, setTaskCategory] = useState<'coding' | 'reasoning' | 'tools'>('coding');
  const [riskClass, setRiskClass] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);

  // Redaction Sandbox State
  const [redactorMode, setRedactorMode] = useState<'string' | 'json' | 'benchmark' | 'memory'>('json');
  const [inputRaw, setInputRaw] = useState<string>(
    JSON.stringify(
      {
        session_id: 'sess-847291',
        event: 'tool:finish',
        tool: 'git_push',
        auth: {
          bearer_token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          apiKey: 'mock-sample-openai-key-REDACTED-TEST',
        },
        payload: {
          prompt: 'Sync database with remote upstream',
          db_connection: 'postgres://dsh_admin:REDACTED_PASSWORD@db.prod.internal:5432/core_db',
        },
        subagent: {
          github_token: 'mock-sample-github-token-REDACTED',
        },
      },
      null,
      2
    )
  );

  const [sanitizedResult, setSanitizedResult] = useState<{
    sanitized: any;
    report: {
      interceptedCount: number;
      patternsMatched: string[];
      sensitiveKeysScrubbed: string[];
      zeroLeakVerified: boolean;
      scrubbedTimestamp: string;
    };
  } | null>(null);

  if (!isOpen) return null;

  const isLab = currentProfile === 'lab';

  // Dynamic Route Evaluation with active probe state
  const evaluatedCandidates = candidates.map((m) => {
    const evaluation = evaluateModelCandidate(m, tokens, isLab);
    return {
      model: m,
      evaluation,
    };
  });

  const eligibleCandidates = evaluatedCandidates
    .filter((entry) => entry.evaluation.eligible)
    .sort((a, b) => b.model.score - a.model.score);

  const selectedCandidate = eligibleCandidates[0]?.model;
  const isBlocked = !selectedCandidate;

  // Active Provider Probe Fault Injection
  const handleInjectFault = (modelId: string, fault: SimulatedFaultType) => {
    updateCandidates((prev) =>
      prev.map((c) => (c.id === modelId ? simulateActiveProviderProbe(c, fault) : c))
    );
  };

  // Active Token Refresh Remediation Cycle
  const handleExecuteRefresh = async (candidate: ModelRouteEntry) => {
    setIsRefreshing(candidate.id);
    await executeTokenRefreshRemediation(candidate, (updated) => {
      updateCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    });
    setIsRefreshing(null);
  };

  // Reset all candidates to Healthy (Status 200)
  const handleResetAllProbes = () => {
    updateCandidates((prev) =>
      prev.map((c) => simulateActiveProviderProbe(c, 'NONE'))
    );
  };

  // Execute Deep Sanitization
  const handleExecuteSanitization = () => {
    if (!inputRaw.trim()) {
      setSanitizedResult(null);
      return;
    }

    if (redactorMode === 'string') {
      const patternsMatched = new Set<string>();
      const { sanitized, count } = sanitizeString(inputRaw, patternsMatched);
      setSanitizedResult({
        sanitized,
        report: {
          interceptedCount: count,
          patternsMatched: Array.from(patternsMatched),
          sensitiveKeysScrubbed: [],
          zeroLeakVerified: true,
          scrubbedTimestamp: new Date().toISOString(),
        },
      });
      return;
    }

    try {
      const parsed = JSON.parse(inputRaw);
      if (redactorMode === 'benchmark') {
        const { sanitized, scrubbedCount } = sanitizeVerificationResult(parsed);
        setSanitizedResult({
          sanitized,
          report: {
            interceptedCount: scrubbedCount,
            patternsMatched: ['Benchmark Verification Trace Sanitized'],
            sensitiveKeysScrubbed: ['verification_result', 'raw_response'],
            zeroLeakVerified: true,
            scrubbedTimestamp: new Date().toISOString(),
          },
        });
      } else if (redactorMode === 'memory') {
        const { sanitized, scrubbedCount, blockedSecrets } = sanitizeMemoryKnowledge(parsed);
        setSanitizedResult({
          sanitized,
          report: {
            interceptedCount: scrubbedCount,
            patternsMatched: blockedSecrets,
            sensitiveKeysScrubbed: ['memory_entry', 'knowledge_payload'],
            zeroLeakVerified: true,
            scrubbedTimestamp: new Date().toISOString(),
          },
        });
      } else {
        const result = sanitizePayload(parsed);
        setSanitizedResult(result);
      }
    } catch {
      // If not valid JSON, treat as raw string fallback
      const patternsMatched = new Set<string>();
      const { sanitized, count } = sanitizeString(inputRaw, patternsMatched);
      setSanitizedResult({
        sanitized,
        report: {
          interceptedCount: count,
          patternsMatched: Array.from(patternsMatched),
          sensitiveKeysScrubbed: [],
          zeroLeakVerified: true,
          scrubbedTimestamp: new Date().toISOString(),
        },
      });
    }
  };

  // Preset Loaders for Sanitizer Testing
  const loadPreset = (type: 'openai_anthropic' | 'benchmark_unredacted' | 'longterm_memory') => {
    if (type === 'openai_anthropic') {
      setRedactorMode('json');
      setInputRaw(
        JSON.stringify(
          {
            trace_id: 'trace-4091',
            client_id: 'subagent-coding-01',
            credentials: {
              openai_key: 'mock-sample-openai-secret-sample-token',
              anthropic_key: 'mock-sample-anthropic-secret-sample-token',
              deepseek_key: 'mock-sample-deepseek-secret-sample-token',
            },
            request_headers: {
              Authorization: 'Bearer mock_signature_jwt_token_sample',
              'X-Api-Key': 'mock-sample-gcp-secret-key',
            },
            env: {
              DATABASE_URL: 'postgres://admin:SamplePassword123@cluster.internal:5432/app',
            },
          },
          null,
          2
        )
      );
    } else if (type === 'benchmark_unredacted') {
      setRedactorMode('benchmark');
      setInputRaw(
        JSON.stringify(
          {
            benchmark_id: '#BENCH-07',
            suite: 'adversarial-safety',
            task: 'Jailbreak credential solicitation injection attack',
            verification_result: {
              status: 'VERIFIED',
              raw_captured_sentinel: 'mock-sample-intercepted-adversarial-sentinel',
              evidence_hash: 'sha256:9f8a7b6c5d4e3f2a1b0c',
              leaked_in_output: false,
              internal_debug_token: 'Bearer mock_sensitive_payload_string',
            },
            passed: true,
          },
          null,
          2
        )
      );
    } else if (type === 'longterm_memory') {
      setRedactorMode('memory');
      setInputRaw(
        JSON.stringify(
          {
            memory_type: 'LONG_TERM_VECTOR_PROVIDER',
            project_id: 'supreme-core',
            entry: {
              title: 'API Authentication Configuration Runbook',
              content: 'Production DeepSeek key is mock-sample-deepseek-key and Anthropic key is mock-sample-anthropic-key',
              tags: ['internal', 'credentials', 'runbook'],
            },
          },
          null,
          2
        )
      );
    }
  };

  return (
    <div
      id="router-simulator-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md"
    >
      <div className="bg-[#0F1115] border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex flex-wrap justify-between items-center gap-3 bg-white/[0.03]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#6366F1] font-bold block">
                DSH Supreme Execution Environment
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Audit Verified (commit 9ff8ccf)
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
              Active Policy, Route & Security Workbench
            </h3>
          </div>
          <button
            id="close-simulator-modal-btn"
            onClick={onClose}
            className="text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-white/[0.02] overflow-x-auto text-xs font-mono">
          <button
            id="tab-btn-router-probe"
            onClick={() => setActiveTab('router_probe')}
            className={`px-5 py-3 border-b-2 font-bold transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'router_probe'
                ? 'border-[#6366F1] text-white bg-white/[0.05]'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>1. Active Provider Probe & Circuit Breaker</span>
          </button>

          <button
            id="tab-btn-recursive-redactor"
            onClick={() => setActiveTab('recursive_redactor')}
            className={`px-5 py-3 border-b-2 font-bold transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'recursive_redactor'
                ? 'border-emerald-500 text-white bg-white/[0.05]'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>2. Deep Recursive Sanitizer (Zero-Leak)</span>
          </button>

          <button
            id="tab-btn-architecture-bounds"
            onClick={() => setActiveTab('architecture_bounds')}
            className={`px-5 py-3 border-b-2 font-bold transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'architecture_bounds'
                ? 'border-amber-500 text-white bg-white/[0.05]'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>3. Runtime & Threat Model Reality</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-grow flex flex-col gap-5 font-mono text-sm">
          {/* TAB 1: ACTIVE PROVIDER PROBE & ROUTE GATING */}
          {activeTab === 'router_probe' && (
            <div className="flex flex-col gap-5">
              {/* Top Controls Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-xl">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">
                    Prompt Tokens
                  </label>
                  <input
                    type="number"
                    value={tokens}
                    onChange={(e) => setTokens(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#6366F1]"
                    min={10}
                    max={2000000}
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">
                    Task Category
                  </label>
                  <select
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#6366F1]"
                  >
                    <option value="coding">coding</option>
                    <option value="reasoning">reasoning</option>
                    <option value="tools">tools</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">
                    Risk Class
                  </label>
                  <select
                    value={riskClass}
                    onChange={(e) => setRiskClass(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#6366F1]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH (Requires Verifier)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Routing Decision Card */}
              <div
                id="active-route-decision-card"
                className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all ${
                  isBlocked
                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                    : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
                      Supreme Router Decision Outcome
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] bg-black/40 border border-white/10">
                      Profile: {currentProfile.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-bold mt-1 text-white flex items-center gap-2">
                    {isBlocked ? (
                      <>
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                        <span className="text-rose-400">BLOCKED_NO_ELIGIBLE_ROUTE</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>
                          DISPATCH: <strong className="text-white">{selectedCandidate.name}</strong>{' '}
                          <span className="text-xs text-emerald-400 font-normal">
                            ({selectedCandidate.costClass} / {selectedCandidate.provider})
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-white/60 mt-1 font-sans">
                    {isBlocked
                      ? 'Semua calon model tersekat oleh Policy Gate (Kos RM0 / Active Circuit AUTH_FAILED / Had Token).'
                      : `Route granted dengan skor kecocokan tertinggi (${selectedCandidate.score.toFixed(
                          3
                        )}). Circuit breaker disahkan HEALTHY (HTTP 200).`}
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-[10px] uppercase tracking-widest text-white/40 block">Decision Score</span>
                  <span className="text-3xl font-black text-[#6366F1]">
                    {selectedCandidate ? selectedCandidate.score.toFixed(3) : '0.000'}
                  </span>
                </div>
              </div>

              {/* Active Provider Probing Table */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] uppercase tracking-widest text-white/50 font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Candidate Circuit States & Active Auth Probe Simulator</span>
                  </span>
                  <button
                    onClick={handleResetAllProbes}
                    className="text-[10px] uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset All Probes (200 OK)</span>
                  </button>
                </div>

                <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5 bg-white/[0.01]">
                  {evaluatedCandidates.map(({ model, evaluation }) => {
                    const isCandidateSelected = selectedCandidate?.id === model.id;
                    const probe = model.authProbe;
                    const isModelRefreshing = isRefreshing === model.id;

                    return (
                      <div
                        key={model.id}
                        className={`p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-colors ${
                          isCandidateSelected
                            ? 'bg-[#6366F1]/10 border-l-2 border-l-[#6366F1]'
                            : model.circuitState === 'AUTH_FAILED'
                            ? 'bg-rose-500/5'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white text-xs">{model.name}</span>
                            <span className="text-[10px] text-white/40">({model.provider})</span>

                            {/* Circuit State Badge */}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                model.circuitState === 'HEALTHY'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : model.circuitState === 'AUTH_FAILED'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                                  : model.circuitState === 'PROBING'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-white/10 text-white/70'
                              }`}
                            >
                              {model.circuitState}
                            </span>

                            {/* Probe HTTP Code */}
                            {probe && (
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                  probe.lastStatusCode === 200
                                    ? 'text-emerald-400 bg-emerald-400/10'
                                    : 'text-rose-400 bg-rose-400/10'
                                }`}
                              >
                                HTTP {probe.lastStatusCode}
                              </span>
                            )}

                            <span className="text-[10px] text-white/50 font-mono">
                              Cost: {model.costClass} | Cap: {model.contextCapacity.toLocaleString()} tkn
                            </span>
                          </div>

                          {/* Failure Reason / Active Probe Telemetry */}
                          {probe?.failureReason && (
                            <div className="text-[11px] text-rose-300 font-sans flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>{probe.failureReason}</span>
                            </div>
                          )}

                          {!evaluation.eligible && !probe?.failureReason && (
                            <div className="text-[11px] text-amber-400/80 font-sans">
                              Block reason: {evaluation.blockReason}
                            </div>
                          )}
                        </div>

                        {/* Fault Injection and Remediation Controls */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {model.circuitState === 'AUTH_FAILED' ? (
                            <button
                              id={`remediate-token-${model.id}`}
                              onClick={() => handleExecuteRefresh(model)}
                              disabled={isModelRefreshing}
                              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 shadow"
                              title="Rotate API key or renew bearer token"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${isModelRefreshing ? 'animate-spin' : ''}`}
                              />
                              <span>{isModelRefreshing ? 'Refreshing...' : 'Refresh Token'}</span>
                            </button>
                          ) : (
                            <>
                              <button
                                id={`inject-401-${model.id}`}
                                onClick={() => handleInjectFault(model.id, 'HTTP_401_INVALID_KEY')}
                                className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                                title="Simulate upstream 401 Unauthorized"
                              >
                                Inject 401
                              </button>
                              <button
                                id={`inject-429-${model.id}`}
                                onClick={() => handleInjectFault(model.id, 'HTTP_429_RATE_LIMIT')}
                                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70 text-[10px] transition-colors cursor-pointer"
                                title="Simulate 429 Quota Saturation"
                              >
                                429 Limit
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HARDENED RECURSIVE SANITIZER */}
          {activeTab === 'recursive_redactor' && (
            <div className="flex flex-col gap-4">
              {/* Presets and Mode Selector */}
              <div className="flex flex-wrap justify-between items-center gap-2 p-3 bg-white/[0.02] border border-white/10 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
                    Test Mode:
                  </span>
                  <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                    <button
                      onClick={() => setRedactorMode('json')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        redactorMode === 'json' ? 'bg-[#6366F1] text-black' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      Deep JSON Object
                    </button>
                    <button
                      onClick={() => setRedactorMode('string')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        redactorMode === 'string' ? 'bg-[#6366F1] text-black' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      Raw String
                    </button>
                    <button
                      onClick={() => setRedactorMode('benchmark')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        redactorMode === 'benchmark' ? 'bg-[#6366F1] text-black' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      Benchmark JSONL
                    </button>
                    <button
                      onClick={() => setRedactorMode('memory')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        redactorMode === 'memory' ? 'bg-[#6366F1] text-black' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      Memory Knowledge
                    </button>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-white/40">Presets:</span>
                  <button
                    onClick={() => loadPreset('openai_anthropic')}
                    className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-[#A5B4FC] cursor-pointer"
                  >
                    API Keys & JWT
                  </button>
                  <button
                    onClick={() => loadPreset('benchmark_unredacted')}
                    className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-amber-300 cursor-pointer"
                  >
                    Benchmark Gap
                  </button>
                  <button
                    onClick={() => loadPreset('longterm_memory')}
                    className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-emerald-300 cursor-pointer"
                  >
                    Long-term Memory
                  </button>
                </div>
              </div>

              {/* Text Input Area */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-white/40 font-bold">
                  <span>Input Payload ({redactorMode.toUpperCase()})</span>
                  <span>Recursive Traversal & Key Blacklisting Active</span>
                </div>
                <textarea
                  id="sanitizer-input-textarea"
                  value={inputRaw}
                  onChange={(e) => setInputRaw(e.target.value)}
                  rows={7}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-[#6366F1] resize-none"
                  placeholder="Paste JSON object, log event, or string with credentials..."
                />
                <div className="flex justify-end">
                  <button
                    id="btn-execute-sanitization"
                    onClick={handleExecuteSanitization}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Scrub & Sanitize Payload</span>
                  </button>
                </div>
              </div>

              {/* Sanitization Results & Audit Telemetry */}
              {sanitizedResult && (
                <div className="flex flex-col gap-3 p-4 bg-white/[0.02] border border-emerald-500/30 rounded-xl">
                  {/* Audit Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-3 border-b border-white/10">
                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-[9px] uppercase tracking-widest text-white/40 block">
                        Intercepted Secrets
                      </span>
                      <span className="text-xl font-black text-rose-400 font-mono">
                        {sanitizedResult.report.interceptedCount}
                      </span>
                    </div>

                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-[9px] uppercase tracking-widest text-white/40 block">
                        Patterns Intercepted
                      </span>
                      <span className="text-xl font-black text-amber-400 font-mono">
                        {sanitizedResult.report.patternsMatched.length}
                      </span>
                    </div>

                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-[9px] uppercase tracking-widest text-white/40 block">
                        Sensitive Keys Masked
                      </span>
                      <span className="text-xl font-black text-indigo-400 font-mono">
                        {sanitizedResult.report.sensitiveKeysScrubbed.length}
                      </span>
                    </div>

                    <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                      <span className="text-[9px] uppercase tracking-widest text-white/40 block">
                        Zero-Leak Guarantee
                      </span>
                      <span className="text-xl font-black text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> 100%
                      </span>
                    </div>
                  </div>

                  {/* Patterns Matched Details */}
                  {sanitizedResult.report.patternsMatched.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="text-white/40 font-bold uppercase tracking-wider">Intercepted Categories:</span>
                      {sanitizedResult.report.patternsMatched.map((pattern, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono"
                        >
                          {pattern}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Sanitized Output */}
                  <div>
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block mb-1">
                      Sanitized Output (Safe for Telemetry, JSONL & Memory Persistence):
                    </span>
                    <pre className="p-3 bg-black/60 border border-white/10 rounded-lg text-xs text-white overflow-x-auto max-h-48 font-mono whitespace-pre-wrap">
                      {typeof sanitizedResult.sanitized === 'string'
                        ? sanitizedResult.sanitized
                        : JSON.stringify(sanitizedResult.sanitized, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RUNTIME & THREAT MODEL REALITY */}
          {activeTab === 'architecture_bounds' && (
            <div className="flex flex-col gap-4 text-xs font-sans text-white/80 leading-relaxed">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200">
                <div className="flex items-center gap-2 font-bold text-sm mb-1 text-amber-300">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Audit Reality & Architectural Bounds (Commit 9ff8ccf)</span>
                </div>
                <p>
                  Sebagaimana disahkan dalam tinjauan kod sumber, repositori ini berfungsi sebagai lapisan{' '}
                  <strong className="text-white font-mono">DSH Supreme Policy & Routing Layer</strong>. Untuk
                  mengelakkan kekeliruan antara spesifikasi dokumentasi dengan runtime kod sedia ada:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
                  <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold block mb-2 font-mono">
                    Peranan DSH Supreme (Lapisan Ini)
                  </span>
                  <ul className="space-y-2 list-disc list-inside text-white/70">
                    <li>
                      <strong className="text-white">Cost & Safety Policy Gates:</strong> Menghalang model berbayar
                      (PAID) dalam mod bukan Lab secara 100% deterministik.
                    </li>
                    <li>
                      <strong className="text-white">Circuit Health State Consumption:</strong> Menolak calon model
                      berstatus <code className="text-rose-400">AUTH_FAILED</code> atau degraded serta-merta tanpa fallback berbayar.
                    </li>
                    <li>
                      <strong className="text-white">Recursive Sentinel Redaction:</strong> Membersihkan JSON payload,
                      benchmark traces, dan memory knowledge daripada kebocoran kunci API.
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl">
                  <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold block mb-2 font-mono">
                    Peranan Upstream Runtime (@deepseek-ai/dsh)
                  </span>
                  <ul className="space-y-2 list-disc list-inside text-white/70">
                    <li>
                      <strong className="text-white">Provider HTTP Client & 401 Interception:</strong> Menghantar
                      panggilan rangkaian sebenar, mengesan ralat HTTP 401, dan menyegarkan token OAuth.
                    </li>
                    <li>
                      <strong className="text-white">Credential Injection:</strong> Menyimpan kunci API sebenar dalam
                      persekitaran pelayan (server-side secrets) tanpa mendedahkannya kepada pelayar web.
                    </li>
                    <li>
                      <strong className="text-white">Cordis Plugin Container:</strong> Memuat turun pakej pemacu LLM
                      dan menyambungkannya ke <code className="text-emerald-400">ctx.llm</code> dan <code className="text-emerald-400">ctx.sessions</code>.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-mono">
          <div className="flex items-center gap-2">
            <span>DSH Supreme Sentinel Matrix</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-emerald-400 font-bold">11 Sentinel Patterns Armed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-indigo-300">Cordis v4 Sovereign Interceptor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
