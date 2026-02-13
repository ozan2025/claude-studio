export interface ParsedFileRef {
  path: string
  line?: number
  start: number
  end: number
}

// Matches: src/foo/bar.ts, ./foo/bar.ts, ../foo.ts, foo/bar.ts:42
const PATH_REGEX = /(?:^|[\s`(])((\.{0,2}\/)?(?:[\w@.-]+\/)+[\w.-]+(?::(\d+))?)/gm

// Matches backtick-wrapped: `path/to/file.ts`
const BACKTICK_PATH = /`((?:[\w@.-]+\/)*[\w.-]+\.\w+(?::(\d+))?)`/g

// Known standalone files
const KNOWN_FILES = new Set([
  'package.json',
  'tsconfig.json',
  'README.md',
  '.env',
  '.gitignore',
  'Dockerfile',
  'Makefile',
  'Cargo.toml',
  'go.mod',
  'requirements.txt',
  'pyproject.toml',
])

export function parseFileReferences(text: string, knownPaths?: Set<string>): ParsedFileRef[] {
  const refs: ParsedFileRef[] = []
  const seen = new Set<string>()

  // Backtick-wrapped paths (higher priority)
  for (const match of text.matchAll(BACKTICK_PATH)) {
    const fullPath = match[1]
    const line = match[2] ? parseInt(match[2]) : undefined
    const pathWithoutLine = fullPath.replace(/:(\d+)$/, '')

    if (!seen.has(pathWithoutLine) && isLikelyPath(pathWithoutLine, knownPaths)) {
      const start = match.index! + 1 // skip backtick
      refs.push({ path: pathWithoutLine, line, start, end: start + fullPath.length })
      seen.add(pathWithoutLine)
    }
  }

  // Regular path patterns
  for (const match of text.matchAll(PATH_REGEX)) {
    const fullMatch = match[1]
    const line = match[3] ? parseInt(match[3]) : undefined
    const pathWithoutLine = fullMatch.replace(/:(\d+)$/, '')

    if (!seen.has(pathWithoutLine) && isLikelyPath(pathWithoutLine, knownPaths)) {
      const start = match.index! + match[0].indexOf(match[1])
      refs.push({ path: pathWithoutLine, line, start, end: start + fullMatch.length })
      seen.add(pathWithoutLine)
    }
  }

  return refs
}

function isLikelyPath(path: string, knownPaths?: Set<string>): boolean {
  // Check known standalone files
  if (KNOWN_FILES.has(path)) return true

  // Must have a file extension
  const lastPart = path.split('/').pop() ?? ''
  if (!lastPart.includes('.')) return false

  // If we have a list of known paths, validate against it
  if (knownPaths) {
    return knownPaths.has(path)
  }

  // Basic heuristic: has at least one directory separator or known extension
  const ext = lastPart.split('.').pop()?.toLowerCase() ?? ''
  const knownExts = new Set([
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'md',
    'py',
    'rs',
    'go',
    'java',
    'c',
    'cpp',
    'h',
    'css',
    'html',
    'yaml',
    'yml',
    'toml',
    'sql',
    'sh',
    'xml',
    'svg',
    'txt',
    'cfg',
    'ini',
    'env',
    'lock',
  ])
  return path.includes('/') || knownExts.has(ext)
}
