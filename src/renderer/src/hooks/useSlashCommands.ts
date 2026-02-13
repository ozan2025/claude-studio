import { useState, useCallback, useMemo, useEffect } from 'react'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'

export interface SlashCommand {
  command: string
  label: string
  description: string
  source: string
}

interface SlashCommandState {
  visible: boolean
  query: string
  selectedIndex: number
}

export function useSlashCommands() {
  const rootPath = useFileTreeStore((s) => s.rootPath)
  const [commands, setCommands] = useState<SlashCommand[]>([])
  const [state, setState] = useState<SlashCommandState>({
    visible: false,
    query: '',
    selectedIndex: 0,
  })

  // Fetch full command list from main process on mount and when project changes
  useEffect(() => {
    if (!rootPath) return
    window.api
      .listCommands(rootPath)
      .then(setCommands)
      .catch(() => {})
  }, [rootPath])

  const filtered = useMemo(
    () => commands.filter((cmd) => cmd.command.toLowerCase().includes(state.query.toLowerCase())),
    [commands, state.query],
  )

  const checkForSlash = useCallback((text: string, cursorPos: number) => {
    const beforeCursor = text.slice(0, cursorPos)

    // Only trigger if "/" is at the start of the input
    if (!beforeCursor.startsWith('/')) {
      setState((s) => (s.visible ? { ...s, visible: false } : s))
      return
    }

    const query = beforeCursor
    // Don't show if there's a space (user finished typing the command)
    if (query.includes(' ')) {
      setState((s) => (s.visible ? { ...s, visible: false } : s))
      return
    }

    setState({
      visible: true,
      query,
      selectedIndex: 0,
    })
  }, [])

  const moveSelection = useCallback(
    (direction: 'up' | 'down') => {
      const max = Math.max(filtered.length - 1, 0)
      setState((s) => ({
        ...s,
        selectedIndex:
          direction === 'down'
            ? Math.min(s.selectedIndex + 1, max)
            : Math.max(s.selectedIndex - 1, 0),
      }))
    },
    [filtered.length],
  )

  const getSelectedCommand = useCallback((): SlashCommand | null => {
    return filtered[state.selectedIndex] ?? null
  }, [filtered, state.selectedIndex])

  const close = useCallback(() => {
    setState((s) => (s.visible ? { ...s, visible: false } : s))
  }, [])

  // Refresh command list (call when you want to re-scan)
  const refresh = useCallback(() => {
    if (!rootPath) return
    window.api
      .listCommands(rootPath)
      .then(setCommands)
      .catch(() => {})
  }, [rootPath])

  return {
    ...state,
    filtered,
    checkForSlash,
    moveSelection,
    getSelectedCommand,
    close,
    refresh,
  }
}
