import { useMemo } from 'react'
import type { ConversationMessage } from '@shared/types'
import ToolUseBlock from './ToolUseBlock'
import CodeBlock from './CodeBlock'
import FileReferenceLink from './FileReferenceLink'
import CopyButton from '../common/CopyButton'
import { parseFileReferences } from '@renderer/utils/filePathParser'

interface MessageBubbleProps {
  message: ConversationMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isError = message.role === 'error'

  const fullText = message.contentBlocks
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  return (
    <div className={`px-3 py-1.5 ${isUser ? 'flex justify-end' : ''} group`}>
      <div
        className={`max-w-[95%] relative ${
          isUser
            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-3 py-2'
            : isError
              ? 'bg-red-50 border border-red-200 rounded-lg px-3 py-2'
              : isSystem
                ? 'text-gray-400 text-xs italic py-1'
                : 'text-gray-800'
        }`}
      >
        {/* Copy button for assistant messages */}
        {!isUser && !isSystem && fullText && (
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={fullText} />
          </div>
        )}

        {message.contentBlocks.map((block, idx) => {
          if (block.type === 'text') {
            return <RichText key={idx} text={block.text} isUser={isUser} />
          }

          if (block.type === 'tool_use') {
            // Hide ExitPlanMode — PlanApprovalCard replaces its function
            if (block.toolName === 'ExitPlanMode') return null
            return <ToolUseBlock key={block.toolUseId} block={block} />
          }

          if (block.type === 'error') {
            return (
              <div key={idx} className="text-sm text-red-600">
                {block.message}
              </div>
            )
          }

          return null
        })}

        {message.isStreaming && (
          <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  )
}

function RichText({ text, isUser }: { text: string; isUser: boolean }) {
  const parts = useMemo(() => {
    if (isUser) return [{ type: 'text' as const, content: text }]
    return parseTextIntoParts(text)
  }, [text, isUser])

  return (
    <div className={`text-sm whitespace-pre-wrap break-words ${isUser ? '' : 'leading-relaxed'}`}>
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          return <CodeBlock key={idx} code={part.content} language={part.language} />
        }
        if (part.type === 'file_ref') {
          return (
            <FileReferenceLink key={idx} path={part.path} line={part.line}>
              {part.content}
            </FileReferenceLink>
          )
        }
        return <span key={idx}>{part.content}</span>
      })}
    </div>
  )
}

type TextPart =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string; language?: string }
  | { type: 'file_ref'; content: string; path: string; line?: number }

function parseTextIntoParts(text: string): TextPart[] {
  const parts: TextPart[] = []

  // Split on code blocks first
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIdx = 0

  for (const match of text.matchAll(codeBlockRegex)) {
    if (match.index! > lastIdx) {
      const textBefore = text.slice(lastIdx, match.index!)
      parts.push(...parseFileRefs(textBefore))
    }
    parts.push({ type: 'code', content: match[2], language: match[1] || undefined })
    lastIdx = match.index! + match[0].length
  }

  if (lastIdx < text.length) {
    parts.push(...parseFileRefs(text.slice(lastIdx)))
  }

  return parts
}

function parseFileRefs(text: string): TextPart[] {
  const refs = parseFileReferences(text)
  if (refs.length === 0) return [{ type: 'text', content: text }]

  const parts: TextPart[] = []
  let lastIdx = 0

  for (const ref of refs) {
    if (ref.start > lastIdx) {
      parts.push({ type: 'text', content: text.slice(lastIdx, ref.start) })
    }
    parts.push({
      type: 'file_ref',
      content: text.slice(ref.start, ref.end),
      path: ref.path,
      line: ref.line,
    })
    lastIdx = ref.end
  }

  if (lastIdx < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIdx) })
  }

  return parts
}
