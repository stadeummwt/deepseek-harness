import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { IncidentLogEntry } from '../types.ts';

interface IncidentStreamDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: IncidentLogEntry[];
}

export function IncidentStreamDrawer({ isOpen, onClose, incidents }: IncidentStreamDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#0f111a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                API Incident & Recovery Stream
              </h3>
              <p className="text-[10px] text-white/50">
                Real-time HTTP failures, circuit breaker trips, and latency anomalies.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-2 text-xs">
          {incidents.length === 0 ? (
            <div className="py-12 text-center text-white/40">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
              <p className="font-bold text-white/70">All Endpoints Nominal</p>
              <p className="text-[11px] mt-1">No circuit breaker trips or HTTP error codes intercepted.</p>
            </div>
          ) : (
            incidents.map((inc) => (
              <div
                key={inc.id}
                className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors ${
                  inc.severity === 'CRITICAL'
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : inc.severity === 'WARN'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-emerald-500/10 border-emerald-500/30'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {inc.severity === 'CRITICAL' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : inc.severity === 'WARN' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white text-xs">{inc.providerName}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          inc.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300'
                            : inc.severity === 'WARN'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {inc.eventType}
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">[{inc.timestamp}]</span>
                    </div>
                    <p className="text-[11px] text-white/70">{inc.details}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded ${
                      inc.statusCode >= 500 || inc.statusCode === 0
                        ? 'bg-rose-500/20 text-rose-300'
                        : inc.statusCode >= 400
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    HTTP {inc.statusCode}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/10 bg-white/[0.01] flex justify-between items-center text-[10px] text-white/40">
          <span>Captured {incidents.length} events in current session</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-mono"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
