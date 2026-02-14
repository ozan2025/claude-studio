// ═══════════════════════════════════════════
// FILE SYSTEM
// ═══════════════════════════════════════════

export interface FileTreeEntry {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  children?: FileTreeEntry[]
}

export interface FileReadResult {
  content: string
  path: string
  size: number
  lastModified: number
}

export interface FileSaveResult {
  success: boolean
  path: string
  error?: string
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
  relativePath: string
}

// ═══════════════════════════════════════════
// EDITOR
// ═══════════════════════════════════════════

export interface EditorTab {
  id: string
  filePath: string
  fileName: string
  language: string
  isDirty: boolean
  isPreview: boolean
  scrollTop?: number
  scrollLeft?: number
  cursorLine?: number
  cursorCol?: number
}

// ═══════════════════════════════════════════
// CLAUDE CODE — Agent SDK message types
// These map SDK messages (AsyncGenerator from sdk.query())
// to our internal format. SDKPartialAssistantMessage.event
// uses BetaRawMessageStreamEvent deltas, so our streaming
// processing logic stays identical.
// ═══════════════════════════════════════════

export type ClaudeStreamEvent =
  | ClaudeSystemInitEvent
  | ClaudeSystemStatusEvent
  | ClaudeSystemCompactBoundaryEvent
  | ClaudeAssistantEvent
  | ClaudeUserEvent
  | ClaudeStreamingEvent
  | ClaudeResultEvent

// Keep backwards-compatible alias
export type ClaudeSystemEvent = ClaudeSystemInitEvent

export interface ClaudeSystemInitEvent {
  type: 'system'
  subtype: 'init'
  session_id: string
  model: string
  claude_code_version: string
  cwd: string
  tools: string[]
  mcp_servers: Array<{ name: string; status: string }>
  permissionMode?: string
  uuid: string
}

export interface ClaudeSystemStatusEvent {
  type: 'system'
  subtype: 'status'
  status: 'compacting' | null
  session_id: string
  uuid: string
}

export interface ClaudeSystemCompactBoundaryEvent {
  type: 'system'
  subtype: 'compact_boundary'
  compact_metadata: { trigger: 'manual' | 'auto'; pre_tokens: number }
  session_id: string
  uuid: string
}

export interface ClaudeAssistantEvent {
  type: 'assistant'
  message: ClaudeAssistantMessage
  session_id: string
  parent_tool_use_id: string | null
  uuid: string
}

export interface ClaudeAssistantMessage {
  id: string
  model: string
  role: 'assistant'
  content: ClaudeContentBlock[]
  stop_reason: string | null
  usage: ClaudeUsage
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }

export interface ClaudeUserEvent {
  type: 'user'
  message: { role: 'user'; content: ClaudeUserContentBlock[] }
  session_id: string
  parent_tool_use_id: string | null
  tool_use_result?: string
  uuid: string
}

export type ClaudeUserContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_result'; content: string; is_error: boolean; tool_use_id: string }

export interface ClaudeStreamingEvent {
  type: 'stream_event'
  event: StreamEventPayload
  session_id: string
  parent_tool_use_id: string | null
  uuid: string
}

export type StreamEventPayload =
  | { type: 'message_start'; message: Partial<ClaudeAssistantMessage> }
  | { type: 'content_block_start'; index: number; content_block: ClaudeContentBlock }
  | { type: 'content_block_delta'; index: number; delta: ContentBlockDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string | null }; usage: ClaudeUsage }
  | { type: 'message_stop' }

export type ContentBlockDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'input_json_delta'; partial_json: string }

export interface ClaudeResultEvent {
  type: 'result'
  subtype:
    | 'success'
    | 'error'
    | 'error_during_execution'
    | 'error_max_turns'
    | 'error_max_budget_usd'
  is_error: boolean
  duration_ms: number
  num_turns: number
  result?: string
  errors?: string[]
  session_id: string
  total_cost_usd: number
  usage: ClaudeUsage
  modelUsage?: Record<string, ModelUsageInfo>
  permission_denials?: Array<{
    tool_name: string
    tool_use_id: string
    tool_input: Record<string, unknown>
  }>
  uuid: string
}

export interface ClaudeUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export interface ModelUsageInfo {
  inputTokens: number
  outputTokens: number
  contextWindow: number
  maxOutputTokens: number
}

// ═══════════════════════════════════════════
// SDK PERMISSION REQUEST (main → renderer)
// ═══════════════════════════════════════════

export interface PermissionRequestEvent {
  sessionId: string
  toolName: string
  toolUseId: string
  input: Record<string, unknown>
  suggestions?: Array<{
    type: string
    rules?: Array<{ type: string; pattern?: string }>
    behavior?: string
    destination?: string
    mode?: string
  }>
  reason?: string
}

// ═══════════════════════════════════════════
// UI-LEVEL TYPES
// ═══════════════════════════════════════════

export type ClaudeStatus =
  | 'idle'
  | 'thinking'
  | 'tool_executing'
  | 'waiting_for_user'
  | 'error'
  | 'disconnected'

export interface ConversationMessage {
  id: string
  role: 'assistant' | 'user' | 'system' | 'error'
  timestamp: number
  contentBlocks: ConversationContentBlock[]
  isStreaming: boolean
}

export type ConversationContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use'
      toolUseId: string
      toolName: string
      input: Record<string, unknown>
      result?: string
      isError?: boolean
      status: 'pending' | 'running' | 'complete' | 'error'
    }
  | {
      type: 'permission_request'
      toolUseId: string
      toolName: string
      input: Record<string, unknown>
      suggestions?: PermissionRequestEvent['suggestions']
      reason?: string
      status: 'pending' | 'accepted' | 'rejected'
    }
  | { type: 'error'; message: string; code?: string }

// ═══════════════════════════════════════════
// SESSION (Session 2+)
// ═══════════════════════════════════════════

export interface SessionInfo {
  id: string
  projectPath: string
  name: string
  createdAt: number
  lastActiveAt: number
  firstMessagePreview: string
  messageCount: number
  status: ClaudeStatus
  model: string
  costUsd: number
  claudeSessionId: string | null
  origin?: 'studio' | 'external'
}

export interface PersistedSession {
  version: 1
  info: SessionInfo
  conversation: ConversationMessage[]
  autoApprovalRules: AutoApprovalRule[]
  contextWindowMax?: number
  lastInputTokens?: number
}

export interface SessionIndex {
  version: 1
  projectPath: string
  lastActiveSessionId: string | null
  sessions: SessionInfo[]
}

export interface PersistedEditorState {
  version: 1
  projectPath: string
  openTabs: EditorTab[]
  activeTabPath: string | null
}

// ═══════════════════════════════════════════
// PERMISSIONS (Session 2+)
// ═══════════════════════════════════════════

export type PermissionType = 'tool' | 'edit' | 'multiple_choice' | 'yes_no' | 'free_text'

export interface PendingPrompt {
  id: string
  sessionId: string
  type: PermissionType
  timestamp: number
  resolved: boolean
  toolName?: string
  toolInput?: Record<string, unknown>
  description?: string
  editFiles?: { filePath: string; oldContent?: string; newContent?: string }[]
  questions?: { question: string; options: { label: string; description: string }[] }[]
  question?: string
}

export interface AutoApprovalRule {
  toolName: string
  sessionId: string
  createdAt: number
}
