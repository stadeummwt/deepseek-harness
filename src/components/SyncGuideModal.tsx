import { useState } from 'react';
import {
  X,
  Check,
  Copy,
  Terminal,
  FileCode,
  BookOpen,
  ExternalLink,
  GitBranch,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { PluginMeta } from '../types.ts';

interface SyncGuideModalProps {
  plugin: PluginMeta;
  isOpen: boolean;
  onClose: () => void;
}

export function SyncGuideModal({ plugin, isOpen, onClose }: SyncGuideModalProps) {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  if (!isOpen) return null;

  const sanitizedName = plugin.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const dshPackageId = `@dsh/plugin-${plugin.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
  const configFilename = `${sanitizedName}-config.json`;

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippet(id);
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const cliSnippet = `# 1. Move the exported file to your harness workspace
mkdir -p ./plugins
mv ~/Downloads/${configFilename} ./plugins/

# 2. Launch DeepSeek Harness with the plugin configuration injected
npx @deepseek-ai/dsh --plugin ./plugins/${configFilename} --mode ptc`;

  const patchYamlSnippet = `# cordis.patch.yml (place in your DeepSeek Harness repository root)
plugins:
  - name: "${dshPackageId}"
    config: "./plugins/${configFilename}"
    enabled: true
    executionClass: "${plugin.executionClass}"
    settings:
      variable: "${plugin.variable}"
      policyGating: "${plugin.policyGating}"
      enforceDeterminism: true
      zeroLeakSanitization: true
      maxDelegationDepth: 2`;

  const programmaticSnippet = `import { Context } from 'cordis';
import pluginConfig from './plugins/${configFilename}';

const app = new Context();

// Register the exported DSH Supreme plugin
await app.plugin(pluginConfig.plugin.name, pluginConfig.settings);

// Start the DeepSeek Harness runtime loop
await app.start();
console.log('[DSH:Runtime] ${plugin.name} loaded and verified.');`;

  return (
    <div
      id="dsh-sync-guide-backdrop"
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="dsh-sync-guide-modal"
        data-testid="dsh-sync-guide-modal"
        className="bg-[#0B0D12] border border-indigo-500/30 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col font-mono"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-[#818cf8]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-[#818cf8] font-bold">
                  Runtime Sync Guide
                </span>
                <span className="text-[10px] text-white/40">v4.0.0-rc.9</span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Linking Configurations into DeepSeek Harness
              </h3>
            </div>
          </div>
          <button
            id="close-sync-guide-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            aria-label="Close Sync Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Runtime Info Bar */}
        <div className="px-5 py-2.5 bg-indigo-950/30 border-b border-indigo-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-white/70">
            <GitBranch className="w-3.5 h-3.5 text-[#818cf8]" />
            <span>Target Repo:</span>
            <a
              href="https://github.com/deepseek-ai/deepseek-harness.git"
              target="_blank"
              rel="noreferrer"
              className="text-[#A5B4FC] hover:underline font-bold inline-flex items-center gap-1"
            >
              deepseek-ai/deepseek-harness
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Plugin: {dshPackageId}</span>
          </div>
        </div>

        {/* Interactive Steps Navigation */}
        <div className="grid grid-cols-3 border-b border-white/10 bg-white/[0.02] text-xs">
          <button
            id="step-tab-1"
            onClick={() => setActiveStep(1)}
            className={`py-3 px-2 text-center font-bold transition-colors cursor-pointer border-b-2 ${
              activeStep === 1
                ? 'border-[#6366F1] text-white bg-white/5'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            1. Placement & Directory
          </button>
          <button
            id="step-tab-2"
            onClick={() => setActiveStep(2)}
            className={`py-3 px-2 text-center font-bold transition-colors cursor-pointer border-b-2 ${
              activeStep === 2
                ? 'border-[#6366F1] text-white bg-white/5'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            2. Runtime Linking
          </button>
          <button
            id="step-tab-3"
            onClick={() => setActiveStep(3)}
            className={`py-3 px-2 text-center font-bold transition-colors cursor-pointer border-b-2 ${
              activeStep === 3
                ? 'border-[#6366F1] text-white bg-white/5'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            3. Verification & Gating
          </button>
        </div>

        {/* Step Contents */}
        <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-4 text-xs">
          {activeStep === 1 && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <span className="text-[10px] uppercase tracking-widest text-[#818cf8] font-bold block mb-1">
                  Directory Placement Architecture
                </span>
                <p className="text-white/70 font-sans leading-relaxed mb-3">
                  DeepSeek Harness (DSH) utilizes the Cordis v4 plugin container. Save the exported{' '}
                  <code className="text-emerald-400 font-mono bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
                    {configFilename}
                  </code>{' '}
                  directly into your harness project&apos;s plugins subdirectory.
                </p>

                {/* Directory tree representation */}
                <div className="bg-black/60 border border-white/10 rounded-lg p-3 text-emerald-400 font-mono text-[11px] leading-relaxed">
                  <div>deepseek-harness/</div>
                  <div>├── package.json</div>
                  <div>├── cordis.patch.yml &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-white/40"># Optional runtime patch file</span></div>
                  <div>├── plugins/</div>
                  <div>│&nbsp;&nbsp; └── <strong className="text-white bg-indigo-900/60 px-1 rounded">{configFilename}</strong> &nbsp;&nbsp;<span className="text-emerald-300">&larr; Place exported JSON here</span></div>
                  <div>└── src/</div>
                </div>
              </div>

              <div className="p-4 bg-indigo-950/20 border border-[#6366F1]/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-white/70 font-bold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-[#818cf8]" />
                    Quick Terminal Setup
                  </span>
                  <button
                    onClick={() => copyToClipboard(cliSnippet, 'step1')}
                    className="flex items-center gap-1 text-[10px] text-[#A5B4FC] hover:text-white px-2 py-0.5 bg-white/10 rounded transition-colors cursor-pointer"
                  >
                    {copiedSnippet === 'step1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet === 'step1' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-black/60 rounded-lg border border-white/10 text-emerald-300 font-mono text-[11px] overflow-x-auto whitespace-pre">
                  {cliSnippet}
                </pre>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div className="flex flex-col gap-4">
              {/* Option A: cordis.patch.yml */}
              <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#818cf8]" />
                    <span className="text-xs font-bold text-white">Method A: Declarative cordis.patch.yml</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(patchYamlSnippet, 'patch')}
                    className="flex items-center gap-1 text-[10px] text-[#A5B4FC] hover:text-white px-2 py-0.5 bg-white/10 rounded transition-colors cursor-pointer"
                  >
                    {copiedSnippet === 'patch' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet === 'patch' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-white/60 font-sans mb-3 text-[11px]">
                  Recommended for persistent configurations. DSH loads this patch automatically across all profiles (web, headless, or SDK).
                </p>
                <pre className="p-3 bg-black/60 rounded-lg border border-white/10 text-emerald-300 font-mono text-[11px] overflow-x-auto whitespace-pre">
                  {patchYamlSnippet}
                </pre>
              </div>

              {/* Option B: Programmatic */}
              <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[#818cf8]" />
                    <span className="text-xs font-bold text-white">Method B: Programmatic Node.js / Cordis v4</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(programmaticSnippet, 'code')}
                    className="flex items-center gap-1 text-[10px] text-[#A5B4FC] hover:text-white px-2 py-0.5 bg-white/10 rounded transition-colors cursor-pointer"
                  >
                    {copiedSnippet === 'code' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet === 'code' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-white/60 font-sans mb-3 text-[11px]">
                  For custom harness host applications embedding the DeepSeek agent loop directly in TypeScript.
                </p>
                <pre className="p-3 bg-black/60 rounded-lg border border-white/10 text-emerald-300 font-mono text-[11px] overflow-x-auto whitespace-pre">
                  {programmaticSnippet}
                </pre>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl flex flex-col gap-3">
                <span className="text-[10px] uppercase tracking-widest text-[#818cf8] font-bold">
                  Runtime Verification Checklist
                </span>
                <p className="text-white/70 font-sans text-xs">
                  Upon launching DeepSeek Harness with this plugin, verify the following in your runtime console:
                </p>

                <div className="space-y-2.5 mt-1 font-sans">
                  <div className="p-2.5 bg-black/40 border border-emerald-500/20 rounded-lg flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-white font-semibold block text-xs">Kernel Initialization</span>
                      <span className="text-white/50 text-[11px] font-mono">
                        [cordis:v4] Plugin {dshPackageId} registered with status: {plugin.executionStatus}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-black/40 border border-emerald-500/20 rounded-lg flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-white font-semibold block text-xs">Policy Gate Enforcement</span>
                      <span className="text-white/50 text-[11px] font-mono">
                        Gate constraint active: {plugin.policyGating} (Determinism: 100%)
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-black/40 border border-emerald-500/20 rounded-lg flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-white font-semibold block text-xs">Variable Binding</span>
                      <span className="text-white/50 text-[11px] font-mono">
                        Context key &apos;{plugin.variable}&apos; initialized with zero-leak sentinel
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex items-center justify-between">
                <div className="text-xs text-white/80 font-sans">
                  Need the latest upstream release of DeepSeek Harness?
                </div>
                <a
                  href="https://github.com/deepseek-ai/deepseek-harness.git"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <span>Clone Repo</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
              disabled={activeStep === 1}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              &larr; Previous
            </button>
            <button
              onClick={() => setActiveStep((prev) => Math.min(3, prev + 1))}
              disabled={activeStep === 3}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              Next &rarr;
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#6366F1] hover:bg-[#5254E0] text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
