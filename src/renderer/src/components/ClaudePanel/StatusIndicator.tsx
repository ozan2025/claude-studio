import type { ClaudeStatus } from '@shared/types'

interface StatusIndicatorProps {
  status: ClaudeStatus
  model: string | null
  totalCost: number
  permissionMode?: string
}

const STATUS_CONFIG: Record<ClaudeStatus, { label: string; color: string; pulse?: boolean }> = {
  idle: { label: 'Ready', color: 'bg-green-500' },
  thinking: { label: 'Thinking...', color: 'bg-yellow-500', pulse: true },
  tool_executing: { label: 'Running tool...', color: 'bg-blue-500', pulse: true },
  waiting_for_user: { label: 'Waiting for input', color: 'bg-orange-500' },
  error: { label: 'Error', color: 'bg-red-500' },
  disconnected: { label: 'Not connected', color: 'bg-gray-400' },
}

const MODE_LABELS: Record<string, string> = {
  acceptEdits: 'Auto-edit',
  plan: 'Plan',
}

export default function StatusIndicator({ status, model, permissionMode }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status]
  const modeLabel = permissionMode ? MODE_LABELS[permissionMode] : null

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}
        />
        <span className="text-gray-600">{config.label}</span>
        {modeLabel && (
          <span className="px-1.5 py-0.5 text-[9px] font-medium bg-purple-100 text-purple-700 rounded">
            {modeLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-gray-400">{model && <span>{model}</span>}</div>
    </div>
  )
}
