import { create } from 'zustand'
import type {
  ClaudeStatus,
  ConversationMessage,
  ConversationContentBlock,
  ClaudeStreamEvent,
  ClaudeContentBlock,
  PermissionRequestEvent,
  PersistedSession,
  AutoApprovalRule,
} from '@shared/types'
import { usePermissionStore } from './permissionStore'
import { useFileTreeStore } from './fileTreeStore'

// Pending permission entry (one per concurrent SDK canUseTool call)
export interface PendingPermission {
  toolUseId: string
  toolName: string
  input: Record<string, unknown>
  suggestions?: PermissionRequestEvent['suggestions']
  reason?: string
}

// Per-session state
export interface SessionState {
  claudeSessionId: string | null
  status: ClaudeStatus
  model: string | null
  claudeCodeVersion: string | null
  messages: ConversationMessage[]
  currentStreamingMessageId: string | null
  currentBlockIndex: number
  partialToolJson: Map<string, string>
  permissionMode: string
  totalCostUsd: number
  contextWindowMax: number
  lastInputTokens: number
  showPlanApproval: boolean
  origin: 'studio' | 'external'
  pendingPermissions: PendingPermission[]
}

function emptySessionState(): SessionState {
  return {
    claudeSessionId: null,
    status: 'disconnected',
    model: null,
    claudeCodeVersion: null,
    messages: [],
    currentStreamingMessageId: null,
    currentBlockIndex: -1,
    partialToolJson: new Map(),
    permissionMode: 'default',
    totalCostUsd: 0,
    contextWindowMax: 0,
    lastInputTokens: 0,
    showPlanApproval: false,
    origin: 'studio',
    pendingPermissions: [],
  }
}

interface ClaudeCodeState {
  sessions: Map<string, SessionState>
  activeSessionId: string | null
  sessionOrder: string[]

  initSession: (id: string) => void
  removeSession: (id: string) => void
  setActiveSession: (id: string) => void
  restoreSession: (sessionId: string, persisted: PersistedSession) => void
  processStreamEvent: (sessionId: string, event: ClaudeStreamEvent) => void
  addPermissionRequest: (event: PermissionRequestEvent) => void
  resolvePermission: (sessionId: string, toolUseId: string, accepted: boolean) => void
  addUserMessage: (text: string) => void
  addSystemMessage: (text: string) => void
  clearPlanApproval: () => void
  clearMessages: () => void
  reset: () => void
}

// ─────────────────────────────────────────
// Debounced session save helper
// ─────────────────────────────────────────

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

function debouncedSaveSession(sessionId: string): void {
  if (saveTimers.has(sessionId)) {
    clearTimeout(saveTimers.get(sessionId)!)
  }
  saveTimers.set(
    sessionId,
    setTimeout(() => {
      saveTimers.delete(sessionId)
      flushSaveSession(sessionId)
    }, 1000),
  )
}

function flushSaveSession(sessionId: string): void {
  const state = useClaudeCodeStore.getState()
  const session = state.sessions.get(sessionId)
  if (!session) return

  const rootPath = useFileTreeStore.getState().rootPath
  if (!rootPath) return

  const firstUserMsg = session.messages.find(
    (m) => m.role === 'user' && m.contentBlocks.some((b) => b.type === 'text'),
  )
  const firstText = firstUserMsg?.contentBlocks.find((b) => b.type === 'text')
  const preview = firstText && 'text' in firstText ? firstText.text.slice(0, 100) : ''

  const autoApprovalRules = usePermissionStore
    .getState()
    .autoApprovalRules.filter((r: AutoApprovalRule) => r.sessionId === sessionId)

  const persisted: PersistedSession = {
    version: 1,
    info: {
      id: sessionId,
      projectPath: rootPath,
      name: preview.slice(0, 50) || 'New Session',
      createdAt: session.messages[0]?.timestamp ?? Date.now(),
      lastActiveAt: Date.now(),
      firstMessagePreview: preview,
      messageCount: session.messages.length,
      status: session.status,
      model: session.model ?? '',
      costUsd: session.totalCostUsd,
      claudeSessionId: session.claudeSessionId,
      origin: session.origin,
    },
    conversation: session.messages,
    autoApprovalRules,
    contextWindowMax: session.contextWindowMax,
    lastInputTokens: session.lastInputTokens,
  }

  window.api.saveSessionData(persisted).catch((err: unknown) => {
    console.error('[claudeCodeStore] save session error:', err)
  })
}

