import { useEffect, useCallback, useRef } from 'react'
import {
  useClaudeCodeStore,
  selectStatus,
  selectPendingPermissions,
  selectFirstPendingPermission,
  selectClaudeSessionId,
  selectPermissionMode,
  flushAllPendingSaves,
} from '@renderer/store/claudeCodeStore'
import { useErrorStore } from '@renderer/store/errorStore'
import { usePermissionStore } from '@renderer/store/permissionStore'

export function useClaudeCode() {
  const activeSessionId = useClaudeCodeStore((s) => s.activeSessionId)
  const status = useClaudeCodeStore(selectStatus)
  const pendingPermissions = useClaudeCodeStore(selectPendingPermissions)
  const firstPendingPermission = useClaudeCodeStore(selectFirstPendingPermission)
  const claudeSessionId = useClaudeCodeStore(selectClaudeSessionId)
  const permissionMode = useClaudeCodeStore(selectPermissionMode)
  const processStreamEvent = useClaudeCodeStore((s) => s.processStreamEvent)
  const addPermissionRequest = useClaudeCodeStore((s) => s.addPermissionRequest)
  const resolvePermission = useClaudeCodeStore((s) => s.resolvePermission)
  const addUserMessage = useClaudeCodeStore((s) => s.addUserMessage)
  const addSystemMessage = useClaudeCodeStore((s) => s.addSystemMessage)
  const initSession = useClaudeCodeStore((s) => s.initSession)
  const removeSessionState = useClaudeCodeStore((s) => s.removeSession)

  // Listen for stream events — route to correct session
  useEffect(() => {
    const unsub = window.api.onClaudeStreamEvent((sid, event) => {
      processStreamEvent(sid, event)
    })
    return unsub
  }, [processStreamEvent])

  // Listen for SDK permission requests from main process
  useEffect(() => {
    const unsub = window.api.onPermissionRequest((event) => {
      // Check auto-approval rules first
      const autoApproved = usePermissionStore
        .getState()
        .checkAutoApproval(event.sessionId, event.toolName)

      if (autoApproved) {
        // Auto-approve: respond immediately, update store
        window.api.respondToPermission(event.toolUseId, true)
        return
      }

      // Not auto-approved — show in UI
      addPermissionRequest(event)
    })
    return unsub
  }, [addPermissionRequest])

  // Listen for process exit + crash detection
  useEffect(() => {
    const unsub = window.api.onClaudeProcessExit((sid, code) => {
      const store = useClaudeCodeStore.getState()
      const session = store.sessions.get(sid)
      if (!session) return
      const sessions = new Map(store.sessions)
      sessions.set(sid, {
        ...session,
        status: code !== 0 ? 'disconnected' : 'idle',
      })
      useClaudeCodeStore.setState({ sessions })

      // Mark crashed if non-zero exit
      if (code !== 0) {
        useErrorStore.getState().markSessionCrashed(sid)
        useErrorStore.getState().addError({
          id: `crash_${sid}_${Date.now()}`,
          severity: 'error',
          source: 'process_crash',
          message: `Claude process exited with code ${code}`,
          sessionId: sid,
          timestamp: Date.now(),
          dismissed: false,
          retryable: true,
        })
      }
      // Clear hung state on exit
      useErrorStore.getState().clearSessionHung(sid)
    })
    return unsub
  }, [])

  // Listen for SDK-initiated permission mode changes (e.g. EnterPlanMode)
  useEffect(() => {
    const unsub = window.api.onModeChanged((sid, mode) => {
      const store = useClaudeCodeStore.getState()
      const session = store.sessions.get(sid)
      if (!session) return
      const sessions = new Map(store.sessions)
      sessions.set(sid, { ...session, permissionMode: mode })
      useClaudeCodeStore.setState({ sessions })
    })
    return unsub
  }, [])

  // Flush pending saves on window close
  useEffect(() => {
    const handler = () => flushAllPendingSaves()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Hung process timer: if status stays thinking/tool_executing for 5 min, mark hung
  const hungTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (hungTimerRef.current) {
      clearTimeout(hungTimerRef.current)
      hungTimerRef.current = null
    }

    if (activeSessionId && (status === 'thinking' || status === 'tool_executing')) {
      const sid = activeSessionId
      hungTimerRef.current = setTimeout(
        () => {
          useErrorStore.getState().markSessionHung(sid)
        },
        5 * 60 * 1000,
      )
    } else if (activeSessionId) {
      // Status changed away from thinking — clear hung
      useErrorStore.getState().clearSessionHung(activeSessionId)
    }

    return () => {
      if (hungTimerRef.current) clearTimeout(hungTimerRef.current)
    }
  }, [status, activeSessionId])

  const setSessionStatus = useCallback(
    (sid: string, newStatus: 'idle' | 'thinking' | 'disconnected') => {
      const store = useClaudeCodeStore.getState()
      const session = store.sessions.get(sid)
      if (!session) return
      const sessions = new Map(store.sessions)
      sessions.set(sid, { ...session, status: newStatus })
      useClaudeCodeStore.setState({ sessions })
    },
    [],
  )

  const spawnSession = useCallback(
    async (projectPath: string) => {
      const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      initSession(id)
      const result = await window.api.spawnClaude(projectPath, id)
      if (result.success) {
        setSessionStatus(id, 'idle')
      } else {
        removeSessionState(id)
      }
      return result
    },
    [initSession, removeSessionState, setSessionStatus],
  )

  const sendMessage = useCallback(
    async (text: string, images?: Array<{ base64: string; mediaType: string }>) => {
      if (!activeSessionId) return
      addUserMessage(text)
      if (images && images.length > 0) {
        await window.api.sendMessageWithImages(activeSessionId, text, images)
      } else {
        await window.api.sendMessage(activeSessionId, text)
      }
    },
    [activeSessionId, addUserMessage],
  )

  // Accept a specific pending permission — send to main process
  const acceptPermission = useCallback(
    async (toolUseId: string) => {
      if (!activeSessionId) return
      resolvePermission(activeSessionId, toolUseId, true)
      await window.api.respondToPermission(toolUseId, true)
    },
    [activeSessionId, resolvePermission],
  )

  // Accept with custom updatedInput (e.g. AskUserQuestion answers)
  const acceptPermissionWithInput = useCallback(
    async (toolUseId: string, updatedInput: Record<string, unknown>) => {
      if (!activeSessionId) return
      resolvePermission(activeSessionId, toolUseId, true)
      await window.api.respondToPermission(toolUseId, true, undefined, updatedInput)
    },
    [activeSessionId, resolvePermission],
  )

  // Reject a specific pending permission
  const rejectPermission = useCallback(
    async (toolUseId: string) => {
      if (!activeSessionId) return
      resolvePermission(activeSessionId, toolUseId, false)
      await window.api.respondToPermission(toolUseId, false)
    },
    [activeSessionId, resolvePermission],
  )

  // "Always allow [tool] for this session" — approve + set auto-approval rule
  const allowToolForSession = useCallback(
    async (toolUseId: string, toolName: string) => {
      if (!activeSessionId) return

      // Set auto-approval rule for future requests
      usePermissionStore.getState().enableAutoApproval(activeSessionId, toolName)

      // Approve the current request with updatedPermissions to tell SDK
      resolvePermission(activeSessionId, toolUseId, true)
      await window.api.respondToPermission(
        toolUseId,
        true,
        // Tell the SDK to add a session-level allow rule for this tool
        [
          {
            type: 'addRules',
            rules: [{ toolName }],
            behavior: 'allow',
            destination: 'session',
          },
        ],
      )
    },
    [activeSessionId, resolvePermission],
  )

  const interrupt = useCallback(async () => {
    if (!activeSessionId) return
    // Reset status immediately so button flips back to "Send" (prevents repeat clicks)
    setSessionStatus(activeSessionId, 'idle')
    await window.api.interruptClaude(activeSessionId)
  }, [activeSessionId, setSessionStatus])

  const killSession = useCallback(async () => {
    if (!activeSessionId) return
    await window.api.killClaude(activeSessionId)
    removeSessionState(activeSessionId)
  }, [activeSessionId, removeSessionState])

  const compactSession = useCallback(async () => {
    if (!activeSessionId) return
    addSystemMessage('Compacting conversation...')
    // Send /compact as a message — SDK handles it natively
    await window.api.sendMessage(activeSessionId, '/compact')
  }, [activeSessionId, addSystemMessage])

  const switchModel = useCallback(
    async (model: string) => {
      if (!activeSessionId) return
      addSystemMessage(`Switching to ${model}...`)
      // V2: close current session + resume with new model
      await window.api.setModel(activeSessionId, model)
      // Update model in store immediately — system/init only fires on next send() in V2
      setSessionStatus(activeSessionId, 'idle')
      const store = useClaudeCodeStore.getState()
      const session = store.sessions.get(activeSessionId)
      if (session) {
        const sessions = new Map(store.sessions)
        sessions.set(activeSessionId, { ...session, model })
        useClaudeCodeStore.setState({ sessions })
      }
      addSystemMessage(`Now using ${model}`)
    },
    [activeSessionId, addSystemMessage, setSessionStatus],
  )

  const switchPermissionMode = useCallback(
    async (mode: string) => {
      if (!activeSessionId) return
      const labels: Record<string, string> = {
        default: 'Default',
        acceptEdits: 'Auto-accept edits',
        plan: 'Plan mode',
      }
      addSystemMessage(`Switching to ${labels[mode] ?? mode} mode...`)
      await window.api.setPermissionMode(activeSessionId, mode)
      setSessionStatus(activeSessionId, 'idle')
      // Update permissionMode in store immediately
      const store = useClaudeCodeStore.getState()
      const session = store.sessions.get(activeSessionId)
      if (session) {
        const sessions = new Map(store.sessions)
        sessions.set(activeSessionId, { ...session, permissionMode: mode })
        useClaudeCodeStore.setState({ sessions })
      }
      addSystemMessage(`Now in ${labels[mode] ?? mode} mode`)
    },
    [activeSessionId, addSystemMessage, setSessionStatus],
  )

  const runDoctor = useCallback(
    async (cwd: string) => {
      addSystemMessage('Running diagnostics...')
      try {
        const versionResult = await window.api.runOneShot('claude', ['--version'], cwd)
        const version = versionResult.stdout?.trim() || 'unknown'
        const isConnected = !!activeSessionId && status !== 'disconnected'
        addSystemMessage(
          `Claude Code: ${version}\n` +
            `Session: ${activeSessionId ?? 'none'}\n` +
            `Status: ${status} | Connected: ${isConnected ? 'yes' : 'no'}`,
        )
      } catch (err) {
        addSystemMessage(`Doctor error: ${err}`)
      }
    },
    [addSystemMessage, activeSessionId, status],
  )

  return {
    sessionId: activeSessionId,
    claudeSessionId,
    status,
    permissionMode,
    pendingPermissions,
    firstPendingPermission,
    spawnSession,
    sendMessage,
    acceptPermission,
    acceptPermissionWithInput,
    rejectPermission,
    allowToolForSession,
    interrupt,
    killSession,
    compactSession,
    switchModel,
    switchPermissionMode,
    runDoctor,
  }
}
