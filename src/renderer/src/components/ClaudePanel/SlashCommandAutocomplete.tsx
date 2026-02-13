import type { SlashCommand } from '@renderer/hooks/useSlashCommands'

interface SlashCommandAutocompleteProps {
  commands: SlashCommand[]
  visible: boolean
  selectedIndex: number
  onSelect: (command: string) => void
  onClose: () => void
}

const SOURCE_BADGE: Record<string, string> = {
  builtin: 'text-gray-400',
  user: 'text-purple-500',
  project: 'text-green-600',
}

export default function SlashCommandAutocomplete({
  commands,
  visible,
  selectedIndex,
  onSelect,
  onClose,
}: SlashCommandAutocompleteProps) {
  if (!visible || commands.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 mb-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-[300px] overflow-y-auto">
      <div className="py-1">
        {commands.map((cmd, idx) => (
          <div
            key={cmd.command}
            className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${
              idx === selectedIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
            }`}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(cmd.command)
              onClose()
            }}
          >
            <span className="font-mono text-xs font-medium flex-shrink-0">{cmd.label}</span>
            <span className="text-xs text-gray-400 truncate flex-1">{cmd.description}</span>
            {cmd.source !== 'builtin' && (
              <span className={`text-[9px] flex-shrink-0 ${SOURCE_BADGE[cmd.source] ?? ''}`}>
                {cmd.source}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
