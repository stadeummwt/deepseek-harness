import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from 'recharts';
import { FullAnalysisReport } from '../utils/statisticalAnalysis.ts';

interface StatisticalAnalysisViewProps {
  analysis: FullAnalysisReport;
}

export function StatisticalAnalysisView({ analysis }: StatisticalAnalysisViewProps) {
  const [activeStatField, setActiveStatField] = useState<'latency' | 'tokens' | 'risk' | 'invocations'>('latency');
  const [outlierSeverityFilter, setOutlierSeverityFilter] = useState<'ALL' | 'EXTREME' | 'MODERATE'>('ALL');

  const { numericStatistics, categoryBreakdown, executionDistribution, outliers, trendSeries } = analysis;

  const currentStat = numericStatistics[activeStatField];

  // Prepare data for Category Distribution chart
  const categoryChartData = categoryBreakdown.map((cat) => {
    // Find count of stable, pending, rejected approx from category summary
    const stable = Math.round((cat.count * cat.stableRatio) / 100);
    const nonStable = cat.count - stable;
    const pending = Math.round(nonStable * 0.6);
    const rejected = nonStable - pending;

    return {
      category: cat.category,
      STABLE: stable,
      PENDING: pending,
      REJECTED: rejected,
      total: cat.count,
      avgLatency: cat.avgLatencyMs,
    };
  });

  // Prepare scatter data for Outlier analysis (Latency vs Risk)
  const outlierScatterData = outliers.map((o) => ({
    id: o.id,
    variable: o.variable,
    value: o.value,
    zScore: o.zScore,
    severity: o.severity,
  }));

  const filteredOutliers = outliers.filter(
    (o) => outlierSeverityFilter === 'ALL' || o.severity === outlierSeverityFilter
  );

  return (
    <div id="statistical-analysis-view" className="p-6 flex flex-col gap-8 overflow-y-auto max-h-[720px] font-mono">
      {/* Overview Stat Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold">
            Execution Stability Ratio
          </span>
          <div className="my-2">
            <span className="text-4xl font-black text-emerald-400 block">
              {executionDistribution.STABLE.percentage}%
            </span>
            <span className="text-xs text-white/50">
              {executionDistribution.STABLE.count} Stable Records
            </span>
          </div>
          <div className="flex gap-4 text-[10px] text-white/40">
            <span>PENDING: {executionDistribution.PENDING.percentage}%</span>
            <span>REJECTED: {executionDistribution.REJECTED.percentage}%</span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
            Average Latency & Dispersion
          </span>
          <div className="my-2">
            <span className="text-4xl font-black text-white block">
              {numericStatistics.latency.mean}ms
            </span>
            <span className="text-xs text-white/50">
              Median: {numericStatistics.latency.median}ms (StdDev: ±{numericStatistics.latency.stdDev}ms)
            </span>
          </div>
          <div className="text-[10px] text-[#6366F1]">
            IQR: {numericStatistics.latency.iqr}ms (Q1: {numericStatistics.latency.q1}ms, Q3: {numericStatistics.latency.q3}ms)
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
            Detected Outliers
          </span>
          <div className="my-2">
            <span className="text-4xl font-black text-amber-400 block">
              {outliers.length}
            </span>
            <span className="text-xs text-white/50">
              {outliers.filter((o) => o.severity === 'EXTREME').length} Extreme (|Z| &gt; 4.0)
            </span>
          </div>
          <div className="text-[10px] text-white/40">
            Upper Latency Fence: {(numericStatistics.latency.q3 + 1.5 * numericStatistics.latency.iqr).toFixed(1)}ms
          </div>
        </div>
      </div>

      {/* Numerical Descriptive Statistics Matrix */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#6366F1]">
              Descriptive Statistics Summary
            </h3>
            <p className="text-xs text-white/40 mt-0.5 font-sans">
              Comprehensive moments, central tendencies, and quartile measures across continuous features.
            </p>
          </div>

          <div className="flex gap-2 text-xs">
            {(['latency', 'tokens', 'risk', 'invocations'] as const).map((field) => (
              <button
                key={field}
                id={`btn-stat-${field}`}
                onClick={() => setActiveStatField(field)}
                className={`px-3 py-1.5 rounded-lg font-bold uppercase transition-colors cursor-pointer ${
                  activeStatField === field
                    ? 'bg-[#6366F1] text-black font-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Field Metric Deep-Dive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 text-center">
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[9px] uppercase text-white/40 block">Mean</span>
            <span className="text-base font-bold text-white mt-1 block">{currentStat.mean}</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[9px] uppercase text-white/40 block">Median</span>
            <span className="text-base font-bold text-[#6366F1] mt-1 block">{currentStat.median}</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[9px] uppercase text-white/40 block">Std Dev</span>
            <span className="text-base font-bold text-white mt-1 block">±{currentStat.stdDev}</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[9px] uppercase text-white/40 block">Q1 (25%)</span>
            <span className="text-base font-bold text-white mt-1 block">{currentStat.q1}</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[9px] uppercase text-white/40 block">Q3 (75%)</span>
            <span className="text-base font-bold text-white mt-1 block">{currentStat.q3}</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[9px] uppercase text-white/40 block">IQR</span>
            <span className="text-base font-bold text-white mt-1 block">{currentStat.iqr}</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[9px] uppercase text-white/40 block">Min / Max</span>
            <span className="text-xs font-bold text-white mt-1 block">
              {currentStat.min} / {currentStat.max}
            </span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[9px] uppercase text-white/40 block">Skewness</span>
            <span className={`text-base font-bold mt-1 block ${currentStat.skewness > 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {currentStat.skewness}
            </span>
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Execution Status Distribution by Functional Category */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#6366F1]">
              Execution Breakdown by Category
            </h3>
            <span className="text-[10px] text-white/40 font-sans">Stacked Bar Chart</span>
          </div>

          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis
                  dataKey="category"
                  stroke="#ffffff60"
                  fontSize={9}
                  tickLine={false}
                  angle={-25}
                  textAnchor="end"
                />
                <YAxis stroke="#ffffff60" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#13161C', borderColor: '#ffffff20', borderRadius: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="STABLE" stackId="a" fill="#10B981" name="STABLE" />
                <Bar dataKey="PENDING" stackId="a" fill="#F59E0B" name="PENDING" />
                <Bar dataKey="REJECTED" stackId="a" fill="#F43F5E" name="REJECTED" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Latency Trends Across Sequential Execution Batches */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#6366F1]">
              Sequential Latency & Throughput Trend
            </h3>
            <span className="text-[10px] text-white/40 font-sans">Time/Batch Series</span>
          </div>

          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="batch" stroke="#ffffff60" fontSize={10} tickLine={false} />
                <YAxis stroke="#ffffff60" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#13161C', borderColor: '#ffffff20', borderRadius: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="avgLatencyMs"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#latencyGradient)"
                  name="Avg Latency (ms)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Outlier Detection & Anomaly Inspection Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-amber-400">
              Statistical Outlier Anomaly Register
            </h3>
            <p className="text-xs text-white/40 mt-0.5 font-sans">
              Identified via Tukey IQR Fencing (1.5 × IQR) & Normalized Z-Score Threshold (|Z| &gt; 2.5).
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/40 text-[10px]">Filter Severity:</span>
            <select
              id="select-outlier-severity"
              value={outlierSeverityFilter}
              onChange={(e) => setOutlierSeverityFilter(e.target.value as any)}
              className="px-2.5 py-1 bg-black/40 border border-white/10 rounded text-xs text-white"
            >
              <option value="ALL">All Outliers ({outliers.length})</option>
              <option value="EXTREME">Extreme (|Z| &gt; 4.0)</option>
              <option value="MODERATE">Moderate (2.5 &lt; |Z| ≤ 4.0)</option>
            </select>
          </div>
        </div>

        {/* Outliers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase text-white/40 font-bold bg-white/[0.02]">
                <th className="p-3">Record ID</th>
                <th className="p-3">Variable</th>
                <th className="p-3">Category</th>
                <th className="p-3">Anomalous Field</th>
                <th className="p-3">Value</th>
                <th className="p-3">Z-Score</th>
                <th className="p-3">IQR Delta</th>
                <th className="p-3">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOutliers.slice(0, 8).map((item, idx) => (
                <tr key={`${item.id}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 font-bold text-white/90">{item.id}</td>
                  <td className="p-3 text-white/70">{item.variable}</td>
                  <td className="p-3 text-[#6366F1] font-bold">{item.category}</td>
                  <td className="p-3 text-white/80">{item.field}</td>
                  <td className="p-3 font-bold text-amber-300">{item.value.toLocaleString()}</td>
                  <td className="p-3 text-white/60">{item.zScore}σ</td>
                  <td className="p-3 text-white/60">+{item.iqrDistance} IQR</td>
                  <td className="p-3">
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                        item.severity === 'EXTREME'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOutliers.length > 8 && (
            <div className="p-3 text-center text-xs text-white/40 border-t border-white/5">
              + {filteredOutliers.length - 8} more outliers registered in audit logs
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
