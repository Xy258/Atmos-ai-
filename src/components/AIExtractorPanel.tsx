import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  FileCode,
  Network,
  TestTube2,
  Package,
  BookOpen,
  Copy,
  Check,
  Download,
  Send,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { ProjectFile, AIExtractionMode } from '../types/project';
import { downloadTextFile } from '../utils/zipExport';

interface AIExtractorPanelProps {
  files: ProjectFile[];
  selectedFile: ProjectFile | null;
}

export const AIExtractorPanel: React.FC<AIExtractorPanelProps> = ({
  files,
  selectedFile,
}) => {
  const [mode, setMode] = useState<AIExtractionMode>('architecture');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractionModes: {
    id: AIExtractionMode;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'architecture',
      title: 'Architecture & Diagrams',
      description: 'Component relationships, Mermaid diagrams, and system architecture',
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: 'types',
      title: 'TypeScript Contracts',
      description: 'Unified types, data models, and schema definitions (.d.ts)',
      icon: <FileCode className="w-4 h-4 text-blue-400" />,
    },
    {
      id: 'apis',
      title: 'API & Route Catalog',
      description: 'REST endpoints, payload schemas, request/response models',
      icon: <Network className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'tests',
      title: 'Unit Test Suites',
      description: 'Vitest / Jest test suites for project components and utils',
      icon: <TestTube2 className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'repomix',
      title: 'Prompt Context Pack',
      description: 'AI-optimized summary and context pack for LLM prompts',
      icon: <Package className="w-4 h-4 text-purple-400" />,
    },
    {
      id: 'explain',
      title: 'Codebase Deep Dive',
      description: 'Pedagogical explanation of code structure and design decisions',
      icon: <BookOpen className="w-4 h-4 text-teal-400" />,
    },
  ];

  const handleExtract = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Prioritize selected file if any, or top code files
      const prioritizedFiles = selectedFile
        ? [selectedFile, ...files.filter((f) => f.path !== selectedFile.path)]
        : files;

      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          query: query.trim(),
          files: prioritizedFiles.slice(0, 15).map((f) => ({
            path: f.path,
            content: f.content,
            language: f.language,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract insights');
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message || 'An error occurred during extraction.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const filename = `project-extraction-${mode}.md`;
    downloadTextFile(filename, result, 'text/markdown');
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-neutral-950">
      {/* Configuration & Mode Sidebar */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-neutral-800 bg-neutral-900/40 p-4 flex flex-col shrink-0 overflow-y-auto">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">AI Extractor Studio</h2>
        </div>
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
          Extract architecture, type contracts, unit tests, or AI context packs powered by Gemini 3.8.
        </p>

        {/* Mode selector */}
        <div className="space-y-1.5 mb-5">
          <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block">
            Extraction Objective
          </label>
          {extractionModes.map((item) => {
            const isSelected = mode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                className={`w-full text-left p-2.5 rounded-lg transition-all text-xs flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-neutral-800 border border-indigo-500/50 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
                }`}
              >
                <div className="mt-0.5 shrink-0">{item.icon}</div>
                <div>
                  <div className="font-medium text-neutral-200">{item.title}</div>
                  <div className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected file kicker */}
        {selectedFile && (
          <div className="mb-4 p-2 bg-neutral-900/80 border border-neutral-800 rounded-md text-xs">
            <span className="text-[10px] text-neutral-500 block uppercase font-mono">
              Prioritized File Focus
            </span>
            <span className="font-mono text-neutral-300 truncate block mt-0.5">
              {selectedFile.path}
            </span>
          </div>
        )}

        {/* Custom refinement prompt */}
        <div className="mb-4">
          <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1.5">
            Refinement / Query (Optional)
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Focus on user session state and API endpoints..."
            rows={3}
            className="w-full text-xs bg-neutral-950 border border-neutral-800 rounded-md p-2 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500 resize-none font-sans"
          />
        </div>

        {/* Execute button */}
        <button
          onClick={handleExtract}
          disabled={isLoading || files.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors shadow-sm mt-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Extracting with Gemini...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run Extraction</span>
            </>
          )}
        </button>
      </div>

      {/* Results Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-950">
        {/* Results toolbar */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 bg-neutral-900/80 border-b border-neutral-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-200">
              {extractionModes.find((m) => m.id === mode)?.title} Output
            </span>
            {result && (
              <>
                <span className="text-neutral-600" aria-hidden="true">
                  ·
                </span>
                <span className="text-neutral-400 font-mono tabular-nums">
                  {result.split('\n').length} lines
                </span>
              </>
            )}
          </div>

          {result && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded text-xs transition-colors"
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
                className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded text-xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save .md</span>
              </button>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-xs mb-4">
              <strong>Extraction Error:</strong> {error}
            </div>
          )}

          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <p className="text-sm font-medium text-neutral-300">
                Analyzing project files &amp; synthesizing insights...
              </p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                Gemini 3.8 Flash is parsing components, dependency graphs, and type structures.
              </p>
            </div>
          ) : result ? (
            <div className="prose prose-invert max-w-none text-neutral-300 text-xs font-mono leading-relaxed whitespace-pre-wrap selection:bg-indigo-600/30 font-['JetBrains_Mono']">
              {result}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-neutral-500" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-300 mb-1">
                Ready for Extraction
              </h3>
              <p className="text-xs text-neutral-500 max-w-md mb-4">
                Choose an extraction mode from the left sidebar and click &quot;Run Extraction&quot; to synthesize project architecture, TypeScript interfaces, or test suites.
              </p>
              <button
                onClick={handleExtract}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
              >
                <span>Extract Architecture Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
