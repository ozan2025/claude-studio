import { useCallback } from 'react'
import { useClaudeCodeStore } from '@renderer/store/claudeCodeStore'
import SessionTab from './SessionTab'

interface SessionTabBarProps {
  onNewSession: () => void
  onShowHistory: () => void
}

export default function SessionTabBar({ onNewSession, onShowHistory }: SessionTabBarProps) {
  const sessions = useClaudeCodeStore((s) => s.sessions)
  const activeSessionId = useClaudeCodeStore((s) => s.activeSessionId)
  const sessionOrder = useClaudeCodeStore((s) => s.sessionOrder)
  const setActiveSession = useClaudeCodeStore((s) => s.setActiveSession)
  const removeSession = useClaudeCodeStore((s) => s.removeSession)

  const handleClose = useCallback(
    (id: string) => {
      window.api.killSession(id)
      removeSession(id)
    },
    [removeSession],
  )

  return (
    <div className="flex items-center border-b border-gray-200 bg-gray-50 flex-shrink-0">
      <div className="flex overflow-x-auto flex-1">
        {sessionOrder.map((id) => {
          const session = sessions.get(id)
          if (!session) return null
          const label = `Session ${sessionOrder.indexOf(id) + 1}`
          return (
            <SessionTab
              key={id}
              id={id}
              label={label}
              isActive={id === activeSessionId}
              status={session.status}
              origin={session.origin}
              onSelect={setActiveSession}
              onClose={handleClose}
            />
          )
        })}
      </div>

      <div className="flex items-center gap-1 px-2 flex-shrink-0">
        <button
          onClick={onNewSession}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500 text-sm"
          title="New session"
        >
          +
        </button>
        <button
          onClick={onShowHistory}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-500 text-xs"
          title="Session history"
        >
          ↻
        </button>
      </div>
    </div>
  )
}