/** Flush all pending saves immediately (for beforeunload) */
export function flushAllPendingSaves(): void {
  for (const [sessionId, timer] of saveTimers.entries()) {
    clearTimeout(timer)
    saveTimers.delete(sessionId)
    flushSaveSession(sessionId)
  }
}

let messageCounter = 0
function nextMessageId(): string {
  return `msg_${++messageCounter}_${Date.now()}`
}

// Helper: update a session in the map
function withSession(
  state: ClaudeCodeState,
  sessionId: string,
  fn: (session: SessionState) => SessionState,
): { sessions: Map<string, SessionState> } {
  const session = state.sessions.get(sessionId)
  if (!session) return { sessions: state.sessions }
  const next = new Map(state.sessions)
  next.set(sessionId, fn(session))
  return { sessions: next }
}

export const useClaudeCodeStore = create<ClaudeCodeState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,
  sessionOrder: [],

  initSession: (id) => {
    set((state) => {
      const next = new Map(state.sessions)
      next.set(id, emptySessionState())
      return {
        sessions: next,
        activeSessionId: id,
        sessionOrder: [...state.sessionOrder, id],
      }
    })
  },

  removeSession: (id) => {
    set((state) => {
      const next = new Map(state.sessions)
      next.delete(id)
      const newOrder = state.sessionOrder.filter((s) => s !== id)
      let newActive = state.activeSessionId
      if (newActive === id) {
        newActive = newOrder[newOrder.length - 1] ?? null
      }
      return { sessions: next, sessionOrder: newOrder, activeSessionId: newActive }
    })
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  restoreSession: (sessionId, persisted) => {
    set((state) => {
      const next = new Map(state.sessions)
      const restored: SessionState = {
        claudeSessionId: persisted.info.claudeSessionId ?? null,
        status: 'idle',
        model: persisted.info.model || null,
        claudeCodeVersion: null,
        messages: persisted.conversation,
        currentStreamingMessageId: null,
        currentBlockIndex: -1,
        partialToolJson: new Map(),
        permissionMode: 'default',
        totalCostUsd: persisted.info.costUsd,
        contextWindowMax: persisted.contextWindowMax ?? 0,
        lastInputTokens: persisted.lastInputTokens ?? 0,
        showPlanApproval: false,
        origin: persisted.info.origin ?? 'studio',
        pendingPermissions: [],
      }
      next.set(sessionId, restored)
      return {
        sessions: next,
        activeSessionId: sessionId,
        sessionOrder: [...state.sessionOrder.filter((s) => s !== sessionId), sessionId],
      }
    })
    // Restore auto-approval rules
    if (persisted.autoApprovalRules?.length) {
      const permStore = usePermissionStore.getState()
      permStore.setAutoApprovalRules([
        ...permStore.autoApprovalRules,
        ...persisted.autoApprovalRules,
      ])
    }
  },

  // Handle SDK permission request — store as pending + add to conversation
  addPermissionRequest: (event) => {
    set(
      withSession(get(), event.sessionId, (s) => {
        // Add a permission_request content block to the current streaming message
        // or create a new system-level message
        const permBlock: ConversationContentBlock = {
          type: 'permission_request',
          toolUseId: event.toolUseId,
          toolName: event.toolName,
          input: event.input,
          suggestions: event.suggestions,
          reason: event.reason,
          status: 'pending',
        }

        const newPerm: PendingPermission = {
          toolUseId: event.toolUseId,
          toolName: event.toolName,
          input: event.input,
          suggestions: event.suggestions,
          reason: event.reason,
        }

        // If there's a streaming message, add the block there
        if (s.currentStreamingMessageId) {
          return {
            ...s,
            status: 'waiting_for_user',
            pendingPermissions: [...s.pendingPermissions, newPerm],
            messages: s.messages.map((m) =>
              m.id === s.currentStreamingMessageId
                ? { ...m, contentBlocks: [...m.contentBlocks, permBlock] }
                : m,
            ),
          }
        }

        // Otherwise add as a new message
        const msg: ConversationMessage = {
          id: nextMessageId(),
          role: 'system',
          timestamp: Date.now(),
          contentBlocks: [permBlock],
          isStreaming: false,
        }
        return {
          ...s,
          status: 'waiting_for_user',
          pendingPermissions: [...s.pendingPermissions, newPerm],
          messages: [...s.messages, msg],
        }
      }),
    )
  },

  // Resolve a pending permission — update block status + remove from queue
  resolvePermission: (sessionId, toolUseId, accepted) => {
    set(
      withSession(get(), sessionId, (s) => {
        const remaining = s.pendingPermissions.filter((p) => p.toolUseId !== toolUseId)
        return {
          ...s,
          pendingPermissions: remaining,
          // Only change status if no more permissions pending
          status:
            remaining.length > 0 ? 'waiting_for_user' : accepted ? 'tool_executing' : 'thinking',
          messages: s.messages.map((m) => ({
            ...m,
            contentBlocks: m.contentBlocks.map((b) => {
              if (b.type === 'permission_request' && b.toolUseId === toolUseId) {
                return { ...b, status: accepted ? ('accepted' as const) : ('rejected' as const) }
              }
              return b
            }),
          })),
        }
      }),
    )
  },

  processStreamEvent: (sessionId, event) => {
    try {
      const state = get()
      const session = state.sessions.get(sessionId)
      if (!session) return

      switch (event.type) {
        case 'system': {
          if (event.subtype === 'init') {
            const isFirstInit = !session.claudeSessionId
            if (isFirstInit) {
              const sysMsg: ConversationMessage = {
                id: nextMessageId(),
                role: 'system',
                timestamp: Date.now(),
                contentBlocks: [{ type: 'text', text: `Session started. Model: ${event.model}` }],
                isStreaming: false,
              }
              set(
                withSession(state, sessionId, (s) => ({
                  ...s,
                  claudeSessionId: event.session_id,
                  model: event.model,
                  claudeCodeVersion: event.claude_code_version,
                  permissionMode: event.permissionMode ?? 'default',
                  status: 'idle',
                  messages: [...s.messages, sysMsg],
                })),
              )
              // Save session to capture claudeSessionId
              debouncedSaveSession(sessionId)
            } else {
              // Subsequent init events (between turns) —
              // silently update metadata without overriding status
              // (status may already be 'thinking' from addUserMessage)
              set(
                withSession(state, sessionId, (s) => ({
                  ...s,
                  model: event.model,
                })),
              )
            }
          } else if (event.subtype === 'status') {
            // SDK status changes (e.g. compacting)
            if (event.status === 'compacting') {
              set(
                withSession(state, sessionId, (s) => ({
                  ...s,
                  status: 'thinking',
                })),
              )
            }
          } else if (event.subtype === 'compact_boundary') {
            const sysMsg: ConversationMessage = {
              id: nextMessageId(),
              role: 'system',
              timestamp: Date.now(),
              contentBlocks: [{ type: 'text', text: `Conversation compacted.` }],
              isStreaming: false,
            }
            set(
              withSession(state, sessionId, (s) => ({
                ...s,
                status: 'idle',
                messages: [...s.messages, sysMsg],
              })),
            )
          }
          break
        }

        case 'stream_event': {
          const payload = event.event
          switch (payload.type) {
            case 'message_start': {
              const msgId = nextMessageId()
              const msg: ConversationMessage = {
                id: msgId,
                role: 'assistant',
                timestamp: Date.now(),
                contentBlocks: [],
                isStreaming: true,
              }
              set(
                withSession(state, sessionId, (s) => ({
                  ...s,
                  messages: [...s.messages, msg],
                  currentStreamingMessageId: msgId,
                  currentBlockIndex: -1,
                  status: 'thinking',
                  partialToolJson: new Map(),
                })),
              )
              break
            }

            case 'content_block_start': {
              const block = payload.content_block
              const uiBlock = claudeBlockToUI(block)
              set(
                withSession(state, sessionId, (s) => {
                  const msgId = s.currentStreamingMessageId
                  if (!msgId) return s
                  return {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === msgId ? { ...m, contentBlocks: [...m.contentBlocks, uiBlock] } : m,
                    ),
                    currentBlockIndex: payload.index,
                  }
                }),
              )
              break
            }

            case 'content_block_delta': {
              set(
                withSession(state, sessionId, (s) => {
                  const msgId = s.currentStreamingMessageId
                  if (!msgId) return s

                  const msgIdx = s.messages.findIndex((m) => m.id === msgId)
                  if (msgIdx === -1) return s

                  const msg = s.messages[msgIdx]
                  const blockIdx = payload.index
                  if (blockIdx >= msg.contentBlocks.length) return s

                  const delta = payload.delta
                  const updatedBlocks = [...msg.contentBlocks]
                  const currentBlock = updatedBlocks[blockIdx]
                  let partialToolJson = s.partialToolJson

                  if (delta.type === 'text_delta' && currentBlock.type === 'text') {
                    updatedBlocks[blockIdx] = {
                      ...currentBlock,
                      text: currentBlock.text + delta.text,
                    }
                  } else if (
                    delta.type === 'input_json_delta' &&
                    currentBlock.type === 'tool_use'
                  ) {
                    partialToolJson = new Map(s.partialToolJson)
                    const key = currentBlock.toolUseId
                    const existing = partialToolJson.get(key) ?? ''
                    partialToolJson.set(key, existing + delta.partial_json)

                    try {
                      const parsed = JSON.parse(partialToolJson.get(key)!)
                      updatedBlocks[blockIdx] = { ...currentBlock, input: parsed }
                    } catch {
                      // Incomplete JSON, keep existing
                    }
                  }

                  const updatedMessages = [...s.messages]
                  updatedMessages[msgIdx] = { ...msg, contentBlocks: updatedBlocks }
                  return { ...s, messages: updatedMessages, partialToolJson }
                }),
              )
              break
            }

            case 'content_block_stop': {
              break
            }

            case 'message_delta': {
              break
            }

            case 'message_stop': {
              set(
                withSession(state, sessionId, (s) => {
                  const msgId = s.currentStreamingMessageId
                  if (!msgId) return s
                  return {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === msgId ? { ...m, isStreaming: false } : m,
                    ),
                    currentStreamingMessageId: null,
                    currentBlockIndex: -1,
                  }
                }),
              )
              break
            }
          }
          break
        }

        case 'assistant': {
          const msg = event.message
          if (!msg?.content) {
            console.warn('[claudeCodeStore] assistant event with null/undefined content, skipping')
            break
          }
          const contentBlocks = msg.content.map(claudeBlockToUI)

          // Each assistant event = one API call. Track input tokens for context bar.
          // Total context = non-cached + cache-read + cache-created tokens.
          const assistantInputTokens = msg.usage
            ? (msg.usage.input_tokens ?? 0) +
              (msg.usage.cache_read_input_tokens ?? 0) +
              (msg.usage.cache_creation_input_tokens ?? 0)
            : 0

          set(
            withSession(state, sessionId, (s) => {
              let messages: ConversationMessage[]
              if (s.currentStreamingMessageId) {
                messages = s.messages.map((m) =>
                  m.id === s.currentStreamingMessageId
                    ? { ...m, contentBlocks, isStreaming: false }
                    : m,
                )
              } else {
                const conversationMsg: ConversationMessage = {
                  id: nextMessageId(),
                  role: 'assistant',
                  timestamp: Date.now(),
                  contentBlocks,
                  isStreaming: false,
                }
                messages = [...s.messages, conversationMsg]
              }

              return {
                ...s,
                messages,
                lastInputTokens:
                  assistantInputTokens > 0 ? assistantInputTokens : s.lastInputTokens,
                currentStreamingMessageId: null,
                pendingPermissions: [],
                status: 'thinking',
              }
            }),
          )
          break
        }

        case 'user': {
          if (event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'tool_result') {
                set(
                  withSession(get(), sessionId, (s) => ({
                    ...s,
                    messages: s.messages.map((m) => ({
                      ...m,
                      contentBlocks: m.contentBlocks.map((b) => {
                        if (b.type === 'tool_use' && b.toolUseId === block.tool_use_id) {
                          return {
                            ...b,
                            result: normalizeToolResult(block.content),
                            isError: block.is_error,
                            status: block.is_error ? ('error' as const) : ('complete' as const),
                          }
                        }
                        return b
                      }),
                    })),
                    pendingPermissions: [],
                    status: 'tool_executing',
                  })),
                )
              }
            }
          }
          break
        }

        case 'result': {
          const isError = event.is_error

          // Check if this is a plan-mode exit (ExitPlanMode denied by our code)
          const isPlanExit = event.permission_denials?.some((d) => d.tool_name === 'ExitPlanMode')

          // Don't show error card for plan exit — show approval card instead
          const errMsg: ConversationMessage | null =
            isError && !isPlanExit
              ? {
                  id: nextMessageId(),
                  role: 'error',
                  timestamp: Date.now(),
                  contentBlocks: [
                    {
                      type: 'error',
                      message:
                        event.result ?? (event.errors ? event.errors.join('\n') : 'Unknown error'),
                    },
                  ],
                  isStreaming: false,
                }
              : null

          // Extract context window max from modelUsage (only on result events)
          let contextWindowMax: number | undefined
          if (event.modelUsage) {
            const models = Object.values(event.modelUsage)
            if (models.length > 0) {
              contextWindowMax = models[0].contextWindow
            }
          }
          // Note: lastInputTokens is tracked per-API-call in the 'assistant' handler,
          // NOT here — result.usage is cumulative across all API calls in a turn.

          set(
            withSession(get(), sessionId, (s) => {
              const shouldShowPlanApproval = s.permissionMode === 'plan' && (isPlanExit || !isError)
              return {
                ...s,
                status: shouldShowPlanApproval ? 'idle' : isError ? 'error' : 'idle',
                totalCostUsd: event.total_cost_usd,
                contextWindowMax: contextWindowMax ?? s.contextWindowMax,
                showPlanApproval: shouldShowPlanApproval,
                messages: errMsg ? [...s.messages, errMsg] : s.messages,
              }
            }),
          )
          // Save conversation after each turn
          debouncedSaveSession(sessionId)
          break
        }
      }
    } catch (err) {
      console.error('[claudeCodeStore] processStreamEvent CRASH:', err, 'event:', event.type)
    }
  },

  addUserMessage: (text) => {
    const { activeSessionId } = get()
    if (!activeSessionId) return
    const msg: ConversationMessage = {
      id: nextMessageId(),
      role: 'user',
      timestamp: Date.now(),
      contentBlocks: [{ type: 'text', text }],
      isStreaming: false,
    }
    set(
      withSession(get(), activeSessionId, (s) => ({
        ...s,
        messages: [...s.messages, msg],
        status: 'thinking',
        showPlanApproval: false,
      })),
    )
  },

  addSystemMessage: (text) => {
    const { activeSessionId } = get()
    if (!activeSessionId) return
    const msg: ConversationMessage = {
      id: nextMessageId(),
      role: 'system',
      timestamp: Date.now(),
      contentBlocks: [{ type: 'text', text }],
      isStreaming: false,
    }
    set(
      withSession(get(), activeSessionId, (s) => ({
        ...s,
        messages: [...s.messages, msg],
      })),
    )
  },

  clearPlanApproval: () => {
    const { activeSessionId } = get()
    if (!activeSessionId) return
    set(
      withSession(get(), activeSessionId, (s) => ({
        ...s,
        showPlanApproval: false,
      })),
    )
  },

  clearMessages: () => {
    const { activeSessionId } = get()
    if (!activeSessionId) return
    set(
      withSession(get(), activeSessionId, (s) => ({
        ...s,
        messages: [],
        currentStreamingMessageId: null,
        currentBlockIndex: -1,
      })),
    )
  },

  reset: () =>
    set({
      sessions: new Map(),
      activeSessionId: null,
      sessionOrder: [],
    }),
}))

