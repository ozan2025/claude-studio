import { useDiffStore } from '@renderer/store/diffStore'

export default function DiffToolbar() {
  const { pendingDiffs, activeDiffPath, acceptDiff, rejectDiff, acceptAll, rejectAll } =
    useDiffStore()

  const unresolvedDiffs = pendingDiffs.filter((d) => d.accepted === null)
  if (unresolvedDiffs.length === 0) return null

  const activeDiff = pendingDiffs.find((d) => d.filePath === activeDiffPath)

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50 border-b border-blue-200 text-xs flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-blue-600 font-medium">
          {unresolvedDiffs.length} file{unresolvedDiffs.length !== 1 ? 's' : ''} changed
        </span>
        {activeDiff && (
          <span className="text-gray-500 font-mono truncate max-w-[200px]">
            {activeDiff.filePath.split('/').pop()}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {activeDiff && activeDiff.accepted === null && (
          <>
            <button
              onClick={() => acceptDiff(activeDiff.filePath)}
              className="px-2 py-0.5 text-[10px] font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => rejectDiff(activeDiff.filePath)}
              className="px-2 py-0.5 text-[10px] font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              Reject
            </button>
          </>
        )}

        {unresolvedDiffs.length > 1 && (
          <>
            <div className="w-px h-4 bg-blue-300 mx-1" />
            <button
              onClick={acceptAll}
              className="px-2 py-0.5 text-[10px] font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={rejectAll}
              className="px-2 py-0.5 text-[10px] font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
            >
              Reject All
            </button>
          </>
        )}
      </div>
    </div>
  )
}
