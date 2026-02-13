import type { SessionInfo } from '@shared/types'

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

interface SessionHistoryProps {
  sessions: SessionInfo[]
  onResume: (sessionId: string) => void
  onResumeExternal: (sdkSessionId: string) => void
  onDelete: (sessionId: string) => void
  onClose: () => void
}

export default function SessionHistory({
  sessions,
  onResume,
  onResumeExternal,
  onDelete,
  onClose,
}: SessionHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-400">
        <div>No past sessions</div>
        <button onClick={onClose} className="mt-2 text-xs text-blue-500 hover:text-blue-700">
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="border-b border-gray-200 bg-gray-50 max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-500 uppercase">Session History</span>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">
          Close
        </button>
      </div>

      {sessions.map((session) => {
        const isExternal = session.origin === 'external'
        return (
          <div
            key={session.id}
            className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-700 truncate flex items-center gap-1.5">
                {session.firstMessagePreview || session.name || 'Untitled session'}
                {isExternal ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                    CLI/VS Code
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                    Studio
                  </span>
                )}
              </div>
              <div className="text-[10px] text-gray-400 flex gap-2">
                <span>{formatRelativeTime(session.lastActiveAt)}</span>
                {session.messageCount > 0 && <span>{session.messageCount} messages</span>}
                {session.costUsd > 0 && <span>${session.costUsd.toFixed(4)}</span>}
              </div>
            </div>

            <div className="flex gap-1 ml-2 flex-shrink-0">
              <button
                onClick={() =>
                  isExternal ? onResumeExternal(session.claudeSessionId!) : onResume(session.id)
                }
                className="px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                Resume
              </button>
              {!isExternal && (
                <button
                  onClick={() => onDelete(session.id)}
                  className="px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
