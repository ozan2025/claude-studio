import { useEffect } from 'react'

interface Shortcut {
  key: string
  meta?: boolean
  shift?: boolean
  action: () => void
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        if (e.key.toLowerCase() === shortcut.key.toLowerCase() && metaMatch && shiftMatch) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [shortcuts])
}
