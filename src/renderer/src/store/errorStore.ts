import { create } from 'zustand'
import type { ClaudeStudioError } from '@shared/errors'

interface ErrorStoreState {
  errors: ClaudeStudioError[]
  fileSystemWarning: string | null
  hungSessions: Set<string>
  crashedSessions: Set<string>

  addError: (error: ClaudeStudioError) => void
  dismissError: (id: string) => void
  clearErrors: () => void
  setFileSystemWarning: (warning: string | null) => void
  markSessionHung: (sessionId: string) => void
  clearSessionHung: (sessionId: string) => void
  markSessionCrashed: (sessionId: string) => void
  clearSessionCrashed: (sessionId: string) => void
}

export const useErrorStore = create<ErrorStoreState>((set) => ({
  errors: [],
  fileSystemWarning: null,
  hungSessions: new Set(),
  crashedSessions: new Set(),

  addError: (error) => set((state) => ({ errors: [...state.errors, error] })),

  dismissError: (id) =>
    set((state) => ({
      errors: state.errors.map((e) => (e.id === id ? { ...e, dismissed: true } : e)),
    })),

  clearErrors: () => set({ errors: [] }),

  setFileSystemWarning: (warning) => set({ fileSystemWarning: warning }),

  markSessionHung: (sessionId) =>
    set((state) => {
      const next = new Set(state.hungSessions)
      next.add(sessionId)
      return { hungSessions: next }
    }),

  clearSessionHung: (sessionId) =>
    set((state) => {
      const next = new Set(state.hungSessions)
      next.delete(sessionId)
      return { hungSessions: next }
    }),

  markSessionCrashed: (sessionId) =>
    set((state) => {
      const next = new Set(state.crashedSessions)
      next.add(sessionId)
      return { crashedSessions: next }
    }),

  clearSessionCrashed: (sessionId) =>
    set((state) => {
      const next = new Set(state.crashedSessions)
      next.delete(sessionId)
      return { crashedSessions: next }
    }),
}))
