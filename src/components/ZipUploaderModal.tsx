import React, { useState, useRef } from 'react';
import { Upload, X, FileArchive, Loader2, CheckCircle2 } from 'lucide-react';
import { ProjectFile } from '../types/project';
import { extractUploadedZip } from '../utils/zipExport';

interface ZipUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onZipLoaded: (name: string, files: ProjectFile[]) => void;
}

export const ZipUploaderModal: React.FC<ZipUploaderModalProps> = ({
  isOpen,
  onClose,
  onZipLoaded,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      setError('Please select a valid .zip archive.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const extractedFiles = await extractUploadedZip(file);
      if (extractedFiles.length === 0) {
        throw new Error('No readable text or code files found in archive.');
      }

      const zipBaseName = file.name.replace(/\.zip$/i, '');
      onZipLoaded(zipBaseName, extractedFiles);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to extract ZIP archive.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <FileArchive className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Extract Local ZIP Archive</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-neutral-400 leading-relaxed">
            Extract and explore any project codebase stored in a .zip archive. All files are unpacked in-browser in memory.
          </p>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-neutral-700/80 hover:border-neutral-600 bg-neutral-950/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {isLoading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
                <span className="text-xs font-medium text-neutral-300">
                  Unpacking archive files...
                </span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-neutral-400 mb-3" />
                <span className="text-xs font-semibold text-neutral-200">
                  Click to browse or drop .zip file here
                </span>
                <span className="text-[11px] text-neutral-500 mt-1">
                  Supports standard zip archives up to 50MB
                </span>
              </>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
