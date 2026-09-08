import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, ExternalLink } from 'lucide-react';
import {
  CANONICAL_PLUGINS,
  MODEL_CANDIDATES,
  BENCHMARK_SUITES,
  SECURITY_LOGS,
  PROFILES_METADATA,
} from './data/canonicalData.ts';
import { PluginMeta, ProfileType } from './types.ts';
import { PluginDetailModal } from './components/PluginDetailModal.tsx';
import { RouterSimulatorModal } from './components/RouterSimulatorModal.tsx';
import { DatasetTable } from './components/DatasetTable.tsx';
import { DataCleaningPipeline } from './components/DataCleaningPipeline.tsx';
import { StatisticalAnalysisView } from './components/StatisticalAnalysisView.tsx';
import { PredictiveModelView } from './components/PredictiveModelView.tsx';
import { FileUploadModal } from './components/FileUploadModal.tsx';
import {
  generateCanonicalDataset,
  RawDataRecord,
  CleanedDataRecord,
} from './data/rawDataset.ts';
import {
  preprocessDataset,
  detectDataIssues,
  PreprocessOptions,
  DEFAULT_PREPROCESS_OPTIONS,
  CleaningReport,
} from './utils/dataPreprocessor.ts';
import { performStatisticalAnalysis, FullAnalysisReport } from './utils/statisticalAnalysis.ts';
import { PredictiveModelEngine } from './utils/predictiveModel.ts';

