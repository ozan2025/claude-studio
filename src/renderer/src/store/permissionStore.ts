import { create } from 'zustand'
import type { AutoApprovalRule } from '@shared/types'

export interface PermissionDenial {
  toolName: string
  toolUseId: string
  input: Record<string, unknown>
  sessionId: string
  message: string
  timestamp: number
  resolved: boolean
}

interface PermissionStoreState {
  autoApprovalRules: AutoApprovalRule[]
  denials: PermissionDenial[]

  enableAutoApproval: (sessionId: string, toolName: string) => void
  disableAutoApproval: (sessionId: string, toolName: string) => void
  clearSessionRules: (sessionId: string) => void
  checkAutoApproval: (sessionId: string, toolName: string) => boolean
  setAutoApprovalRules: (rules: AutoApprovalRule[]) => void
  addDenial: (denial: PermissionDenial) => void
  resolveDenial: (toolUseId: string) => void
}

export const usePermissionStore = create<PermissionStoreState>((set, get) => ({
  autoApprovalRules: [],
  denials: [],

  enableAutoApproval: (sessionId, toolName) => {
    set((state) => ({
      autoApprovalRules: [
        ...state.autoApprovalRules,
        { toolName, sessionId, createdAt: Date.now() },
      ],
    }))
  },

  disableAutoApproval: (sessionId, toolName) => {
    set((state) => ({
      autoApprovalRules: state.autoApprovalRules.filter(
        (r) => !(r.sessionId === sessionId && r.toolName === toolName),
      ),
    }))
  },

  clearSessionRules: (sessionId) => {
    set((state) => ({
      autoApprovalRules: state.autoApprovalRules.filter((r) => r.sessionId !== sessionId),
    }))
  },

  checkAutoApproval: (sessionId, toolName) => {
    return get().autoApprovalRules.some((r) => r.sessionId === sessionId && r.toolName === toolName)
  },

  setAutoApprovalRules: (rules) => set({ autoApprovalRules: rules }),

  addDenial: (denial) =>
    set((state) => {
      const existing = state.denials.find(
        (d) => d.toolName === denial.toolName && d.sessionId === denial.sessionId && !d.resolved,
      )
      if (existing) return state
      return { denials: [...state.denials, denial] }
    }),

  resolveDenial: (toolUseId) =>
    set((state) => ({
      denials: state.denials.map((d) => (d.toolUseId === toolUseId ? { ...d, resolved: true } : d)),
    })),
}))