// Stable defaults to avoid infinite re-render loops (React useSyncExternalStore
// requires referentially stable snapshots)
const EMPTY_MESSAGES: ConversationMessage[] = []

// Selectors for active session
export function selectActiveSession(state: ClaudeCodeState): SessionState | null {
  if (!state.activeSessionId) return null
  return state.sessions.get(state.activeSessionId) ?? null
}

export const selectMessages = (state: ClaudeCodeState): ConversationMessage[] =>
  selectActiveSession(state)?.messages ?? EMPTY_MESSAGES

export const selectStatus = (state: ClaudeCodeState): ClaudeStatus =>
  selectActiveSession(state)?.status ?? 'disconnected'

export const selectModel = (state: ClaudeCodeState): string | null =>
  selectActiveSession(state)?.model ?? null

const EMPTY_PERMISSIONS: PendingPermission[] = []

export const selectPendingPermissions = (state: ClaudeCodeState): PendingPermission[] =>
  selectActiveSession(state)?.pendingPermissions ?? EMPTY_PERMISSIONS

/** First pending permission — for keyboard shortcuts and sticky prompt bar */
export const selectFirstPendingPermission = (state: ClaudeCodeState): PendingPermission | null =>
  selectActiveSession(state)?.pendingPermissions[0] ?? null

