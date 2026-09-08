import { useState } from 'react';
import {
  CleaningReport,
  DataIssues,
  PreprocessOptions,
  DEFAULT_PREPROCESS_OPTIONS,
} from '../utils/dataPreprocessor.ts';

interface DataCleaningPipelineProps {
  issues: DataIssues;
  report: CleaningReport;
  options: PreprocessOptions;
  onOptionsChange: (opts: PreprocessOptions) => void;
  onRerunPipeline: () => void;
}

export function DataCleaningPipeline({
  issues,
  report,
  options,
  onOptionsChange,
  onRerunPipeline,
}: DataCleaningPipelineProps) {
  const [activeStrategy, setActiveStrategy] = useState<PreprocessOptions['missingValueStrategy']>(
    options.missingValueStrategy
  );
  const [dedup, setDedup] = useState(options.removeDuplicates);
  const [normCat, setNormCat] = useState(options.normalizeCategories);
  const [castTypes, setCastTypes] = useState(options.castDataTypes);
  const [outlierHandling, setOutlierHandling] = useState<PreprocessOptions['handleOutliers']>(
    options.handleOutliers
  );

  const handleApplyConfig = () => {
    onOptionsChange({
      missingValueStrategy: activeStrategy,
      removeDuplicates: dedup,
      normalizeCategories: normCat,
      castDataTypes: castTypes,
      handleOutliers: outlierHandling,
    });
    onRerunPipeline();
  };

  return (
    <div id="data-cleaning-pipeline" className="p-6 flex flex-col gap-8 overflow-y-auto max-h-[720px]">
      {/* Top Banner: Health Score & Transformation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
        {/* Health Score Gauge */}
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold">
            Dataset Health Score
          </span>
          <div className="flex items-baseline gap-3 my-2">
            <span className="text-4xl font-black text-rose-400 line-through opacity-60">
              {report.healthScoreBefore}%
            </span>
            <span className="text-xl font-bold text-white/40">➔</span>
            <span className="text-5xl font-black text-emerald-400">
              {report.healthScoreAfter}%
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-sans">
            ✓ 100% Production Ready
          </span>
        </div>

        {/* Missing Values Card */}
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
            Missing Values
          </span>
          <div className="my-2">
            <span className="text-4xl font-black block text-amber-400">
              {report.missingValuesImputed + report.missingValuesDropped}
            </span>
            <span className="text-[11px] text-white/60">
              {report.missingValuesImputed} Imputed / {report.missingValuesDropped} Dropped
            </span>
          </div>
          <span className="text-[10px] text-white/40 font-sans">
            Strategy: {options.missingValueStrategy.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        {/* Duplicates Card */}
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
            Duplicates Purged
          </span>
          <div className="my-2">
            <span className="text-4xl font-black block text-[#6366F1]">
              {report.duplicatesRemoved}
            </span>
            <span className="text-[11px] text-white/60">
              Primary Key & Signature
            </span>
          </div>
          <span className="text-[10px] text-white/40 font-sans">
            Deduplicated by #DATA ID
          </span>
        </div>

        {/* Types & Outliers Card */}
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
            Types & Inconsistencies
          </span>
          <div className="my-2">
            <span className="text-4xl font-black block text-white">
              {report.typeErrorsCorrected + report.categoriesStandardized}
            </span>
            <span className="text-[11px] text-white/60">
              {report.typeErrorsCorrected} Types / {report.categoriesStandardized} Categories
            </span>
          </div>
          <span className="text-[10px] text-white/40 font-sans">
            {report.outliersDetected} Outliers Flagged
          </span>
        </div>
      </div>

      {/* Interactive Pipeline Configuration Controls */}
      <div className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">
              Preprocessing Configuration
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Customize imputation method, deduplication rules, and outlier treatments.
            </p>
          </div>
          <button
            id="btn-apply-pipeline-config"
            onClick={handleApplyConfig}
            className="px-5 py-2.5 bg-[#6366F1] hover:bg-[#5254db] text-black font-black text-xs uppercase tracking-widest rounded-xl transition-colors cursor-pointer shadow-[0_0_16px_rgba(99,102,241,0.3)]"
          >
            Execute Cleaning Pipeline
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Missing Value Strategy */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
              Missing Value Handling
            </label>
            <div className="flex flex-col gap-2">
              {[
                { id: 'impute_median', label: 'Impute Median (Recommended)', desc: 'Robust against extreme outliers' },
                { id: 'impute_mean', label: 'Impute Mean', desc: 'Standard arithmetic average' },
                { id: 'drop_rows', label: 'Drop Incomplete Rows', desc: 'Removes any row with missing fields' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    activeStrategy === opt.id
                      ? 'bg-[#6366F1]/10 border-[#6366F1] text-white'
                      : 'bg-white/[0.02] border-white/5 text-white/70 hover:bg-white/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="missingStrategy"
                    value={opt.id}
                    checked={activeStrategy === opt.id}
                    onChange={() => setActiveStrategy(opt.id as any)}
                    className="mt-0.5 accent-[#6366F1]"
                  />
                  <div>
                    <div className="font-bold">{opt.label}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Outlier Strategy */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
              Statistical Outlier Treatment
            </label>
            <div className="flex flex-col gap-2">
              {[
                { id: 'flag_only', label: 'Flag Only (Preserve Data)', desc: 'Marks is_outlier: true without loss' },
                { id: 'clip_iqr', label: 'Clip to IQR Fences (Winsorize)', desc: 'Clamps values at Q3 + 1.5*IQR' },
                { id: 'remove', label: 'Purge Outlier Rows', desc: 'Filters anomalous latency/token rows' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    outlierHandling === opt.id
                      ? 'bg-[#6366F1]/10 border-[#6366F1] text-white'
                      : 'bg-white/[0.02] border-white/5 text-white/70 hover:bg-white/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="outlierHandling"
                    value={opt.id}
                    checked={outlierHandling === opt.id}
                    onChange={() => setOutlierHandling(opt.id as any)}
                    className="mt-0.5 accent-[#6366F1]"
                  />
                  <div>
                    <div className="font-bold">{opt.label}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Toggle Switches for Deduplication & Consistency */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
              Quality & Normalization Rules
            </label>

            <label className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white/5">
              <div>
                <div className="font-bold text-white">Deduplicate Identifiers</div>
                <div className="text-[10px] text-white/40">Purges duplicate #DATA-XXXX keys</div>
              </div>
              <input
                type="checkbox"
                checked={dedup}
                onChange={(e) => setDedup(e.target.checked)}
                className="w-4 h-4 accent-[#6366F1]"
              />
            </label>

            <label className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white/5">
              <div>
                <div className="font-bold text-white">Normalize Categories & Casing</div>
                <div className="text-[10px] text-white/40">Enforces uppercase & trims whitespace</div>
              </div>
              <input
                type="checkbox"
                checked={normCat}
                onChange={(e) => setNormCat(e.target.checked)}
                className="w-4 h-4 accent-[#6366F1]"
              />
            </label>

            <label className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white/5">
              <div>
                <div className="font-bold text-white">Strict Numeric Type Casting</div>
                <div className="text-[10px] text-white/40">Converts strings like "0.04s" to float</div>
              </div>
              <input
                type="checkbox"
                checked={castTypes}
                onChange={(e) => setCastTypes(e.target.checked)}
                className="w-4 h-4 accent-[#6366F1]"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Detailed Issues Matrix Before Preprocessing */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/90 mb-4 font-mono">
          Raw Dataset Defect Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-center">
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/40 uppercase block">Latency Nulls</span>
            <span className="text-xl font-bold text-rose-400 mt-1 block">{issues.missingValues.latency}</span>
            <span className="text-[10px] text-white/40">Resolved via Imputation</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/40 uppercase block">Token Nulls</span>
            <span className="text-xl font-bold text-rose-400 mt-1 block">{issues.missingValues.tokens}</span>
            <span className="text-[10px] text-white/40">Resolved via Imputation</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/40 uppercase block">Risk Score Nulls</span>
            <span className="text-xl font-bold text-rose-400 mt-1 block">{issues.missingValues.risk}</span>
            <span className="text-[10px] text-white/40">Resolved via Imputation</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/40 uppercase block">String Numbers</span>
            <span className="text-xl font-bold text-amber-400 mt-1 block">{issues.typeMismatches}</span>
            <span className="text-[10px] text-white/40">Type Cast to Float/Int</span>
          </div>
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/40 uppercase block">Duplicate IDs</span>
            <span className="text-xl font-bold text-[#6366F1] mt-1 block">{issues.duplicateIds}</span>
            <span className="text-[10px] text-white/40">Purged in Pipeline</span>
          </div>
        </div>
      </div>

      {/* Execution Audit Trail Log */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 font-mono">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#6366F1]">
            Pipeline Execution Audit Trail ({report.log.length} Stages)
          </h3>
          <span className="text-xs text-white/40 font-mono">
            Execution Time: {report.processingTimeMs}ms
          </span>
        </div>

        <div className="space-y-2 text-xs">
          {report.log.map((entry, idx) => (
            <div
              key={idx}
              className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-start justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                    entry.status === 'SUCCESS'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : entry.status === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-[#6366F1]/20 text-[#818cf8]'
                  }`}
                >
                  {entry.stage}
                </span>
                <span className="text-white/80">{entry.details}</span>
              </div>
              <span className="text-white/40 whitespace-nowrap text-[11px]">
                {entry.affectedCount} affected
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
