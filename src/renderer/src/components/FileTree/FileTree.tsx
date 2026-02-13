import { useCallback } from 'react'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useFileTree } from '@renderer/hooks/useFileTree'
import FileTreeFilter from './FileTreeFilter'
import FileTreeNode from './FileTreeNode'

export default function FileTree() {
  useFileTree()
  const { entries, isLoading, error, rootPath, setRootPath, setEntries, setLoading } =
    useFileTreeStore()

  const projectName = rootPath?.split('/').pop() ?? 'Project'

  const handleOpenFolder = useCallback(async () => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setRootPath(folder)
      setLoading(true)
      const newEntries = await window.api.readDir(folder)
      setEntries(newEntries)
    }
  }, [setRootPath, setEntries, setLoading])

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">
          {projectName}
        </span>
        <button
          onClick={handleOpenFolder}
          className="text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
          title="Open folder (Cmd+O)"
        >
          Open
        </button>
      </div>

      <FileTreeFilter />

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {isLoading && entries.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
        )}

        {error && <div className="px-3 py-2 text-xs text-red-500">{error}</div>}

        {entries.map((entry) => (
          <FileTreeNode key={entry.path} entry={entry} depth={0} />
        ))}

        {!isLoading && !error && entries.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">No files found</div>
        )}
      </div>
    </div>
  )
}
