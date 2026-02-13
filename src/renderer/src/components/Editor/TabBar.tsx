import { useEditorStore } from '@renderer/store/editorStore'
import Tab from './Tab'

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore()

  if (tabs.length === 0) return null

  return (
    <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50 flex-shrink-0">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={setActiveTab}
          onClose={closeTab}
        />
      ))}
    </div>
  )
}
