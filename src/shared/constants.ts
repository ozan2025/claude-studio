export const PANEL_MIN_WIDTH = 150
export const PANEL_DEFAULT_FILE_TREE_WIDTH = 250
export const PANEL_DEFAULT_EDITOR_WIDTH = 500

export const FILE_TREE_FILTER_DEBOUNCE_MS = 150
export const FILE_TREE_MAX_DEPTH = 10

export const HUNG_PROCESS_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  py: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'cpp',
  cpp: 'cpp',
  cc: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  css: 'css',
  scss: 'css',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  sql: 'sql',
  php: 'php',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  toml: 'toml',
  env: 'shell',
}

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_MAP[ext] ?? 'text'
}
