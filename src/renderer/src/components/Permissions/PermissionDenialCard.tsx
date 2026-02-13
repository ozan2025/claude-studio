import type { PermissionDenial } from '@renderer/store/permissionStore'

interface PermissionDenialCardProps {
  denial: PermissionDenial
  onAllow: (toolName: string) => void
  onDeny: (toolUseId: string) => void
}

export default function PermissionDenialCard({
  denial,
  onAllow,
  onDeny,
}: PermissionDenialCardProps) {
  const toolDisplay =
    denial.toolName === 'Bash'
      ? `Bash: ${(denial.input as Record<string, unknown>).command ?? 'command'}`
      : `${denial.toolName}: ${(denial.input as Record<string, unknown>).file_path ?? (denial.input as Record<string, unknown>).filePath ?? ''}`

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 my-2 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="font-semibold text-amber-800">Permission Required</span>
      </div>

      <div className="text-amber-700 mb-2 font-mono text-[11px] bg-white/60 rounded px-2 py-1.5 break-all">
        {toolDisplay}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAllow(denial.toolName)}
          className="px-2.5 py-1 text-[11px] font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
        >
          Allow {denial.toolName} for session
        </button>
        <button
          onClick={() => onDeny(denial.toolUseId)}
          className="px-2.5 py-1 text-[11px] font-medium text-amber-700 bg-white hover:bg-amber-100 border border-amber-300 rounded transition-colors"
        >
          Deny
        </button>
      </div>
    </div>
  )
}
