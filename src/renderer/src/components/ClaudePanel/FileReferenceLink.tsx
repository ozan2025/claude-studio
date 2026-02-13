import { useCallback } from 'react'
import { useEditorStore } from '@renderer/store/editorStore'

interface FileReferenceLinkProps {
  path: string
  line?: number
  children: React.ReactNode
}

export default function FileReferenceLink({ path, line, children }: FileReferenceLinkProps) {
  const { openFile } = useEditorStore()

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      try {
        const result = await window.api.readFile(path)
        openFile(path, result.content, false)
      } catch {
        // Try with project root prefix
        const root = await window.api.getProjectRoot()
        try {
          const fullPath = `${root}/${path}`
          const result = await window.api.readFile(fullPath)
          openFile(fullPath, result.content, false)
        } catch {
          // File not found
        }
      }
    },
    [path, openFile],
  )

  return (
    <button
      onClick={handleClick}
      className="text-blue-600 hover:text-blue-800 hover:underline font-mono cursor-pointer bg-transparent border-none p-0 text-inherit"
      title={line ? `${path}:${line}` : path}
    >
      {children}
    </button>
  )
}
