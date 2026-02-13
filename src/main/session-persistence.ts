import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { app } from 'electron'
import type { PersistedSession, SessionIndex } from '@shared/types'

function getStorageDir(): string {
  return path.join(app.getPath('home'), '.claude-studio', 'sessions')
}

function projectHash(projectPath: string): string {
  return crypto.createHash('sha256').update(projectPath).digest('hex').slice(0, 16)
}

function getProjectDir(projectPath: string): string {
  const dir = path.join(getStorageDir(), projectHash(projectPath))
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function indexPath(projectPath: string): string {
  return path.join(getProjectDir(projectPath), 'index.json')
}

function sessionPath(projectPath: string, sessionId: string): string {
  return path.join(getProjectDir(projectPath), `${sessionId}.json`)
}

export function loadSessionIndex(projectPath: string): SessionIndex {
  const p = indexPath(projectPath)
  try {
    const data = fs.readFileSync(p, 'utf-8')
    return JSON.parse(data) as SessionIndex
  } catch {
    return {
      version: 1,
      projectPath,
      lastActiveSessionId: null,
      sessions: [],
    }
  }
}

export function saveSessionIndex(index: SessionIndex): void {
  const p = indexPath(index.projectPath)
  fs.writeFileSync(p, JSON.stringify(index, null, 2), 'utf-8')
}

export function loadSession(projectPath: string, sessionId: string): PersistedSession | null {
  const p = sessionPath(projectPath, sessionId)
  try {
    const data = fs.readFileSync(p, 'utf-8')
    return JSON.parse(data) as PersistedSession
  } catch {
    return null
  }
}

export function saveSession(session: PersistedSession): void {
  const p = sessionPath(session.info.projectPath, session.info.id)
  fs.writeFileSync(p, JSON.stringify(session, null, 2), 'utf-8')

  // Update index
  const index = loadSessionIndex(session.info.projectPath)
  const existingIdx = index.sessions.findIndex((s) => s.id === session.info.id)
  if (existingIdx >= 0) {
    index.sessions[existingIdx] = session.info
  } else {
    index.sessions.push(session.info)
  }
  index.lastActiveSessionId = session.info.id
  saveSessionIndex(index)
}

export function deleteSession(projectPath: string, sessionId: string): void {
  const p = sessionPath(projectPath, sessionId)
  try {
    fs.unlinkSync(p)
  } catch {
    // File may not exist
  }

  const index = loadSessionIndex(projectPath)
  index.sessions = index.sessions.filter((s) => s.id !== sessionId)
  if (index.lastActiveSessionId === sessionId) {
    index.lastActiveSessionId = index.sessions[0]?.id ?? null
  }
  saveSessionIndex(index)
}

export function getLastSessionId(projectPath: string): string | null {
  const index = loadSessionIndex(projectPath)
  return index.lastActiveSessionId
}
