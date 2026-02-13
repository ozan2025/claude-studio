import { useMemo } from 'react'
import { computeLineDiff, getDiffStats } from '@renderer/utils/diffComputer'

interface UnifiedDiffViewProps {
  filePath: string
  oldContent: string
  newContent: string
}

export default function UnifiedDiffView({
  filePath,
  oldContent,
  newContent,
}: UnifiedDiffViewProps) {
  const diffs = useMemo(() => computeLineDiff(oldContent, newContent), [oldContent, newContent])
  const stats = useMemo(() => getDiffStats(diffs), [diffs])
  const fileName = filePath.split('/').pop() ?? filePath

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-gray-700 truncate">{fileName}</span>
          <span className="text-[10px] text-gray-400 truncate hidden sm:inline">{filePath}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] flex-shrink-0">
          <span className="text-green-600 font-medium">+{stats.added}</span>
          <span className="text-red-600 font-medium">-{stats.removed}</span>
        </div>
      </div>

      {/* Diff lines */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5">
        {diffs.map((line, idx) => {
          const bgClass =
            line.type === 'added' ? 'bg-green-50' : line.type === 'removed' ? 'bg-red-50' : ''
          const textClass =
            line.type === 'added'
              ? 'text-green-800'
              : line.type === 'removed'
                ? 'text-red-800'
                : 'text-gray-700'
          const gutterClass =
            line.type === 'added'
              ? 'bg-green-100 text-green-600'
              : line.type === 'removed'
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-50 text-gray-400'
          const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '

          return (
            <div key={idx} className={`flex ${bgClass}`}>
              <div className={`w-10 text-right px-1 select-none flex-shrink-0 ${gutterClass}`}>
                {line.oldLineNumber ?? ''}
              </div>
              <div className={`w-10 text-right px-1 select-none flex-shrink-0 ${gutterClass}`}>
                {line.type !== 'removed' ? line.lineNumber : ''}
              </div>
              <div className={`px-2 whitespace-pre ${textClass} flex-1`}>
                <span className="select-none opacity-60">{prefix}</span>
                {line.value}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
