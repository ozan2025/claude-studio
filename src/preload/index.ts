import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type {
  FileTreeEntry,
  FileReadResult,
  FileSaveResult,
  FileChangeEvent,
  ClaudeStreamEvent,
  PermissionRequestEvent,
  PersistedSession,
  PersistedEditorState,
  SessionIndex,
  SessionInfo,
  ConversationMessage,
} from '@shared/types'

const api = {
  // File system
  readDir: (dirPath: string, depth?: number): Promise<FileTreeEntry[]> =>
    ipcRenderer.invoke(IPC.FS_READ_DIR, { dirPath, depth }),

  readFile: (filePath: string): Promise<FileReadResult> =>
    ipcRenderer.invoke(IPC.FS_READ_FILE, { filePath }),

  saveFile: (filePath: string, content: string): Promise<FileSaveResult> =>
    ipcRenderer.invoke(IPC.FS_SAVE_FILE, { filePath, content }),

  getProjectRoot: (): Promise<string> => ipcRenderer.invoke(IPC.FS_GET_PROJECT_ROOT),

  onFileChanged: (callback: (event: FileChangeEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: FileChangeEvent) => callback(data)
    ipcRenderer.on(IPC.FS_FILE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.FS_FILE_CHANGED, handler)
  },

  // Claude Code
  spawnClaude: (
    projectPath: string,
    sessionId: string,
    resumeSessionId?: string,
    model?: string,
    preSeenUuids?: string[],
  ): Promise<{ success: boolean; sessionId: string; error?: string }> =>
    ipcRenderer.invoke(IPC.CLAUDE_SPAWN, {
      projectPath,
      sessionId,
      resumeSessionId,
      model,
      preSeenUuids,
    }),

  sendMessage: (sessionId: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IPC.CLAUDE_SEND_MESSAGE, { sessionId, text }),

  sendMessageWithImages: (
    sessionId: string,
    text: string,
    images: Array<{ base64: string; mediaType: string }>,
  ): Promise<void> =>
    ipcRenderer.invoke(IPC.CLAUDE_SEND_MESSAGE_WITH_IMAGES, { sessionId, text, images }),

  killClaude: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.CLAUDE_KILL, { sessionId }),

  interruptClaude: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.CLAUDE_INTERRUPT, { sessionId }),

  setModel: (sessionId: string, model: string): Promise<void> =>
    ipcRenderer.invoke(IPC.CLAUDE_SET_MODEL, { sessionId, model }),

  setPermissionMode: (sessionId: string, mode: string): Promise<void> =>
    ipcRenderer.invoke(IPC.CLAUDE_SET_PERMISSION_MODE, { sessionId, mode }),

  onClaudeStreamEvent: (callback: (sessionId: string, event: ClaudeStreamEvent) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      data: { sessionId: string; event: ClaudeStreamEvent },
    ) => callback(data.sessionId, data.event)
    ipcRenderer.on(IPC.CLAUDE_STREAM_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC.CLAUDE_STREAM_EVENT, handler)
  },

  onClaudeProcessExit: (
    callback: (sessionId: string, code: number | null, signal: string | null) => void,
  ) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      data: { sessionId: string; code: number | null; signal: string | null },
    ) => callback(data.sessionId, data.code, data.signal)
    ipcRenderer.on(IPC.CLAUDE_PROCESS_EXIT, handler)
    return () => ipcRenderer.removeListener(IPC.CLAUDE_PROCESS_EXIT, handler)
  },

  // SDK Permission flow
  onPermissionRequest: (callback: (event: PermissionRequestEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: PermissionRequestEvent) => callback(data)
    ipcRenderer.on(IPC.CLAUDE_PERMISSION_REQUEST, handler)
    return () => ipcRenderer.removeListener(IPC.CLAUDE_PERMISSION_REQUEST, handler)
  },

  respondToPermission: (
    toolUseId: string,
    allow: boolean,
    updatedPermissions?: unknown[],
    updatedInput?: Record<string, unknown>,
  ): Promise<void> =>
    ipcRenderer.invoke(IPC.CLAUDE_PERMISSION_RESPONSE, {
      toolUseId,
      allow,
      updatedPermissions,
      updatedInput,
    }),

  onModeChanged: (callback: (sessionId: string, permissionMode: string) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      data: { sessionId: string; permissionMode: string },
    ) => callback(data.sessionId, data.permissionMode)
    ipcRenderer.on(IPC.CLAUDE_MODE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.CLAUDE_MODE_CHANGED, handler)
  },

  // Session management
  spawnSession: (projectPath: string): Promise<{ success: boolean; sessionId: string }> =>
    ipcRenderer.invoke(IPC.CLAUDE_SPAWN_SESSION, { projectPath }),

  resumeSession: (
    sessionId: string,
    projectPath: string,
  ): Promise<{ success: boolean; sessionId: string }> =>
    ipcRenderer.invoke(IPC.CLAUDE_RESUME_SESSION, { sessionId, projectPath }),

  killSession: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.CLAUDE_KILL_SESSION, { sessionId }),

  respondToPrompt: (sessionId: string, response: string): Promise<void> =>
    ipcRenderer.invoke(IPC.CLAUDE_RESPOND_PROMPT, { sessionId, response }),

  // Session persistence
  saveSessionData: (session: PersistedSession): Promise<void> =>
    ipcRenderer.invoke(IPC.SESSION_SAVE, { session }),

  loadSessionData: (projectPath: string, sessionId: string): Promise<PersistedSession | null> =>
    ipcRenderer.invoke(IPC.SESSION_LOAD, { projectPath, sessionId }),

  loadSessionIndex: (projectPath: string): Promise<SessionIndex> =>
    ipcRenderer.invoke(IPC.SESSION_LOAD_INDEX, { projectPath }),

  getLastSession: (projectPath: string): Promise<{ sessionId: string } | null> =>
    ipcRenderer.invoke(IPC.SESSION_GET_LAST, { projectPath }),

  deleteSessionData: (projectPath: string, sessionId: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SESSION_DELETE, { projectPath, sessionId }),

  loadExternalSessionIndex: (projectPath: string): Promise<SessionInfo[]> =>
    ipcRenderer.invoke(IPC.SESSION_LOAD_EXTERNAL_INDEX, { projectPath }),

  parseExternalSession: (
    projectPath: string,
    sessionId: string,
  ): Promise<{ messages: ConversationMessage[]; uuids: string[]; model: string } | null> =>
    ipcRenderer.invoke(IPC.SESSION_PARSE_EXTERNAL, { projectPath, sessionId }),

  // Editor state persistence
  saveEditorState: (state: PersistedEditorState): Promise<void> =>
    ipcRenderer.invoke(IPC.EDITOR_STATE_SAVE, { state }),

  loadEditorState: (projectPath: string): Promise<PersistedEditorState | null> =>
    ipcRenderer.invoke(IPC.EDITOR_STATE_LOAD, { projectPath }),

  // Slash commands
  listCommands: (
    projectPath: string,
  ): Promise<{ command: string; label: string; description: string; source: string }[]> =>
    ipcRenderer.invoke(IPC.CLAUDE_LIST_COMMANDS, { projectPath }),

  readCommand: (
    projectPath: string,
    command: string,
  ): Promise<{ content: string; source: string } | null> =>
    ipcRenderer.invoke(IPC.CLAUDE_READ_COMMAND, { projectPath, command }),

  runOneShot: (
    command: string,
    args: string[],
    cwd: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> =>
    ipcRenderer.invoke(IPC.CLAUDE_RUN_ONE_SHOT, { command, args, cwd }),

  // App
  getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),

  selectFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.APP_SELECT_FOLDER),
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
