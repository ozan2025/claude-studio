import { useCallback } from 'react'
import type { FileTreeEntry } from '@shared/types'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useEditorStore } from '@renderer/store/editorStore'
import { getFileIcon } from './fileIcons'

interface FileTreeNodeProps {
  entry: FileTreeEntry
  depth: number
}

export default function FileTreeNode({ entry, depth }: FileTreeNodeProps) {
  const { expandedPaths, toggleExpanded, filterText } = useFileTreeStore()
  const { openFile, promotePreview, activeTabId } = useEditorStore()
  const isExpanded = expandedPaths.has(entry.path)
  const isActive = activeTabId === entry.path

  const handleClick = useCallback(async () => {
    if (entry.isDirectory) {
      toggleExpanded(entry.path)
    } else {
      // Single click = preview
      try {
        const result = await window.api.readFile(entry.path)
        openFile(entry.path, result.content, true)
      } catch {
        // Ignore read errors for binary files etc
      }
    }
  }, [entry, toggleExpanded, openFile])

  const handleDoubleClick = useCallback(async () => {
    if (entry.isDirectory) return
    // Double click = promote from preview to permanent
    try {
      const result = await window.api.readFile(entry.path)
      openFile(entry.path, result.content, false)
      promotePreview(entry.path)
    } catch {
      // Ignore
    }
  }, [entry, openFile, promotePreview])

  // Filter check
  if (filterText) {
    const matchesSelf = entry.name.toLowerCase().includes(filterText.toLowerCase())
    const hasMatchingChildren =
      entry.isDirectory && entry.children?.some((c) => matchesFilter(c, filterText))
    if (!matchesSelf && !hasMatchingChildren) return null
  }

  const icon = getFileIcon(entry.name, entry.isDirectory)
  const chevron = entry.isDirectory ? (isExpanded ? '▾' : '▸') : ' '

  return (
    <div>
      <div
        className={`flex items-center py-0.5 px-1 cursor-pointer hover:bg-gray-100 text-xs select-none ${
          isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
        }`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <span className="w-4 text-center text-gray-400 flex-shrink-0">{chevron}</span>
        <span className="mr-1 flex-shrink-0 text-[11px]">{icon}</span>
        <span className="truncate">{entry.name}</span>
      </div>

      {entry.isDirectory && isExpanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <FileTreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function matchesFilter(entry: FileTreeEntry, filter: string): boolean {
  const lower = filter.toLowerCase()
  if (entry.name.toLowerCase().includes(lower)) return true
  if (entry.isDirectory && entry.children) {
    return entry.children.some((c) => matchesFilter(c, lower))
  }
  return false
}
