interface PermissionCardProps {
  toolName: string
  input: Record<string, unknown>
  onAccept: () => void
  onReject: () => void
}

export default function PermissionCard({
  toolName,
  input,
  onAccept,
  onReject,
}: PermissionCardProps) {
  const description = getPermissionDescription(toolName, input)

  return (
    <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-3 my-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-orange-600 text-sm font-medium">Permission Required</span>
      </div>

      <div className="text-xs text-gray-700 mb-2">
        <span className="font-medium">{toolName}</span>
        {description && <span className="text-gray-500"> — {description}</span>}
      </div>

      {input.command && typeof input.command === 'string' && (
        <div className="bg-white/70 rounded px-2 py-1.5 font-mono text-xs text-gray-700 mb-2 whitespace-pre-wrap break-all">
          {input.command}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onAccept}
          className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
        >
          Accept (Y)
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
        >
          Reject (N)
        </button>
      </div>
    </div>
  )
}

function getPermissionDescription(toolName: string, input: Record<string, unknown>): string {
  if (input.file_path && typeof input.file_path === 'string') {
    return input.file_path
  }
  if (input.description && typeof input.description === 'string') {
    return input.description
  }
  return ''
}