export default function App() {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'data' | 'clean' | 'stats' | 'model' | 'plugins'>('data');
  const [activeProfile, setActiveProfile] = useState<ProfileType>('supreme');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginMeta | null>(null);
  const [pluginSearchQuery, setPluginSearchQuery] = useState<string>('');
  const [simulatorOpen, setSimulatorOpen] = useState<boolean>(false);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [liveTime, setLiveTime] = useState<string>('14:02:44.09');
  const [datasetName, setDatasetName] = useState<string>('DATABASE_CORE_1240');

  // Preprocessing Options & Data States
  const [preprocessOptions, setPreprocessOptions] = useState<PreprocessOptions>(DEFAULT_PREPROCESS_OPTIONS);
  const [rawData, setRawData] = useState<RawDataRecord[]>(() => generateCanonicalDataset());
  const [viewMode, setViewMode] = useState<'cleaned' | 'raw'>('cleaned');

  // Pipeline Execution State
  const [cleanedData, setCleanedData] = useState<CleanedDataRecord[]>([]);
  const [cleaningReport, setCleaningReport] = useState<CleaningReport | null>(null);

  // Model Engine instance
  const modelEngine = useMemo(() => new PredictiveModelEngine(), []);
  const [modelTrainedCount, setModelTrainedCount] = useState<number>(0);

  // Real-time clock updating matching HH:MM:SS.SS
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const centis = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
      setLiveTime(`${hours}:${minutes}:${seconds}.${centis}`);
    }, 90);
    return () => clearInterval(timer);
  }, []);

  // Execute cleaning pipeline and retrain model when rawData or options change
  const runPipeline = useCallback(() => {
    const { cleaned, report } = preprocessDataset(rawData, preprocessOptions);
    setCleanedData(cleaned);
    setCleaningReport(report);
    modelEngine.train(cleaned);
    setModelTrainedCount((c) => c + 1);
  }, [rawData, preprocessOptions, modelEngine]);

  // Initial run on mount
  useEffect(() => {
    runPipeline();
  }, [runPipeline]);

  // Detected issues in raw data
  const rawIssues = useMemo(() => detectDataIssues(rawData), [rawData]);

  // Statistical analysis report
  const analysisReport: FullAnalysisReport = useMemo(() => {
    return performStatisticalAnalysis(cleanedData);
  }, [cleanedData]);

  // Custom dataset loader from FileUploadModal
  const handleLoadCustomDataset = (newRecords: RawDataRecord[], filename: string) => {
    setRawData(newRecords);
    setDatasetName(filename.replace(/\.[^/.]+$/, '').toUpperCase());
    setViewMode('cleaned');
    setActiveTab('data');
  };

  // Filter CANONICAL_PLUGINS list by name or ID in real-time as the user types
  const filteredPlugins = useMemo(() => {
    const query = pluginSearchQuery.trim().toLowerCase();
    if (!query) return CANONICAL_PLUGINS;
    return CANONICAL_PLUGINS.filter((plugin) =>
      plugin.name.toLowerCase().includes(query) ||
      plugin.id.toLowerCase().includes(query)
    );
  }, [pluginSearchQuery]);

  const currentProfileMeta = PROFILES_METADATA[activeProfile];

  return (
    <div
      id="app-root"
      className="min-h-screen w-full bg-[#0F1115] text-[#E0E2E6] flex flex-col p-4 sm:p-8 font-sans overflow-x-hidden max-w-7xl mx-auto"
    >
      {/* Header matching the Bold Typography specification */}
      <header
        id="header-section"
        className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline border-b border-white/10 pb-6 mb-8 gap-4"
      >
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#6366F1] font-bold mb-1">
            System Interface / v.01
          </span>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-none">
            MENGIKUT{' '}
            <span
              className="text-transparent"
              style={{ WebkitTextStroke: '1px #E0E2E6' }}
            >
              DATA
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-2">
            <span className="text-[11px] uppercase tracking-widest text-white/50 font-mono">
              DSH SUPREME // DEEPSEEK HARNESS MASTER DATA INTELLIGENCE RUNTIME
            </span>
            <a
              id="header-upstream-repo-link"
              href="https://github.com/deepseek-ai/deepseek-harness.git"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-white/5 hover:bg-white/10 text-[#A5B4FC] hover:text-white border border-white/10 transition-colors"
              title="Official DeepSeek Harness Upstream Repository"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>deepseek-ai/deepseek-harness</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-70" />
            </a>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Last Synced Data</div>
          <div className="text-2xl font-mono">{liveTime}</div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main id="main-content" className="grid grid-cols-12 gap-8 flex-grow">
        {/* Left Column (col-span-12 lg:col-span-4) */}
        <section id="metrics-status-section" className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Primary Metrics Card */}
          <div id="primary-metrics-card" className="bg-white/5 border border-white/10 p-6 rounded-2xl">
            <h2 className="text-[11px] uppercase tracking-widest text-[#6366F1] font-bold mb-8">
              Primary Metrics
            </h2>
            <div className="mb-6">
              <span className="text-6xl font-black block leading-none">
                {cleanedData.length > 0 ? `${(cleanedData.length / 1000).toFixed(1)}k` : '84.2k'}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-white/40">Processed Entries</span>
            </div>
            <div className="mb-2">
              <span className="text-6xl font-black block leading-none text-[#6366F1]">
                {analysisReport?.numericStatistics?.latency
                  ? `${(analysisReport.numericStatistics.latency.mean / 1000).toFixed(2)}s`
                  : '0.04s'}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-white/40">Latent Response</span>
            </div>
          </div>

          {/* Status Report Card (Inverted vibrant indigo block with background glyph) */}
          <div
            id="status-report-card"
            className="bg-[#6366F1] text-black p-6 rounded-2xl flex-grow relative overflow-hidden flex flex-col justify-between min-h-[240px]"
          >
            <div>
              <h2 className="text-[11px] uppercase tracking-widest font-black mb-4">Status Report</h2>
              <p className="text-2xl font-bold leading-tight tracking-tight">
                Sistem sedia untuk memproses input data seterusnya mengikut format yang ditetapkan.
              </p>
              <div className="mt-3 text-xs font-bold uppercase tracking-wider opacity-85 font-mono">
                Dataset: {datasetName} // {cleanedData.length} Clean Records
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 z-10">
              <button
                id="btn-quick-upload"
                onClick={() => setUploadModalOpen(true)}
                className="px-4 py-2 bg-black text-[#E0E2E6] text-xs font-black uppercase tracking-widest rounded-xl hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                Upload File
              </button>
              <button
                id="btn-quick-sandbox"
                onClick={() => setActiveTab('model')}
                className="px-4 py-2 bg-white/20 text-black text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/30 transition-colors cursor-pointer"
              >
                Predictor
              </button>
            </div>

            {/* Background SVG Watermark */}
            <div className="absolute -bottom-4 -right-4 opacity-20 pointer-events-none">
              <svg width="130" height="130" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V9l-7-7zM6 20V4h6v5h5v11H6z" />
              </svg>
            </div>
          </div>

          {/* Data Quality & Model Accuracy Summary Card */}
          <div id="data-quality-summary-card" className="bg-white/5 border border-white/10 p-6 rounded-2xl font-mono text-xs">
            <h2 className="text-[11px] uppercase tracking-widest text-[#6366F1] font-bold mb-4">
              Intelligence Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-white/50">Data Health Score</span>
                <span className="font-bold text-emerald-400">
                  {cleaningReport?.healthScoreAfter || 100}%
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-white/50">Random Forest Accuracy</span>
                <span className="font-bold text-[#818cf8]">
                  {modelEngine.getEvaluation()
                    ? `${(modelEngine.getEvaluation()!.overallAccuracy * 100).toFixed(1)}%`
                    : '92.4%'}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-white/50">Imputed / Dropped</span>
                <span className="font-bold text-amber-400">
                  {cleaningReport ? cleaningReport.missingValuesImputed : 38} items
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-white/50">Duplicates Purged</span>
                <span className="font-bold text-white">
                  {cleaningReport ? cleaningReport.duplicatesRemoved : 24} rows
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Statistical Outliers</span>
                <span className="font-bold text-rose-400">
                  {analysisReport?.outliers?.length || 0} flagged
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column (col-span-12 lg:col-span-8) */}
        <section id="main-display-section" className="col-span-12 lg:col-span-8 flex flex-col">
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-full">
            {/* Top Navigation Tabs */}
            <div className="flex border-b border-white/10 bg-white/5 overflow-x-auto">
              <button
                id="tab-data-records"
                onClick={() => setActiveTab('data')}
                className={`px-5 py-3 text-[10px] uppercase tracking-widest font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'data'
                    ? 'border-[#6366F1] text-[#6366F1] bg-white/[0.04]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Data Records ({cleanedData.length})
              </button>

              <button
                id="tab-clean-preprocess"
                onClick={() => setActiveTab('clean')}
                className={`px-5 py-3 text-[10px] uppercase tracking-widest font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'clean'
                    ? 'border-[#6366F1] text-[#6366F1] bg-white/[0.04]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Clean & Preprocess
              </button>

              <button
                id="tab-statistics-trends"
                onClick={() => setActiveTab('stats')}
                className={`px-5 py-3 text-[10px] uppercase tracking-widest font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'stats'
                    ? 'border-[#6366F1] text-[#6366F1] bg-white/[0.04]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Statistics & Trends
              </button>

              <button
                id="tab-predictive-model"
                onClick={() => setActiveTab('model')}
                className={`px-5 py-3 text-[10px] uppercase tracking-widest font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'model'
                    ? 'border-[#6366F1] text-[#6366F1] bg-white/[0.04]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Predictive Model
              </button>

              <button
                id="tab-canonical-plugins"
                onClick={() => setActiveTab('plugins')}
                className={`px-5 py-3 text-[10px] uppercase tracking-widest font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === 'plugins'
                    ? 'border-[#6366F1] text-[#6366F1] bg-white/[0.04]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Cordis Harness (7 Plugins)
              </button>
            </div>

            {/* Tab Views Body */}
            <div className="flex-grow flex flex-col">
              {/* TAB 1: DATA RECORDS */}
              {activeTab === 'data' && (
                <DatasetTable
                  cleanedData={cleanedData}
                  rawData={rawData}
                  viewMode={viewMode}
                  onToggleViewMode={setViewMode}
                  onOpenUpload={() => setUploadModalOpen(true)}
                />
              )}

              {/* TAB 2: CLEANING & PREPROCESSING */}
              {activeTab === 'clean' && cleaningReport && (
                <DataCleaningPipeline
                  issues={rawIssues}
                  report={cleaningReport}
                  options={preprocessOptions}
                  onOptionsChange={setPreprocessOptions}
                  onRerunPipeline={runPipeline}
                />
              )}

              {/* TAB 3: STATISTICAL ANALYSIS & TRENDS */}
              {activeTab === 'stats' && analysisReport && (
                <StatisticalAnalysisView analysis={analysisReport} />
              )}

              {/* TAB 4: PREDICTIVE MODEL & INFERENCE SANDBOX */}
              {activeTab === 'model' && (
                <PredictiveModelView
                  modelEngine={modelEngine}
                  cleanedData={cleanedData}
                  onRetrain={runPipeline}
                />
              )}

              {/* TAB 5: SOVEREIGN CORDIS PLUGINS */}
              {activeTab === 'plugins' && (
                <div className="flex flex-col h-full font-mono">
                  {/* Search Bar Toolbar */}
                  <div
                    id="plugin-search-toolbar"
                    className="p-3 sm:p-4 border-b border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
                  >
                    <div className="relative flex-grow max-w-md">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                      <input
                        id="plugin-search-input"
                        data-testid="plugin-search-input"
                        type="text"
                        value={pluginSearchQuery}
                        onChange={(e) => setPluginSearchQuery(e.target.value)}
                        placeholder="Filter plugins by name or ID (e.g. supreme, #PLUG-9901)..."
                        className="w-full pl-10 pr-9 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all"
                      />
                      {pluginSearchQuery && (
                        <button
                          id="clear-plugin-search-btn"
                          onClick={() => setPluginSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-0.5 rounded transition-colors cursor-pointer"
                          title="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-white/40 flex items-center justify-between sm:justify-end gap-2 font-mono">
                      <span>
                        Showing <strong className="text-white font-bold">{filteredPlugins.length}</strong> of {CANONICAL_PLUGINS.length} plugins
                      </span>
                    </div>
                  </div>

                  {/* Table Column Headers */}
                  <div className="grid grid-cols-4 border-b border-white/10 bg-white/5">
                    <div className="p-4 text-[10px] uppercase tracking-widest font-bold text-white/40">Identifier</div>
                    <div className="p-4 text-[10px] uppercase tracking-widest font-bold text-white/40">Category</div>
                    <div className="p-4 text-[10px] uppercase tracking-widest font-bold text-white/40">Variable</div>
                    <div className="p-4 text-[10px] uppercase tracking-widest font-bold text-white/40">Execution</div>
                  </div>

                  <div className="flex-grow divide-y divide-white/5 overflow-y-auto min-h-[360px] text-sm">
                    {filteredPlugins.length > 0 ? (
                      filteredPlugins.map((plugin) => (
                        <div
                          key={plugin.id}
                          id={`row-${plugin.name}`}
                          onClick={() => setSelectedPlugin(plugin)}
                          className="grid grid-cols-4 hover:bg-white/[0.03] cursor-pointer transition-colors"
                        >
                          <div className="p-4 border-r border-white/5 text-white/90">{plugin.id}</div>
                          <div className="p-4 border-r border-white/5 text-[#6366F1] font-bold">{plugin.name}</div>
                          <div className="p-4 border-r border-white/5 truncate text-white/80">{plugin.variable}</div>
                          <div className="p-4 text-emerald-400 font-bold">{plugin.executionStatus}</div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center text-white/40 px-4">
                        <Search className="w-8 h-8 mb-3 opacity-30 text-[#6366F1]" />
                        <p className="text-sm font-sans text-white/70 mb-1">
                          No plugins found matching &quot;{pluginSearchQuery}&quot;
                        </p>
                        <p className="text-xs text-white/40 font-sans mb-3">
                          Try searching by plugin name (e.g. &quot;policy&quot;) or ID (e.g. &quot;#PLUG-9901&quot;)
                        </p>
                        <button
                          onClick={() => setPluginSearchQuery('')}
                          className="px-3 py-1 text-xs text-[#6366F1] hover:underline cursor-pointer font-mono"
                        >
                          Reset Search Filter
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Plugin Actions Footer */}
                  <div className="p-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                    <span className="text-white/40 uppercase tracking-widest text-[10px]">
                      {filteredPlugins.length === CANONICAL_PLUGINS.length
                        ? '7 Canonical Plugins Active in Cordis Context'
                        : `${filteredPlugins.length} of ${CANONICAL_PLUGINS.length} Plugins Matching "${pluginSearchQuery}"`}
                    </span>
                    <button
                      id="btn-launch-harness-sandbox"
                      onClick={() => setSimulatorOpen(true)}
                      className="px-4 py-1.5 bg-[#6366F1] text-black font-bold uppercase tracking-wider rounded-lg hover:bg-[#5254db] transition-colors cursor-pointer"
                    >
                      Launch Simulator
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer matching Design HTML */}
      <footer
        id="footer-section"
        className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div className="flex gap-8 font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-tighter text-white/40 mb-1">Access Level</span>
            <span className="text-xs font-bold">ADMINISTRATOR_LEVEL_0</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-tighter text-white/40 mb-1">Active Node</span>
            <span className="text-xs font-bold text-[#6366F1]">KUALA_LUMPUR_04</span>
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.4em] font-black italic">
          Security Protocol Alpha Active
        </div>
      </footer>

      {/* Modals */}
      <PluginDetailModal plugin={selectedPlugin} onClose={() => setSelectedPlugin(null)} />
      <RouterSimulatorModal
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        currentProfile={activeProfile}
      />
      <FileUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onLoadDataset={handleLoadCustomDataset}
      />
    </div>
  );
}
