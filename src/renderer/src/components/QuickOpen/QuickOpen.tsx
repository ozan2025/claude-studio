import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'
import { useEditorStore } from '@renderer/store/editorStore'
import { useUiStore } from '@renderer/store/uiStore'
import { fuzzySearch } from '@renderer/utils/fuzzySearch'
import HighlightedPath from './HighlightedPath'
import type { FileTreeEntry } from '@shared/types'

function flattenEntries(entries: FileTreeEntry[]): string[] {
  const result: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory) {
      result.push(entry.relativePath)
    }
    if (entry.children) {
      result.push(...flattenEntries(entry.children))
    }
  }
  return result
}

export default function QuickOpen() {
  const { quickOpenVisible, setQuickOpenVisible } = useUiStore()
  const entries = useFileTreeStore((s) => s.entries)
  const { openFile } = useEditorStore()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const allFiles = useMemo(() => flattenEntries(entries), [entries])
  const results = useMemo(() => fuzzySearch(query, allFiles).slice(0, 15), [query, allFiles])

  useEffect(() => {
    if (quickOpenVisible) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [quickOpenVisible])

  const handleSelect = useCallback(
    async (path: string) => {
      setQuickOpenVisible(false)
      const root = await window.api.getProjectRoot()
      const fullPath = `${root}/${path}`
      try {
        const result = await window.api.readFile(fullPath)
        openFile(fullPath, result.content, false)
      } catch {
        // File may not exist
      }
    },
    [openFile, setQuickOpenVisible],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setQuickOpenVisible(false)
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex].path)
          }
          break
      }
    },
    [results, selectedIndex, handleSelect, setQuickOpenVisible],
  )

  if (!quickOpenVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={() => setQuickOpenVisible(false)} />

      {/* Modal */}
      <div className="relative w-[500px] max-w-[90vw] bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search files by name..."
          className="w-full px-4 py-3 text-sm border-b border-gray-200 focus:outline-none"
        />

        <div className="max-h-[300px] overflow-y-auto">
          {results.length === 0 && query && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">No files found</div>
          )}

          {results.map((result, idx) => {
            const fileName = result.path.split('/').pop() ?? result.path
            return (
              <div
                key={result.path}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${
                  idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSelect(result.path)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="text-sm font-medium text-gray-800 truncate">{fileName}</span>
                <HighlightedPath path={result.path} matches={result.matches} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
