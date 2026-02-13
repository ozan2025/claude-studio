import { useRef, useEffect, useCallback } from 'react'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { FILE_TREE_FILTER_DEBOUNCE_MS } from '@shared/constants'

export default function FileTreeFilter() {
  const { filterText, setFilterText } = useFileTreeStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setFilterText(value)
      }, FILE_TREE_FILTER_DEBOUNCE_MS)
    },
    [setFilterText],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="px-2 py-1.5 border-b border-gray-200">
      <input
        ref={inputRef}
        type="text"
        placeholder="Filter files..."
        defaultValue={filterText}
        onChange={handleChange}
        className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-400 placeholder-gray-400"
      />
    </div>
  )
}
