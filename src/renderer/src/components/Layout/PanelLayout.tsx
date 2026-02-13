import { useState, useCallback, type ReactNode } from 'react'
import ResizeHandle from './ResizeHandle'
import {
  PANEL_MIN_WIDTH,
  PANEL_DEFAULT_FILE_TREE_WIDTH,
  PANEL_DEFAULT_EDITOR_WIDTH,
} from '@shared/constants'

interface PanelLayoutProps {
  fileTree: ReactNode
  editor: ReactNode
  claudePanel: ReactNode
}

export default function PanelLayout({ fileTree, editor, claudePanel }: PanelLayoutProps) {
  const [fileTreeWidth, setFileTreeWidth] = useState(PANEL_DEFAULT_FILE_TREE_WIDTH)
  const [editorWidth, setEditorWidth] = useState(PANEL_DEFAULT_EDITOR_WIDTH)

  const handleLeftResize = useCallback((delta: number) => {
    setFileTreeWidth((prev) => {
      const next = prev + delta
      if (next < PANEL_MIN_WIDTH) return PANEL_MIN_WIDTH
      return next
    })
  }, [])

  const handleRightResize = useCallback((delta: number) => {
    setEditorWidth((prev) => {
      const next = prev + delta
      if (next < PANEL_MIN_WIDTH) return PANEL_MIN_WIDTH
      return next
    })
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      {fileTree && (
        <>
          <div className="flex-shrink-0 h-full overflow-hidden" style={{ width: fileTreeWidth }}>
            {fileTree}
          </div>
          <ResizeHandle onResize={handleLeftResize} />
        </>
      )}

      <div className="flex-shrink-0 h-full overflow-hidden" style={{ width: editorWidth }}>
        {editor}
      </div>

      <ResizeHandle onResize={handleRightResize} />

      <div className="flex-1 min-w-[200px] overflow-hidden">{claudePanel}</div>
    </div>
  )
}
