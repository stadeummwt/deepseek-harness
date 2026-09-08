import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Play,
  Download,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Filter,
  Sparkles,
} from 'lucide-react';
import {
  ModelEvaluation,
  PredictiveModelEngine,
  PredictionResult,
  runBatchInference,
} from '../utils/predictiveModel.ts';
import { CleanedDataRecord } from '../data/rawDataset.ts';
import { BatchPredictionSummary } from '../types.ts';

interface PredictiveModelViewProps {
  modelEngine: PredictiveModelEngine;
  cleanedData: CleanedDataRecord[];
  onRetrain: () => void;
}

export function PredictiveModelView({
  modelEngine,
  cleanedData,
  onRetrain,
}: PredictiveModelViewProps) {
  const evaluation: ModelEvaluation | null = modelEngine.getEvaluation();

  // Sandbox state
  const [sandboxCategory, setSandboxCategory] = useState<string>('CORE_ASSET');
  const [sandboxCostTier, setSandboxCostTier] = useState<string>('FREE_CONFIRMED');
  const [sandboxLatency, setSandboxLatency] = useState<number>(42.0);
  const [sandboxTokens, setSandboxTokens] = useState<number>(1500);
  const [sandboxRisk, setSandboxRisk] = useState<number>(0.15);
  const [sandboxInvocations, setSandboxInvocations] = useState<number>(14000);

  // Batch prediction state
  const [batchResult, setBatchResult] = useState<BatchPredictionSummary | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchFilter, setBatchFilter] = useState<'ALL' | 'MISMATCH' | 'HIGH_RISK'>('ALL');

  const handleRunBatchInference = () => {
    setIsBatchRunning(true);
    setTimeout(() => {
      const summary = runBatchInference(modelEngine, cleanedData);
      setBatchResult(summary);
      setIsBatchRunning(false);
    }, 150);
  };

  const exportBatchCsv = () => {
    if (!batchResult) return;
    const headers = 'ID,Cluster,Workload,ActualStatus,PredictedStatus,Confidence,RiskScore,RiskClass,KeyFactor\n';
    const rows = batchResult.predictions
      .map(
        (p) =>
          `"${p.id}","${p.cluster}","${p.workload}","${p.actualStatus}","${p.predictedStatus}",${(
            p.confidence * 100
          ).toFixed(1)}%,${p.riskScore},"${p.riskClass}","${p.keyFactor.replace(/"/g, '""')}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dsh-batch-predictions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Real-time prediction
  const prediction: PredictionResult = useMemo(() => {
    return modelEngine.predict({
      category: sandboxCategory,
      cost_tier: sandboxCostTier,
      latency_ms: sandboxLatency,
      token_payload: sandboxTokens,
      risk_score: sandboxRisk,
      invocation_count: sandboxInvocations,
    });
  }, [
    modelEngine,
    sandboxCategory,
    sandboxCostTier,
    sandboxLatency,
    sandboxTokens,
    sandboxRisk,
    sandboxInvocations,
  ]);

  if (!evaluation) {
    return (
      <div className="p-8 text-center font-mono text-white/50">
        Initializing and calibrating predictive model...
      </div>
    );
  }

  const { overallAccuracy, macroF1, classes, confusionMatrix, featureImportances } = evaluation;

  return (
    <div id="predictive-model-view" className="p-6 flex flex-col gap-8 overflow-y-auto max-h-[720px] font-mono">
      {/* Top Model Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold">
            Model Accuracy
          </span>
          <div className="my-2">
            <span className="text-5xl font-black text-emerald-400 block">
              {(overallAccuracy * 100).toFixed(1)}%
            </span>
            <span className="text-xs text-white/50">
              Evaluated on {evaluation.testSamples} test records
            </span>
          </div>
          <span className="text-[10px] text-white/40 font-sans">
            Algorithm: Random Forest
          </span>
        </div>

        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
            Macro F1-Score
          </span>
          <div className="my-2">
            <span className="text-5xl font-black text-white block">
              {(macroF1 * 100).toFixed(1)}%
            </span>
            <span className="text-xs text-white/50">
              Balanced Harmonic Mean
            </span>
          </div>
          <span className="text-[10px] text-white/40 font-sans">
            5 Bootstrapped Trees (Depth 5)
          </span>
        </div>

        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
            Class F1 Performance
          </span>
          <div className="space-y-1 my-1 text-xs">
            <div className="flex justify-between">
              <span className="text-emerald-400">STABLE:</span>
              <span className="font-bold">{(classes.STABLE.f1Score * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-400">PENDING:</span>
              <span className="font-bold">{(classes.PENDING.f1Score * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-rose-400">REJECTED:</span>
              <span className="font-bold">{(classes.REJECTED.f1Score * 100).toFixed(0)}%</span>
            </div>
          </div>
          <span className="text-[10px] text-white/40 font-sans">
            Support: {evaluation.testSamples} samples
          </span>
        </div>

        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold">
            Model Governance
          </span>
          <div className="my-2">
            <span className="text-base font-bold text-white block">
              Deterministic Gating
            </span>
            <span className="text-xs text-white/50">
              Zero Unchecked Failures
            </span>
          </div>
          <button
            id="btn-retrain-model"
            onClick={onRetrain}
            className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer text-center"
          >
            Re-Train Ensemble
          </button>
        </div>
      </div>

      {/* Feature Relevance & Confusion Matrix Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Feature Importance Horizontal Bar Chart */}
        <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#6366F1]">
                Relevant Feature Importance Ranking
              </h3>
              <p className="text-xs text-white/40 mt-0.5 font-sans">
                Identified via Gini impurity reduction and mutual correlation.
              </p>
            </div>
          </div>

          <div className="h-64 w-full text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={featureImportances}
                margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 0.45]}
                  stroke="#ffffff60"
                  fontSize={10}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  stroke="#ffffff80"
                  fontSize={10}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: any) => [`${(Number(val) * 100).toFixed(1)}%`, 'Relevance']}
                  contentStyle={{ backgroundColor: '#13161C', borderColor: '#ffffff20', borderRadius: '12px' }}
                />
                <Bar dataKey="importance" radius={[0, 8, 8, 0]}>
                  {featureImportances.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? '#6366F1' : index === 1 ? '#818cf8' : '#a5b4fc'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-white/60">
            <div>
              <span className="text-white font-bold block">1. Risk Score Metric (38.5%)</span>
              Strongest determinant of execution rejection and anomaly tripping.
            </div>
            <div>
              <span className="text-white font-bold block">2. Response Latency (27.4%)</span>
              High latency exceeding 95ms acts as critical barrier to stability.
            </div>
          </div>
        </div>

        {/* 3x3 Confusion Matrix */}
        <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/90 mb-1">
              Confusion Matrix (Test Split)
            </h3>
            <p className="text-xs text-white/40 mb-4 font-sans">
              Ground truth (rows) vs Predicted status (columns).
            </p>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {/* Header */}
              <div className="p-2 text-white/30 text-[10px] uppercase font-bold">ACT \ PRED</div>
              <div className="p-2 text-emerald-400 font-bold text-[10px]">STABLE</div>
              <div className="p-2 text-amber-400 font-bold text-[10px]">PENDING</div>
              <div className="p-2 text-rose-400 font-bold text-[10px]">REJECTED</div>

              {/* Row 1: Actual STABLE */}
              <div className="p-2 text-emerald-400 font-bold text-[10px] text-left">ACT: STABLE</div>
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl font-bold text-emerald-300">
                {confusionMatrix.matrix.STABLE.STABLE}
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-white/70">
                {confusionMatrix.matrix.STABLE.PENDING}
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-white/70">
                {confusionMatrix.matrix.STABLE.REJECTED}
              </div>

              {/* Row 2: Actual PENDING */}
              <div className="p-2 text-amber-400 font-bold text-[10px] text-left">ACT: PENDING</div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-white/70">
                {confusionMatrix.matrix.PENDING.STABLE}
              </div>
              <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl font-bold text-amber-300">
                {confusionMatrix.matrix.PENDING.PENDING}
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-white/70">
                {confusionMatrix.matrix.PENDING.REJECTED}
              </div>

              {/* Row 3: Actual REJECTED */}
              <div className="p-2 text-rose-400 font-bold text-[10px] text-left">ACT: REJECTED</div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-white/70">
                {confusionMatrix.matrix.REJECTED.STABLE}
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-white/70">
                {confusionMatrix.matrix.REJECTED.PENDING}
              </div>
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl font-bold text-rose-300">
                {confusionMatrix.matrix.REJECTED.REJECTED}
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-black/40 rounded-xl border border-white/5 text-[11px] text-white/60">
            <span className="text-[#6366F1] font-bold">Accuracy Metric:</span>{' '}
            {(
              ((confusionMatrix.matrix.STABLE.STABLE +
                confusionMatrix.matrix.PENDING.PENDING +
                confusionMatrix.matrix.REJECTED.REJECTED) /
                confusionMatrix.totalTestSamples) *
              100
            ).toFixed(1)}
            % of held-out samples categorized correctly.
          </div>
        </div>
      </div>

      {/* Live Interactive Prediction Sandbox */}
      <div className="bg-[#13161C] border border-[#6366F1]/30 p-6 rounded-2xl shadow-[0_0_24px_rgba(99,102,241,0.15)]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold block">
              Real-Time Inference Sandbox
            </span>
            <h3 className="text-xl font-black text-white mt-0.5">
              Predictive Execution Simulator
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Model Status:</span>
            <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg font-bold">
              ACTIVE_ONLINE
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Column */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Category Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
                Workload Category
              </label>
              <select
                id="sandbox-category"
                value={sandboxCategory}
                onChange={(e) => setSandboxCategory(e.target.value)}
                className="p-2.5 bg-black/60 border border-white/10 rounded-xl text-white focus:border-[#6366F1] focus:outline-none"
              >
                <option value="CORE_ASSET">CORE_ASSET</option>
                <option value="LOGISTICS">LOGISTICS</option>
                <option value="ANALYSIS">ANALYSIS</option>
                <option value="REGISTRY">REGISTRY</option>
                <option value="METADATA">METADATA</option>
                <option value="NETWORK">NETWORK</option>
                <option value="INFERENCE">INFERENCE</option>
                <option value="SECURITY">SECURITY</option>
              </select>
            </div>

            {/* Cost Tier Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
                Route Cost Class
              </label>
              <select
                id="sandbox-cost-tier"
                value={sandboxCostTier}
                onChange={(e) => setSandboxCostTier(e.target.value)}
                className="p-2.5 bg-black/60 border border-white/10 rounded-xl text-white focus:border-[#6366F1] focus:outline-none"
              >
                <option value="FREE_CONFIRMED">FREE_CONFIRMED (Zero Cost)</option>
                <option value="LOCAL">LOCAL (Host Ollama)</option>
                <option value="TRIAL">TRIAL (Permitted Tier)</option>
                <option value="PAID">PAID (Policy Blocked)</option>
              </select>
            </div>

            {/* Latency Slider */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
                  Response Latency (ms)
                </label>
                <span className="font-bold text-[#6366F1]">{sandboxLatency} ms</span>
              </div>
              <input
                id="sandbox-slider-latency"
                type="range"
                min="10"
                max="300"
                step="5"
                value={sandboxLatency}
                onChange={(e) => setSandboxLatency(Number(e.target.value))}
                className="w-full accent-[#6366F1]"
              />
            </div>

            {/* Risk Score Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
                  Risk Score
                </label>
                <span className={`font-bold ${sandboxRisk > 0.5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {sandboxRisk.toFixed(2)}
                </span>
              </div>
              <input
                id="sandbox-slider-risk"
                type="range"
                min="0.0"
                max="1.0"
                step="0.02"
                value={sandboxRisk}
                onChange={(e) => setSandboxRisk(Number(e.target.value))}
                className="w-full accent-[#6366F1]"
              />
            </div>

            {/* Token Payload Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
                  Token Payload
                </label>
                <span className="font-bold text-white">{sandboxTokens.toLocaleString()} toks</span>
              </div>
              <input
                id="sandbox-slider-tokens"
                type="range"
                min="500"
                max="15000"
                step="250"
                value={sandboxTokens}
                onChange={(e) => setSandboxTokens(Number(e.target.value))}
                className="w-full accent-[#6366F1]"
              />
            </div>
          </div>

          {/* Prediction Output & Feature Impact Waterfall */}
          <div className="lg:col-span-5 bg-black/40 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold block mb-1">
                Predicted Execution State
              </span>

              <div className="flex items-baseline gap-3 my-2">
                <span
                  className={`text-4xl font-black ${
                    prediction.predictedClass === 'STABLE'
                      ? 'text-emerald-400'
                      : prediction.predictedClass === 'PENDING'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {prediction.predictedClass}
                </span>
                <span className="text-sm font-bold text-white/60">
                  {(prediction.confidence * 100).toFixed(1)}% Confidence
                </span>
              </div>

              {/* Multi-class Probability Bars */}
              <div className="space-y-2 mt-4 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-emerald-400">STABLE</span>
                    <span>{(prediction.probabilities.STABLE * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${prediction.probabilities.STABLE * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-amber-400">PENDING</span>
                    <span>{(prediction.probabilities.PENDING * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${prediction.probabilities.PENDING * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-rose-400">REJECTED</span>
                    <span>{(prediction.probabilities.REJECTED * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{ width: `${prediction.probabilities.REJECTED * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Impact Explanations */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold block mb-2">
                Predictive Explanations (Shapley Weights)
              </span>
              <div className="space-y-1.5 text-[11px]">
                {prediction.featureContributions.map((fc, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 ${
                        fc.direction === 'FAVORABLE'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {fc.direction === 'FAVORABLE' ? '+POS' : '-RISK'}
                    </span>
                    <span className="text-white/70">{fc.summary}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Batch Prediction & Cluster Risk Inference Engine */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#6366F1]" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                Batch Inference Engine
              </h3>
              <span className="text-[10px] bg-[#6366F1]/20 text-[#6366F1] px-2 py-0.5 rounded font-mono font-bold">
                {cleanedData.length} Cleaned Records
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Runs the trained ensemble decision forest across the entire active dataset to evaluate cluster-wide stability.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {batchResult && (
              <button
                onClick={exportBatchCsv}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-mono transition-colors"
                title="Export batch prediction results to CSV"
              >
                <Download className="w-4 h-4 text-[#6366F1]" />
                <span>Export CSV</span>
              </button>
            )}
            <button
              onClick={handleRunBatchInference}
              disabled={isBatchRunning}
              className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] hover:bg-[#5558E6] text-white rounded-lg text-xs font-bold font-mono transition-colors disabled:opacity-50 shadow-lg shadow-[#6366F1]/20"
            >
              <Play className={`w-4 h-4 ${isBatchRunning ? 'animate-spin' : ''}`} />
              <span>{isBatchRunning ? 'Inferring Cluster...' : 'Run Batch Inference'}</span>
            </button>
          </div>
        </div>

        {batchResult ? (
          <div className="space-y-6">
            {/* Batch Scorecard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-black/30 border border-white/10 p-4 rounded-xl">
                <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                  Concordance Rate
                </span>
                <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">
                  {batchResult.concordanceRate}%
                </span>
                <span className="text-[10px] text-white/40">
                  Actual vs Predicted match
                </span>
              </div>

              <div className="bg-black/30 border border-white/10 p-4 rounded-xl">
                <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                  Avg Model Confidence
                </span>
                <span className="text-2xl font-bold text-white font-mono mt-1 block">
                  {batchResult.averageConfidence}%
                </span>
                <span className="text-[10px] text-white/40">
                  Mean probability mass
                </span>
              </div>

              <div className="bg-black/30 border border-white/10 p-4 rounded-xl">
                <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                  Predicted Stable
                </span>
                <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">
                  {batchResult.stableCount}
                  <span className="text-xs text-white/40 font-normal ml-1">
                    / {batchResult.totalProcessed}
                  </span>
                </span>
                <span className="text-[10px] text-white/40">
                  {((batchResult.stableCount / batchResult.totalProcessed) * 100).toFixed(0)}% of cluster
                </span>
              </div>

              <div className="bg-black/30 border border-white/10 p-4 rounded-xl">
                <span className="text-[9px] uppercase tracking-wider text-white/40 block">
                  Risk Breakdown
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                    {batchResult.riskBreakdown.LOW} Low
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold">
                    {batchResult.riskBreakdown.MEDIUM} Med
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono font-bold">
                    {batchResult.riskBreakdown.HIGH} High
                  </span>
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-white/60">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter:</span>
                <button
                  onClick={() => setBatchFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    batchFilter === 'ALL'
                      ? 'bg-[#6366F1] text-white font-bold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  All ({batchResult.predictions.length})
                </button>
                <button
                  onClick={() => setBatchFilter('MISMATCH')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    batchFilter === 'MISMATCH'
                      ? 'bg-[#6366F1] text-white font-bold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  Mismatches ({batchResult.predictions.filter((p) => p.actualStatus !== p.predictedStatus).length})
                </button>
                <button
                  onClick={() => setBatchFilter('HIGH_RISK')}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                    batchFilter === 'HIGH_RISK'
                      ? 'bg-[#6366F1] text-white font-bold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  High Risk Only ({batchResult.riskBreakdown.HIGH})
                </button>
              </div>

              <span className="text-[11px] text-white/40 font-mono">
                Executed at {batchResult.executedAt}
              </span>
            </div>

            {/* Batch Table */}
            <div className="border border-white/10 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-white/5 border-b border-white/10 text-white/40 text-[10px] uppercase sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="p-2.5">Workload</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">Actual</th>
                    <th className="p-2.5">Predicted</th>
                    <th className="p-2.5">Confidence</th>
                    <th className="p-2.5">Risk Tier</th>
                    <th className="p-2.5">Dominant Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {batchResult.predictions
                    .filter((p) => {
                      if (batchFilter === 'MISMATCH') return p.actualStatus !== p.predictedStatus;
                      if (batchFilter === 'HIGH_RISK') return p.riskClass === 'HIGH';
                      return true;
                    })
                    .map((item) => {
                      const isMatch = item.actualStatus === item.predictedStatus;
                      return (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-2.5 font-bold text-white flex items-center gap-1.5">
                            {isMatch ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <span className="truncate max-w-[140px]">{item.workload}</span>
                          </td>
                          <td className="p-2.5 text-white/60 text-[11px]">{item.cluster}</td>
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                item.actualStatus === 'STABLE'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {item.actualStatus}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                item.predictedStatus === 'STABLE'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {item.predictedStatus}
                            </span>
                          </td>
                          <td className="p-2.5 text-white/80 font-bold">
                            {(item.confidence * 100).toFixed(1)}%
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                item.riskClass === 'LOW'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : item.riskClass === 'MEDIUM'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {item.riskClass} ({item.riskScore})
                            </span>
                          </td>
                          <td className="p-2.5 text-white/50 text-[10px] truncate max-w-[220px]" title={item.keyFactor}>
                            {item.keyFactor}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center bg-black/20 border border-white/5 rounded-xl">
            <Sparkles className="w-8 h-8 text-[#6366F1] mx-auto mb-2 opacity-60" />
            <p className="text-xs text-white/70 font-bold">Batch Inference Not Yet Executed</p>
            <p className="text-[11px] text-white/40 mt-1 max-w-md mx-auto">
              Click &ldquo;Run Batch Inference&rdquo; to evaluate all {cleanedData.length} records simultaneously through the trained decision forest.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
