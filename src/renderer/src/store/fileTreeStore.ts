import { create } from 'zustand'
import type { FileTreeEntry, FileChangeEvent } from '@shared/types'

interface FileTreeState {
  rootPath: string | null
  entries: FileTreeEntry[]
  expandedPaths: Set<string>
  filterText: string
  isLoading: boolean
  error: string | null

  setRootPath: (path: string) => void
  setEntries: (entries: FileTreeEntry[]) => void
  toggleExpanded: (path: string) => void
  setFilterText: (text: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  handleFileChange: (event: FileChangeEvent) => void
}

export const useFileTreeStore = create<FileTreeState>((set, get) => ({
  rootPath: null,
  entries: [],
  expandedPaths: new Set<string>(),
  filterText: '',
  isLoading: false,
  error: null,

  setRootPath: (path) => set({ rootPath: path }),

  setEntries: (entries) => set({ entries, isLoading: false, error: null }),

  toggleExpanded: (path) =>
    set((state) => {
      const next = new Set(state.expandedPaths)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedPaths: next }
    }),

  setFilterText: (text) => set({ filterText: text }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  handleFileChange: (_event) => {
    // Re-fetch tree on file changes - delegated to the hook
    const rootPath = get().rootPath
    if (rootPath) {
      // The hook will handle the actual refetch
    }
  },
}))
