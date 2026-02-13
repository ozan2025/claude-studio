import { useMemo, useCallback } from 'react'
import PanelLayout from './components/Layout/PanelLayout'
import FileTree from './components/FileTree/FileTree'
import EditorPanel from './components/Editor/EditorPanel'
import ClaudePanel from './components/ClaudePanel/ClaudePanel'
import StatusBar from './components/StatusBar/StatusBar'
import ErrorBanner from './components/ErrorBanner/ErrorBanner'
import QuickOpen from './components/QuickOpen/QuickOpen'
import DiffToolbar from './components/DiffViewer/DiffToolbar'
import { useAutoOpenFiles } from './hooks/useAutoOpenFiles'
import { useDiffTracking } from './hooks/useDiffTracking'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useUiStore } from './store/uiStore'
import { useFileTreeStore } from './store/fileTreeStore'
import { useEditorStore } from './store/editorStore'
import { useClaudeCodeStore } from './store/claudeCodeStore'

export default function App() {
  useAutoOpenFiles()
  useDiffTracking()

  const { toggleFileTree, toggleClaudePanel, setQuickOpenVisible, fileTreeVisible } = useUiStore()
  const { rootPath, setRootPath, setEntries, setLoading } = useFileTreeStore()

  const handleOpenFolder = useCallback(async () => {
    const folder = await window.api.selectFolder()
    if (folder) {
      setRootPath(folder)
      setLoading(true)
      const entries = await window.api.readDir(folder)
      setEntries(entries)
    }
  }, [setRootPath, setEntries, setLoading])

  const handleCloseTab = useCallback(() => {
    const { activeTabId, closeTab } = useEditorStore.getState()
    if (activeTabId) closeTab(activeTabId)
  }, [])

  const handleNextSessionTab = useCallback(() => {
    const { sessionOrder, activeSessionId, setActiveSession } = useClaudeCodeStore.getState()
    if (sessionOrder.length < 2 || !activeSessionId) return
    const idx = sessionOrder.indexOf(activeSessionId)
    const nextIdx = (idx + 1) % sessionOrder.length
    setActiveSession(sessionOrder[nextIdx])
  }, [])

  const handlePrevSessionTab = useCallback(() => {
    const { sessionOrder, activeSessionId, setActiveSession } = useClaudeCodeStore.getState()
    if (sessionOrder.length < 2 || !activeSessionId) return
    const idx = sessionOrder.indexOf(activeSessionId)
    const prevIdx = (idx - 1 + sessionOrder.length) % sessionOrder.length
    setActiveSession(sessionOrder[prevIdx])
  }, [])

  const shortcuts = useMemo(
    () => [
      { key: 'b', meta: true, action: toggleFileTree },
      { key: 'l', meta: true, action: toggleClaudePanel },
      { key: 'p', meta: true, action: () => setQuickOpenVisible(true) },
      { key: 'o', meta: true, action: handleOpenFolder },
      { key: 'w', meta: true, action: handleCloseTab },
      { key: ']', meta: true, shift: true, action: handleNextSessionTab },
      { key: '[', meta: true, shift: true, action: handlePrevSessionTab },
    ],
    [
      toggleFileTree,
      toggleClaudePanel,
      setQuickOpenVisible,
      handleOpenFolder,
      handleCloseTab,
      handleNextSessionTab,
      handlePrevSessionTab,
    ],
  )

  useKeyboardShortcuts(shortcuts)

  const projectName = rootPath?.split('/').pop() ?? 'Claude Studio'

  return (
    <div className="h-screen flex flex-col">
      {/* Titlebar drag region */}
      <div className="titlebar-drag h-9 bg-gray-100 border-b border-gray-200 flex-shrink-0 flex items-center justify-center">
        <span className="titlebar-no-drag text-xs text-gray-500">{projectName}</span>
      </div>

      <ErrorBanner />
      <DiffToolbar />

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <PanelLayout
          fileTree={fileTreeVisible ? <FileTree /> : null}
          editor={<EditorPanel />}
          claudePanel={<ClaudePanel />}
        />
      </div>

      <StatusBar />
      <QuickOpen />
    </div>
  )
}
