export interface ProjectFile {
  path: string;
  name: string;
  content: string;
  size: number;
  lines: number;
  language: string;
  isBinary?: boolean;
}

export interface ProjectStats {
  totalFiles: number;
  totalLines: number;
  totalBytes: number;
  languages: { [lang: string]: { count: number; lines: number; bytes: number } };
  estimatedTokens: number;
}

export interface GitHubRepoDetails {
  name: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
  language: string | null;
  url: string;
}

export type AIExtractionMode = 'architecture' | 'types' | 'apis' | 'tests' | 'repomix' | 'explain';

export interface AIExtractionResult {
  mode: AIExtractionMode;
  title: string;
  content: string;
  timestamp: string;
}
