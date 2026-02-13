import { useCallback } from 'react'
import type { EditorTab } from '@shared/types'

interface TabProps {
  tab: EditorTab
  isActive: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

export default function Tab({ tab, isActive, onSelect, onClose }: TabProps) {
  const handleClick = useCallback(() => onSelect(tab.id), [tab.id, onSelect])

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose(tab.id)
    },
    [tab.id, onClose],
  )

  const handleMiddleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
        onClose(tab.id)
      }
    },
    [tab.id, onClose],
  )

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-200 select-none flex-shrink-0 ${
        isActive
          ? 'bg-white text-gray-900 border-b-2 border-b-blue-500'
          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
      }`}
      onClick={handleClick}
      onMouseDown={handleMiddleClick}
    >
      <span className={tab.isPreview ? 'italic' : ''}>{tab.fileName}</span>
      {tab.isDirty && <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />}
      <button
        className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-300 text-gray-400 hover:text-gray-700"
        onClick={handleClose}
      >
        ×
      </button>
    </div>
  )
}
