import { useState, useCallback, useRef, useEffect } from 'react'
import { useClaudeCode } from '@renderer/hooks/useClaudeCode'
import {
  useClaudeCodeStore,
  selectModel,
  selectTotalCost,
  selectFirstPendingPermission,
  selectPermissionMode,
  selectContextWindowMax,
  selectLastInputTokens,
} from '@renderer/store/claudeCodeStore'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useSessionStore } from '@renderer/store/sessionStore'
import { usePermissionKeyboard } from '@renderer/hooks/usePermissionKeyboard'
import StatusIndicator from './StatusIndicator'
import ConversationView from './ConversationView'
import InputArea from './InputArea'
import SessionTabBar from '../SessionTabs/SessionTabBar'
import SessionHistory from '../SessionTabs/SessionHistory'
import QuickActionBar from '../QuickActions/QuickActionBar'
import StickyPromptBar from '../Permissions/StickyPromptBar'
import HungProcessIndicator from '../ErrorBanner/HungProcessIndicator'
import ErrorBoundary from '../ErrorBanner/ErrorBoundary'
import { useErrorStore } from '@renderer/store/errorStore'

const MODEL_OPTIONS = [
  { label: 'Sonnet', value: 'claude-sonnet-4-5-20250929' },
  { label: 'Opus', value: 'claude-opus-4-6' },
  { label: 'Haiku', value: 'claude-haiku-4-5-20251001' },
]

const MODE_OPTIONS = [
  { label: 'Default', value: 'default', description: 'Manual approval for all tools' },
  { label: 'Auto-edit', value: 'acceptEdits', description: 'Auto-accept file edits' },
  { label: 'Plan', value: 'plan', description: 'Plan without executing' },
]

