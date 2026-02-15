import { spawn, type ChildProcess } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { ClaudeStreamEvent } from '@shared/types'

// ═══════════════════════════════════════════
// Dynamic ESM import for the SDK (ESM-only, main process is CJS)
// ═══════════════════════════════════════════

type SDKModule = typeof import('@anthropic-ai/claude-agent-sdk')
type SDKSession = ReturnType<SDKModule['unstable_v2_createSession']>
type PermissionResult = Awaited<ReturnType<import('@anthropic-ai/claude-agent-sdk').CanUseTool>>

// ═══════════════════════════════════════════
// MCP server config loader
// Reads mcpServers from ~/.claude.json (user-level global config).
// The SDK V2 constructor is patched (scripts/patch-sdk.js) to accept mcpServers.
// ═══════════════════════════════════════════

type McpServerEntry = {
  type?: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

let cachedMcpServers: Record<string, McpServerEntry> | null = null

function loadMcpServers(): Record<string, McpServerEntry> {
  if (cachedMcpServers !== null) return cachedMcpServers
  try {
    const raw = readFileSync(join(homedir(), '.claude.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    cachedMcpServers = parsed.mcpServers ?? {}
    console.log(
      `[claude-code] loaded ${Object.keys(cachedMcpServers!).length} MCP servers from ~/.claude.json`,
    )
  } catch {
    cachedMcpServers = {}
  }
  return cachedMcpServers!
}

let sdkModule: SDKModule | null = null
async function getSDK(): Promise<SDKModule> {
  if (!sdkModule) {
    sdkModule = await import('@anthropic-ai/claude-agent-sdk')
  }
  return sdkModule
}

// ═══════════════════════════════════════════
// CWD helper — V2 SDKSession ignores `cwd` in options,
// so we must process.chdir() during createSession/resumeSession
// (subprocess spawns synchronously in the constructor)
// ═══════════════════════════════════════════

let cwdMutex = Promise.resolve()

function withCwd<T>(cwd: string, fn: () => T): Promise<Awaited<T>> {
  let release!: () => void
  const nextMutex = new Promise<void>((r) => {
    release = r
  })
  const prevMutex = cwdMutex
  cwdMutex = nextMutex

  return prevMutex.then(async () => {
    const saved = process.cwd()
    try {
      process.chdir(cwd)
      return await fn()
    } finally {
      process.chdir(saved)
      release()
    }
  })
}

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface PermissionResolve {
  resolve: (result: PermissionResult) => void
  signal: AbortSignal
  input: Record<string, unknown> // Original tool input, passed back as updatedInput
}

interface QueuedMessage {
  text?: string
  images?: Array<{ base64: string; mediaType: string }>
}

interface SessionEntry {
  session: SDKSession
  sdkSessionId: string // SDK's internal session ID, captured from system/init
  projectPath: string
  model: string
  permissionMode: string
  isProcessing: boolean // Prevents double-send during a turn
  seenUuids: Set<string> // Track event UUIDs to deduplicate replays after resume
  messageQueue: QueuedMessage[]
}

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'

// ═══════════════════════════════════════════
// ClaudeCodeManager — V2 Session API
// ═══════════════════════════════════════════

class ClaudeCodeManager {
  private sessions = new Map<string, SessionEntry>()
  private pendingPermissions = new Map<string, PermissionResolve>()
  private win: BrowserWindow | null = null

  setWindow(win: BrowserWindow): void {
    this.win = win
  }

  // ─────────────────────────────────────────
  // Spawn / Create Session
  // ─────────────────────────────────────────

  async spawn(
    projectPath: string,
    sessionId: string,
    resumeSessionId?: string,
    model?: string,
    preSeenUuids?: string[],
  ): Promise<{ success: boolean; sessionId: string; error?: string }> {
    if (this.sessions.has(sessionId)) {
      return { success: false, sessionId, error: 'Session already exists' }
    }

    try {
      const sdk = await getSDK()
      const sessionModel = model || DEFAULT_MODEL

      const canUseTool = (
        toolName: string,
        input: Record<string, unknown>,
        opts: {
          signal: AbortSignal
          suggestions?: unknown[]
          decisionReason?: string
          toolUseID: string
        },
      ) => this.handlePermissionRequest(sessionId, toolName, input, opts)

      const mcpServers = loadMcpServers()
      const options = {
        model: sessionModel,
        permissionMode: 'default' as const,
        canUseTool,
        ...(Object.keys(mcpServers).length > 0 && { mcpServers }),
      }

      // V2 SDKSession ignores cwd in options — must chdir before create/resume
      // (subprocess spawns synchronously in constructor)
      const session = await withCwd(projectPath, () =>
        resumeSessionId
          ? sdk.unstable_v2_resumeSession(resumeSessionId, options)
          : sdk.unstable_v2_createSession(options),
      )

      const entry: SessionEntry = {
        session,
        sdkSessionId: resumeSessionId || '', // Will be set from system/init if new
        projectPath,
        model: sessionModel,
        permissionMode: 'default',
        isProcessing: false, // Allow first send() to go through immediately
        seenUuids: new Set(preSeenUuids ?? []),
        messageQueue: [],
      }

      this.sessions.set(sessionId, entry)

      console.log(
        `[claude-code] session created for ${sessionId}, isProcessing=${entry.isProcessing}`,
      )

      // Start reading the stream in background
      this.readStream(sessionId, entry)

      return { success: true, sessionId }
    } catch (err) {
      return {
        success: false,
        sessionId,
        error: err instanceof Error ? err.message : 'Failed to create SDK session',
      }
    }
  }

  // ─────────────────────────────────────────
  // Send Message
  // ─────────────────────────────────────────

  async sendMessage(sessionId: string, text: string): Promise<void> {
    const entry = this.sessions.get(sessionId)
    if (!entry) {
      console.warn(`[claude-code] sendMessage: no session found for ${sessionId}`)
      return
    }

    if (entry.isProcessing) {
      console.log(`[claude-code] sendMessage: queuing (isProcessing=true) for ${sessionId}`)
      entry.messageQueue.push({ text })
      return
    }

    console.log(`[claude-code] sendMessage: sending for ${sessionId}`)
    entry.isProcessing = true
    try {
      await entry.session.send(text)
      console.log(`[claude-code] sendMessage: send() resolved for ${sessionId}`)
    } catch (err) {
      console.error(`[claude-code] sendMessage error for ${sessionId}:`, err)
      entry.isProcessing = false
    }
  }

  async sendMessageWithImages(
    sessionId: string,
    text: string,
    images: Array<{ base64: string; mediaType: string }>,
  ): Promise<void> {
    const entry = this.sessions.get(sessionId)
    if (!entry) return

    if (entry.isProcessing) {
      entry.messageQueue.push({ text, images })
      return
    }

    entry.isProcessing = true
    try {
      const content: Array<Record<string, unknown>> = []
      for (const img of images) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
        })
      }
      if (text) {
        content.push({ type: 'text', text })
      }

      await entry.session.send({
        type: 'user',
        message: { role: 'user', content },
        session_id: entry.sdkSessionId,
        parent_tool_use_id: null,
      } as import('@anthropic-ai/claude-agent-sdk').SDKUserMessage)
    } catch (err) {
      console.error(`[claude-code] sendMessageWithImages error for ${sessionId}:`, err)
      entry.isProcessing = false
    }
  }

  // ─────────────────────────────────────────
  // Interrupt — close + resume
  // ─────────────────────────────────────────

  async sendInterrupt(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId)
    if (!entry || !entry.sdkSessionId) return

    try {
      // Remove from map so readStream's finally block won't emit exit
      this.sessions.delete(sessionId)

      // Close current session (ends the stream)
      entry.session.close()

      // Resume with same SDK session ID
      const sdk = await getSDK()
      const canUseTool = (
        toolName: string,
        input: Record<string, unknown>,
        opts: {
          signal: AbortSignal
          suggestions?: unknown[]
          decisionReason?: string
          toolUseID: string
        },
      ) => this.handlePermissionRequest(sessionId, toolName, input, opts)

      const mcpServers = loadMcpServers()
      const newSession = await withCwd(entry.projectPath, () =>
        sdk.unstable_v2_resumeSession(entry.sdkSessionId, {
          model: entry.model,
          permissionMode: entry.permissionMode as 'default',
          canUseTool,
          ...(Object.keys(mcpServers).length > 0 && { mcpServers }),
        }),
      )

      const newEntry: SessionEntry = {
        session: newSession,
        sdkSessionId: entry.sdkSessionId,
        projectPath: entry.projectPath,
        model: entry.model,
        permissionMode: entry.permissionMode,
        isProcessing: false,
        seenUuids: new Set(entry.seenUuids),
        messageQueue: [],
      }

      this.sessions.set(sessionId, newEntry)

      // Start reading the new stream
      this.readStream(sessionId, newEntry)
    } catch (err) {
      console.error(`[claude-code] sendInterrupt error for ${sessionId}:`, err)
      // Resume failed after close — session is dead, notify renderer
      if (!this.sessions.has(sessionId) && this.win && !this.win.isDestroyed()) {
        this.win.webContents.send(IPC.CLAUDE_PROCESS_EXIT, {
          sessionId,
          code: 1,
          signal: null,
        })
      }
    }
  }

  // ─────────────────────────────────────────
  // Model Switch — close + resume with new model
  // ─────────────────────────────────────────

  async setModel(sessionId: string, model: string): Promise<void> {
    const entry = this.sessions.get(sessionId)
    if (!entry) {
      console.warn(`[claude-code] setModel: no session for ${sessionId}`)
      return
    }
    console.log(
      `[claude-code] setModel: ${sessionId} → ${model} (sdkSessionId=${entry.sdkSessionId || '(none)'})`,
    )

    try {
      // Remove from map so readStream's finally block won't emit exit
      this.sessions.delete(sessionId)

      // Close current session
      entry.session.close()
      console.log(`[claude-code] setModel: old session closed`)

      const sdk = await getSDK()
      const canUseTool = (
        toolName: string,
        input: Record<string, unknown>,
        opts: {
          signal: AbortSignal
          suggestions?: unknown[]
          decisionReason?: string
          toolUseID: string
        },
      ) => this.handlePermissionRequest(sessionId, toolName, input, opts)

      const mcpServers = loadMcpServers()
      const sessionOptions = {
        model,
        permissionMode: entry.permissionMode as 'default',
        canUseTool,
        ...(Object.keys(mcpServers).length > 0 && { mcpServers }),
      }

      // V2 SDKSession ignores cwd in options — must chdir before create/resume
      const newSession = await withCwd(entry.projectPath, () =>
        entry.sdkSessionId
          ? sdk.unstable_v2_resumeSession(entry.sdkSessionId, sessionOptions)
          : sdk.unstable_v2_createSession(sessionOptions),
      )

      const newEntry: SessionEntry = {
        session: newSession,
        sdkSessionId: entry.sdkSessionId, // May be empty — will be set from system/init
        projectPath: entry.projectPath,
        model,
        permissionMode: entry.permissionMode,
        isProcessing: false,
        seenUuids: new Set(entry.seenUuids),
        messageQueue: [],
      }

      this.sessions.set(sessionId, newEntry)
      console.log(
        `[claude-code] setModel: ${entry.sdkSessionId ? 'resumed' : 'created new'} session, starting readStream`,
      )

      // Start reading the new stream
      this.readStream(sessionId, newEntry)
    } catch (err) {
      console.error(`[claude-code] setModel error for ${sessionId}:`, err)
      // Resume failed after close — session is dead, notify renderer
      if (!this.sessions.has(sessionId) && this.win && !this.win.isDestroyed()) {
        this.win.webContents.send(IPC.CLAUDE_PROCESS_EXIT, {
          sessionId,
          code: 1,
          signal: null,
        })
      }
    }
  }

  // ─────────────────────────────────────────
  // Permission Mode Switch — close + resume with new permissionMode
  // ─────────────────────────────────────────

  async setPermissionMode(sessionId: string, mode: string): Promise<void> {
    const entry = this.sessions.get(sessionId)
    if (!entry) {
      console.warn(`[claude-code] setPermissionMode: no session for ${sessionId}`)
      return
    }
    console.log(
      `[claude-code] setPermissionMode: ${sessionId} → ${mode} (sdkSessionId=${entry.sdkSessionId || '(none)'})`,
    )

    try {
      this.sessions.delete(sessionId)
      entry.session.close()
      console.log(`[claude-code] setPermissionMode: old session closed`)

      const sdk = await getSDK()
      const canUseTool = (
        toolName: string,
        input: Record<string, unknown>,
        opts: {
          signal: AbortSignal
          suggestions?: unknown[]
          decisionReason?: string
          toolUseID: string
        },
      ) => this.handlePermissionRequest(sessionId, toolName, input, opts)

      const mcpServers = loadMcpServers()
      const sessionOptions = {
        model: entry.model,
        permissionMode: mode as 'default',
        canUseTool,
        ...(Object.keys(mcpServers).length > 0 && { mcpServers }),
      }

      const newSession = await withCwd(entry.projectPath, () =>
        entry.sdkSessionId
          ? sdk.unstable_v2_resumeSession(entry.sdkSessionId, sessionOptions)
          : sdk.unstable_v2_createSession(sessionOptions),
      )

      const newEntry: SessionEntry = {
        session: newSession,
        sdkSessionId: entry.sdkSessionId,
        projectPath: entry.projectPath,
        model: entry.model,
        permissionMode: mode,
        isProcessing: false,
        seenUuids: new Set(entry.seenUuids),
        messageQueue: [],
      }

      this.sessions.set(sessionId, newEntry)
      console.log(
        `[claude-code] setPermissionMode: ${entry.sdkSessionId ? 'resumed' : 'created new'} session, starting readStream`,
      )

      this.readStream(sessionId, newEntry)
    } catch (err) {
      console.error(`[claude-code] setPermissionMode error for ${sessionId}:`, err)
      if (!this.sessions.has(sessionId) && this.win && !this.win.isDestroyed()) {
        this.win.webContents.send(IPC.CLAUDE_PROCESS_EXIT, {
          sessionId,
          code: 1,
          signal: null,
        })
      }
    }
  }

  // ─────────────────────────────────────────
  // Kill / Cleanup
  // ─────────────────────────────────────────

  kill(sessionId: string): void {
    const entry = this.sessions.get(sessionId)
    if (!entry) return

    // Remove first so readStream won't double-emit exit
    this.sessions.delete(sessionId)
    entry.session.close()

    // Clean up any pending permissions for this session
    for (const [toolUseId, pending] of this.pendingPermissions.entries()) {
      if (pending.signal.aborted) {
        this.pendingPermissions.delete(toolUseId)
      }
    }

    // Notify renderer
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(IPC.CLAUDE_PROCESS_EXIT, {
        sessionId,
        code: 0,
        signal: null,
      })
    }
  }

  killAll(): void {
    for (const id of Array.from(this.sessions.keys())) {
      this.kill(id)
    }
  }

  isRunning(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  getProjectPath(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.projectPath ?? null
  }

  // ─────────────────────────────────────────
  // Permission Handling (unchanged from V1)
  // ─────────────────────────────────────────

  respondToPermission(
    toolUseId: string,
    allow: boolean,
    updatedPermissions?: unknown[],
    updatedInput?: Record<string, unknown>,
  ): void {
    const pending = this.pendingPermissions.get(toolUseId)
    if (!pending) return
    this.pendingPermissions.delete(toolUseId)

    if (allow) {
      // SDK Zod schema requires updatedInput to be a record (not undefined).
      // Use provided updatedInput (e.g. AskUserQuestion with answers) or fall back to original.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: PermissionResult = {
        behavior: 'allow',
        updatedInput: updatedInput ?? pending.input,
      } as any
      if (updatedPermissions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(result as any).updatedPermissions = updatedPermissions
      }
      pending.resolve(result)
    } else {
      pending.resolve({
        behavior: 'deny',
        message: 'User denied permission',
      })
    }
  }

  // ─────────────────────────────────────────
  // One-Shot (unchanged — separate concern)
  // ─────────────────────────────────────────

  runOneShot(
    command: string,
    args: string[],
    cwd: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      const child: ChildProcess = spawn(command, args, {
        cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString()
        })
      }
      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })
      }
      child.on('exit', (code) => {
        resolve({ stdout, stderr, exitCode: code })
      })
      child.on('error', (err) => {
        resolve({ stdout, stderr: err.message, exitCode: 1 })
      })
      child.stdin?.end()
    })
  }

  // ─────────────────────────────────────────
  // Permission callback (pauses SDK until user responds)
  // ─────────────────────────────────────────

  // Tools that are part of the interaction workflow — not dangerous,
  // auto-approve to avoid confusing permission cards
  private static SAFE_META_TOOLS = new Set(['EnterPlanMode'])

  private handlePermissionRequest(
    sessionId: string,
    toolName: string,
    input: Record<string, unknown>,
    opts: {
      signal: AbortSignal
      suggestions?: unknown[]
      decisionReason?: string
      toolUseID: string
    },
  ): Promise<PermissionResult> {
    // Auto-approve safe meta-tools (user interaction)
    if (ClaudeCodeManager.SAFE_META_TOOLS.has(toolName)) {
      console.log(`[claude-code] auto-approving safe tool: ${toolName}`)
      // EnterPlanMode: update entry so ExitPlanMode is correctly denied later
      if (toolName === 'EnterPlanMode') {
        const entry = this.sessions.get(sessionId)
        if (entry) {
          entry.permissionMode = 'plan'
          if (this.win && !this.win.isDestroyed()) {
            this.win.webContents.send(IPC.CLAUDE_MODE_CHANGED, {
              sessionId,
              permissionMode: 'plan',
            })
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Promise.resolve({ behavior: 'allow', updatedInput: input } as any)
    }

    // ExitPlanMode: only deny in plan mode to show our plan approval UI.
    // In other modes (e.g. after "Execute clear context" switched to acceptEdits),
    // allow it so it doesn't trigger a spurious Plan Ready card.
    if (toolName === 'ExitPlanMode') {
      const entry = this.sessions.get(sessionId)
      if (entry?.permissionMode === 'plan') {
        console.log(`[claude-code] denying ExitPlanMode to trigger plan approval UI`)
        return Promise.resolve({
          behavior: 'deny',
          message: 'Plan complete — awaiting user approval via UI.',
        })
      }
      console.log(`[claude-code] auto-approving ExitPlanMode (not in plan mode)`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Promise.resolve({ behavior: 'allow', updatedInput: input } as any)
    }

    return new Promise((resolve) => {
      const toolUseId = opts.toolUseID

      // If signal already aborted, deny immediately
      if (opts.signal.aborted) {
        resolve({ behavior: 'deny', message: 'Aborted' })
        return
      }

      // Store the resolver so respondToPermission can call it
      this.pendingPermissions.set(toolUseId, { resolve, signal: opts.signal, input })

      // Auto-deny if the abort signal fires while waiting
      opts.signal.addEventListener(
        'abort',
        () => {
          if (this.pendingPermissions.has(toolUseId)) {
            this.pendingPermissions.delete(toolUseId)
            resolve({ behavior: 'deny', message: 'Aborted' })
          }
        },
        { once: true },
      )

      // Send to renderer so the UI can show a permission card
      if (this.win && !this.win.isDestroyed()) {
        this.win.webContents.send(IPC.CLAUDE_PERMISSION_REQUEST, {
          sessionId,
          toolName,
          toolUseId,
          input,
          suggestions: opts.suggestions,
          reason: opts.decisionReason,
        })
      }
    })
  }

  // ─────────────────────────────────────────
  // Stream Processing — per-turn stream() with while loop
  // ─────────────────────────────────────────

  private async readStream(sessionId: string, entry: SessionEntry): Promise<void> {
    console.log(`[claude-code] readStream started for ${sessionId}`)
    try {
      // stream() is per-turn: the generator yields events until 'result', then returns.
      // The underlying iterator is shared across stream() calls (lazy init).
      // We loop to keep reading across multiple send()/stream() cycles.
      // Use entry identity check (not just sessionId) so that if setModel/interrupt
      // replaces the entry, this old readStream exits without touching the new one.
      while (this.sessions.get(sessionId) === entry) {
        let gotResult = false
        for await (const msg of entry.session.stream()) {
          if (this.sessions.get(sessionId) !== entry) return

          const sdkMsg = msg as Record<string, unknown>
          console.log(
            `[claude-code] stream event: type=${sdkMsg.type}, subtype=${sdkMsg.subtype ?? ''}`,
          )
          this.mapAndEmitEvent(sessionId, entry, sdkMsg)
          if (sdkMsg.type === 'result') gotResult = true
        }
        if (!gotResult) {
          // Stream returned without a result — underlying iterator is done (process died)
          console.log(`[claude-code] stream ended without result for ${sessionId}, exiting loop`)
          break
        }
        // Turn ended normally (result received).
        // The result handler in mapAndEmitEvent already set isProcessing=false
        // and called drainQueue(). Do NOT set isProcessing here — it would
        // race with drainQueue if a queued message is already being sent.
        console.log(`[claude-code] stream() turn completed for ${sessionId}, awaiting next send`)
      }
    } catch (err) {
      // Stream ended — could be normal close, abort, or crash
      console.log(
        `[claude-code] readStream catch for ${sessionId}:`,
        err instanceof Error ? err.message : err,
      )
    } finally {
      // Only clean up if OUR entry is still the current one in the map.
      // If setModel/interrupt replaced it, the new readStream owns the session.
      if (this.sessions.get(sessionId) === entry) {
        this.sessions.delete(sessionId)
        console.log(`[claude-code] readStream: cleaned up session ${sessionId}`)
        if (this.win && !this.win.isDestroyed()) {
          this.win.webContents.send(IPC.CLAUDE_PROCESS_EXIT, {
            sessionId,
            code: 0,
            signal: null,
          })
        }
      } else {
        console.log(`[claude-code] readStream: session ${sessionId} was replaced, skipping cleanup`)
      }
    }
  }

  // ─────────────────────────────────────────
  // Event Mapping — SDK messages → ClaudeStreamEvent
  // ─────────────────────────────────────────

  private mapAndEmitEvent(
    sessionId: string,
    entry: SessionEntry,
    sdkMsg: Record<string, unknown>,
  ): void {
    const type = sdkMsg.type as string

    // Deduplicate: after close+resume, the SDK replays the entire conversation
    // history. Each event has a uuid — skip events we've already processed.
    const uuid = sdkMsg.uuid as string | undefined
    if (uuid) {
      if (entry.seenUuids.has(uuid)) {
        // Already processed this event — replay duplicate, skip
        console.log(`[claude-code] DEDUP: skipping ${type} (uuid=${uuid.slice(0, 8)}...)`)
        return
      }
      entry.seenUuids.add(uuid)
      console.log(`[claude-code] NEW event: ${type} (uuid=${uuid.slice(0, 8)}...)`)
    } else {
      console.log(`[claude-code] event without uuid: ${type}`)
    }

    if (type === 'system' && sdkMsg.subtype === 'init') {
      // Capture SDK's session ID
      if (sdkMsg.session_id) {
        entry.sdkSessionId = sdkMsg.session_id as string
      }
      console.log(
        `[claude-code] init received for ${sessionId}, sdkSessionId=${entry.sdkSessionId}`,
      )

      const event: ClaudeStreamEvent = {
        type: 'system',
        subtype: 'init',
        session_id: (sdkMsg.session_id as string) ?? '',
        model: (sdkMsg.model as string) ?? '',
        claude_code_version: (sdkMsg.claude_code_version as string) ?? '',
        cwd: (sdkMsg.cwd as string) ?? '',
        tools: (sdkMsg.tools as string[]) ?? [],
        mcp_servers: (sdkMsg.mcp_servers as Array<{ name: string; status: string }>) ?? [],
        permissionMode: sdkMsg.permissionMode as string | undefined,
        uuid: (sdkMsg.uuid as string) ?? '',
      }
      this.emitEvent(sessionId, event)
    } else if (type === 'system' && sdkMsg.subtype === 'status') {
      const event: ClaudeStreamEvent = {
        type: 'system',
        subtype: 'status',
        status: (sdkMsg.status as 'compacting' | null) ?? null,
        session_id: (sdkMsg.session_id as string) ?? '',
        uuid: (sdkMsg.uuid as string) ?? '',
      }
      this.emitEvent(sessionId, event)
    } else if (type === 'system' && sdkMsg.subtype === 'compact_boundary') {
      const event: ClaudeStreamEvent = {
        type: 'system',
        subtype: 'compact_boundary',
        compact_metadata: (sdkMsg.compact_metadata as {
          trigger: 'manual' | 'auto'
          pre_tokens: number
        }) ?? { trigger: 'manual', pre_tokens: 0 },
        session_id: (sdkMsg.session_id as string) ?? '',
        uuid: (sdkMsg.uuid as string) ?? '',
      }
      this.emitEvent(sessionId, event)
    } else if (type === 'stream_event') {
      const event: ClaudeStreamEvent = {
        type: 'stream_event',
        event: sdkMsg.event as ClaudeStreamEvent extends { type: 'stream_event' }
          ? ClaudeStreamEvent['event']
          : never,
        session_id: (sdkMsg.session_id as string) ?? '',
        parent_tool_use_id: (sdkMsg.parent_tool_use_id as string | null) ?? null,
        uuid: (sdkMsg.uuid as string) ?? '',
      }
      this.emitEvent(sessionId, event)
    } else if (type === 'assistant') {
      // Detect EnterPlanMode from assistant tool_use blocks (safety net —
      // SDK may auto-approve without calling canUseTool)
      const assistantMsg = sdkMsg.message as { content?: Array<{ type: string; name?: string }> }
      if (assistantMsg?.content?.some((b) => b.type === 'tool_use' && b.name === 'EnterPlanMode')) {
        if (entry.permissionMode !== 'plan') {
          console.log(`[claude-code] detected EnterPlanMode in assistant event, switching to plan`)
          entry.permissionMode = 'plan'
          if (this.win && !this.win.isDestroyed()) {
            this.win.webContents.send(IPC.CLAUDE_MODE_CHANGED, {
              sessionId,
              permissionMode: 'plan',
            })
          }
        }
      }

      const event: ClaudeStreamEvent = {
        type: 'assistant',
        message: sdkMsg.message as ClaudeStreamEvent extends { type: 'assistant' }
          ? ClaudeStreamEvent['message']
          : never,
        session_id: (sdkMsg.session_id as string) ?? '',
        parent_tool_use_id: (sdkMsg.parent_tool_use_id as string | null) ?? null,
        uuid: (sdkMsg.uuid as string) ?? '',
      }
      this.emitEvent(sessionId, event)
    } else if (type === 'user') {
      const event: ClaudeStreamEvent = {
        type: 'user',
        message: sdkMsg.message as ClaudeStreamEvent extends { type: 'user' }
          ? ClaudeStreamEvent['message']
          : never,
        session_id: (sdkMsg.session_id as string) ?? '',
        parent_tool_use_id: (sdkMsg.parent_tool_use_id as string | null) ?? null,
        tool_use_result: sdkMsg.tool_use_result as string | undefined,
        uuid: (sdkMsg.uuid as string) ?? '',
      }
      this.emitEvent(sessionId, event)
    } else if (type === 'result') {
      // Turn completed — allow next message
      console.log(
        `[claude-code] result received for ${sessionId}, queue=${entry.messageQueue.length}`,
      )
      entry.isProcessing = false
      this.drainQueue(sessionId)

      const event: ClaudeStreamEvent = {
        type: 'result',
        subtype:
          (sdkMsg.subtype as ClaudeStreamEvent extends { type: 'result' }
            ? ClaudeStreamEvent['subtype']
            : never) ?? 'success',
        is_error: (sdkMsg.is_error as boolean) ?? false,
        duration_ms: (sdkMsg.duration_ms as number) ?? 0,
        num_turns: (sdkMsg.num_turns as number) ?? 0,
        result: sdkMsg.result as string | undefined,
        errors: sdkMsg.errors as string[] | undefined,
        session_id: (sdkMsg.session_id as string) ?? '',
        total_cost_usd: (sdkMsg.total_cost_usd as number) ?? 0,
        usage: (sdkMsg.usage as { input_tokens: number; output_tokens: number }) ?? {
          input_tokens: 0,
          output_tokens: 0,
        },
        modelUsage: sdkMsg.modelUsage as
          | Record<
              string,
              {
                inputTokens: number
                outputTokens: number
                contextWindow: number
                maxOutputTokens: number
              }
            >
          | undefined,
        permission_denials: sdkMsg.permission_denials as
          | Array<{
              tool_name: string
              tool_use_id: string
              tool_input: Record<string, unknown>
            }>
          | undefined,
        uuid: (sdkMsg.uuid as string) ?? '',
      }
      this.emitEvent(sessionId, event)
    }
    // Ignore other SDK message types (tool_progress, auth_status, hook_*, etc.)
  }

  // ─────────────────────────────────────────
  // Queue Drain — send next queued message after turn completes
  // ─────────────────────────────────────────

  private async drainQueue(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId)
    if (!entry || entry.messageQueue.length === 0) return

    const next = entry.messageQueue.shift()!
    entry.isProcessing = true

    try {
      if (next.images && next.images.length > 0) {
        const content: Array<Record<string, unknown>> = []
        for (const img of next.images) {
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
          })
        }
        if (next.text) content.push({ type: 'text', text: next.text })

        await entry.session.send({
          type: 'user',
          message: { role: 'user', content },
          session_id: entry.sdkSessionId,
          parent_tool_use_id: null,
        } as import('@anthropic-ai/claude-agent-sdk').SDKUserMessage)
      } else if (next.text) {
        await entry.session.send(next.text)
      }
    } catch (err) {
      console.error(`[claude-code] drainQueue send error for ${sessionId}:`, err)
      entry.isProcessing = false
    }
  }

  // ─────────────────────────────────────────
  // Emit to renderer
  // ─────────────────────────────────────────

  private emitEvent(sessionId: string, event: ClaudeStreamEvent): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(IPC.CLAUDE_STREAM_EVENT, { sessionId, event })
    }
  }
}

export const claudeCodeManager = new ClaudeCodeManager()
