import { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import {
  useClaudeCodeStore,
  selectMessages,
  selectPendingPermission,
  selectShowPlanApproval,
} from '@renderer/store/claudeCodeStore'
import { useErrorStore } from '@renderer/store/errorStore'
import MessageBubble from './MessageBubble'
import PermissionCardWrapper from '../Permissions/PermissionCardWrapper'
import ErrorCard from '../ErrorBanner/ErrorCard'
import PlanApprovalCard from '../Permissions/PlanApprovalCard'
import { useIntersectionVisible } from '../Permissions/StickyPromptBar'

interface ConversationViewProps {
  onAcceptPermission: () => void
  onAcceptPermissionWithInput?: (updatedInput: Record<string, unknown>) => void
  onRejectPermission: () => void
  onAllowToolForSession: () => void
  onPermissionVisibilityChange?: (visible: boolean) => void
  onRestartSession?: () => void
  onExecutePlanAutoAccept?: () => void
  onExecutePlanManual?: () => void
  onExecutePlanClearContext?: () => void
  onRevisePlan?: () => void
  sessionId: string | null
}

export default function ConversationView({
  onAcceptPermission,
  onAcceptPermissionWithInput,
  onRejectPermission,
  onAllowToolForSession,
  onPermissionVisibilityChange,
  onRestartSession,
  onExecutePlanAutoAccept,
  onExecutePlanManual,
  onExecutePlanClearContext,
  onRevisePlan,
  sessionId,
}: ConversationViewProps) {
  const messages = useClaudeCodeStore(selectMessages)
  const pendingPermission = useClaudeCodeStore(selectPendingPermission)
  const showPlanApproval = useClaudeCodeStore(selectShowPlanApproval)
  const allErrors = useErrorStore((s) => s.errors)
  const dismissError = useErrorStore((s) => s.dismissError)
  const sessionErrors = useMemo(
    () => allErrors.filter((e) => e.sessionId === sessionId && !e.dismissed),
    [allErrors, sessionId],
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const permissionCardRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef(true)
  const isProgrammaticScroll = useRef(false)

  const isPermissionVisible = useIntersectionVisible(permissionCardRef)

  // Notify parent about permission card visibility
  useEffect(() => {
    onPermissionVisibilityChange?.(isPermissionVisible || !pendingPermission)
  }, [isPermissionVisible, pendingPermission, onPermissionVisibilityChange])

  // Auto-scroll to bottom on new content
  useLayoutEffect(() => {
    if (isAutoScrolling.current && scrollRef.current) {
      isProgrammaticScroll.current = true
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      requestAnimationFrame(() => {
        isProgrammaticScroll.current = false
      })
    }
  }, [messages, sessionErrors])

  const handleScroll = useCallback(() => {
    if (isProgrammaticScroll.current) return
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    isAutoScrolling.current = scrollHeight - scrollTop - clientHeight < 100
  }, [])

  const handleRespond = useCallback(
    (response: string) => {
      if (!sessionId) return

      // AskUserQuestion: response is JSON with answers — inject into updatedInput
      if (response.startsWith('{"__askUserAnswers"')) {
        try {
          const parsed = JSON.parse(response) as { answers: Record<string, string> }
          if (onAcceptPermissionWithInput && pendingPermission) {
            onAcceptPermissionWithInput({ ...pendingPermission.input, answers: parsed.answers })
            return
          }
        } catch {
          // Fall through to normal accept
        }
      }

      if (response === 'no') {
        onRejectPermission()
      } else if (response === 'allow_session') {
        onAllowToolForSession()
      } else {
        onAcceptPermission()
      }
    },
    [
      sessionId,
      pendingPermission,
      onAcceptPermission,
      onAcceptPermissionWithInput,
      onRejectPermission,
      onAllowToolForSession,
    ],
  )

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto py-2" onScroll={handleScroll}>
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          <div className="text-center">
            <div className="text-4xl mb-3">🤖</div>
            <div>Start a conversation with Claude</div>
            <div className="text-xs text-gray-300 mt-1">Type a message below to begin</div>
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {pendingPermission && sessionId && (
        <div ref={permissionCardRef} className="px-3">
          <PermissionCardWrapper
            toolName={pendingPermission.toolName}
            toolUseId={pendingPermission.toolUseId}
            input={pendingPermission.input}
            sessionId={sessionId}
            onRespond={handleRespond}
          />
        </div>
      )}

      {showPlanApproval &&
        onExecutePlanAutoAccept &&
        onExecutePlanManual &&
        onExecutePlanClearContext &&
        onRevisePlan && (
          <div className="px-3">
            <PlanApprovalCard
              onExecuteAutoAccept={onExecutePlanAutoAccept}
              onExecuteManual={onExecutePlanManual}
              onExecuteClearContext={onExecutePlanClearContext}
              onRevise={onRevisePlan}
            />
          </div>
        )}

      {sessionErrors.map((err) => (
        <div key={err.id} className="px-3">
          <ErrorCard
            error={err}
            onDismiss={() => dismissError(err.id)}
            onRestart={onRestartSession}
          />
        </div>
      ))}
    </div>
  )
}
