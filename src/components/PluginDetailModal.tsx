import { useState, useRef, useEffect } from 'react';
import {
  Download,
  Check,
  Copy,
  Code,
  FileText,
  CheckCircle2,
  X,
  ExternalLink,
  Terminal,
  GitBranch,
  BookOpen,
} from 'lucide-react';
import { PluginMeta } from '../types.ts';
import { SyncGuideModal } from './SyncGuideModal.tsx';

interface PluginDetailModalProps {
  plugin: PluginMeta | null;
  onClose: () => void;
}

export function PluginDetailModal({ plugin, onClose }: PluginDetailModalProps) {
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showConfigPreview, setShowConfigPreview] = useState<boolean>(true);
  const [previewTab, setPreviewTab] = useState<'json' | 'yaml' | 'cli'>('json');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [showSyncGuide, setShowSyncGuide] = useState<boolean>(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  if (!plugin) return null;

  const sanitizedName = plugin.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const dshPackageId = `@dsh/plugin-${plugin.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

  // DeepSeek Harness (deepseek-ai/deepseek-harness) compatible runtime configuration
  const pluginConfigObject = {
    $schema: 'https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/main/schemas/runtime-plugin-v4.json',
    upstream: {
      repository: 'https://github.com/deepseek-ai/deepseek-harness.git',
      package: '@deepseek-ai/dsh',
      framework: 'DeepSeek Harness (Cordis Plugin Architecture)',
      targetBranch: 'main',
      specVersion: '4.0.0-rc.9',
      compatRange: '>=4.0.0',
    },
    plugin: {
      id: plugin.id,
      name: dshPackageId,
      displayName: plugin.name,
      version: plugin.version || '4.0.0',
      category: plugin.category,
      executionClass: plugin.executionClass,
      executionStatus: plugin.executionStatus,
      description: plugin.description,
    },
    runtime: {
      targetEnvironment: 'DSH_CORP_SOVEREIGN',
      nodeBinding: 'KUALA_LUMPUR_04',
      accessLevel: 'ADMINISTRATOR_LEVEL_0',
      protocol: 'ALPHA_SOVEREIGN',
      kernel: 'cordis-v4',
      container: 'Cordis v4 Sovereign Service Container',
      mode: 'ptc',
      permissions: {
        level: 'workspace-write',
        enforceDeterminism: true,
        zeroLeakSanitization: true,
        maxDelegationDepth: 2,
      },
    },
    settings: {
      variable: plugin.variable,
      policyGating: plugin.policyGating,
      executionClass: plugin.executionClass,
      executionStatus: plugin.executionStatus,
      enforceDeterminism: true,
      zeroLeakSanitization: true,
      maxDelegationDepth: 2,
      metricsBaseline: {
        targetInvocations: plugin.metrics.invocations,
        maxLatencyMs: plugin.metrics.latencyMs,
        allowedErrorRate: plugin.metrics.errorRate,
      },
    },
    sync: {
      upstreamRepo: 'https://github.com/deepseek-ai/deepseek-harness.git',
      patchFilePath: 'cordis.patch.yml',
      patchDirective: `plugins:\n  - name: "${dshPackageId}"\n    config: ./plugins/${sanitizedName}-config.json`,
      cliCommand: `npx @deepseek-ai/dsh --plugin ./plugins/${sanitizedName}-config.json`,
    },
    exportedAt: new Date().toISOString(),
  };

  const configJsonString = JSON.stringify(pluginConfigObject, null, 2);

  const cordisPatchYamlString = `# cordis.patch.yml - deepseek-ai/deepseek-harness runtime patch
# Upstream Specification: https://github.com/deepseek-ai/deepseek-harness.git
# Plugin: ${plugin.name} (${plugin.id})
plugins:
  - name: "${dshPackageId}"
    version: "${plugin.version || '4.0.0'}"
    enabled: true
    executionClass: "${plugin.executionClass}"
    settings:
      variable: "${plugin.variable}"
      policyGating: "${plugin.policyGating}"
      enforceDeterminism: true
      zeroLeakSanitization: true
      maxDelegationDepth: 2
    metrics:
      targetInvocations: ${plugin.metrics.invocations}
      latencyThresholdMs: ${plugin.metrics.latencyMs}
      errorRateAllowance: ${plugin.metrics.errorRate}`;

  const cliCommandString = `npx @deepseek-ai/dsh --plugin ./plugins/${sanitizedName}-config.json --mode ptc`;

  const activeSnippetString =
    previewTab === 'json'
      ? configJsonString
      : previewTab === 'yaml'
      ? cordisPatchYamlString
      : cliCommandString;

  const handleDownloadConfig = () => {
    try {
      const blob = new Blob([configJsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sanitizedName}-config.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);

      // Trigger temporary status toast notification
      setShowToast(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setShowToast(false);
      }, 3500);
    } catch (err) {
      console.error('Failed to download plugin configuration:', err);
    }
  };

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(activeSnippetString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy config:', err);
    }
  };

  return (
    <div
      id="plugin-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="plugin-detail-modal"
        className="relative bg-[#0F1115] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Status Toast Notification */}
        {showToast && (
          <div
            id="status-toast-notification"
            data-testid="status-toast-notification"
            role="status"
            aria-live="polite"
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-[#0A1A12]/95 border border-emerald-500/50 text-emerald-100 rounded-xl shadow-2xl shadow-emerald-950/70 backdrop-blur-md max-w-[92%] sm:max-w-md transition-all animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex flex-col min-w-0 pr-1">
              <span className="font-bold text-white text-xs tracking-tight">
                Configuration Exported Successfully
              </span>
              <span className="text-[10px] text-emerald-300/80 truncate font-mono">
                {sanitizedName}-config.json synced with deepseek-ai/deepseek-harness runtime
              </span>
            </div>
            <button
              id="dismiss-toast-btn"
              onClick={() => setShowToast(false)}
              className="ml-auto text-emerald-400/60 hover:text-white p-1 rounded transition-colors cursor-pointer shrink-0"
              title="Dismiss toast"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-baseline bg-white/5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#6366F1] font-bold">
                Plugin Inspection / {plugin.id}
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                DSH v4 Runtime Ready
              </span>
            </div>
            <h3 className="text-2xl font-black tracking-tight text-white">{plugin.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="close-plugin-detail-modal-btn"
              onClick={onClose}
              className="text-[10px] uppercase tracking-widest font-bold px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5 font-mono text-sm overflow-y-auto">
          {/* Upstream DeepSeek Harness Sync Banner */}
          <div
            id="upstream-harness-banner"
            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs"
          >
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#6366F1]" />
              <span className="text-white/60">Target Runtime:</span>
              <span className="text-white font-bold font-mono">@deepseek-ai/dsh (Cordis v4)</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                id="sync-guide-link"
                data-testid="sync-guide-link"
                onClick={() => setShowSyncGuide(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                title="Open DeepSeek Harness Sync Guide"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Sync Guide</span>
              </button>
              <a
                id="upstream-repo-link"
                href="https://github.com/deepseek-ai/deepseek-harness.git"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-[#A5B4FC] hover:text-white transition-colors underline-offset-2 hover:underline"
              >
                <span>deepseek-ai/deepseek-harness</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
            <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">
              Governance Description
            </span>
            <p className="font-sans text-[#E0E2E6] text-sm leading-relaxed">{plugin.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Category</span>
              <span className="text-[#6366F1] font-bold">{plugin.category}</span>
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Execution Status</span>
              <span className="text-emerald-400 font-bold">{plugin.executionStatus}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Invocations</span>
              <span className="text-xl font-bold text-white">{plugin.metrics.invocations.toLocaleString()}</span>
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Latency</span>
              <span className="text-xl font-bold text-[#6366F1]">{plugin.metrics.latencyMs}ms</span>
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Error Rate</span>
              <span className="text-xl font-bold text-emerald-400">{plugin.metrics.errorRate}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Variable Binding</span>
              <span className="text-xs text-indigo-300 font-medium">{plugin.variable}</span>
            </div>
            <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
              <span className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Policy Gate Binding</span>
              <span className="text-xs text-amber-300 font-medium">{plugin.policyGating}</span>
            </div>
          </div>

          {/* DSH Environment Configuration Action Card */}
          <div
            id="dsh-configuration-panel"
            className="p-4 bg-indigo-950/20 border border-[#6366F1]/30 rounded-xl flex flex-col gap-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#6366F1]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  DSH Runtime Export Specification
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10 text-[10px]">
                  <button
                    onClick={() => setPreviewTab('json')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      previewTab === 'json' ? 'bg-[#6366F1] text-white font-bold' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    JSON Manifest
                  </button>
                  <button
                    onClick={() => setPreviewTab('yaml')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      previewTab === 'yaml' ? 'bg-[#6366F1] text-white font-bold' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    cordis.patch.yml
                  </button>
                  <button
                    onClick={() => setPreviewTab('cli')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      previewTab === 'cli' ? 'bg-[#6366F1] text-white font-bold' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    CLI Flag
                  </button>
                </div>
                <button
                  id="toggle-config-preview-btn"
                  onClick={() => setShowConfigPreview(!showConfigPreview)}
                  className="flex items-center gap-1 text-[11px] text-[#A5B4FC] hover:text-white transition-colors cursor-pointer ml-1"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>{showConfigPreview ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-white/60 font-sans">
              Konfigurasi ini disinkronkan secara presisi dengan runtime spesifikasi{' '}
              <strong className="text-white font-medium">deepseek-ai/deepseek-harness</strong>. Dapat langsung dimuat
              oleh CLI <code className="text-[#A5B4FC]">dsh</code> atau di-patch ke dalam berkas{' '}
              <code className="text-[#A5B4FC]">cordis.patch.yml</code>.{' '}
              <button
                id="sync-guide-inline-link"
                onClick={() => setShowSyncGuide(true)}
                className="text-emerald-400 hover:text-emerald-300 underline font-bold cursor-pointer inline-flex items-center gap-1"
              >
                <span>Lihat Panduan Sinkronisasi (Sync Guide)</span>
                <BookOpen className="w-3 h-3 inline" />
              </button>
            </p>

            {/* Optional JSON / YAML / CLI Preview */}
            {showConfigPreview && (
              <div className="relative mt-2">
                <pre className="p-3 bg-black/60 border border-white/10 rounded-lg text-[11px] text-emerald-400 overflow-x-auto max-h-52 font-mono leading-relaxed whitespace-pre">
                  {activeSnippetString}
                </pre>
                <button
                  id="copy-plugin-config-btn"
                  onClick={handleCopyConfig}
                  className="absolute top-2 right-2 flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Download Configuration Button */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-[10px] uppercase tracking-widest text-white/40 flex flex-wrap items-center gap-2">
            <span>deepseek-ai/deepseek-harness</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-[#6366F1] font-bold">100% Deterministic</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <button
              id="footer-sync-guide-btn"
              onClick={() => setShowSyncGuide(true)}
              className="text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1 cursor-pointer font-bold lowercase first-letter:uppercase"
            >
              <BookOpen className="w-3 h-3" />
              <span>Sync Guide</span>
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              id="download-configuration-btn"
              data-testid="download-configuration-btn"
              onClick={handleDownloadConfig}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E0] active:bg-[#4346C8] text-white text-xs font-bold tracking-wide transition-all shadow-lg shadow-indigo-600/30 cursor-pointer w-full sm:w-auto"
            >
              {downloaded ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Configuration Downloaded</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Configuration</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* DeepSeek Harness Runtime Sync Guide Modal */}
      <SyncGuideModal
        plugin={plugin}
        isOpen={showSyncGuide}
        onClose={() => setShowSyncGuide(false)}
      />
    </div>
  );
}
