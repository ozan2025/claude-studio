import { readdirSync, readFileSync, statSync, createReadStream } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { createInterface } from 'readline'
import type { SessionInfo, ConversationMessage, ConversationContentBlock } from '@shared/types'

/** Claude Code hashes project paths by replacing all non-alphanumeric chars with '-' */
function projectPathToHash(projectPath: string): string {
  return projectPath.replace(/[^a-zA-Z0-9]/g, '-')
}

function externalSessionDir(projectPath: string): string {
  return join(homedir(), '.claude', 'projects', projectPathToHash(projectPath))
}

/** Scan a .jsonl file for { preview, hasConversation }.
 *  Returns the first user text (for preview) and whether any user/assistant lines exist. */
function scanSessionFile(filePath: string): Promise<{ preview: string; hasConversation: boolean }> {
  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: 'utf-8' })
    const rl = createInterface({ input: stream, crlfDelay: Infinity })
    let preview = ''
    let hasConversation = false

    rl.on('line', (line) => {
      try {
        const obj = JSON.parse(line)
        const type = obj.type as string

        // Any user or assistant line means this is a real session
        if (type === 'user' || type === 'assistant') {
          hasConversation = true
        }

        // Extract first user text for preview (only if we haven't found one yet)
        if (!preview && type === 'user') {
          const msg = obj.message
          if (msg && typeof msg === 'object') {
            const content = msg.content
            if (typeof content === 'string') {
              preview = content.slice(0, 200)
            } else if (Array.isArray(content)) {
              for (const block of content) {
                if (block?.type === 'text' && typeof block.text === 'string') {
                  preview = block.text.slice(0, 200)
                  break
                }
              }
            }
          }
        }

        // Once we have both, stop early
        if (preview && hasConversation) {
          rl.close()
          stream.destroy()
        }
      } catch {
        // malformed line, skip
      }
    })

    rl.on('close', () => resolve({ preview, hasConversation }))
    stream.on('error', () => resolve({ preview: '', hasConversation: false }))
  })
}

// ─────────────────────────────────────────
// Session Index — list all external sessions
// ─────────────────────────────────────────

export async function loadExternalSessionIndex(projectPath: string): Promise<SessionInfo[]> {
  try {
    const dir = externalSessionDir(projectPath)

    let files: string[]
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    } catch {
      return []
    }

    const results: SessionInfo[] = []

    for (const file of files) {
      const sessionId = file.replace('.jsonl', '')
      const filePath = join(dir, file)

      try {
        const stat = statSync(filePath)
        const { preview, hasConversation } = await scanSessionFile(filePath)

        // Skip ghost sessions (only file-history-snapshot, no user/assistant lines)
        if (!hasConversation) continue

        results.push({
          id: sessionId,
          projectPath,
          name: '',
          createdAt: stat.birthtimeMs,
          lastActiveAt: stat.mtimeMs,
          firstMessagePreview: preview,
          messageCount: 0,
          status: 'disconnected',
          model: '',
          costUsd: 0,
          claudeSessionId: sessionId,
          origin: 'external',
        })
      } catch {
        // Skip files we can't read
      }
    }

    return results.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
  } catch {
    return []
  }
}

// ─────────────────────────────────────────
// Session Parser — parse .jsonl into ConversationMessages
// ─────────────────────────────────────────

/** Normalize tool_result content (string | {type,text} | Array<{type,text}>) to string */
function normalizeToolResult(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) =>
        typeof c === 'object' && c && 'text' in c ? (c as { text: string }).text : String(c),
      )
      .join('\n')
  }
  if (typeof content === 'object' && content && 'text' in content) {
    return (content as { text: string }).text
  }
  return String(content ?? '')
}

export interface ParsedExternalSession {
  messages: ConversationMessage[]
  uuids: string[]
  model: string
}

