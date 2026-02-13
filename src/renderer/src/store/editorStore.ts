import { create } from 'zustand'
import type { EditorTab, PersistedEditorState } from '@shared/types'
import { getLanguageFromPath } from '@shared/constants'

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
  fileContents: Map<string, string>

  openFile: (filePath: string, content: string, isPreview?: boolean) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabContent: (tabId: string, content: string) => void
  markTabDirty: (tabId: string, isDirty: boolean) => void
  promotePreview: (tabId: string) => void
  setFileContent: (filePath: string, content: string) => void
  saveEditorState: (projectPath: string) => void
  restoreEditorState: (projectPath: string) => Promise<void>
}

function filePathToId(filePath: string): string {
  return filePath
}

function fileNameFromPath(filePath: string): string {
  return filePath.split('/').pop() ?? filePath
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  fileContents: new Map(),

  openFile: (filePath, content, isPreview = true) => {
    const id = filePathToId(filePath)
    const state = get()

    // If tab already exists, just activate it
    const existingTab = state.tabs.find((t) => t.id === id)
    if (existingTab) {
      set({ activeTabId: id })
      // Update content
      const next = new Map(state.fileContents)
      next.set(filePath, content)
      set({ fileContents: next })
      return
    }

    // If opening as preview, replace existing preview tab
    const newTabs = isPreview ? state.tabs.filter((t) => !t.isPreview) : [...state.tabs]

    const tab: EditorTab = {
      id,
      filePath,
      fileName: fileNameFromPath(filePath),
      language: getLanguageFromPath(filePath),
      isDirty: false,
      isPreview,
    }

    newTabs.push(tab)
    const next = new Map(state.fileContents)
    next.set(filePath, content)

    set({ tabs: newTabs, activeTabId: id, fileContents: next })
  },

  closeTab: (tabId) => {
    const state = get()
    const idx = state.tabs.findIndex((t) => t.id === tabId)
    const newTabs = state.tabs.filter((t) => t.id !== tabId)

    let newActiveId = state.activeTabId
    if (state.activeTabId === tabId) {
      if (newTabs.length === 0) {
        newActiveId = null
      } else if (idx >= newTabs.length) {
        newActiveId = newTabs[newTabs.length - 1].id
      } else {
        newActiveId = newTabs[idx].id
      }
    }

    set({ tabs: newTabs, activeTabId: newActiveId })
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabContent: (tabId, content) => {
    const state = get()
    const tab = state.tabs.find((t) => t.id === tabId)
    if (!tab) return

    const next = new Map(state.fileContents)
    next.set(tab.filePath, content)

    set({
      fileContents: next,
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isDirty: true } : t)),
    })
  },

  markTabDirty: (tabId, isDirty) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isDirty } : t)),
    })),

  promotePreview: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, isPreview: false } : t)),
    })),

  setFileContent: (filePath, content) =>
    set((state) => {
      const next = new Map(state.fileContents)
      next.set(filePath, content)
      return { fileContents: next }
    }),

  saveEditorState: (projectPath) => {
    const state = get()
    const persistedState: PersistedEditorState = {
      version: 1,
      projectPath,
      openTabs: state.tabs.filter((t) => !t.isPreview),
      activeTabPath: state.activeTabId,
    }
    window.api.saveEditorState(persistedState)
  },

  restoreEditorState: async (projectPath) => {
    const state = await window.api.loadEditorState(projectPath)
    if (!state || !state.openTabs.length) return

    for (const tab of state.openTabs) {
      try {
        const result = await window.api.readFile(tab.filePath)
        get().openFile(tab.filePath, result.content, false)
      } catch {
        // File may have been deleted
      }
    }

    if (state.activeTabPath) {
      set({ activeTabId: state.activeTabPath })
    }
  },
}))
