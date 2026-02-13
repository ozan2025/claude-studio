import type { ConversationContentBlock } from '@shared/types'

type ToolUseBlockData = Extract<ConversationContentBlock, { type: 'tool_use' }>

interface ToolUseBlockProps {
  block: ToolUseBlockData
}

const STATUS_STYLES = {
  pending: 'border-gray-300 bg-gray-50',
  running: 'border-blue-300 bg-blue-50',
  complete: 'border-green-300 bg-green-50',
  error: 'border-red-300 bg-red-50',
}

const STATUS_LABELS = {
  pending: 'Pending',
  running: 'Running...',
  complete: 'Complete',
  error: 'Error',
}

export default function ToolUseBlock({ block }: ToolUseBlockProps) {
  const inputPreview = formatInput(block.input)

  return (
    <div className={`rounded border p-2 my-1 text-xs ${STATUS_STYLES[block.status]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-gray-700">{block.toolName}</span>
        <span className="text-gray-500">{STATUS_LABELS[block.status]}</span>
      </div>

      {inputPreview && (
        <div className="text-gray-600 bg-white/60 rounded px-2 py-1 font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
          {inputPreview}
        </div>
      )}

      {block.result && (
        <div
          className={`mt-1 px-2 py-1 rounded font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto text-[11px] ${
            block.isError ? 'bg-red-100 text-red-700' : 'bg-white/60 text-gray-600'
          }`}
        >
          {block.result}
        </div>
      )}
    </div>
  )
}

function formatInput(input: Record<string, unknown>): string {
  if (!input || Object.keys(input).length === 0) return ''

  // Show command for Bash tool
  if (input.command && typeof input.command === 'string') {
    return input.command
  }

  // Show file_path for file-related tools
  if (input.file_path && typeof input.file_path === 'string') {
    return input.file_path as string
  }

  // Generic: show first key=value pair
  const entries = Object.entries(input)
  if (entries.length === 1) {
    const [, value] = entries[0]
    if (typeof value === 'string') return value.slice(0, 200)
  }

  return JSON.stringify(input, null, 2).slice(0, 200)
}
