import { useState, useRef, useEffect } from 'react';
import { Download, Check, Copy, Code, FileText, CheckCircle2, X } from 'lucide-react';
import { PluginMeta } from '../types.ts';

interface PluginDetailModalProps {
  plugin: PluginMeta | null;
  onClose: () => void;
}

export function PluginDetailModal({ plugin, onClose }: PluginDetailModalProps) {
  const [downloaded, setDownloaded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showConfigPreview, setShowConfigPreview] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  if (!plugin) return null;

  // Construct comprehensive DSH environment configuration object
  const pluginConfigObject = {
    $schema: 'https://cordis.dsh.internal/schemas/v4/plugin-config.json',
    dshVersion: '4.0.0-rc.9',
    targetEnvironment: 'DSH_CORP_SOVEREIGN',
    exportedAt: new Date().toISOString(),
    plugin: {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      category: plugin.category,
      executionClass: plugin.executionClass,
      executionStatus: plugin.executionStatus,
      description: plugin.description,
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
    runtimeContext: {
      node: 'KUALA_LUMPUR_04',
      accessLevel: 'ADMINISTRATOR_LEVEL_0',
      protocol: 'ALPHA_SOVEREIGN',
      container: 'Cordis v4 Sovereign Service Container',
    },
  };

  const configJsonString = JSON.stringify(pluginConfigObject, null, 2);

  const handleDownloadConfig = () => {
    try {
      const blob = new Blob([configJsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sanitizedName = plugin.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
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
      await navigator.clipboard.writeText(configJsonString);
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
                {plugin.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}-config.json ready for DSH transfer
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
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#6366F1] font-bold block mb-1">
              Plugin Inspection / {plugin.id}
            </span>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#6366F1]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  DSH Environment Configuration
                </span>
              </div>
              <button
                id="toggle-config-preview-btn"
                onClick={() => setShowConfigPreview(!showConfigPreview)}
                className="flex items-center gap-1.5 text-[11px] text-[#A5B4FC] hover:text-white transition-colors cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" />
                <span>{showConfigPreview ? 'Hide JSON Preview' : 'Preview JSON'}</span>
              </button>
            </div>

            <p className="text-xs text-white/60 font-sans">
              Export this plugin&apos;s runtime variables, governance policy gates, and determinism constraints as a standardized JSON configuration for direct deployment across sovereign DSH instances.
            </p>

            {/* Optional JSON Preview */}
            {showConfigPreview && (
              <div className="relative mt-2">
                <pre className="p-3 bg-black/60 border border-white/10 rounded-lg text-[11px] text-emerald-400 overflow-x-auto max-h-48 font-mono leading-relaxed">
                  {configJsonString}
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
          <div className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-3">
            <span>Cordis v4 Sovereign Container</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-[#6366F1] font-bold">100% Deterministic</span>
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
    </div>
  );
}
