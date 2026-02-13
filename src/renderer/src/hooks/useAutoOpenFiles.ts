import { useEffect } from 'react'
import { useEditorStore } from '@renderer/store/editorStore'

export function useAutoOpenFiles() {
  const { openFile } = useEditorStore()

  useEffect(() => {
    // Listen for file change events and auto-open changed files
    const unsub = window.api.onFileChanged(async (event) => {
      if (event.type === 'change' || event.type === 'add') {
        const tabs = useEditorStore.getState().tabs
        const existingTab = tabs.find((t) => t.filePath === event.path)
        if (existingTab) {
          // Refresh content for already-open tab
          try {
            const result = await window.api.readFile(event.path)
            useEditorStore.getState().setFileContent(event.path, result.content)
          } catch {
            // File may have been deleted
          }
        } else {
          // Auto-open new/changed files as preview tabs
          try {
            const result = await window.api.readFile(event.path)
            useEditorStore.getState().openFile(event.path, result.content, false)
          } catch {
            // File may have been deleted before we could read it
          }
        }
      }
    })

    return unsub
  }, [openFile])
}
