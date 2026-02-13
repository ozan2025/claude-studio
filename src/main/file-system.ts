import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import ignore, { type Ignore } from 'ignore'
import { IPC } from '@shared/ipc-channels'
import type { FileTreeEntry, FileReadResult, FileSaveResult } from '@shared/types'
import { FILE_TREE_MAX_DEPTH } from '@shared/constants'

let watcher: FSWatcher | null = null
let projectRoot: string = process.cwd()
let gitignore: Ignore | null = null

const ALWAYS_IGNORE = [
  'node_modules',
  '.git',
  '.DS_Store',
  'dist',
  'out',
  '.next',
  '.cache',
  'coverage',
  '__pycache__',
  '.pyc',
  'target',
  '.idea',
  '.vscode',
]

function loadGitignore(rootPath: string): void {
  gitignore = ignore()
  gitignore.add(ALWAYS_IGNORE)
  const gitignorePath = path.join(rootPath, '.gitignore')
  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8')
    gitignore.add(content)
  } catch {
    // No .gitignore, use defaults only
  }
}

function shouldIgnore(relativePath: string): boolean {
  if (!gitignore) return false
  if (!relativePath) return false
  return gitignore.ignores(relativePath)
}

export function setProjectRoot(rootPath: string): void {
  projectRoot = rootPath
  loadGitignore(rootPath)
}

export function getProjectRoot(): string {
  return projectRoot
}

export function readDirectoryTree(
  dirPath: string,
  depth: number = FILE_TREE_MAX_DEPTH,
  currentDepth: number = 0,
): FileTreeEntry[] {
  if (currentDepth >= depth) return []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  const result: FileTreeEntry[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.relative(projectRoot, fullPath)

    if (shouldIgnore(relativePath)) continue

    const node: FileTreeEntry = {
      name: entry.name,
      path: fullPath,
      relativePath,
      isDirectory: entry.isDirectory(),
    }

    if (entry.isDirectory()) {
      node.children = readDirectoryTree(fullPath, depth, currentDepth + 1)
    }

    result.push(node)
  }

  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return result
}

export function readFileContent(filePath: string): FileReadResult {
  const stat = fs.statSync(filePath)
  const content = fs.readFileSync(filePath, 'utf-8')
  return {
    content,
    path: filePath,
    size: stat.size,
    lastModified: stat.mtimeMs,
  }
}

export function saveFileContent(filePath: string, content: string): FileSaveResult {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true, path: filePath }
  } catch (err) {
    return {
      success: false,
      path: filePath,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export function startWatching(win: BrowserWindow): void {
  stopWatching()

  watcher = watch(projectRoot, {
    ignored: (filePath: string) => {
      const relativePath = path.relative(projectRoot, filePath)
      if (!relativePath) return false
      return shouldIgnore(relativePath)
    },
    persistent: true,
    ignoreInitial: true,
    depth: FILE_TREE_MAX_DEPTH,
  })

  const sendEvent = (type: string, filePath: string) => {
    const relativePath = path.relative(projectRoot, filePath)
    if (win.isDestroyed()) return
    win.webContents.send(IPC.FS_FILE_CHANGED, { type, path: filePath, relativePath })
  }

  watcher.on('add', (p) => sendEvent('add', p))
  watcher.on('change', (p) => sendEvent('change', p))
  watcher.on('unlink', (p) => sendEvent('unlink', p))
  watcher.on('addDir', (p) => sendEvent('addDir', p))
  watcher.on('unlinkDir', (p) => sendEvent('unlinkDir', p))
}

export function stopWatching(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
}
