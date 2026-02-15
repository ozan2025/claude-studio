import { create } from 'zustand'
import type {
  ClaudeStatus,
  ConversationMessage,
  SessionInfo,
  ClaudeStreamEvent,
} from '@shared/types'

export interface SessionRuntime {
  id: string
  claudeSessionId: string | null
  status: ClaudeStatus
  model: string | null
  messages: ConversationMessage[]
  currentStreamingMessageId: string | null
  totalCostUsd: number
  pendingPermissions: Array<{
    toolUseId: string
    toolName: string
    input: Record<string, unknown>
  }>
}

interface SessionStoreState {
  sessions: Map<string, SessionRuntime>
  activeSessionId: string | null
  sessionOrder: string[]
  sessionHistory: SessionInfo[]

  createSession: (id: string) => void
  closeSession: (id: string) => void
  switchSession: (id: string) => void
  getActiveSession: () => SessionRuntime | null
  updateSession: (id: string, update: Partial<SessionRuntime>) => void
  processEvent: (sessionId: string, event: ClaudeStreamEvent) => void
  addMessage: (sessionId: string, message: ConversationMessage) => void
  updateMessages: (sessionId: string, messages: ConversationMessage[]) => void
  setSessionHistory: (history: SessionInfo[]) => void
  setSessionOrder: (order: string[]) => void
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,
  sessionOrder: [],
  sessionHistory: [],

  createSession: (id) => {
    const session: SessionRuntime = {
      id,
      claudeSessionId: null,
      status: 'disconnected',
      model: null,
      messages: [],
      currentStreamingMessageId: null,
      totalCostUsd: 0,
      pendingPermissions: [],
    }
    set((state) => {
      const next = new Map(state.sessions)
      next.set(id, session)
      return {
        sessions: next,
        activeSessionId: id,
        sessionOrder: [...state.sessionOrder, id],
      }
    })
  },

  closeSession: (id) => {
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

  switchSession: (id) => set({ activeSessionId: id }),

  getActiveSession: () => {
    const state = get()
    if (!state.activeSessionId) return null
    return state.sessions.get(state.activeSessionId) ?? null
  },

  updateSession: (id, update) => {
    set((state) => {
      const existing = state.sessions.get(id)
      if (!existing) return state
      const next = new Map(state.sessions)
      next.set(id, { ...existing, ...update })
      return { sessions: next }
    })
  },

  processEvent: (sessionId, event) => {
    // This delegates to claudeCodeStore-like logic but per-session
    const state = get()
    const session = state.sessions.get(sessionId)
    if (!session) return

    // Simplified per-session event processing
    // The main processing happens in claudeCodeStore which is shared
    // This store tracks multi-session state
    switch (event.type) {
      case 'system':
        get().updateSession(sessionId, {
          claudeSessionId: event.session_id,
          model: event.model,
          status: 'idle',
        })
        break
      case 'result':
        get().updateSession(sessionId, {
          status: event.is_error ? 'error' : 'idle',
          totalCostUsd: event.total_cost_usd,
        })
        break
    }
  },

  addMessage: (sessionId, message) => {
    set((state) => {
      const session = state.sessions.get(sessionId)
      if (!session) return state
      const next = new Map(state.sessions)
      next.set(sessionId, { ...session, messages: [...session.messages, message] })
      return { sessions: next }
    })
  },

  updateMessages: (sessionId, messages) => {
    set((state) => {
      const session = state.sessions.get(sessionId)
      if (!session) return state
      const next = new Map(state.sessions)
      next.set(sessionId, { ...session, messages })
      return { sessions: next }
    })
  },

  setSessionHistory: (history) => set({ sessionHistory: history }),

  setSessionOrder: (order) => set({ sessionOrder: order }),
}))