export const selectPermissionMode = (state: ClaudeCodeState): string =>
  selectActiveSession(state)?.permissionMode ?? 'default'

export const selectTotalCost = (state: ClaudeCodeState): number =>
  selectActiveSession(state)?.totalCostUsd ?? 0

export const selectShowPlanApproval = (state: ClaudeCodeState): boolean =>
  selectActiveSession(state)?.showPlanApproval ?? false

export const selectClaudeSessionId = (state: ClaudeCodeState): string | null =>
  selectActiveSession(state)?.claudeSessionId ?? null

export const selectContextWindowMax = (state: ClaudeCodeState): number =>
  selectActiveSession(state)?.contextWindowMax ?? 0

export const selectLastInputTokens = (state: ClaudeCodeState): number =>
  selectActiveSession(state)?.lastInputTokens ?? 0

/** Normalize SDK tool_result content to a plain string.
 *  The SDK V2 may send content as a string, an object {type, text}, or an array of them. */
function normalizeToolResult(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) =>
        typeof c === 'object' && c && 'text' in c ? (c as { text: string }).text : String(c),
      )
      .join('\n')
  }
  if (typeof content === 'object' && content && 'text' in content) {
    return (content as { text: string }).text
  }
  return String(content ?? '')
}

function claudeBlockToUI(block: ClaudeContentBlock): ConversationContentBlock {
  if (block.type === 'text') {
    return { type: 'text', text: block.text }
  }
  return {
    type: 'tool_use',
    toolUseId: block.id,
    toolName: block.name,
    input: block.input,
    status: 'pending',
  }
}
