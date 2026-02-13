import { create } from 'zustand'

interface UiStoreState {
  fileTreeVisible: boolean
  claudePanelVisible: boolean
  quickOpenVisible: boolean

  toggleFileTree: () => void
  toggleClaudePanel: () => void
  setQuickOpenVisible: (visible: boolean) => void
}

export const useUiStore = create<UiStoreState>((set) => ({
  fileTreeVisible: true,
  claudePanelVisible: true,
  quickOpenVisible: false,

  toggleFileTree: () => set((state) => ({ fileTreeVisible: !state.fileTreeVisible })),

  toggleClaudePanel: () => set((state) => ({ claudePanelVisible: !state.claudePanelVisible })),

  setQuickOpenVisible: (visible) => set({ quickOpenVisible: visible }),
}))
