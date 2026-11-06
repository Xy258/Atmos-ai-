import React, { useMemo } from 'react';
import {
  BarChart3,
  Code2,
  FileText,
  Boxes,
  Zap,
  ExternalLink,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { ProjectFile, ProjectStats } from '../types/project';
import { calculateProjectStats, downloadTextFile } from '../utils/zipExport';

interface MetricsDashboardProps {
  files: ProjectFile[];
  onSelectFile?: (file: ProjectFile) => void;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  files,
  onSelectFile,
}) => {
  const [copied, setCopied] = React.useState(false);
  const stats: ProjectStats = useMemo(() => calculateProjectStats(files), [files]);

  // Extract package.json dependencies
  const packageJsonData = useMemo(() => {
    const pkgFile = files.find((f) => f.name === 'package.json');
    if (!pkgFile || !pkgFile.content) return null;
    try {
      return JSON.parse(pkgFile.content);
    } catch {
      return null;
    }
  }, [files]);

  const dependencies = useMemo(() => {
    if (!packageJsonData) return [];
    const deps = packageJsonData.dependencies || {};
    const devDeps = packageJsonData.devDependencies || {};

    const list: { name: string; version: string; isDev: boolean }[] = [];
    Object.keys(deps).forEach((k) => list.push({ name: k, version: deps[k], isDev: false }));
    Object.keys(devDeps).forEach((k) => list.push({ name: k, version: devDeps[k], isDev: true }));
    return list;
  }, [packageJsonData]);

  // Sorted languages by lines
  const sortedLanguages = useMemo(() => {
    return Object.entries(stats.languages)
      .map(([lang, data]) => ({
        lang,
        ...data,
        pct: stats.totalLines > 0 ? (data.lines / stats.totalLines) * 100 : 0,
      }))
      .sort((a, b) => b.lines - a.lines);
  }, [stats]);

  // Largest files by line count
  const topFiles = useMemo(() => {
    return [...files].sort((a, b) => b.lines - a.lines).slice(0, 10);
  }, [files]);

  const handleCopyMetrics = async () => {
    const summary = `Project Codebase Metrics:
- Total Files: ${stats.totalFiles}
- Total Lines of Code: ${stats.totalLines.toLocaleString()}
- Total File Size: ${(stats.totalBytes / 1024).toFixed(1)} KB
- Estimated LLM Tokens: ~${stats.estimatedTokens.toLocaleString()}
- Languages: ${sortedLanguages.map((l) => `${l.lang} (${l.pct.toFixed(1)}%)`).join(', ')}
- Dependencies: ${dependencies.length} packages`;

    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      stats,
      languages: sortedLanguages,
      dependencies,
      files: files.map((f) => ({ path: f.path, lines: f.lines, size: f.size, language: f.language })),
    };
    downloadTextFile('project-metrics-report.json', JSON.stringify(report, null, 2), 'application/json');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-neutral-950 p-6 space-y-6">
      {/* Top Banner & Export Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Codebase Metrics &amp; Audit
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Volumetric analysis, token footprint, language distribution, and dependency audit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMetrics}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-lg border border-neutral-750 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Summary</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON Report</span>
          </button>
        </div>
      </div>

      {/* 4-Stat Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Source Files</span>
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {stats.totalFiles}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Across workspace hierarchy
          </div>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Lines of Code</span>
            <Code2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {stats.totalLines.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Total non-binary source lines
          </div>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Estimated LLM Tokens</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            ~{stats.estimatedTokens.toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Prompt budget footprint (~4 chars/token)
          </div>
        </div>

        <div className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Dependencies</span>
            <Boxes className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {dependencies.length}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            Runtime &amp; dev packages
          </div>
        </div>
      </div>

      {/* Language Breakdown Section */}
      <div className="p-5 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>Language Distribution</span>
          </h2>
          <span className="text-xs text-neutral-500 font-mono tabular-nums">
            {(stats.totalBytes / 1024).toFixed(1)} KB Total
          </span>
        </div>

        {/* Visual Multi-Segment Bar */}
        <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden flex">
          {sortedLanguages.map((l, i) => {
            const colors = [
              'bg-blue-500',
              'bg-indigo-500',
              'bg-emerald-500',
              'bg-amber-500',
              'bg-sky-500',
              'bg-rose-500',
              'bg-purple-500',
            ];
            const color = colors[i % colors.length];
            return (
              <div
                key={l.lang}
                style={{ width: `${Math.max(l.pct, 1)}%` }}
                title={`${l.lang}: ${l.lines} lines (${l.pct.toFixed(1)}%)`}
                className={`${color} h-full transition-all`}
              />
            );
          })}
        </div>

        {/* Language Grid Table */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
          {sortedLanguages.map((l) => (
            <div
              key={l.lang}
              className="p-2.5 bg-neutral-950/60 border border-neutral-850 rounded-lg text-xs"
            >
              <div className="font-semibold text-neutral-200 capitalize truncate">
                {l.lang}
              </div>
              <div className="flex items-center justify-between text-neutral-500 mt-1 font-mono tabular-nums text-[11px]">
                <span>{l.lines.toLocaleString()} lines</span>
                <span>{l.pct.toFixed(1)}%</span>
              </div>
              <div className="text-[10px] text-neutral-600 mt-0.5 font-mono tabular-nums">
                {l.count} files · {(l.bytes / 1024).toFixed(1)} KB
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Top Files & Package Dependencies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Largest Files */}
        <div className="p-5 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center justify-between">
            <span>Largest Files by Line Count</span>
            <span className="text-xs text-neutral-500 font-normal">Top 10</span>
          </h2>
          <div className="divide-y divide-neutral-800/60">
            {topFiles.map((file) => (
              <div
                key={file.path}
                onClick={() => onSelectFile && onSelectFile(file)}
                className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-neutral-800/40 px-2 rounded cursor-pointer transition-colors"
              >
                <div className="truncate font-mono text-neutral-300">
                  {file.path}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-neutral-500 font-mono tabular-nums text-[11px]">
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                  <span className="font-medium text-neutral-300">{file.lines} L</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Package Dependencies */}
        <div className="p-5 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-purple-400" />
              <span>Project Dependencies</span>
            </h2>
            <span className="text-xs text-neutral-500 font-mono tabular-nums">
              {dependencies.length} packages
            </span>
          </div>

          {dependencies.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-500">
              No dependencies detected or package.json not found.
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto divide-y divide-neutral-800/60 pr-1">
              {dependencies.map((dep) => (
                <div
                  key={dep.name}
                  className="py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-neutral-200 truncate font-medium">
                      {dep.name}
                    </span>
                    {dep.isDev && (
                      <span className="text-[10px] text-neutral-500 font-mono">
                        (dev)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                      {dep.version}
                    </span>
                    <a
                      href={`https://www.npmjs.com/package/${dep.name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
                      title="View package on npm"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
