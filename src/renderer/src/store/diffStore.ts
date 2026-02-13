import { create } from 'zustand'

export interface DiffEntry {
  filePath: string
  oldContent: string
  newContent: string
  sessionId: string
  timestamp: number
  accepted: boolean | null
}

interface DiffStoreState {
  pendingDiffs: DiffEntry[]
  activeDiffPath: string | null

  addDiff: (diff: DiffEntry) => void
  acceptDiff: (filePath: string) => void
  rejectDiff: (filePath: string) => void
  acceptAll: () => void
  rejectAll: () => void
  setActiveDiff: (filePath: string | null) => void
  clearDiffs: () => void
}

export const useDiffStore = create<DiffStoreState>((set, get) => ({
  pendingDiffs: [],
  activeDiffPath: null,

  addDiff: (diff) =>
    set((state) => {
      // Replace existing diff for same file
      const filtered = state.pendingDiffs.filter((d) => d.filePath !== diff.filePath)
      return {
        pendingDiffs: [...filtered, diff],
        activeDiffPath: diff.filePath,
      }
    }),

  acceptDiff: (filePath) =>
    set((state) => ({
      pendingDiffs: state.pendingDiffs.map((d) =>
        d.filePath === filePath ? { ...d, accepted: true } : d,
      ),
    })),

  rejectDiff: (filePath) => {
    const diff = get().pendingDiffs.find((d) => d.filePath === filePath)
    if (diff) {
      // Write back old content
      window.api.saveFile(filePath, diff.oldContent)
    }
    set((state) => ({
      pendingDiffs: state.pendingDiffs.map((d) =>
        d.filePath === filePath ? { ...d, accepted: false } : d,
      ),
    }))
  },

  acceptAll: () =>
    set((state) => ({
      pendingDiffs: state.pendingDiffs.map((d) =>
        d.accepted === null ? { ...d, accepted: true } : d,
      ),
    })),

  rejectAll: () => {
    const diffs = get().pendingDiffs.filter((d) => d.accepted === null)
    for (const diff of diffs) {
      window.api.saveFile(diff.filePath, diff.oldContent)
    }
    set((state) => ({
      pendingDiffs: state.pendingDiffs.map((d) =>
        d.accepted === null ? { ...d, accepted: false } : d,
      ),
    }))
  },

  setActiveDiff: (filePath) => set({ activeDiffPath: filePath }),

  clearDiffs: () => set({ pendingDiffs: [], activeDiffPath: null }),
}))
