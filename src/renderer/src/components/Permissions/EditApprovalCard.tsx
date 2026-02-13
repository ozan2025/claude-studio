import { useState, useCallback } from 'react'

interface EditFile {
  filePath: string
  oldContent?: string
  newContent?: string
}

interface EditApprovalCardProps {
  files: EditFile[]
  onAcceptAll: (autoApprove: boolean) => void
  onRejectAll: () => void
  onReviewEach: () => void
}

export default function EditApprovalCard({
  files,
  onAcceptAll,
  onRejectAll,
  onReviewEach,
}: EditApprovalCardProps) {
  const [autoApprove, setAutoApprove] = useState(false)

  const handleAcceptAll = useCallback(() => {
    onAcceptAll(autoApprove)
  }, [onAcceptAll, autoApprove])

  return (
    <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 my-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-blue-700 text-sm font-medium">Edit Approval</span>
      </div>

      <div className="text-xs text-gray-600 mb-2">
        {files.length} file{files.length !== 1 ? 's' : ''} to be edited:
      </div>

      <div className="space-y-1 mb-2 max-h-24 overflow-y-auto">
        {files.map((f) => (
          <div
            key={f.filePath}
            className="text-xs font-mono text-gray-700 bg-white/70 rounded px-2 py-1 border border-blue-200"
          >
            {f.filePath}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleAcceptAll}
            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={onRejectAll}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Reject All
          </button>
          <button
            onClick={onReviewEach}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
          >
            Review Each
          </button>
        </div>

        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="rounded border-gray-300"
          />
          Auto-accept edits this session
        </label>
      </div>
    </div>
  )
}
