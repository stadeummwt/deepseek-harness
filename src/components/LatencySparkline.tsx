import { LatencyDataPoint } from '../types.ts';

interface LatencySparklineProps {
  history: LatencyDataPoint[];
  currentLatency: number;
}

export function LatencySparkline({ history, currentLatency }: LatencySparklineProps) {
  if (!history || history.length < 2) {
    return (
      <div className="h-10 flex items-center justify-between text-[10px] font-mono text-white/30 px-2 bg-white/[0.02] rounded-lg border border-white/5">
        <span>Accumulating probe telemetries...</span>
        <span className="text-emerald-400 font-bold">{currentLatency}ms</span>
      </div>
    );
  }

  const values = history.map((h) => h.latencyMs);
  const minVal = Math.max(0, Math.min(...values) - 5);
  const maxVal = Math.max(...values, minVal + 15);
  const range = maxVal - minVal || 1;

  const width = 240;
  const height = 44;
  const paddingX = 4;
  const paddingY = 6;

  const points = history.map((item, idx) => {
    const x = paddingX + (idx / (history.length - 1)) * (width - paddingX * 2);
    const normalizedY = (item.latencyMs - minVal) / range;
    const y = height - paddingY - normalizedY * (height - paddingY * 2);
    return { x, y, latency: item.latencyMs, time: item.timestamp, status: item.status };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;

  const lastPt = points[points.length - 1];

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl p-3 flex flex-col gap-1.5 font-mono">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
          <span>Real-Time Latency Jitter ({history.length} cycles)</span>
        </span>
        <span className="text-emerald-400 font-bold">{currentLatency}ms now</span>
      </div>

      <div className="relative w-full h-[48px] overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Fill Area */}
          <path d={areaD} fill="url(#latencyGradient)" />

          {/* Line Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#6366F1"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current Live Pulse Marker */}
          {lastPt && (
            <g>
              <circle
                cx={lastPt.x}
                cy={lastPt.y}
                r="4"
                className="fill-[#6366F1] animate-ping opacity-75"
              />
              <circle cx={lastPt.x} cy={lastPt.y} r="3" className="fill-emerald-400" />
            </g>
          )}
        </svg>
      </div>

      <div className="flex justify-between items-center text-[8px] text-white/30 pt-0.5 border-t border-white/5">
        <span>Min: {Math.min(...values)}ms</span>
        <span>Max: {Math.max(...values)}ms</span>
      </div>
    </div>
  );
}
