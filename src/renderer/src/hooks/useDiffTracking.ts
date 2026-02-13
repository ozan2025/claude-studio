import { useEffect, useRef } from 'react'
import { useClaudeCodeStore, selectMessages } from '@renderer/store/claudeCodeStore'
import { useDiffStore } from '@renderer/store/diffStore'

const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'edit', 'write', 'multi_edit'])

export function useDiffTracking() {
  const messages = useClaudeCodeStore(selectMessages)
  const activeSessionId = useClaudeCodeStore((s) => s.activeSessionId)
  // Track snapshots of file content before edits
  const snapshotsRef = useRef<Map<string, string>>(new Map())
  // Track which tool_use IDs we've already processed
  const processedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!activeSessionId) return

    for (const msg of messages) {
      for (const block of msg.contentBlocks) {
        if (block.type !== 'tool_use') continue
        if (!EDIT_TOOL_NAMES.has(block.toolName)) continue

        const toolId = block.toolUseId
        const input = block.input as Record<string, unknown>
        const filePath = (input.file_path as string) || (input.filePath as string)
        if (!filePath) continue

        // When tool is pending, snapshot the old content
        if (block.status === 'pending' || block.status === 'running') {
          if (!snapshotsRef.current.has(toolId)) {
            snapshotsRef.current.set(toolId, '')
            window.api
              .readFile(filePath)
              .then((result) => {
                snapshotsRef.current.set(toolId, result.content)
              })
              .catch(() => {
                // File doesn't exist yet (Write creates new files)
                snapshotsRef.current.set(toolId, '')
              })
          }
        }

        // When tool completes, read new content and create diff
        if (block.status === 'complete' && !processedRef.current.has(toolId)) {
          processedRef.current.add(toolId)
          const oldContent = snapshotsRef.current.get(toolId) ?? ''
          window.api
            .readFile(filePath)
            .then((result) => {
              if (result.content !== oldContent) {
                useDiffStore.getState().addDiff({
                  filePath,
                  oldContent,
                  newContent: result.content,
                  sessionId: activeSessionId,
                  timestamp: Date.now(),
                  accepted: true, // Auto-accept: permission was already granted via SDK
                })
              }
            })
            .catch(() => {
              // File might have been deleted
            })
        }
      }
    }
  }, [messages, activeSessionId])
}
