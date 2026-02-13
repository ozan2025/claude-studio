import { useCallback } from 'react'
import { useEditorStore } from '@renderer/store/editorStore'
import { useDiffStore } from '@renderer/store/diffStore'
import TabBar from './TabBar'
import CodeEditor from './CodeEditor'
import DiffFileList from '../DiffViewer/DiffFileList'
import UnifiedDiffView from '../DiffViewer/UnifiedDiffView'

export default function EditorPanel() {
  const { tabs, activeTabId, fileContents, updateTabContent } = useEditorStore()
  const activeDiffPath = useDiffStore((s) => s.activeDiffPath)
  const pendingDiffs = useDiffStore((s) => s.pendingDiffs)
  const activeDiff = activeDiffPath
    ? pendingDiffs.find((d) => d.filePath === activeDiffPath && d.accepted === null)
    : null

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const content = activeTab ? (fileContents.get(activeTab.filePath) ?? '') : ''

  const handleChange = useCallback(
    (value: string) => {
      if (activeTabId) {
        updateTabContent(activeTabId, value)
      }
    },
    [activeTabId, updateTabContent],
  )

  return (
    <div className="h-full flex flex-col bg-white">
      <TabBar />
      <DiffFileList />
      <div className="flex-1 overflow-hidden">
        {activeDiff ? (
          <UnifiedDiffView
            filePath={activeDiff.filePath}
            oldContent={activeDiff.oldContent}
            newContent={activeDiff.newContent}
          />
        ) : activeTab ? (
          <CodeEditor
            content={content}
            language={activeTab.language}
            filePath={activeTab.filePath}
            onChange={handleChange}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            <div className="text-center">
              <div className="text-3xl mb-2">📝</div>
              <div>Select a file to open</div>
              <div className="text-xs text-gray-300 mt-1">or use Cmd+P to search</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
