interface QuickActionBarProps {
  onNewSession: () => void
  onSendCommand: (command: string) => void
  disabled: boolean
}

const QUICK_ACTIONS = [
  { label: '/compact', command: '/compact', title: 'Compact conversation' },
  { label: '/clear', command: '/clear', title: 'Clear conversation' },
  { label: '/model', command: '/model', title: 'Switch model' },
  { label: '/cost', command: '/cost', title: 'Show cost' },
  { label: '/mode', command: '/mode', title: 'Switch permission mode' },
]

export default function QuickActionBar({
  onNewSession,
  onSendCommand,
  disabled,
}: QuickActionBarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-200 overflow-x-auto flex-shrink-0">
      <button
        onClick={onNewSession}
        className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors flex-shrink-0"
      >
        + New Session
      </button>

      <div className="w-px h-3 bg-gray-300 mx-1" />

      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.command}
          onClick={() => onSendCommand(action.command)}
          disabled={disabled}
          title={action.title}
          className="px-2 py-0.5 text-[10px] font-mono text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
