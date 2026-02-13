import { useErrorStore } from '@renderer/store/errorStore'

export default function ErrorBanner() {
  const { fileSystemWarning, setFileSystemWarning } = useErrorStore()

  if (!fileSystemWarning) return null

  return (
    <div className="bg-amber-50 border-b border-amber-300 px-3 py-1.5 flex items-center justify-between text-xs flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-amber-600 font-medium">Warning</span>
        <span className="text-amber-700">{fileSystemWarning}</span>
      </div>
      <button
        onClick={() => setFileSystemWarning(null)}
        className="text-amber-500 hover:text-amber-700 font-medium"
      >
        Dismiss
      </button>
    </div>
  )
}
