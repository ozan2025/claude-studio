import type { ClaudeStudioError } from '@shared/errors'

interface ErrorCardProps {
  error: ClaudeStudioError
  onDismiss: () => void
  onRetry?: () => void
  onRestart?: () => void
}

const SEVERITY_STYLES = {
  info: 'border-blue-300 bg-blue-50 text-blue-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-800',
  error: 'border-red-300 bg-red-50 text-red-800',
  fatal: 'border-red-500 bg-red-100 text-red-900',
}

export default function ErrorCard({ error, onDismiss, onRetry, onRestart }: ErrorCardProps) {
  return (
    <div className={`rounded-lg border p-3 my-2 text-xs ${SEVERITY_STYLES[error.severity]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold capitalize">{error.source.replace('_', ' ')}</span>
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
          ×
        </button>
      </div>

      <div className="mb-2">{error.message}</div>

      {error.details && (
        <div className="text-[11px] opacity-75 font-mono bg-white/50 rounded px-2 py-1 mb-2 max-h-20 overflow-y-auto">
          {error.details}
        </div>
      )}

      <div className="flex gap-2">
        {error.retryable && onRetry && (
          <button
            onClick={onRetry}
            className="px-2 py-1 text-[11px] font-medium bg-white/70 rounded hover:bg-white transition-colors"
          >
            {error.retryAfterMs ? `Retry (${Math.ceil(error.retryAfterMs / 1000)}s)` : 'Retry Now'}
          </button>
        )}
        {error.source === 'process_crash' && onRestart && (
          <button
            onClick={onRestart}
            className="px-2 py-1 text-[11px] font-medium bg-white/70 rounded hover:bg-white transition-colors"
          >
            Restart Session
          </button>
        )}
      </div>
    </div>
  )
}
