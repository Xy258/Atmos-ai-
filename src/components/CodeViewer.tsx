import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  Download,
  Edit3,
  Save,
  Search,
  Maximize2,
  Minimize2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { ProjectFile } from '../types/project';
import { downloadTextFile } from '../utils/zipExport';

interface CodeViewerProps {
  file: ProjectFile | null;
  onSaveFile?: (filePath: string, content: string) => Promise<void>;
  isSaving?: boolean;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  file,
  onSaveFile,
  isSaving = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [searchInFile, setSearchInFile] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      setEditContent(file.content || '');
      setIsEditing(false);
      setSaveStatus(null);
    }
  }, [file?.path, file?.content]);

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-500 bg-neutral-950">
        <FileText className="w-12 h-12 stroke-[1.2] mb-3 text-neutral-600" />
        <p className="text-sm font-medium text-neutral-400">No file selected</p>
        <p className="text-xs text-neutral-600 mt-1">
          Select a file from the tree to view, edit, or extract its contents.
        </p>
      </div>
    );
  }

  const handleCopy = async () => {
    try {
      const text = isEditing ? editContent : file.content;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownload = () => {
    const text = isEditing ? editContent : file.content;
    downloadTextFile(file.name, text);
  };

  const handleSave = async () => {
    if (!onSaveFile) return;
    try {
      setSaveStatus('Saving...');
      await onSaveFile(file.path, editContent);
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err: any) {
      setSaveStatus(`Error: ${err.message}`);
    }
  };

  // Rough estimation: 1 token ≈ 4 chars
  const fileChars = (isEditing ? editContent : file.content).length;
  const estimatedTokens = Math.round(fileChars / 4);

  const lines = (isEditing ? editContent : file.content).split('\n');

  return (
    <div
      className={`flex-1 flex flex-col bg-neutral-950 overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50' : 'h-full'
      }`}
    >
      {/* File Viewer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-neutral-200 font-semibold truncate">
            {file.path}
          </span>
          <span className="text-neutral-600" aria-hidden="true">
            ·
          </span>
          <span className="text-neutral-500 font-mono tabular-nums">
            {(file.size / 1024).toFixed(1)} KB
          </span>
          <span className="text-neutral-600" aria-hidden="true">
            ·
          </span>
          <span className="text-neutral-500 font-mono tabular-nums">
            {lines.length} lines
          </span>
          <span className="text-neutral-600" aria-hidden="true">
            ·
          </span>
          <span className="text-neutral-500 font-mono tabular-nums">
            ~{estimatedTokens} tokens
          </span>
          {saveStatus && (
            <span
              className={`ml-2 text-xs font-medium ${
                saveStatus.startsWith('Error') ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {saveStatus}
            </span>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2">
          {/* In-file Search */}
          {!isEditing && (
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-neutral-500" />
              <input
                type="text"
                placeholder="Find in file..."
                value={searchInFile}
                onChange={(e) => setSearchInFile(e.target.value)}
                className="pl-7 pr-2 py-1 text-xs bg-neutral-950 border border-neutral-800 rounded text-neutral-300 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 w-36 focus:w-48 transition-all"
              />
            </div>
          )}

          {onSaveFile && (
            <button
              onClick={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
              disabled={isSaving}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                isEditing
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white'
              }`}
            >
              {isEditing ? (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </>
              )}
            </button>
          )}

          {isEditing && (
            <button
              onClick={() => {
                setEditContent(file.content || '');
                setIsEditing(false);
              }}
              className="px-2.5 py-1 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-850 hover:bg-neutral-800 rounded transition-colors"
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white rounded transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            title="Download this file"
            className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Editor / Viewer Body */}
      {file.isBinary ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-neutral-400">
          <AlertCircle className="w-10 h-10 mb-2 text-amber-500/80" />
          <p className="text-sm font-medium">Binary or media file</p>
          <p className="text-xs text-neutral-600 mt-1 mb-4">
            Direct text preview not available for this file type.
          </p>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white rounded-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download file</span>
          </button>
        </div>
      ) : isEditing ? (
        <div className="flex-1 p-0 relative">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full bg-neutral-950 text-neutral-200 font-mono text-xs p-4 leading-relaxed outline-none resize-none border-none selection:bg-indigo-600/30 font-['JetBrains_Mono']"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto font-['JetBrains_Mono'] text-xs leading-5">
          <div className="flex min-w-full">
            {/* Line numbers column */}
            <div className="select-none py-3 px-3 text-right bg-neutral-950/80 text-neutral-600 font-mono border-r border-neutral-900 sticky left-0 shrink-0 tabular-nums">
              {lines.map((_, i) => (
                <div key={i} className="h-5">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code content */}
            <div className="flex-1 py-3 px-4 overflow-x-auto text-neutral-300 font-mono whitespace-pre">
              {lines.map((line, idx) => {
                const isMatch =
                  searchInFile &&
                  line.toLowerCase().includes(searchInFile.toLowerCase());

                return (
                  <div
                    key={idx}
                    className={`h-5 hover:bg-neutral-900/60 transition-colors ${
                      isMatch ? 'bg-amber-500/20 text-amber-200' : ''
                    }`}
                  >
                    {line || ' '}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
