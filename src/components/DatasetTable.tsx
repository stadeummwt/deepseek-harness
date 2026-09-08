import { useState, useMemo } from 'react';
import { CleanedDataRecord, RawDataRecord } from '../data/rawDataset.ts';
import { exportToCSV } from '../utils/dataPreprocessor.ts';

interface DatasetTableProps {
  cleanedData: CleanedDataRecord[];
  rawData: RawDataRecord[];
  viewMode: 'cleaned' | 'raw';
  onToggleViewMode: (mode: 'cleaned' | 'raw') => void;
  onOpenUpload: () => void;
}

export function DatasetTable({
  cleanedData,
  rawData,
  viewMode,
  onToggleViewMode,
  onOpenUpload,
}: DatasetTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const activeRecords = viewMode === 'cleaned' ? cleanedData : rawData;

  // Filter records
  const filteredRecords = useMemo(() => {
    return activeRecords.filter((rec: any) => {
      const matchSearch =
        !searchTerm ||
        rec.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(rec.variable).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(rec.category).toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat =
        categoryFilter === 'ALL' ||
        String(rec.category).trim().toUpperCase() === categoryFilter;

      const matchStatus =
        statusFilter === 'ALL' ||
        String(rec.execution).trim().toUpperCase() === statusFilter;

      return matchSearch && matchCat && matchStatus;
    });
  }, [activeRecords, searchTerm, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pagedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const handleExport = () => {
    const csvContent = exportToCSV(cleanedData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dsh_cleaned_dataset_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="dataset-table-container" className="flex flex-col h-full">
      {/* Table Action & Filtering Bar */}
      <div className="p-4 bg-white/[0.03] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        {/* View Mode Toggle: Cleaned vs Raw */}
        <div className="flex items-center gap-2">
          <button
            id="btn-view-cleaned"
            onClick={() => {
              onToggleViewMode('cleaned');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === 'cleaned'
                ? 'bg-[#6366F1] text-black shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
            }`}
          >
            Cleaned Data ({cleanedData.length})
          </button>
          <button
            id="btn-view-raw"
            onClick={() => {
              onToggleViewMode('raw');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              viewMode === 'raw'
                ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
            }`}
          >
            Raw Dataset ({rawData.length})
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-grow sm:flex-grow-0">
          <input
            id="input-search-data"
            type="text"
            placeholder="Filter ID, Variable, Category..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-white placeholder-white/40 focus:outline-none focus:border-[#6366F1] w-48"
          />

          <select
            id="select-category-filter"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white/80 focus:outline-none focus:border-[#6366F1]"
          >
            <option value="ALL">All Categories</option>
            <option value="CORE_ASSET">CORE_ASSET</option>
            <option value="LOGISTICS">LOGISTICS</option>
            <option value="ANALYSIS">ANALYSIS</option>
            <option value="REGISTRY">REGISTRY</option>
            <option value="METADATA">METADATA</option>
            <option value="NETWORK">NETWORK</option>
            <option value="INFERENCE">INFERENCE</option>
            <option value="SECURITY">SECURITY</option>
          </select>

          <select
            id="select-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white/80 focus:outline-none focus:border-[#6366F1]"
          >
            <option value="ALL">All Status</option>
            <option value="STABLE">STABLE</option>
            <option value="PENDING">PENDING</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>

        {/* Actions: Export & Upload */}
        <div className="flex items-center gap-2">
          <button
            id="btn-upload-dataset"
            onClick={onOpenUpload}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer"
          >
            Upload File
          </button>
          <button
            id="btn-export-csv"
            onClick={handleExport}
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table Column Headers matching the Canonical Design */}
      <div className="grid grid-cols-12 border-b border-white/10 bg-white/5 font-mono">
        <div className="col-span-3 p-3.5 text-[10px] uppercase tracking-widest font-bold text-white/40 border-r border-white/5">
          Identifier
        </div>
        <div className="col-span-3 p-3.5 text-[10px] uppercase tracking-widest font-bold text-white/40 border-r border-white/5">
          Category
        </div>
        <div className="col-span-3 p-3.5 text-[10px] uppercase tracking-widest font-bold text-white/40 border-r border-white/5">
          Variable
        </div>
        <div className="col-span-3 p-3.5 text-[10px] uppercase tracking-widest font-bold text-white/40">
          Execution
        </div>
      </div>

      {/* Table Rows Body */}
      <div className="flex-grow font-mono text-sm overflow-y-auto divide-y divide-white/5 min-h-[360px]">
        {pagedRecords.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-xs">
            No matching records found for the active search criteria.
          </div>
        ) : (
          pagedRecords.map((item: any, idx) => {
            const isCleaned = viewMode === 'cleaned';
            const isOutlier = item.is_outlier;
            const hasImputed = item.imputed_fields && item.imputed_fields.length > 0;
            const isMissingVal =
              !isCleaned &&
              (item.latency_ms === null ||
                item.token_payload === null ||
                item.risk_score === null ||
                !item.category);

            const statusClass =
              item.execution === 'STABLE'
                ? 'text-emerald-400'
                : item.execution === 'PENDING'
                ? 'text-amber-400'
                : 'text-rose-400';

            return (
              <div
                key={`${item.id}-${idx}`}
                id={`row-${item.id}`}
                onClick={() => setSelectedRecord(item)}
                className="grid grid-cols-12 hover:bg-white/[0.03] cursor-pointer transition-colors group items-center"
              >
                {/* Identifier */}
                <div className="col-span-3 p-3.5 border-r border-white/5 flex items-center justify-between">
                  <span className="text-white/90 font-semibold group-hover:text-white">
                    {item.id}
                  </span>
                  {isCleaned && isOutlier && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-sans uppercase">
                      OUTLIER
                    </span>
                  )}
                  {isCleaned && hasImputed && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#6366F1]/20 text-[#818cf8] font-sans uppercase">
                      IMPUTED
                    </span>
                  )}
                  {!isCleaned && isMissingVal && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-sans uppercase">
                      DIRTY
                    </span>
                  )}
                </div>

                {/* Category */}
                <div className="col-span-3 p-3.5 border-r border-white/5 text-[#6366F1] font-bold truncate">
                  {item.category ? item.category : <span className="text-white/30 italic">NULL_CAT</span>}
                </div>

                {/* Variable */}
                <div className="col-span-3 p-3.5 border-r border-white/5 text-white/80 truncate flex items-center justify-between">
                  <span>{item.variable}</span>
                  <span className="text-[10px] text-white/40 font-sans hidden sm:inline">
                    {typeof item.latency_ms === 'number'
                      ? `${item.latency_ms.toFixed(1)}ms`
                      : String(item.latency_ms)}
                  </span>
                </div>

                {/* Execution */}
                <div className="col-span-3 p-3.5 flex items-center justify-between">
                  <span className={`font-bold ${statusClass}`}>
                    {item.execution || 'UNKNOWN'}
                  </span>
                  <span className="text-[10px] text-white/30 font-sans hidden md:inline">
                    {item.cost_tier}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Table Pagination & Status Footer */}
      <div className="p-4 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-mono">
        <div className="text-[11px] text-white/40 uppercase tracking-widest">
          Displaying {filteredRecords.length ? (currentPage - 1) * pageSize + 1 : 0}-
          {Math.min(currentPage * pageSize, filteredRecords.length)} of {activeRecords.length} records found in database
        </div>

        {/* Page navigation controls */}
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-[10px] mr-2">Rows per page:</span>
          <select
            id="select-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>

          <button
            id="btn-page-prev"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-white/10 text-white cursor-pointer"
          >
            &lt; Prev
          </button>
          <span className="text-white/70 px-1">
            {currentPage} / {totalPages}
          </span>
          <button
            id="btn-page-next"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed rounded border border-white/10 text-white cursor-pointer"
          >
            Next &gt;
          </button>
        </div>
      </div>

      {/* Record Inspector Modal */}
      {selectedRecord && (
        <div
          id="record-detail-overlay"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            id="record-detail-modal"
            className="bg-[#13161C] border border-white/20 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold block">
                  Record Metadata Inspector
                </span>
                <h3 className="text-2xl font-black font-mono mt-1">{selectedRecord.id}</h3>
              </div>
              <button
                id="btn-close-record-inspector"
                onClick={() => setSelectedRecord(null)}
                className="text-white/40 hover:text-white text-lg font-mono p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono mb-4">
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/40 block uppercase text-[10px]">Category</span>
                <span className="font-bold text-[#6366F1] text-sm">{selectedRecord.category || 'NULL'}</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/40 block uppercase text-[10px]">Variable Key</span>
                <span className="font-bold text-white text-sm">{selectedRecord.variable}</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/40 block uppercase text-[10px]">Execution Status</span>
                <span className={`font-bold text-sm ${
                  selectedRecord.execution === 'STABLE' ? 'text-emerald-400' :
                  selectedRecord.execution === 'PENDING' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {selectedRecord.execution}
                </span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/40 block uppercase text-[10px]">Cost Tier</span>
                <span className="font-bold text-white text-sm">{selectedRecord.cost_tier}</span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/40 block uppercase text-[10px]">Response Latency</span>
                <span className="font-bold text-white text-sm">
                  {typeof selectedRecord.latency_ms === 'number'
                    ? `${selectedRecord.latency_ms.toFixed(2)} ms`
                    : String(selectedRecord.latency_ms)}
                </span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/40 block uppercase text-[10px]">Token Payload</span>
                <span className="font-bold text-white text-sm">
                  {typeof selectedRecord.token_payload === 'number'
                    ? `${selectedRecord.token_payload.toLocaleString()} tokens`
                    : String(selectedRecord.token_payload)}
                </span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/40 block uppercase text-[10px]">Risk Score</span>
                <span className="font-bold text-white text-sm">
                  {typeof selectedRecord.risk_score === 'number'
                    ? selectedRecord.risk_score.toFixed(2)
                    : String(selectedRecord.risk_score)}
                </span>
              </div>
              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/40 block uppercase text-[10px]">Invocations</span>
                <span className="font-bold text-white text-sm">
                  {typeof selectedRecord.invocation_count === 'number'
                    ? selectedRecord.invocation_count.toLocaleString()
                    : String(selectedRecord.invocation_count)}
                </span>
              </div>
            </div>

            {selectedRecord.imputed_fields && (
              <div className="p-3 bg-[#6366F1]/10 border border-[#6366F1]/30 rounded-xl text-xs mb-4">
                <span className="font-bold text-[#818cf8] block mb-1">
                  Imputed Attributes in Cleaning Phase:
                </span>
                <div className="flex gap-2">
                  {selectedRecord.imputed_fields.map((f: string) => (
                    <span key={f} className="px-2 py-0.5 bg-black/40 rounded text-[10px] font-mono text-white/90">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-right">
              <button
                id="btn-dismiss-inspector"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-wider"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
