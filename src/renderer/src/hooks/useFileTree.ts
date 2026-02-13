import { useEffect, useCallback, useRef } from 'react'
import { useFileTreeStore } from '@renderer/store/fileTreeStore'

export function useFileTree() {
  const { rootPath, setRootPath, setEntries, setLoading, setError } = useFileTreeStore()
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadTree = useCallback(
    async (dirPath: string) => {
      setLoading(true)
      try {
        const entries = await window.api.readDir(dirPath)
        setEntries(entries)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file tree')
      }
    },
    [setEntries, setLoading, setError],
  )

  // Initial load
  useEffect(() => {
    async function init() {
      const root = await window.api.getProjectRoot()
      setRootPath(root)
      loadTree(root)
    }
    init()
  }, [setRootPath, loadTree])

  // File change listener - debounced refetch
  useEffect(() => {
    if (!rootPath) return

    const unsub = window.api.onFileChanged(() => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        loadTree(rootPath)
      }, 300)
    })

    return () => {
      unsub()
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [rootPath, loadTree])

  return { loadTree }
}
