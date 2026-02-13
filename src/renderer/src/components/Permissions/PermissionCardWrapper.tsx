import { useCallback } from 'react'
import ToolPermissionCard from './ToolPermissionCard'
import EditApprovalCard from './EditApprovalCard'
import MultipleChoiceCard from './MultipleChoiceCard'
import YesNoCard from './YesNoCard'
import FreeTextCard from './FreeTextCard'
import AskUserQuestionCard from './AskUserQuestionCard'

interface PermissionCardWrapperProps {
  toolName: string
  toolUseId: string
  input: Record<string, unknown>
  sessionId: string
  onRespond: (response: string) => void
}

export default function PermissionCardWrapper({
  toolName,
  toolUseId,
  input,
  sessionId,
  onRespond,
}: PermissionCardWrapperProps) {
  const handleToolAccept = useCallback(
    (autoApprove: boolean) => {
      onRespond(autoApprove ? 'allow_session' : 'yes')
    },
    [onRespond],
  )

  const handleToolReject = useCallback(() => {
    onRespond('no')
  }, [onRespond])

  const handleEditAcceptAll = useCallback(
    (_autoApprove: boolean) => {
      onRespond('yes')
    },
    [onRespond],
  )

  const handleEditRejectAll = useCallback(() => {
    onRespond('no')
  }, [onRespond])

  const handleSelect = useCallback(
    (value: string) => {
      onRespond(value)
    },
    [onRespond],
  )

  // AskUserQuestion — render interactive question card
  if (toolName === 'AskUserQuestion' && Array.isArray(input.questions)) {
    return (
      <AskUserQuestionCard
        questions={
          input.questions as Array<{
            question: string
            header: string
            options: Array<{ label: string; description: string }>
            multiSelect: boolean
          }>
        }
        onSubmit={(answers) => onRespond(JSON.stringify({ __askUserAnswers: true, answers }))}
      />
    )
  }

  // Determine card type based on tool name and input
  if (isEditTool(toolName)) {
    const files = Array.isArray(input.files)
      ? (input.files as { filePath: string }[])
      : input.file_path
        ? [{ filePath: input.file_path as string }]
        : []
    return (
      <EditApprovalCard
        files={files}
        onAcceptAll={handleEditAcceptAll}
        onRejectAll={handleEditRejectAll}
        onReviewEach={() => onRespond('review')}
      />
    )
  }

  if (isMultipleChoice(input)) {
    const options = (input.options as { label: string; description: string }[]) ?? []
    return (
      <MultipleChoiceCard
        question={(input.question as string) ?? `${toolName} requires your choice`}
        options={options}
        onSelect={handleSelect}
      />
    )
  }

  if (isYesNo(input)) {
    return (
      <YesNoCard
        question={(input.question as string) ?? `Allow ${toolName}?`}
        onYes={() => handleSelect('yes')}
        onNo={() => handleSelect('no')}
      />
    )
  }

  if (isFreeText(input)) {
    return (
      <FreeTextCard
        question={(input.question as string) ?? `${toolName} needs your input`}
        onSubmit={handleSelect}
      />
    )
  }

  // Default: tool permission card
  return (
    <ToolPermissionCard
      toolName={toolName}
      input={input}
      onAccept={handleToolAccept}
      onReject={handleToolReject}
    />
  )
}

function isEditTool(toolName: string): boolean {
  return ['Edit', 'Write', 'NotebookEdit'].includes(toolName)
}

function isMultipleChoice(input: Record<string, unknown>): boolean {
  return Array.isArray(input.options) && (input.options as unknown[]).length > 0
}

function isYesNo(input: Record<string, unknown>): boolean {
  return input.type === 'yes_no' || input.yesNo === true
}

function isFreeText(input: Record<string, unknown>): boolean {
  return input.type === 'free_text' || input.freeText === true
}
