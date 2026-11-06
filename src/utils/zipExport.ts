import JSZip from 'jszip';
import { ProjectFile, ProjectStats } from '../types/project';

/**
 * Creates and downloads a ZIP archive containing all project files
 */
export async function exportProjectAsZip(files: ProjectFile[], zipName = 'project-archive.zip'): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    if (!file.isBinary) {
      zip.file(file.path, file.content || '');
    }
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName.endsWith('.zip') ? zipName : `${zipName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports project as a consolidated single-file context bundle (Repomix format)
 * optimized for pasting directly into LLMs (Gemini, Claude, ChatGPT)
 */
export function generateRepomixMarkdown(files: ProjectFile[], projectName = 'project'): string {
  let output = `# ${projectName} - Codebase Export\n\n`;
  output += `Generated on: ${new Date().toISOString()}\n`;
  output += `Total Files: ${files.length}\n`;
  output += `Total Lines: ${files.reduce((a, b) => a + b.lines, 0)}\n\n`;

  output += `## Directory Structure\n\`\`\`\n`;
  files.forEach((f) => {
    output += `${f.path} (${f.lines} lines, ${(f.size / 1024).toFixed(1)} KB)\n`;
  });
  output += `\`\`\`\n\n`;

  output += `## File Contents\n\n`;
  files.forEach((file) => {
    output += `### File: \`${file.path}\`\n`;
    output += `\`\`\`${file.language || ''}\n`;
    output += `${file.content || ''}\n`;
    output += `\`\`\`\n\n`;
  });

  return output;
}

/**
 * Downloads single text file to user's computer
 */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reads an uploaded .zip file and extracts its files in-memory
 */
export async function extractUploadedZip(zipFile: File): Promise<ProjectFile[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipFile);
  const files: ProjectFile[] = [];

  const entries = Object.keys(loadedZip.files);
  for (const relativePath of entries) {
    const entry = loadedZip.files[relativePath];
    if (entry.dir) continue;

    // skip internal mac/zip metadata
    if (relativePath.includes('__MACOSX/') || relativePath.endsWith('.DS_Store')) {
      continue;
    }

    try {
      const ext = relativePath.split('.').pop()?.toLowerCase() || '';
      const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'woff', 'woff2', 'ttf', 'eot', 'zip', 'tar', 'gz', 'exe', 'bin'];
      const isBinary = binaryExtensions.includes(ext);

      let content = '';
      let lines = 0;

      if (!isBinary) {
        content = await entry.async('string');
        lines = content.split('\n').length;
      }

      const fileName = relativePath.split('/').pop() || relativePath;

      files.push({
        path: relativePath,
        name: fileName,
        content,
        size: content.length,
        lines,
        language: getLanguageFromExt(ext),
        isBinary,
      });
    } catch (e) {
      console.warn(`Could not read entry ${relativePath}:`, e);
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function getLanguageFromExt(ext: string): string {
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescriptreact';
    case 'js':
      return 'javascript';
    case 'jsx':
      return 'javascriptreact';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'md':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'svg':
      return 'svg';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'c':
    case 'cpp':
    case 'h':
      return 'cpp';
    default:
      return 'plaintext';
  }
}

/**
 * Calculates metrics and stats across files
 */
export function calculateProjectStats(files: ProjectFile[]): ProjectStats {
  const languages: { [lang: string]: { count: number; lines: number; bytes: number } } = {};
  let totalLines = 0;
  let totalBytes = 0;
  let totalChars = 0;

  for (const f of files) {
    const lang = f.language || 'plaintext';
    if (!languages[lang]) {
      languages[lang] = { count: 0, lines: 0, bytes: 0 };
    }
    languages[lang].count += 1;
    languages[lang].lines += f.lines || 0;
    languages[lang].bytes += f.size || 0;

    totalLines += f.lines || 0;
    totalBytes += f.size || 0;
    totalChars += (f.content || '').length;
  }

  // Rough estimation: 1 token ≈ 4 characters
  const estimatedTokens = Math.round(totalChars / 4);

  return {
    totalFiles: files.length,
    totalLines,
    totalBytes,
    languages,
    estimatedTokens,
  };
}
