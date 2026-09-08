import React, { useState, useRef } from 'react';
import { RawDataRecord } from '../data/rawDataset.ts';
import { parseCSV } from '../utils/dataPreprocessor.ts';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDataset: (records: RawDataRecord[], filename: string) => void;
}

export function FileUploadModal({
  isOpen,
  onClose,
  onLoadDataset,
}: FileUploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<RawDataRecord[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFileContent = (content: string, name: string) => {
    setErrorMsg(null);
    try {
      let records: RawDataRecord[] = [];
      if (name.endsWith('.json') || content.trim().startsWith('[') || content.trim().startsWith('{')) {
        const parsed = JSON.parse(content);
        records = Array.isArray(parsed) ? parsed : (parsed.records || parsed.data || [parsed]);
      } else {
        records = parseCSV(content);
      }

      if (records.length === 0) {
        setErrorMsg('The file appears empty or could not be parsed into records.');
        return;
      }

      setFileName(name);
      setPreviewRows(records);
    } catch (err: any) {
      setErrorMsg(`Failed to parse file: ${err.message}`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        processFileContent(event.target?.result as string, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        processFileContent(event.target?.result as string, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleConfirmLoad = () => {
    if (previewRows.length > 0 && fileName) {
      onLoadDataset(previewRows, fileName);
      onClose();
    }
  };

  return (
    <div
      id="file-upload-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="file-upload-modal"
        className="bg-[#13161C] border border-white/20 rounded-2xl max-w-xl w-full p-6 text-white shadow-2xl relative font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#6366F1] font-bold block">
              Dataset Ingestion Portal
            </span>
            <h3 className="text-xl font-black mt-1">Upload External Dataset</h3>
          </div>
          <button
            id="btn-close-upload-modal"
            onClick={onClose}
            className="text-white/40 hover:text-white text-lg p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Drag and Drop Zone */}
        <div
          id="dropzone-area"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors text-center ${
            dragOver
              ? 'border-[#6366F1] bg-[#6366F1]/10'
              : 'border-white/20 hover:border-white/40 bg-white/[0.02]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".csv,.json"
            className="hidden"
          />

          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3 text-[#6366F1]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <span className="text-sm font-bold text-white mb-1">
            Drag & Drop CSV or JSON Dataset here
          </span>
          <span className="text-xs text-white/40 font-sans">
            or click to browse from local filesystem
          </span>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Parsed Preview */}
        {previewRows.length > 0 && (
          <div className="mt-4 p-4 bg-black/40 border border-white/10 rounded-xl">
            <div className="flex justify-between items-center mb-2 text-xs">
              <span className="font-bold text-emerald-400">
                ✓ Parsed {previewRows.length} records from {fileName}
              </span>
              <span className="text-white/40 text-[10px]">
                Columns: {Object.keys(previewRows[0]).join(', ')}
              </span>
            </div>
            <div className="text-[11px] text-white/60">
              The dataset will undergo automatic cleaning, imputation, anomaly detection, and predictive model fitting.
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            id="btn-cancel-upload"
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-load-dataset"
            disabled={previewRows.length === 0}
            onClick={handleConfirmLoad}
            className="px-5 py-2 bg-[#6366F1] hover:bg-[#5254db] disabled:opacity-30 disabled:cursor-not-allowed text-black font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-colors"
          >
            Ingest & Clean Dataset
          </button>
        </div>
      </div>
    </div>
  );
}
