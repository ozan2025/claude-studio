import { useCallback } from 'react'
import type { ClaudeStatus } from '@shared/types'

interface SessionTabProps {
  id: string
  label: string
  isActive: boolean
  status: ClaudeStatus
  origin: 'studio' | 'external'
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

const STATUS_COLORS: Record<ClaudeStatus, string> = {
  idle: 'bg-green-500',
  thinking: 'bg-yellow-500',
  tool_executing: 'bg-blue-500',
  waiting_for_user: 'bg-orange-500',
  error: 'bg-red-500',
  disconnected: 'bg-gray-400',
}

export default function SessionTab({
  id,
  label,
  isActive,
  status,
  origin,
  onSelect,
  onClose,
}: SessionTabProps) {
  const handleClick = useCallback(() => onSelect(id), [id, onSelect])
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose(id)
    },
    [id, onClose],
  )

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-200 select-none flex-shrink-0 ${
        isActive
          ? 'bg-white text-gray-900 border-b-2 border-b-blue-500'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-50'
      }`}
      onClick={handleClick}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[status]} ${
          status === 'thinking' || status === 'tool_executing' ? 'animate-pulse' : ''
        }`}
      />
      <span className="truncate max-w-[120px]">{label}</span>
      {origin === 'external' && (
        <span className="text-[8px] font-medium text-amber-600 flex-shrink-0">CLI</span>
      )}
      <button
        className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-300 text-gray-400 hover:text-gray-700"
        onClick={handleClose}
      >
        ×
      </button>
    </div>
  )
}
