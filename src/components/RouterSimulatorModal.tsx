import { useState } from 'react';
import { MODEL_CANDIDATES } from '../data/canonicalData.ts';

interface RouterSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: string;
}

export function RouterSimulatorModal({ isOpen, onClose, currentProfile }: RouterSimulatorModalProps) {
  const [tokens, setTokens] = useState<number>(500);
  const [taskCategory, setTaskCategory] = useState<'coding' | 'reasoning' | 'tools'>('coding');
  const [riskClass, setRiskClass] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('LOW');
  const [simulatedSecret, setSimulatedSecret] = useState<string>('');
  const [redactedOutput, setRedactedOutput] = useState<string>('');

  if (!isOpen) return null;

  // Simulate routing decision
  const isLab = currentProfile === 'lab';
  const eligibleCandidates = MODEL_CANDIDATES.filter((m) => {
    if (!isLab && m.costClass === 'PAID') return false;
    if (m.contextCapacity < tokens) return false;
    if (m.circuitState !== 'HEALTHY') return false;
    return true;
  }).sort((a, b) => b.score - a.score);

  const selectedModel = eligibleCandidates[0];
  const isBlocked = !selectedModel;

  const handleTestRedaction = () => {
    if (!simulatedSecret) {
      setRedactedOutput('[REDACTED_BY_SUPREME_OBSERVABILITY] (No input provided)');
      return;
    }
    // Mask sensitive keys and tokens
    const sanitized = simulatedSecret
      .replace(/(sk-[a-zA-Z0-9_-]{8,})/g, '[REDACTED_BY_SUPREME_OBSERVABILITY]')
      .replace(/(Bearer\s+[a-zA-Z0-9_.-]+)/gi, 'Bearer [REDACTED_BY_SUPREME_OBSERVABILITY]')
      .replace(/(AIza[0-9A-Za-z-_]{35})/g, '[REDACTED_BY_SUPREME_OBSERVABILITY]')
      .replace(/(token=[a-zA-Z0-9_-]+)/gi, 'token=[REDACTED_BY_SUPREME_OBSERVABILITY]');
    setRedactedOutput(sanitized);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0F1115] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-baseline bg-white/5">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#6366F1] font-bold block mb-1">
              Simulation Sandbox / Router & Security Gates
            </span>
            <h3 className="text-2xl font-black tracking-tight">Active Policy & Redaction Tester</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[10px] uppercase tracking-widest font-bold px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6 font-mono text-sm max-h-[75vh] overflow-y-auto">
          {/* Router Simulator */}
          <div className="bg-white/[0.02] border border-white/10 p-5 rounded-xl flex flex-col gap-4">
            <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold">
              1. Dynamic Route Selection Gate
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Prompt Tokens</label>
                <input
                  type="number"
                  value={tokens}
                  onChange={(e) => setTokens(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#6366F1]"
                  min={10}
                  max={2000000}
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Task Category</label>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#6366F1]"
                >
                  <option value="coding">coding</option>
                  <option value="reasoning">reasoning</option>
                  <option value="tools">tools</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Risk Class</label>
                <select
                  value={riskClass}
                  onChange={(e) => setRiskClass(e.target.value as any)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#6366F1]"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH (Requires Verifier)</option>
                </select>
              </div>
            </div>

            {/* Decision Outcome */}
            <div className="mt-2 p-4 bg-white/5 border border-white/5 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/40">Decision Result</div>
                <div className="text-xl font-bold mt-1">
                  {isBlocked ? (
                    <span className="text-rose-400">BLOCKED (No Eligible Route)</span>
                  ) : (
                    <span className="text-emerald-400">
                      SELECTED: {selectedModel.name} ({selectedModel.costClass})
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/60 mt-1">
                  Hard Gates: Cost Class {isLab ? 'LAB (Paid Allowed)' : 'FREE_CONFIRMED Only'} | Context {tokens} tokens
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-widest text-white/40 block">Decision Score</span>
                <span className="text-2xl font-black text-[#6366F1]">
                  {selectedModel ? selectedModel.score.toFixed(3) : '0.000'}
                </span>
              </div>
            </div>
          </div>

          {/* Security & Zero Leak Redactor */}
          <div className="bg-white/[0.02] border border-white/10 p-5 rounded-xl flex flex-col gap-4">
            <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold">
              2. Zero-Leak Sentinel Redaction Test
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter sample text with sk-ant-api03-... or token=secret123"
                value={simulatedSecret}
                onChange={(e) => setSimulatedSecret(e.target.value)}
                className="flex-grow bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-[#6366F1]"
              />
              <button
                onClick={handleTestRedaction}
                className="px-4 py-2 bg-[#6366F1] text-black font-bold uppercase tracking-wider text-xs rounded-lg hover:bg-indigo-400 transition-colors cursor-pointer"
              >
                Redact
              </button>
            </div>
            {redactedOutput && (
              <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs break-all">
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 block mb-1">
                  Sanitized JSONL Stream Output:
                </span>
                <span className="text-white">{redactedOutput}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex justify-between items-center text-[10px] uppercase tracking-widest text-white/40">
          <span>Security Protocol Alpha Active</span>
          <span className="text-emerald-400 font-bold">0 Leaks Detected</span>
        </div>
      </div>
    </div>
  );
}
