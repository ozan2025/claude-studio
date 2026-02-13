import { useClaudeCodeStore, selectStatus } from '@renderer/store/claudeCodeStore'
import { useEditorStore } from '@renderer/store/editorStore'

export default function StatusBar() {
  const status = useClaudeCodeStore(selectStatus)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const tabs = useEditorStore((s) => s.tabs)
  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="h-6 bg-gray-100 border-t border-gray-200 flex items-center px-3 text-[11px] text-gray-500 flex-shrink-0">
      <div className="flex-1 truncate">{activeTab ? activeTab.filePath : 'No file open'}</div>
      <div className="flex items-center gap-3">
        {activeTab && <span>{activeTab.language}</span>}
        <span className="capitalize">{status}</span>
      </div>
    </div>
  )
}
