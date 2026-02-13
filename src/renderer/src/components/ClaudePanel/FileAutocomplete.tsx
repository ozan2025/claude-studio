import { useCallback, useEffect, useRef } from 'react'

interface FileAutocompleteProps {
  query: string
  files: string[]
  visible: boolean
  position: { top: number; left: number }
  selectedIndex: number
  onSelect: (filePath: string) => void
  onClose: () => void
}

export default function FileAutocomplete({
  query,
  files,
  visible,
  position,
  selectedIndex,
  onSelect,
  onClose,
}: FileAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // Filter files based on query
  const filtered = files.filter((f) => f.toLowerCase().includes(query.toLowerCase())).slice(0, 10)

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const item = listRef.current.children[selectedIndex] as HTMLElement
      if (item) {
        item.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  if (!visible || filtered.length === 0) return null

  return (
    <div
      className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
      style={{ bottom: position.top, left: position.left, minWidth: 250, maxWidth: 400 }}
      ref={listRef}
    >
      {filtered.map((file, idx) => {
        const fileName = file.split('/').pop() ?? file
        const dirPath = file.split('/').slice(0, -1).join('/')
        return (
          <div
            key={file}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${
              idx === selectedIndex
                ? 'bg-blue-100 text-blue-800'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(file)
            }}
          >
            <span className="font-medium truncate">{fileName}</span>
            {dirPath && <span className="text-gray-400 truncate text-[10px]">{dirPath}/</span>}
          </div>
        )
      })}
    </div>
  )
}
