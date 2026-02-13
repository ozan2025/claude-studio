import { useState, useCallback, useMemo } from 'react'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import type { FileTreeEntry } from '@shared/types'

interface AutocompleteState {
  visible: boolean
  query: string
  selectedIndex: number
  position: { top: number; left: number }
}

function flattenEntries(entries: FileTreeEntry[]): string[] {
  const result: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory) {
      result.push(entry.relativePath)
    }
    if (entry.children) {
      result.push(...flattenEntries(entry.children))
    }
  }
  return result
}

export function useFileAutocomplete() {
  const entries = useFileTreeStore((s) => s.entries)
  const allFiles = useMemo(() => flattenEntries(entries), [entries])

  const [state, setState] = useState<AutocompleteState>({
    visible: false,
    query: '',
    selectedIndex: 0,
    position: { top: 0, left: 0 },
  })

  const handleInputChange = useCallback(
    (text: string, cursorPos: number, textareaRect?: DOMRect) => {
      // Check if we have an @ before cursor
      const beforeCursor = text.slice(0, cursorPos)
      const atIdx = beforeCursor.lastIndexOf('@')

      if (
        atIdx === -1 ||
        (atIdx > 0 && beforeCursor[atIdx - 1] !== ' ' && beforeCursor[atIdx - 1] !== '\n')
      ) {
        setState((s) => ({ ...s, visible: false }))
        return
      }

      const query = beforeCursor.slice(atIdx + 1)
      // Don't show if there's a space after @
      if (query.includes(' ') || query.includes('\n')) {
        setState((s) => ({ ...s, visible: false }))
        return
      }

      setState({
        visible: true,
        query,
        selectedIndex: 0,
        position: {
          top: textareaRect ? textareaRect.height + 4 : 40,
          left: textareaRect ? Math.min(atIdx * 7.5, textareaRect.width - 250) : 0,
        },
      })
    },
    [],
  )

  const moveSelection = useCallback(
    (direction: 'up' | 'down') => {
      const filtered = allFiles.filter((f) => f.toLowerCase().includes(state.query.toLowerCase()))
      const max = Math.min(filtered.length, 10) - 1
      setState((s) => ({
        ...s,
        selectedIndex:
          direction === 'down'
            ? Math.min(s.selectedIndex + 1, max)
            : Math.max(s.selectedIndex - 1, 0),
      }))
    },
    [allFiles, state.query],
  )

  const getSelectedFile = useCallback((): string | null => {
    const filtered = allFiles
      .filter((f) => f.toLowerCase().includes(state.query.toLowerCase()))
      .slice(0, 10)
    return filtered[state.selectedIndex] ?? null
  }, [allFiles, state.query, state.selectedIndex])

  const close = useCallback(() => {
    setState((s) => ({ ...s, visible: false }))
  }, [])

  return {
    ...state,
    allFiles,
    handleInputChange,
    moveSelection,
    getSelectedFile,
    close,
  }
}