export function parseExternalSession(
  projectPath: string,
  sessionId: string,
): ParsedExternalSession | null {
  try {
    const filePath = join(externalSessionDir(projectPath), `${sessionId}.jsonl`)
    const raw = readFileSync(filePath, 'utf-8')
    const lines = raw.split('\n').filter((l) => l.trim().length > 0)

    const messages: ConversationMessage[] = []
    const uuids: string[] = []
    let msgCounter = 0
    let model = ''

    // Map toolUseId → { messageIndex, blockIndex } for filling in tool_results
    const toolUseMap = new Map<string, { msgIdx: number; blockIdx: number }>()

    for (const line of lines) {
      let obj: Record<string, unknown>
      try {
        obj = JSON.parse(line)
      } catch {
        continue
      }

      const type = obj.type as string
      const uuid = obj.uuid as string | undefined
      if (uuid) uuids.push(uuid)

      if (type === 'user') {
        const msg = obj.message as { role: string; content: unknown } | undefined
        if (!msg) continue

        const content = msg.content
        const ts = obj.timestamp ? new Date(obj.timestamp as string).getTime() : Date.now()

        if (typeof content === 'string') {
          // Regular user text message
          messages.push({
            id: `ext_msg_${++msgCounter}`,
            role: 'user',
            timestamp: ts,
            contentBlocks: [{ type: 'text', text: content }],
            isStreaming: false,
          })
        } else if (Array.isArray(content)) {
          // Tool results — update matching tool_use blocks
          for (const block of content) {
            if (block?.type === 'tool_result' && block.tool_use_id) {
              const loc = toolUseMap.get(block.tool_use_id)
              if (loc) {
                const targetMsg = messages[loc.msgIdx]
                const targetBlock = targetMsg.contentBlocks[loc.blockIdx]
                if (targetBlock.type === 'tool_use') {
                  targetMsg.contentBlocks[loc.blockIdx] = {
                    ...targetBlock,
                    result: normalizeToolResult(block.content),
                    isError: block.is_error === true,
                    status: block.is_error ? 'error' : 'complete',
                  }
                }
              }
            }
          }
        }
      } else if (type === 'assistant') {
        const msg = obj.message as
          | {
              role: string
              model?: string
              content: Array<Record<string, unknown>>
            }
          | undefined
        if (!msg?.content) continue

        if (msg.model && !model) model = msg.model

        const ts = obj.timestamp ? new Date(obj.timestamp as string).getTime() : Date.now()

        const contentBlocks: ConversationContentBlock[] = []
        const msgIdx = messages.length

        for (const block of msg.content) {
          if (block.type === 'text' && typeof block.text === 'string') {
            contentBlocks.push({ type: 'text', text: block.text })
          } else if (block.type === 'tool_use') {
            const blockIdx = contentBlocks.length
            contentBlocks.push({
              type: 'tool_use',
              toolUseId: block.id as string,
              toolName: block.name as string,
              input: (block.input as Record<string, unknown>) ?? {},
              status: 'pending',
            })
            toolUseMap.set(block.id as string, { msgIdx, blockIdx })
          }
        }

        if (contentBlocks.length > 0) {
          messages.push({
            id: `ext_msg_${++msgCounter}`,
            role: 'assistant',
            timestamp: ts,
            contentBlocks,
            isStreaming: false,
          })
        }
      }
      // Skip: progress, file-history-snapshot, result, system, etc.
    }

    // Mark any remaining pending tool_uses as complete (no result = truncated/interrupted)
    for (const [, loc] of toolUseMap) {
      const block = messages[loc.msgIdx]?.contentBlocks[loc.blockIdx]
      if (block?.type === 'tool_use' && block.status === 'pending') {
        messages[loc.msgIdx].contentBlocks[loc.blockIdx] = {
          ...block,
          status: 'complete',
          result: block.result ?? '',
        }
      }
    }

    return { messages, uuids, model }
  } catch (err) {
    console.error('[external-sessions] parse error:', err)
    return null
  }
}