export default function ClaudePanel() {
  const {
    sessionId,
    status,
    spawnSession,
    sendMessage,
    acceptPermission,
    acceptPermissionWithInput,
    rejectPermission,
    interrupt,
    compactSession,
    switchModel,
    switchPermissionMode,
    runDoctor,
    allowToolForSession,
  } = useClaudeCode()

  const model = useClaudeCodeStore(selectModel)
  const totalCostUsd = useClaudeCodeStore(selectTotalCost)
  const firstPendingPermission = useClaudeCodeStore(selectFirstPendingPermission)
  const permissionMode = useClaudeCodeStore(selectPermissionMode)
  const contextWindowMax = useClaudeCodeStore(selectContextWindowMax)
  const lastInputTokens = useClaudeCodeStore(selectLastInputTokens)
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const { sessionHistory } = useSessionStore()

  const hungSessions = useErrorStore((s) => s.hungSessions)
  const isHung = sessionId ? hungSessions.has(sessionId) : false

  const [showHistory, setShowHistory] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showModePicker, setShowModePicker] = useState(false)
  const [permissionCardVisible, setPermissionCardVisible] = useState(true)
  const conversationRef = useRef<HTMLDivElement>(null)

  const restoreSession = useClaudeCodeStore((s) => s.restoreSession)

  // Restore last session or spawn fresh on mount
  useEffect(() => {
    if (sessionId || !rootPath) return
    let cancelled = false

    async function restoreOrSpawn() {
      try {
        const last = await window.api.getLastSession(rootPath!)
        if (cancelled) return

        if (last) {
          const persisted = await window.api.loadSessionData(rootPath!, last.sessionId)
          if (cancelled) return

          if (persisted && persisted.info.claudeSessionId) {
            // Re-parse .jsonl for fresh data (user may have used CLI since last Studio session)
            const freshData = await window.api.parseExternalSession(
              rootPath!,
              persisted.info.claudeSessionId,
            )
            if (cancelled) return

            if (freshData && freshData.messages.length > 0) {
              restoreSession(last.sessionId, {
                ...persisted,
                conversation: freshData.messages,
                info: {
                  ...persisted.info,
                  model: freshData.model || persisted.info.model,
                },
              })
              const result = await window.api.spawnClaude(
                rootPath!,
                last.sessionId,
                persisted.info.claudeSessionId,
                freshData.model || persisted.info.model || undefined,
                freshData.uuids,
              )
              if (!result.success && !cancelled) {
                useClaudeCodeStore.getState().removeSession(last.sessionId)
                spawnSession(rootPath!)
              }
            } else {
              // No .jsonl — fall back to Studio save
              restoreSession(last.sessionId, persisted)
              const result = await window.api.spawnClaude(
                rootPath!,
                last.sessionId,
                persisted.info.claudeSessionId,
                persisted.info.model || undefined,
              )
              if (!result.success && !cancelled) {
                useClaudeCodeStore.getState().removeSession(last.sessionId)
                spawnSession(rootPath!)
              }
            }
            return
          }
        }
      } catch (err) {
        console.error('[ClaudePanel] restore error:', err)
      }

      if (!cancelled) {
        spawnSession(rootPath!)
      }
    }

    restoreOrSpawn()
    return () => {
      cancelled = true
    }
  }, [sessionId, rootPath, spawnSession, restoreSession])

  // Populate session history on mount — merge Studio + external sessions
  useEffect(() => {
    if (!rootPath) return

    Promise.all([
      window.api.loadSessionIndex(rootPath).catch(() => null),
      window.api.loadExternalSessionIndex(rootPath).catch(() => []),
    ]).then(([index, external]) => {
      const studioSessions = index?.sessions ?? []
      // Deduplicate: filter out external sessions already resumed in Studio
      const studioSdkIds = new Set(studioSessions.map((s) => s.claudeSessionId).filter(Boolean))
      const newExternal = external.filter((e) => !studioSdkIds.has(e.claudeSessionId))
      // Merge and sort by most recent first
      const merged = [...studioSessions, ...newExternal].sort(
        (a, b) => b.lastActiveAt - a.lastActiveAt,
      )
      useSessionStore.setState({ sessionHistory: merged })
    })
  }, [rootPath])

  const handleSend = useCallback(
    (text: string, images?: Array<{ base64: string; mediaType: string }>) => {
      sendMessage(text, images)
    },
    [sendMessage],
  )

  const handleNewSession = useCallback(async () => {
    if (!rootPath) return
    await spawnSession(rootPath)
  }, [rootPath, spawnSession])

  const clearMessages = useClaudeCodeStore((s) => s.clearMessages)

  // Built-in commands that require interactive terminal I/O
  const UNSUPPORTED_COMMANDS = new Set([
    '/init',
    '/login',
    '/logout',
    '/memory',
    '/permissions',
    '/review',
    '/status',
    '/vim',
    '/bug',
    '/terminal-setup',
    '/mcp',
    '/config',
  ])

  const handleSendCommand = useCallback(
    async (command: string) => {
      const [cmd, ...args] = command.trim().split(/\s+/)
      const cmdLower = cmd.toLowerCase()

      // Local-only commands
      if (cmdLower === '/clear') {
        clearMessages()
        return
      }
      if (cmdLower === '/cost') {
        useClaudeCodeStore.getState().addSystemMessage(`Session cost: $${totalCostUsd.toFixed(4)}`)
        return
      }
      if (cmdLower === '/help') {
        useClaudeCodeStore
          .getState()
          .addSystemMessage(
            'Type / to see available commands. Use @ to reference files.\n' +
              'Local commands: /clear, /cost, /help, /compact, /model <name>, /doctor\n' +
              'Custom commands from .claude/commands/ are also available.',
          )
        return
      }

      // /compact — compact conversation
      if (cmdLower === '/compact') {
        await compactSession()
        return
      }

      // /model [name] — switch model
      if (cmdLower === '/model') {
        if (args.length === 0) {
          setShowModelPicker(true)
          return
        }
        await switchModel(args[0])
        return
      }

      // /mode [name] — switch permission mode
      if (cmdLower === '/mode') {
        if (args.length === 0) {
          setShowModePicker(true)
          return
        }
        const modeArg = args[0].toLowerCase()
        const modeMap: Record<string, string> = {
          default: 'default',
          'auto-edit': 'acceptEdits',
          autoedit: 'acceptEdits',
          acceptedits: 'acceptEdits',
          plan: 'plan',
        }
        const resolved = modeMap[modeArg]
        if (resolved) {
          await switchPermissionMode(resolved)
        } else {
          useClaudeCodeStore
            .getState()
            .addSystemMessage(`Unknown mode "${args[0]}". Available: default, auto-edit, plan`)
        }
        return
      }

      // /doctor — run diagnostics
      if (cmdLower === '/doctor') {
        if (rootPath) {
          await runDoctor(rootPath)
        } else {
          useClaudeCodeStore.getState().addSystemMessage('No project root set.')
        }
        return
      }

      // Unsupported built-in commands
      if (UNSUPPORTED_COMMANDS.has(cmdLower)) {
        useClaudeCodeStore
          .getState()
          .addSystemMessage(
            `${cmd} is not available in this mode. Use the Claude Code CLI directly for this command.`,
          )
        return
      }

      // Try to expand custom command from .md file
      if (rootPath) {
        const result = await window.api.readCommand(rootPath, command)
        if (result) {
          sendMessage(result.content)
          return
        }
      }

      // Unknown command — send as regular message to Claude
      sendMessage(command)
    },
    [
      sendMessage,
      clearMessages,
      totalCostUsd,
      rootPath,
      compactSession,
      switchModel,
      switchPermissionMode,
      runDoctor,
    ],
  )

  // Keyboard shortcuts and sticky bar operate on the first (oldest) pending permission
  const handleKeyboardAccept = useCallback(() => {
    if (firstPendingPermission) acceptPermission(firstPendingPermission.toolUseId)
  }, [firstPendingPermission, acceptPermission])

  const handleKeyboardReject = useCallback(() => {
    if (firstPendingPermission) rejectPermission(firstPendingPermission.toolUseId)
  }, [firstPendingPermission, rejectPermission])

  const handleKeyboardAutoApprove = useCallback(() => {
    if (firstPendingPermission) {
      allowToolForSession(firstPendingPermission.toolUseId, firstPendingPermission.toolName)
    }
  }, [firstPendingPermission, allowToolForSession])

  const handleScrollToCard = useCallback(() => {
    // scrollRef is inside ConversationView (first child of conversationRef)
    const scrollEl = conversationRef.current?.firstElementChild as HTMLDivElement | null
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
  }, [])

  // Permission keyboard shortcuts
  usePermissionKeyboard({
    hasPending: !!firstPendingPermission,
    onAccept: handleKeyboardAccept,
    onReject: handleKeyboardReject,
    onAutoApprove: handleKeyboardAutoApprove,
  })

  const clearPlanApproval = useClaudeCodeStore((s) => s.clearPlanApproval)

  const handleExecutePlanAutoAccept = useCallback(async () => {
    clearPlanApproval()
    await switchPermissionMode('acceptEdits')
    sendMessage('Execute the plan.')
  }, [clearPlanApproval, switchPermissionMode, sendMessage])

  const handleExecutePlanManual = useCallback(async () => {
    clearPlanApproval()
    await switchPermissionMode('default')
    sendMessage('Execute the plan.')
  }, [clearPlanApproval, switchPermissionMode, sendMessage])

  const handleExecutePlanClearContext = useCallback(async () => {
    clearPlanApproval()
    clearMessages()
    await switchPermissionMode('acceptEdits')
    sendMessage('Execute the plan.')
  }, [clearPlanApproval, clearMessages, switchPermissionMode, sendMessage])

  const handleRevisePlan = useCallback(() => {
    clearPlanApproval()
    // User types feedback manually — just clear the card and focus input
  }, [clearPlanApproval])

  const handleResumeSession = useCallback(
    async (sid: string) => {
      if (!rootPath) return
      setShowHistory(false)

      try {
        const persisted = await window.api.loadSessionData(rootPath, sid)
        if (persisted && persisted.info.claudeSessionId) {
          // Always re-parse the .jsonl for fresh data (source of truth).
          // The user may have continued this session in CLI/VS Code since last Studio use.
          const freshData = await window.api.parseExternalSession(
            rootPath,
            persisted.info.claudeSessionId,
          )

          if (freshData && freshData.messages.length > 0) {
            // Use fresh .jsonl messages, but keep Studio metadata (cost, auto-approvals)
            restoreSession(sid, {
              ...persisted,
              conversation: freshData.messages,
              info: {
                ...persisted.info,
                model: freshData.model || persisted.info.model,
              },
            })
            const result = await window.api.spawnClaude(
              rootPath,
              sid,
              persisted.info.claudeSessionId,
              freshData.model || persisted.info.model || undefined,
              freshData.uuids,
            )
            if (!result.success) {
              useClaudeCodeStore.getState().removeSession(sid)
              useClaudeCodeStore
                .getState()
                .addSystemMessage(`Failed to resume session: ${result.error}`)
            }
          } else {
            // No .jsonl found — fall back to Studio save
            restoreSession(sid, persisted)
            const result = await window.api.spawnClaude(
              rootPath,
              sid,
              persisted.info.claudeSessionId,
              persisted.info.model || undefined,
            )
            if (!result.success) {
              useClaudeCodeStore.getState().removeSession(sid)
              useClaudeCodeStore
                .getState()
                .addSystemMessage(`Failed to resume session: ${result.error}`)
            }
          }
        } else {
          useClaudeCodeStore
            .getState()
            .addSystemMessage('Cannot resume: no SDK session ID saved for this session.')
        }
      } catch (err) {
        console.error('[ClaudePanel] resume error:', err)
      }
    },
    [rootPath, restoreSession],
  )

  const removeSession = useClaudeCodeStore((s) => s.removeSession)

  const handleResumeExternalSession = useCallback(
    async (sdkSessionId: string) => {
      if (!rootPath) return
      setShowHistory(false)

      // Parse JSONL to get conversation history + UUIDs for dedup
      const parsed = await window.api.parseExternalSession(rootPath, sdkSessionId)
      if (!parsed || parsed.messages.length === 0) {
        useClaudeCodeStore
          .getState()
          .addSystemMessage('This session has no conversation history to resume.')
        return
      }

      // Create session and populate with parsed conversation
      const internalId = `ext_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const store = useClaudeCodeStore.getState()
      const sessions = new Map(store.sessions)
      sessions.set(internalId, {
        claudeSessionId: sdkSessionId,
        status: 'idle',
        model: parsed.model || null,
        claudeCodeVersion: null,
        messages: parsed.messages,
        currentStreamingMessageId: null,
        currentBlockIndex: -1,
        partialToolJson: new Map(),
        permissionMode: 'default',
        totalCostUsd: 0,
        contextWindowMax: 0,
        lastInputTokens: 0,
        showPlanApproval: false,
        origin: 'external',
        pendingPermissions: [],
      })
      useClaudeCodeStore.setState({
        sessions,
        activeSessionId: internalId,
        sessionOrder: [...store.sessionOrder, internalId],
      })

      // Spawn SDK with pre-populated UUIDs so replay events are deduplicated
      const result = await window.api.spawnClaude(
        rootPath,
        internalId,
        sdkSessionId,
        parsed.model || undefined,
        parsed.uuids,
      )
      if (!result.success) {
        removeSession(internalId)
        useClaudeCodeStore
          .getState()
          .addSystemMessage(`Failed to resume external session: ${result.error}`)
      }
    },
    [rootPath, removeSession],
  )

  const handleDeleteSession = useCallback(
    async (sid: string) => {
      if (!rootPath) return
      await window.api.deleteSessionData(rootPath, sid)
    },
    [rootPath],
  )

  return (
    <div className="h-full flex flex-col bg-white">
      <SessionTabBar
        onNewSession={handleNewSession}
        onShowHistory={() => setShowHistory(!showHistory)}
      />

      {showHistory && (
        <SessionHistory
          sessions={sessionHistory}
          onResume={handleResumeSession}
          onResumeExternal={handleResumeExternalSession}
          onDelete={handleDeleteSession}
          onClose={() => setShowHistory(false)}
        />
      )}

      <QuickActionBar
        onNewSession={handleNewSession}
        onSendCommand={handleSendCommand}
        disabled={!sessionId || status === 'disconnected'}
      />

      {showModelPicker && (
        <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-gray-500 mr-1">Switch model:</span>
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={async () => {
                setShowModelPicker(false)
                await switchModel(opt.value)
              }}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                model === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setShowModelPicker(false)}
            className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 ml-auto"
          >
            Cancel
          </button>
        </div>
      )}

      {showModePicker && (
        <div className="px-2 py-1.5 bg-purple-50 border-b border-purple-200 flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-purple-500 mr-1">Permission mode:</span>
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={async () => {
                setShowModePicker(false)
                await switchPermissionMode(opt.value)
              }}
              title={opt.description}
              className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                permissionMode === opt.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border border-purple-300 text-purple-700 hover:bg-purple-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setShowModePicker(false)}
            className="px-1.5 py-0.5 text-[10px] text-purple-400 hover:text-purple-600 ml-auto"
          >
            Cancel
          </button>
        </div>
      )}

      <StatusIndicator
        status={status}
        model={model}
        totalCost={totalCostUsd}
        permissionMode={permissionMode}
        contextWindowMax={contextWindowMax}
        lastInputTokens={lastInputTokens}
      />

      <div ref={conversationRef} className="flex-1 flex flex-col min-h-0 relative">
        <ErrorBoundary>
          <ConversationView
            onAcceptPermission={acceptPermission}
            onAcceptPermissionWithInput={acceptPermissionWithInput}
            onRejectPermission={rejectPermission}
            onAllowToolForSession={allowToolForSession}
            onPermissionVisibilityChange={setPermissionCardVisible}
            onRestartSession={handleNewSession}
            onExecutePlanAutoAccept={handleExecutePlanAutoAccept}
            onExecutePlanManual={handleExecutePlanManual}
            onExecutePlanClearContext={handleExecutePlanClearContext}
            onRevisePlan={handleRevisePlan}
            sessionId={sessionId}
          />
        </ErrorBoundary>

        {firstPendingPermission && !permissionCardVisible && (
          <StickyPromptBar
            toolName={firstPendingPermission.toolName}
            visible={true}
            onAccept={handleKeyboardAccept}
            onReject={handleKeyboardReject}
            onScrollToCard={handleScrollToCard}
          />
        )}
      </div>

      {isHung && <HungProcessIndicator onCancel={interrupt} />}

      <InputArea
        onSend={handleSend}
        onCommand={handleSendCommand}
        onInterrupt={interrupt}
        status={status}
        disabled={status === 'disconnected' && !sessionId}
      />
    </div>
  )
}
