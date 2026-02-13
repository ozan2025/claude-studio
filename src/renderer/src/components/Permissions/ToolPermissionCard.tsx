import { useState, useCallback } from 'react'

interface ToolPermissionCardProps {
  toolName: string
  input: Record<string, unknown>
  onAccept: (autoApprove: boolean) => void
  onReject: () => void
}

export default function ToolPermissionCard({
  toolName,
  input,
  onAccept,
  onReject,
}: ToolPermissionCardProps) {
  const [autoApprove, setAutoApprove] = useState(false)
  const description = getToolDescription(toolName, input)

  const handleAccept = useCallback(() => {
    onAccept(autoApprove)
  }, [onAccept, autoApprove])

  return (
    <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-3 my-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <span className="text-orange-700 text-sm font-medium">Permission Required</span>
      </div>

      <div className="text-xs text-gray-700 mb-1.5">
        <span className="font-semibold">{toolName}</span>
        {description && <span className="text-gray-500 ml-1">— {description}</span>}
      </div>

      {input.command && typeof input.command === 'string' && (
        <div className="bg-white/70 rounded px-2 py-1.5 font-mono text-xs text-gray-700 mb-2 whitespace-pre-wrap break-all max-h-32 overflow-y-auto border border-orange-200">
          {input.command}
        </div>
      )}

      {input.file_path && typeof input.file_path === 'string' && !input.command && (
        <div className="bg-white/70 rounded px-2 py-1.5 font-mono text-xs text-gray-600 mb-2 border border-orange-200">
          {input.file_path as string}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
          >
            Accept (Y)
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Reject (N)
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="rounded border-gray-300"
          />
          Allow all {toolName} this session (A)
        </label>
      </div>
    </div>
  )
}

function getToolDescription(toolName: string, input: Record<string, unknown>): string {
  if (input.description && typeof input.description === 'string') return input.description
  if (input.file_path && typeof input.file_path === 'string') return input.file_path as string
  return ''
}
