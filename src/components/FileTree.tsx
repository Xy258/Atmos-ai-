import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  Hash,
  Search,
  ChevronRight,
  ChevronDown,
  Braces,
  Layers,
} from 'lucide-react';
import { ProjectFile } from '../types/project';

interface FileTreeProps {
  files: ProjectFile[];
  selectedFile: ProjectFile | null;
  onSelectFile: (file: ProjectFile) => void;
  projectName?: string;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: { [key: string]: TreeNode };
  file?: ProjectFile;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  selectedFile,
  onSelectFile,
  projectName = 'Project Workspace',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<{ [path: string]: boolean }>({
    'src': true,
    '': true,
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  // Build tree data structure from flat file list
  const treeRoot = useMemo(() => {
    const root: TreeNode = {
      name: 'root',
      path: '',
      isDirectory: true,
      children: {},
    };

    const filtered = files.filter((f) =>
      searchTerm ? f.path.toLowerCase().includes(searchTerm.toLowerCase()) : true
    );

    for (const file of filtered) {
      const parts = file.path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        if (isLast) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isDirectory: false,
            children: {},
            file,
          };
        } else {
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              path: currentPath,
              isDirectory: true,
              children: {},
            };
          }
          current = current.children[part];
        }
      }
    }

    return root;
  }, [files, searchTerm]);

  const getFileIcon = (fileName: string, lang: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
      case 'js':
      case 'jsx':
        return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'css':
        return <Hash className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'html':
        return <Braces className="w-4 h-4 text-orange-400 shrink-0" />;
      case 'md':
        return <FileText className="w-4 h-4 text-neutral-400 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-neutral-500 shrink-0" />;
    }
  };

  const renderTree = (node: TreeNode, depth = 0) => {
    const entries = Object.values(node.children).sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div className="flex flex-col">
        {entries.map((child) => {
          if (child.isDirectory) {
            const isExpanded = expandedFolders[child.path] ?? true;
            return (
              <div key={child.path} className="select-none">
                <button
                  onClick={() => toggleFolder(child.path)}
                  style={{ paddingLeft: `${Math.max(depth * 14 + 10, 10)}px` }}
                  className="w-full flex items-center gap-1.5 py-1 text-xs text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-md transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  )}
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-amber-400/90 shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-amber-400/90 shrink-0" />
                  )}
                  <span className="font-medium truncate">{child.name}</span>
                </button>
                {isExpanded && renderTree(child, depth + 1)}
              </div>
            );
          }

          const isSelected = selectedFile?.path === child.file?.path;
          return (
            <button
              key={child.path}
              onClick={() => child.file && onSelectFile(child.file)}
              style={{ paddingLeft: `${Math.max(depth * 14 + 26, 26)}px` }}
              className={`w-full flex items-center justify-between gap-2 py-1 pr-3 text-xs transition-colors rounded-md text-left ${
                isSelected
                  ? 'bg-indigo-600/20 text-indigo-200 font-medium border-l-2 border-indigo-500'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
              }`}
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                {getFileIcon(child.name, child.file?.language || '')}
                <span className="truncate">{child.name}</span>
              </div>
              <span className="text-[10px] text-neutral-600 font-mono tabular-nums shrink-0">
                {child.file?.lines}L
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900/60 border-r border-neutral-800 select-none">
      {/* File Tree Header */}
      <div className="p-3 border-b border-neutral-800/80">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="truncate max-w-[170px]">{projectName}</span>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono tabular-nums">
            {files.length} items
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter files..."
            className="w-full pl-8 pr-2 py-1.5 text-xs bg-neutral-950/70 border border-neutral-800 rounded-md text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {files.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-500">
            No files available.
          </div>
        ) : (
          renderTree(treeRoot)
        )}
      </div>
    </div>
  );
};
