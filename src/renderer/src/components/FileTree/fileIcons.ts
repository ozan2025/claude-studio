const FILE_ICONS: Record<string, string> = {
  ts: '🟦',
  tsx: '⚛️',
  js: '🟨',
  jsx: '⚛️',
  json: '{}',
  md: '📝',
  css: '🎨',
  scss: '🎨',
  html: '🌐',
  py: '🐍',
  rs: '🦀',
  go: '🔷',
  java: '☕',
  c: '⚙️',
  cpp: '⚙️',
  h: '⚙️',
  yaml: '📋',
  yml: '📋',
  toml: '📋',
  sql: '🗃️',
  sh: '💻',
  bash: '💻',
  svg: '🖼️',
  png: '🖼️',
  jpg: '🖼️',
  gif: '🖼️',
  lock: '🔒',
  env: '🔑',
  gitignore: '🚫',
}

const SPECIAL_FILES: Record<string, string> = {
  'package.json': '📦',
  'tsconfig.json': '🟦',
  'README.md': '📖',
  LICENSE: '📜',
  Dockerfile: '🐳',
  '.gitignore': '🚫',
  '.env': '🔑',
  '.env.local': '🔑',
}

export function getFileIcon(name: string, isDirectory: boolean): string {
  if (isDirectory) return '📁'

  if (SPECIAL_FILES[name]) return SPECIAL_FILES[name]

  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return FILE_ICONS[ext] ?? '📄'
}
