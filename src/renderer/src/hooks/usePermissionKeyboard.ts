import { useEffect } from 'react'

interface UsePermissionKeyboardOptions {
  hasPending: boolean
  onAccept: () => void
  onReject: () => void
  onAutoApprove?: () => void
}

export function usePermissionKeyboard({
  hasPending,
  onAccept,
  onReject,
  onAutoApprove,
}: UsePermissionKeyboardOptions) {
  useEffect(() => {
    if (!hasPending) return

    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Only when claude panel area is focused (not in editor)
      const inEditor = target.closest('.cm-editor')
      if (inEditor) return

      switch (e.key.toLowerCase()) {
        case 'y':
          e.preventDefault()
          onAccept()
          break
        case 'n':
          e.preventDefault()
          onReject()
          break
        case 'a':
          if (onAutoApprove) {
            e.preventDefault()
            onAutoApprove()
          }
          break
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [hasPending, onAccept, onReject, onAutoApprove])
}
