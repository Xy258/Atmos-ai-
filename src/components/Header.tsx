import React from 'react';
import { Download, Sparkles, FolderGit2, Upload, FileCode2, RefreshCw } from 'lucide-react';

interface HeaderProps {
  activeTab: 'workspace' | 'inspector' | 'metrics' | 'ai';
  setActiveTab: (tab: 'workspace' | 'inspector' | 'metrics' | 'ai') => void;
  onExportZip: () => void;
  onExportRepomix: () => void;
  onOpenGitHubModal: () => void;
  onOpenZipModal: () => void;
  onRefreshWorkspace: () => void;
  isLoading: boolean;
  totalFiles: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onExportZip,
  onExportRepomix,
  onOpenGitHubModal,
  onOpenZipModal,
  onRefreshWorkspace,
  isLoading,
  totalFiles,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-neutral-900 border-b border-neutral-800 text-neutral-200 shrink-0">
      {/* Zone 1: Brand wordmark (single text element, no pills or taglines) */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('workspace');
          }}
          className="text-lg font-bold tracking-tight text-white hover:text-indigo-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <FileCode2 className="w-5 h-5 text-indigo-400" />
          <span>ProjectExtra</span>
        </a>
        <span className="text-xs text-neutral-500 hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span className="text-xs text-neutral-400 font-mono tabular-nums hidden sm:inline">
          {totalFiles} files loaded
        </span>
      </div>

      {/* Zone 2: Navigation Links (concise 1-2 word text links) */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-400">
        <button
          onClick={() => setActiveTab('workspace')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'workspace' ? 'text-white border-b-2 border-indigo-500' : ''
          }`}
        >
          Workspace
        </button>
        <button
          onClick={() => setActiveTab('inspector')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'inspector' ? 'text-white border-b-2 border-indigo-500' : ''
          }`}
        >
          Code Inspector
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
            activeTab === 'metrics' ? 'text-white border-b-2 border-indigo-500' : ''
          }`}
        >
          Metrics &amp; Audit
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
            activeTab === 'ai' ? 'text-indigo-400 border-b-2 border-indigo-500' : ''
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI Extractor</span>
        </button>
      </nav>

      {/* Zone 3: Quick Action Affordances & Primary Action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onRefreshWorkspace}
          disabled={isLoading}
          title="Reload workspace files"
          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
        </button>

        <button
          onClick={onOpenGitHubModal}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-neutral-400" />
          <span>Extract GitHub Repo</span>
        </button>

        <button
          onClick={onOpenZipModal}
          className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5 text-neutral-400" />
          <span>Upload ZIP</span>
        </button>

        <button
          onClick={onExportRepomix}
          title="Export single-file markdown pack for AI models"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <span>Repomix Pack</span>
        </button>

        <button
          onClick={onExportZip}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export ZIP</span>
        </button>
      </div>
    </header>
  );
};
