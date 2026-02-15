import { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import {
  useClaudeCodeStore,
  selectMessages,
  selectPendingPermissions,
  selectShowPlanApproval,
} from '@renderer/store/claudeCodeStore'
import { useErrorStore } from '@renderer/store/errorStore'
import MessageBubble from './MessageBubble'
import PermissionCardWrapper from '../Permissions/PermissionCardWrapper'
import ErrorCard from '../ErrorBanner/ErrorCard'
import PlanApprovalCard from '../Permissions/PlanApprovalCard'
import { useIntersectionVisible } from '../Permissions/StickyPromptBar'

interface ConversationViewProps {
  onAcceptPermission: (toolUseId: string) => void
  onAcceptPermissionWithInput?: (toolUseId: string, updatedInput: Record<string, unknown>) => void
  onRejectPermission: (toolUseId: string) => void
  onAllowToolForSession: (toolUseId: string, toolName: string) => void
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
  const pendingPermissions = useClaudeCodeStore(selectPendingPermissions)
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
    onPermissionVisibilityChange?.(isPermissionVisible || pendingPermissions.length === 0)
  }, [isPermissionVisible, pendingPermissions, onPermissionVisibilityChange])

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

  const makeHandleRespond = useCallback(
    (perm: { toolUseId: string; toolName: string; input: Record<string, unknown> }) =>
      (response: string) => {
        if (!sessionId) return

        // AskUserQuestion: response is JSON with answers — inject into updatedInput
        if (response.startsWith('{"__askUserAnswers"')) {
          try {
            const parsed = JSON.parse(response) as { answers: Record<string, string> }
            if (onAcceptPermissionWithInput) {
              onAcceptPermissionWithInput(perm.toolUseId, {
                ...perm.input,
                answers: parsed.answers,
              })
              return
            }
          } catch {
            // Fall through to normal accept
          }
        }

        if (response === 'no') {
          onRejectPermission(perm.toolUseId)
        } else if (response === 'allow_session') {
          onAllowToolForSession(perm.toolUseId, perm.toolName)
        } else {
          onAcceptPermission(perm.toolUseId)
        }
      },
    [
      sessionId,
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

      {pendingPermissions.length > 0 &&
        sessionId &&
        pendingPermissions.map((perm, idx) => (
          <div
            key={perm.toolUseId}
            ref={idx === pendingPermissions.length - 1 ? permissionCardRef : undefined}
            className="px-3"
          >
            <PermissionCardWrapper
              toolName={perm.toolName}
              toolUseId={perm.toolUseId}
              input={perm.input}
              sessionId={sessionId}
              onRespond={makeHandleRespond(perm)}
            />
          </div>
        ))}

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
