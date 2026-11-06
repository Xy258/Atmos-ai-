import React, { useState } from 'react';
import {
  FolderGit2,
  X,
  Loader2,
  Search,
  Star,
  GitFork,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { ProjectFile } from '../types/project';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRepoLoaded: (repoName: string, files: ProjectFile[]) => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({
  isOpen,
  onClose,
  onRepoLoaded,
}) => {
  const [repoInput, setRepoInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickPresets = [
    { label: 'expressjs/express', desc: 'Fast, unopinionated Node.js framework' },
    { label: 'facebook/react', desc: 'JavaScript library for web UIs' },
    { label: 'tailwindlabs/tailwindcss', desc: 'Utility-first CSS framework' },
    { label: 'colinhacks/zod', desc: 'TypeScript-first schema declaration' },
  ];

  const handleFetchRepo = async (targetRepo: string) => {
    if (!targetRepo.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/proxy/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: targetRepo.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract repository files');
      }

      onRepoLoaded(data.repo.fullName || targetRepo, data.files);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not load GitHub repository.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Extract GitHub Repository</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-neutral-400">
            Enter any public GitHub repository (e.g. <span className="font-mono text-neutral-300">owner/repo</span> or repository URL) to extract its source tree, inspect code, and export.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleFetchRepo(repoInput);
            }}
            className="space-y-3"
          >
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="e.g. expressjs/express or https://github.com/..."
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !repoInput.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-colors shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Extracting Repository...</span>
                </>
              ) : (
                <>
                  <span>Extract &amp; Load Files</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick presets */}
          <div className="pt-2">
            <span className="text-[11px] font-medium text-neutral-400 block mb-2">
              Popular Presets to Explore:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickPresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setRepoInput(preset.label);
                    handleFetchRepo(preset.label);
                  }}
                  disabled={isLoading}
                  className="p-2.5 bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800/80 hover:border-neutral-700 rounded-xl text-left transition-colors text-xs"
                >
                  <div className="font-mono font-medium text-neutral-200 truncate">
                    {preset.label}
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                    {preset.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
