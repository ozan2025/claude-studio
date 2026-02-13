import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { IPC } from '@shared/ipc-channels'
import type { PersistedSession, PersistedEditorState } from '@shared/types'
import { readDirectoryTree, readFileContent, saveFileContent, getProjectRoot } from './file-system'
import { claudeCodeManager } from './claude-code'
import {
  saveSession,
  loadSession,
  loadSessionIndex,
  getLastSessionId,
  deleteSession,
} from './session-persistence'
import { loadExternalSessionIndex, parseExternalSession } from './external-sessions'
import { saveEditorState, loadEditorState } from './editor-state-persistence'

export function registerIpcHandlers(): void {
  // File system
  ipcMain.handle(IPC.FS_READ_DIR, (_event, args: { dirPath: string; depth?: number }) => {
    return readDirectoryTree(args.dirPath, args.depth)
  })

  ipcMain.handle(IPC.FS_READ_FILE, (_event, args: { filePath: string }) => {
    return readFileContent(args.filePath)
  })

  ipcMain.handle(IPC.FS_SAVE_FILE, (_event, args: { filePath: string; content: string }) => {
    return saveFileContent(args.filePath, args.content)
  })

  ipcMain.handle(IPC.FS_GET_PROJECT_ROOT, () => {
    return getProjectRoot()
  })

  // Claude Code — spawn (now async because SDK spawn is async)
  ipcMain.handle(
    IPC.CLAUDE_SPAWN,
    async (
      _event,
      args: {
        projectPath: string
        sessionId: string
        resumeSessionId?: string
        model?: string
        preSeenUuids?: string[]
      },
    ) => {
      return claudeCodeManager.spawn(
        args.projectPath,
        args.sessionId,
        args.resumeSessionId,
        args.model,
        args.preSeenUuids,
      )
    },
  )

  ipcMain.handle(
    IPC.CLAUDE_SEND_MESSAGE,
    async (_event, args: { sessionId: string; text: string }) => {
      await claudeCodeManager.sendMessage(args.sessionId, args.text)
    },
  )

  ipcMain.handle(
    IPC.CLAUDE_SEND_MESSAGE_WITH_IMAGES,
    async (
      _event,
      args: {
        sessionId: string
        text: string
        images: Array<{ base64: string; mediaType: string }>
      },
    ) => {
      await claudeCodeManager.sendMessageWithImages(args.sessionId, args.text, args.images)
    },
  )

  ipcMain.handle(IPC.CLAUDE_KILL, (_event, args: { sessionId: string }) => {
    claudeCodeManager.kill(args.sessionId)
  })

  ipcMain.handle(IPC.CLAUDE_INTERRUPT, async (_event, args: { sessionId: string }) => {
    await claudeCodeManager.sendInterrupt(args.sessionId)
  })

  ipcMain.handle(
    IPC.CLAUDE_SET_MODEL,
    async (_event, args: { sessionId: string; model: string }) => {
      await claudeCodeManager.setModel(args.sessionId, args.model)
    },
  )

  ipcMain.handle(
    IPC.CLAUDE_SET_PERMISSION_MODE,
    async (_event, args: { sessionId: string; mode: string }) => {
      await claudeCodeManager.setPermissionMode(args.sessionId, args.mode)
    },
  )

  // SDK Permission response (renderer → main)
  ipcMain.handle(
    IPC.CLAUDE_PERMISSION_RESPONSE,
    (
      _event,
      args: {
        toolUseId: string
        allow: boolean
        updatedPermissions?: unknown[]
        updatedInput?: Record<string, unknown>
      },
    ) => {
      claudeCodeManager.respondToPermission(
        args.toolUseId,
        args.allow,
        args.updatedPermissions,
        args.updatedInput,
      )
    },
  )

  // Session management
  ipcMain.handle(IPC.CLAUDE_SPAWN_SESSION, async (_event, args: { projectPath: string }) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    return claudeCodeManager.spawn(args.projectPath, sessionId)
  })

  ipcMain.handle(
    IPC.CLAUDE_RESUME_SESSION,
    async (_event, args: { sessionId: string; projectPath: string }) => {
      return claudeCodeManager.spawn(args.projectPath, args.sessionId, args.sessionId)
    },
  )

  ipcMain.handle(IPC.CLAUDE_KILL_SESSION, (_event, args: { sessionId: string }) => {
    claudeCodeManager.kill(args.sessionId)
  })

  ipcMain.handle(
    IPC.CLAUDE_RESPOND_PROMPT,
    async (_event, args: { sessionId: string; response: string }) => {
      await claudeCodeManager.sendMessage(args.sessionId, args.response)
    },
  )

  // Session persistence
  ipcMain.handle(IPC.SESSION_SAVE, (_event, args: { session: PersistedSession }) => {
    saveSession(args.session)
  })

  ipcMain.handle(IPC.SESSION_LOAD, (_event, args: { projectPath: string; sessionId: string }) => {
    return loadSession(args.projectPath, args.sessionId)
  })

  ipcMain.handle(IPC.SESSION_LOAD_INDEX, (_event, args: { projectPath: string }) => {
    return loadSessionIndex(args.projectPath)
  })

  ipcMain.handle(IPC.SESSION_GET_LAST, (_event, args: { projectPath: string }) => {
    const sessionId = getLastSessionId(args.projectPath)
    return sessionId ? { sessionId } : null
  })

  ipcMain.handle(IPC.SESSION_DELETE, (_event, args: { projectPath: string; sessionId: string }) => {
    deleteSession(args.projectPath, args.sessionId)
  })

  ipcMain.handle(IPC.SESSION_LOAD_EXTERNAL_INDEX, async (_event, args: { projectPath: string }) => {
    return loadExternalSessionIndex(args.projectPath)
  })

  ipcMain.handle(
    IPC.SESSION_PARSE_EXTERNAL,
    (_event, args: { projectPath: string; sessionId: string }) => {
      return parseExternalSession(args.projectPath, args.sessionId)
    },
  )

  // Editor state persistence
  ipcMain.handle(IPC.EDITOR_STATE_SAVE, (_event, args: { state: PersistedEditorState }) => {
    saveEditorState(args.state)
  })

  ipcMain.handle(IPC.EDITOR_STATE_LOAD, (_event, args: { projectPath: string }) => {
    return loadEditorState(args.projectPath)
  })

  // Slash commands — scan .claude/commands/ directories
  ipcMain.handle(IPC.CLAUDE_LIST_COMMANDS, (_event, args: { projectPath: string }) => {
    return listSlashCommands(args.projectPath)
  })

  // Read a custom command's .md file content for expansion
  ipcMain.handle(
    IPC.CLAUDE_READ_COMMAND,
    (_event, args: { projectPath: string; command: string }) => {
      return readCommandContent(args.projectPath, args.command)
    },
  )

  // Run a one-shot claude command (for /doctor)
  ipcMain.handle(
    IPC.CLAUDE_RUN_ONE_SHOT,
    (_event, args: { command: string; args: string[]; cwd: string }) => {
      return claudeCodeManager.runOneShot(args.command, args.args, args.cwd)
    },
  )

  // App
  ipcMain.handle(IPC.APP_GET_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(IPC.APP_SELECT_FOLDER, async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}

interface SlashCommandInfo {
  command: string
  label: string
  description: string
  source: 'builtin' | 'user' | 'project'
}

const BUILTIN_COMMANDS: SlashCommandInfo[] = [
  {
    command: '/compact',
    label: '/compact',
    description: 'Compact conversation history',
    source: 'builtin',
  },
  { command: '/clear', label: '/clear', description: 'Clear conversation', source: 'builtin' },
  { command: '/cost', label: '/cost', description: 'Show session cost', source: 'builtin' },
  { command: '/doctor', label: '/doctor', description: 'Run diagnostics', source: 'builtin' },
  { command: '/help', label: '/help', description: 'Show available commands', source: 'builtin' },
  {
    command: '/init',
    label: '/init',
    description: 'Initialize project settings',
    source: 'builtin',
  },
  { command: '/login', label: '/login', description: 'Switch account', source: 'builtin' },
  { command: '/logout', label: '/logout', description: 'Sign out', source: 'builtin' },
  {
    command: '/memory',
    label: '/memory',
    description: 'View/edit CLAUDE.md memory',
    source: 'builtin',
  },
  { command: '/model', label: '/model', description: 'Switch model', source: 'builtin' },
  {
    command: '/permissions',
    label: '/permissions',
    description: 'Manage permissions',
    source: 'builtin',
  },
  { command: '/review', label: '/review', description: 'Review code changes', source: 'builtin' },
  { command: '/status', label: '/status', description: 'Show session status', source: 'builtin' },
  { command: '/vim', label: '/vim', description: 'Toggle vim mode', source: 'builtin' },
  { command: '/bug', label: '/bug', description: 'Report a bug', source: 'builtin' },
  {
    command: '/terminal-setup',
    label: '/terminal-setup',
    description: 'Setup terminal integration',
    source: 'builtin',
  },
  { command: '/mcp', label: '/mcp', description: 'Manage MCP servers', source: 'builtin' },
  { command: '/config', label: '/config', description: 'Show configuration', source: 'builtin' },
]

function scanCommandsDir(dir: string, source: 'user' | 'project'): SlashCommandInfo[] {
  try {
    const files = readdirSync(dir)
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => {
        const name = f.replace(/\.md$/, '')
        let description = `Custom command (${source})`
        try {
          const content = readFileSync(join(dir, f), 'utf-8')
          // Use first non-empty line as description
          const firstLine = content.split('\n').find((l) => l.trim().length > 0)
          if (firstLine) {
            description = firstLine.replace(/^#\s*/, '').slice(0, 80)
          }
        } catch {
          // Can't read file, use default description
        }
        return {
          command: `/${name}`,
          label: `/${name}`,
          description,
          source,
        }
      })
  } catch {
    return []
  }
}

function listSlashCommands(projectPath: string): SlashCommandInfo[] {
  const userDir = join(homedir(), '.claude', 'commands')
  const projectDir = join(projectPath, '.claude', 'commands')

  const userCommands = scanCommandsDir(userDir, 'user')
  const projectCommands = scanCommandsDir(projectDir, 'project')

  // Deduplicate: project overrides user, custom overrides builtin
  const commandMap = new Map<string, SlashCommandInfo>()
  for (const cmd of BUILTIN_COMMANDS) commandMap.set(cmd.command, cmd)
  for (const cmd of userCommands) commandMap.set(cmd.command, cmd)
  for (const cmd of projectCommands) commandMap.set(cmd.command, cmd)

  return Array.from(commandMap.values()).sort((a, b) => a.command.localeCompare(b.command))
}

function readCommandContent(
  projectPath: string,
  command: string,
): { content: string; source: string } | null {
  // Strip leading /
  const name = command.replace(/^\//, '')
  const fileName = `${name}.md`

  // Check project-level first, then user-level
  const projectFile = join(projectPath, '.claude', 'commands', fileName)
  const userFile = join(homedir(), '.claude', 'commands', fileName)

  try {
    return { content: readFileSync(projectFile, 'utf-8'), source: 'project' }
  } catch {
    // Not found at project level
  }

  try {
    return { content: readFileSync(userFile, 'utf-8'), source: 'user' }
  } catch {
    // Not found at user level
  }

  return null
}
