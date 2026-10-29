// src/components/UploadModal.tsx
'use client';

import { useState } from 'react';
import { Upload, X, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function UploadModal({ isOpen, onClose, userId }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus(null);
    }
  };

  const handleUpload = async () => {
  if (!file) return;

  setIsUploading(true);
  setStatus(null);

  try {
    let fileContent = '';

    if (file.name.endsWith('.pdf')) {
      // Read PDF as base64 data URL
      fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    } else {
      // Read text files directly
      fileContent = await file.text();
    }

    const response = await fetch('http://localhost:5000/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        documentId: file.name,
        rawText: fileContent,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      setStatus({
        type: 'success',
        message: `File "${file.name}" ingested successfully!`,
      });
      setFile(null);
    } else {
      throw new Error(data.error || 'Ingestion failed');
    }
  } catch (err: any) {
    setStatus({
      type: 'error',
      message: err.message || 'Failed to connect to backend server.',
    });
  } finally {
    setIsUploading(false);
  }
};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold">Upload Knowledge Document</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Zone */}
        <div className="mt-5 space-y-4">
          <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-all">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <FileText className="w-8 h-8 text-indigo-400 mb-2" />
              <p className="text-xs text-slate-300 font-medium">
                {file ? file.name : 'Click or drop text / markdown / document file'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Supports .txt, .md, .json, .pdf</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".txt,.md,.json,.pdf,.csv"
              onChange={handleFileChange}
            />
          </label>

          {/* Status Message */}
          {status && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center space-x-2 ${
                status.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-800 text-rose-300'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="flex items-center space-x-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-all shadow-md"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Ingesting...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Ingest File</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}