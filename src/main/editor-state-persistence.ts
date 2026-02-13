import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { app } from 'electron'
import type { PersistedEditorState } from '@shared/types'

function getStorageDir(): string {
  const dir = path.join(app.getPath('home'), '.claude-studio', 'editor-state')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function projectHash(projectPath: string): string {
  return crypto.createHash('sha256').update(projectPath).digest('hex').slice(0, 16)
}

function statePath(projectPath: string): string {
  return path.join(getStorageDir(), `${projectHash(projectPath)}.json`)
}

export function loadEditorState(projectPath: string): PersistedEditorState | null {
  const p = statePath(projectPath)
  try {
    const data = fs.readFileSync(p, 'utf-8')
    return JSON.parse(data) as PersistedEditorState
  } catch {
    return null
  }
}

export function saveEditorState(state: PersistedEditorState): void {
  const p = statePath(state.projectPath)
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8')
}
