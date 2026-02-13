import { useDiffStore, type DiffEntry } from '@renderer/store/diffStore'

export default function DiffFileList() {
  const { pendingDiffs, activeDiffPath, setActiveDiff } = useDiffStore()

  const unresolvedDiffs = pendingDiffs.filter((d) => d.accepted === null)
  if (unresolvedDiffs.length === 0) return null

  return (
    <div className="border-b border-gray-200 bg-gray-50 max-h-24 overflow-y-auto">
      {pendingDiffs.map((diff) => (
        <DiffFileItem
          key={diff.filePath}
          diff={diff}
          isActive={diff.filePath === activeDiffPath}
          onSelect={() => setActiveDiff(diff.filePath)}
        />
      ))}
    </div>
  )
}

function DiffFileItem({
  diff,
  isActive,
  onSelect,
}: {
  diff: DiffEntry
  isActive: boolean
  onSelect: () => void
}) {
  const fileName = diff.filePath.split('/').pop() ?? diff.filePath
  const statusColor =
    diff.accepted === true
      ? 'text-green-600'
      : diff.accepted === false
        ? 'text-red-600'
        : 'text-blue-600'

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 text-xs cursor-pointer hover:bg-gray-100 ${
        isActive ? 'bg-blue-50 border-l-2 border-blue-500' : ''
      }`}
      onClick={onSelect}
    >
      <span className={`font-medium ${statusColor}`}>
        {diff.accepted === true ? '✓' : diff.accepted === false ? '✗' : 'M'}
      </span>
      <span className="font-mono text-gray-700 truncate">{fileName}</span>
    </div>
  )
}
