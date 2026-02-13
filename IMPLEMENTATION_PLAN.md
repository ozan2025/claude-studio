# Claude Studio — Full MVP Implementation Plan

> **Context:** Claude Studio is a lightweight Electron + React desktop editor purpose-built for Claude Code. It replaces VS Code for developers who use Claude Code as their primary coding interface. The codebase is currently empty (only PRD.md and CLAUDE.md exist). This plan covers all 24 MVP features across 3 build sessions.
>
> **On approval:** Write this plan to `./IMPLEMENTATION_PLAN.md` in the project root before starting any code.

---

## Table of Contents

1. [Technical Stack & Constraints](#1-technical-stack--constraints)
2. [Project Structure](#2-project-structure)
3. [Shared Types (All Sessions)](#3-shared-types)
4. [IPC Channel Definitions](#4-ipc-channel-definitions)
5. [Zustand Store Shapes](#5-zustand-store-shapes)
6. [Stream-JSON Event → UI Mapping](#6-stream-json-event-mapping)
7. [Session 1: Core](#7-session-1-core)
8. [Session 2: Interaction & Sessions](#8-session-2-interaction--sessions)
9. [Session 3: Polish & Completeness](#9-session-3-polish--completeness)
10. [Session Continuity](#10-session-continuity)

---

## 1. Technical Stack & Constraints

| Package | Version | Notes |
|---|---|---|
| electron | 40.2.1 | Node 24, Chromium 144 |
| electron-vite | ^5.0.0 | Build tooling for main/preload/renderer |
| react + react-dom | 19.2.4 | `createRoot`, no UMD |
| typescript | 5.9.2 | `strict: true`, `skipLibCheck: true` |
| tailwindcss | 4.1.18 | Via `@tailwindcss/postcss` ONLY, NOT `@tailwindcss/vite` |
| @uiw/react-codemirror | 4.25.4 | CodeMirror 6 React wrapper |
| diff (jsdiff) | 8.0.3 | Own types, no `@types/diff` |
| chokidar | ^4.0.0 | NOT v5 (ESM-only breaks Electron CJS main) |
| zustand | 5.0.11 | Named imports only: `import { create } from 'zustand'` |
| electron-builder | 26.7.0 | Packaging .app |
| @vitejs/plugin-react | ^5.1.1 | JSX transform for renderer |
| ignore | ^7.0.0 | .gitignore parsing |

**Key constraints:**
- Tailwind via `@tailwindcss/postcss` in `postcss.config.cjs` (CommonJS), not the Vite plugin
- chokidar v4 (CJS-compatible) in main process, NOT v5 (ESM-only)
- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- Electron main process is CJS; renderer is ESM (bundled by Vite)
- Prettier: no semicolons, single quotes
- "Allow all for session" is UI-level auto-response, NOT `--dangerously-skip-permissions`

---

## 2. Project Structure

```
claude-studio/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── postcss.config.cjs
├── eslint.config.mjs
├── .prettierrc
├── .prettierignore
├── .gitignore
├── electron-builder.yml
├── bin/
│   └── claude-studio.js              # Session 3: CLI launcher
├── resources/
│   └── icon.png                      # App icon placeholder
├── src/
│   ├── shared/                       # Shared across main/preload/renderer
│   │   ├── types.ts                  # All shared TypeScript interfaces
│   │   ├── ipc-channels.ts           # IPC channel name constants
│   │   ├── constants.ts              # App-wide constants
│   │   └── errors.ts                 # Session 3: error types
│   ├── main/                         # Electron main process
│   │   ├── index.ts                  # App entry, window creation
│   │   ├── ipc-handlers.ts           # All IPC handler registrations
│   │   ├── file-system.ts            # File tree, .gitignore, chokidar watching
│   │   ├── claude-code.ts            # Claude Code child process manager
│   │   ├── menu.ts                   # macOS application menu
│   │   ├── session-persistence.ts    # Session 2: save/load sessions
│   │   ├── editor-state-persistence.ts # Session 2: editor state
│   │   └── ipc-socket.ts            # Session 3: CLI single-instance socket
│   ├── preload/
│   │   ├── index.ts                  # contextBridge.exposeInMainWorld
│   │   └── index.d.ts               # Window type augmentation
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx              # React root mount
│           ├── App.tsx               # Top-level layout
│           ├── env.d.ts              # Vite client types
│           ├── components/
│           │   ├── Layout/
│           │   │   ├── PanelLayout.tsx
│           │   │   └── ResizeHandle.tsx
│           │   ├── FileTree/
│           │   │   ├── FileTree.tsx
│           │   │   ├── FileTreeNode.tsx
│           │   │   ├── FileTreeFilter.tsx
│           │   │   └── fileIcons.ts
│           │   ├── Editor/
│           │   │   ├── EditorPanel.tsx
│           │   │   ├── TabBar.tsx
│           │   │   ├── Tab.tsx
│           │   │   ├── CodeEditor.tsx
│           │   │   └── languageExtensions.ts
│           │   ├── ClaudePanel/
│           │   │   ├── ClaudePanel.tsx
│           │   │   ├── ConversationView.tsx
│           │   │   ├── MessageBubble.tsx
│           │   │   ├── ToolUseBlock.tsx
│           │   │   ├── PermissionCard.tsx
│           │   │   ├── InputArea.tsx
│           │   │   ├── StatusIndicator.tsx
│           │   │   ├── CodeBlock.tsx
│           │   │   ├── FileReferenceLink.tsx
│           │   │   ├── FileAutocomplete.tsx
│           │   │   └── ImagePreview.tsx
│           │   ├── Permissions/
│           │   │   ├── PermissionCardWrapper.tsx
│           │   │   ├── ToolPermissionCard.tsx
│           │   │   ├── EditApprovalCard.tsx
│           │   │   ├── MultipleChoiceCard.tsx
│           │   │   ├── YesNoCard.tsx
│           │   │   ├── FreeTextCard.tsx
│           │   │   └── StickyPromptBar.tsx
│           │   ├── SessionTabs/
│           │   │   ├── SessionTabBar.tsx
│           │   │   ├── SessionTab.tsx
│           │   │   └── SessionHistory.tsx
│           │   ├── QuickActions/
│           │   │   └── QuickActionBar.tsx
│           │   ├── DiffViewer/
│           │   │   ├── DiffToolbar.tsx
│           │   │   └── DiffFileList.tsx
│           │   ├── ErrorBanner/
│           │   │   ├── ErrorBanner.tsx
│           │   │   ├── ErrorCard.tsx
│           │   │   └── HungProcessIndicator.tsx
│           │   ├── QuickOpen/
│           │   │   ├── QuickOpen.tsx
│           │   │   └── HighlightedPath.tsx
│           │   ├── StatusBar/
│           │   │   └── StatusBar.tsx
│           │   └── common/
│           │       └── CopyButton.tsx
│           ├── hooks/
│           │   ├── useIpc.ts
│           │   ├── useFileTree.ts
│           │   ├── useClaudeCode.ts
│           │   ├── useKeyboardShortcuts.ts
│           │   ├── usePermissionKeyboard.ts
│           │   ├── useAutoOpenFiles.ts
│           │   ├── useFileAutocomplete.ts
│           │   └── useImagePaste.ts
│           ├── store/
│           │   ├── fileTreeStore.ts
│           │   ├── editorStore.ts
│           │   ├── claudeCodeStore.ts
│           │   ├── sessionStore.ts
│           │   ├── permissionStore.ts
│           │   ├── errorStore.ts
│           │   ├── diffStore.ts
│           │   └── uiStore.ts
│           ├── utils/
│           │   ├── filePathParser.ts
│           │   ├── fuzzySearch.ts
│           │   ├── diffComputer.ts
│           │   └── diffExtension.ts
│           └── styles/
│               ├── globals.css
│               ├── diff.css
│               └── theme.ts
├── CLAUDE.md
├── PRD.md
└── IMPLEMENTATION_PLAN.md
```

---

## 3. Shared Types

### `src/shared/types.ts`

```typescript
// FILE SYSTEM
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

// EDITOR
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

// CLAUDE CODE — stream-json protocol
export type ClaudeStreamEvent =
  | ClaudeSystemEvent
  | ClaudeAssistantEvent
  | ClaudeUserEvent
  | ClaudeStreamingEvent
  | ClaudeResultEvent

export interface ClaudeSystemEvent {
  type: 'system'
  subtype: 'init'
  session_id: string
  model: string
  claude_code_version: string
  cwd: string
  tools: string[]
  mcp_servers: Array<{ name: string; status: string }>
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
  subtype: 'success' | 'error'
  is_error: boolean
  duration_ms: number
  num_turns: number
  result: string
  session_id: string
  total_cost_usd: number
  usage: ClaudeUsage
  uuid: string
}

export interface ClaudeUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

// UI-LEVEL TYPES
export type ClaudeStatus =
  | 'idle' | 'thinking' | 'tool_executing'
  | 'waiting_for_user' | 'error' | 'disconnected'

export interface ConversationMessage {
  id: string
  role: 'assistant' | 'user' | 'system' | 'error'
  timestamp: number
  contentBlocks: ConversationContentBlock[]
  isStreaming: boolean
}

export type ConversationContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; toolUseId: string; toolName: string;
      input: Record<string, unknown>; result?: string;
      isError?: boolean; status: 'pending' | 'running' | 'complete' | 'error' }
  | { type: 'permission_request'; toolUseId: string; toolName: string;
      input: Record<string, unknown>;
      status: 'pending' | 'accepted' | 'rejected' }
  | { type: 'error'; message: string; code?: string }

// SESSION (Session 2+)
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
}

export interface PersistedSession {
  version: 1
  info: SessionInfo
  conversation: ConversationMessage[]
  autoApprovalRules: AutoApprovalRule[]
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

// PERMISSIONS (Session 2+)
export type PermissionType =
  | 'tool' | 'edit' | 'multiple_choice' | 'yes_no' | 'free_text'

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
```

---

## 4. IPC Channel Definitions

### `src/shared/ipc-channels.ts`

```
SESSION 1 CHANNELS:
  fs:read-dir          R→M  { dirPath, depth? } → FileTreeEntry[]
  fs:read-file         R→M  { filePath } → FileReadResult
  fs:save-file         R→M  { filePath, content } → FileSaveResult
  fs:get-project-root  R→M  void → string
  fs:file-changed      M→R  FileChangeEvent
  claude:spawn         R→M  { projectPath, sessionId } → { success, sessionId }
  claude:send-message  R→M  { sessionId, text } → void
  claude:kill          R→M  { sessionId } → void
  claude:interrupt     R→M  { sessionId } → void
  claude:stream-event  M→R  { sessionId, event: ClaudeStreamEvent }
  claude:process-exit  M→R  { sessionId, code, signal }
  claude:process-error M→R  { sessionId, error }
  app:get-version      R→M  void → string
  app:select-folder    R→M  void → string | null

SESSION 2 ADDITIONS:
  claude:spawn-session    R→M  { projectPath } → { sessionId }
  claude:resume-session   R→M  { sessionId, projectPath } → { success }
  claude:kill-session     R→M  { sessionId } → void
  claude:respond-prompt   R→M  { sessionId, toolUseId, action, answers? }
  claude:session-event    M→R  { sessionId, event }
  session:save            R→M  { session: PersistedSession } → void
  session:load            R→M  { projectPath, sessionId } → PersistedSession | null
  session:load-index      R→M  { projectPath } → SessionIndex
  session:get-last        R→M  { projectPath } → { sessionId } | null
  session:delete          R→M  { projectPath, sessionId } → void
  editor-state:save       R→M  { state: PersistedEditorState } → void
  editor-state:load       R→M  { projectPath } → PersistedEditorState | null

SESSION 3 ADDITIONS:
  claude:cancel           R→M  { sessionId } → void (sends SIGINT)
  claude:restart-session  R→M  { sessionId } → { success }
  claude:error            M→R  ClaudeStudioError
  fs:project-missing      M→R  { path, message }
  diff:file-changed       M→R  { filePath, oldContent, newContent, sessionId }
  diff:reject             R→M  { filePath, oldContent } → void
  app:new-window          R→M  { dir? } → void
```

---

## 5. Zustand Store Shapes

### fileTreeStore (Session 1)
```
rootPath: string | null
entries: FileTreeEntry[]
expandedPaths: Set<string>
filterText: string
isLoading: boolean
error: string | null
+ getAllFilePaths(): string[]        // Session 3: flat list for autocomplete
Actions: setRootPath, setEntries, toggleExpanded, setFilterText, handleFileChange
```

### editorStore (Session 1)
```
tabs: EditorTab[]
activeTabId: string | null
fileContents: Map<string, string>
Actions: openFile, closeTab, setActiveTab, updateTabContent, markTabDirty,
         promotePreview, reorderTabs
+ scrollToLine(filePath, line)       // Session 3
+ saveEditorState() / restoreEditorState()  // Session 2
```

### claudeCodeStore (Session 1)
```
sessionId: string | null
claudeSessionId: string | null
status: ClaudeStatus
model: string | null
messages: ConversationMessage[]
currentStreamingMessageId: string | null
totalCostUsd: number
pendingPermission: { toolUseId, toolName, input } | null
Actions: processStreamEvent, appendTextDelta, addUserMessage,
         respondToPermission, clearMessages, reset
```

### sessionStore (Session 2)
```
sessions: Map<string, SessionRuntime>
activeSessionId: string | null
sessionOrder: string[]
sessionHistory: SessionInfo[]
Actions: createSession, closeSession, switchSession, resumeSession,
         restoreLastSession, loadSessionHistory
```

### permissionStore (Session 2)
```
pendingPrompts: Map<string, PendingPrompt>
autoApprovalRules: AutoApprovalRule[]
Actions: addPendingPrompt, resolvePendingPrompt, acceptTool, rejectTool,
         enableAutoApproval, disableAutoApproval, checkAndAutoResolve
```

### errorStore (Session 3)
```
errors: ClaudeStudioError[]
fileSystemWarning: string | null
hungSessions: Set<string>
crashedSessions: Set<string>
Actions: addError, dismissError, markSessionHung, markSessionCrashed
```

### diffStore (Session 3)
```
pendingDiffs: DiffEntry[]
activeDiffPath: string | null
Actions: addDiff, acceptDiff, rejectDiff, acceptAll, rejectAll
```

### uiStore (Session 3)
```
fileTreeVisible: boolean
claudePanelVisible: boolean
quickOpenVisible: boolean
Actions: toggleFileTree, toggleClaudePanel, setQuickOpenVisible
```

---

## 6. Stream-JSON Event → UI Mapping

| Event Type | Content | UI Component | Store Update |
|---|---|---|---|
| `system` (init) | Session init with model, version | StatusIndicator | Set model, version, status='idle' |
| `stream_event` → `message_start` | Start of response | Thinking spinner | status='thinking' |
| `stream_event` → `content_block_start` | New text/tool block | New ConversationMessage | Add streaming message |
| `stream_event` → `content_block_delta` (text) | Incremental text | MessageBubble grows | appendTextDelta |
| `stream_event` → `content_block_delta` (json) | Incremental tool input | ToolUseBlock input grows | Append to tool input |
| `stream_event` → `content_block_stop` | Block complete | Remove streaming cursor | Mark block finalized |
| `stream_event` → `message_stop` | Full message done | Streaming stops | currentStreamingMessageId=null |
| `assistant` | Complete message with tool_use | MessageBubble + PermissionCard | Add message, set pendingPermission |
| `user` (tool_result) | Tool execution result | ToolUseBlock shows result | Update tool_use block status |
| `result` (success) | Turn complete with cost | Status → idle | status='idle', add cost |
| `result` (error) | Error occurred | ErrorCard inline | Add error message, status='error' |

---

## 7. Session 1: Core

**Goal:** Working Electron app with file tree, editor, and basic Claude Code integration.

### 7.1 Files to Create (54 total)

**Config files (13):**
- `package.json` — all deps pinned, scripts: dev, build, preview
- `electron.vite.config.ts` — main/preload/renderer configs, `@shared` alias, React plugin, PostCSS
- `tsconfig.json` — references tsconfig.node.json + tsconfig.web.json
- `tsconfig.node.json` — main/preload (ESNext, bundler resolution, `@shared` path)
- `tsconfig.web.json` — renderer (react-jsx, DOM lib, `@renderer`/`@shared` paths)
- `postcss.config.cjs` — `{ plugins: { '@tailwindcss/postcss': {} } }`
- `eslint.config.mjs` — flat config: `@eslint/js` + `typescript-eslint` + `eslint-config-prettier`
- `.prettierrc` — `{ semi: false, singleQuote: true, trailingComma: 'all', printWidth: 100 }`
- `.prettierignore` — dist, out, node_modules
- `.gitignore` — node_modules, out, dist, .DS_Store
- `electron-builder.yml` — macOS .app config
- `resources/icon.png` — placeholder

**Shared (3):**
- `src/shared/types.ts` — all interfaces from Section 3
- `src/shared/ipc-channels.ts` — channel constants
- `src/shared/constants.ts` — panel sizes, timeouts, supported languages

**Main process (5):**
- `src/main/index.ts` — BrowserWindow creation (1400x900), preload, HMR dev URL
- `src/main/ipc-handlers.ts` — registers all Session 1 IPC handlers
- `src/main/file-system.ts` — readDirectoryTree, readFileContent, saveFile, chokidar watcher, .gitignore via `ignore` package
- `src/main/claude-code.ts` — ClaudeCodeManager class
- `src/main/menu.ts` — macOS application menu

**Preload (2):**
- `src/preload/index.ts` — contextBridge wrapping all IPC invoke/on calls
- `src/preload/index.d.ts` — `Window.api` type augmentation

**Renderer entry (4):**
- `src/renderer/index.html` — HTML shell
- `src/renderer/src/main.tsx` — `createRoot` mount
- `src/renderer/src/App.tsx` — PanelLayout with 3 panels + StatusBar
- `src/renderer/src/env.d.ts` — Vite client types

**Styles (1):**
- `src/renderer/src/styles/globals.css`

**Stores (3):**
- `src/renderer/src/store/fileTreeStore.ts`
- `src/renderer/src/store/editorStore.ts`
- `src/renderer/src/store/claudeCodeStore.ts`

**Hooks (4):**
- `src/renderer/src/hooks/useIpc.ts`
- `src/renderer/src/hooks/useFileTree.ts`
- `src/renderer/src/hooks/useClaudeCode.ts`
- `src/renderer/src/hooks/useKeyboardShortcuts.ts`

**Components (19):**
- Layout (2), FileTree (4), Editor (5), ClaudePanel (7), StatusBar (1)

### 7.2 Build Order

| Phase | Step | Files | Checkpoint |
|---|---|---|---|
| **Scaffolding** | 1 | package.json, electron.vite.config.ts, tsconfigs, postcss, eslint, prettier, gitignore, electron-builder, icon | `npm install` succeeds |
| **Shared + Preload** | 2 | shared/types.ts, ipc-channels.ts, constants.ts, preload/index.ts, preload/index.d.ts | Types compile |
| **Main process** | 3 | menu.ts, file-system.ts, claude-code.ts, ipc-handlers.ts, index.ts | App opens, IPC registered |
| **Renderer shell** | 4 | index.html, env.d.ts, globals.css, main.tsx, ResizeHandle.tsx, PanelLayout.tsx, App.tsx | Three resizable panels |
| **Stores + Hooks** | 5 | fileTreeStore, editorStore, claudeCodeStore, useIpc, useFileTree, useClaudeCode, useKeyboardShortcuts | Stores instantiate |
| **File Tree** | 6 | fileIcons.ts, FileTreeFilter, FileTreeNode, FileTree, wire into App | Real files render |
| **Editor** | 7 | languageExtensions, Tab, TabBar, CodeEditor, EditorPanel, wire to file tree clicks | Click file opens in editor |
| **Claude Panel** | 8 | StatusIndicator, ToolUseBlock, PermissionCard, MessageBubble, ConversationView, InputArea, ClaudePanel, StatusBar | Full end-to-end working |

### 7.3 Session 1 Verification

1. `npm run dev` launches the app
2. File tree shows real project files, expands/collapses, filters
3. Click file → opens in CodeMirror with syntax highlighting and tabs
4. Type a message → Claude Code spawns, streams response
5. Tool use events render as ToolUseBlock cards
6. Permission prompts show Accept/Reject buttons
7. Accept → tool executes → result shows
8. Multiple files can be opened in tabs, tabs closeable
9. Panel resize works by dragging dividers

---

## 8. Session 2: Interaction & Sessions

**Goal:** Full permission UI, multiple concurrent sessions, persistence, quick actions.

### 8.1 Build Order

| Step | What | Depends On |
|---|---|---|
| 1 | Session types (extend shared/types.ts) | — |
| 2 | Session manager refactor in main (multi-process, resume) | Step 1 |
| 3 | New IPC channels + handlers | Step 2 |
| 4 | sessionStore | Step 3 |
| 5 | SessionTabBar + SessionTab UI | Step 4 |
| 6 | permissionStore + auto-approval logic | Step 1 |
| 7 | Permission event detection in ConversationView | Step 6 |
| 8 | All 5 permission card components + PermissionCardWrapper | Step 7 |
| 9 | StickyPromptBar (IntersectionObserver for visibility) | Step 8 |
| 10 | usePermissionKeyboard (Y/N/A) | Step 8 |
| 11 | session-persistence.ts in main | Step 2 |
| 12 | Persistence wiring in sessionStore | Step 11 |
| 13 | SessionHistory UI | Step 12 |
| 14 | Restore last session on app open | Step 12 |
| 15 | editor-state-persistence.ts + editorStore persistence | Step 11 |
| 16 | QuickActionBar | Step 4 |
| 17 | Slash command detection in InputArea | — |
| 18 | Integration testing | All |

### 8.2 Session 2 Verification

1. Multiple session tabs work simultaneously with independent processes
2. Permission cards render correctly for all prompt types
3. "Allow all for session" auto-approves subsequent same-type prompts
4. Sticky bar appears when permission card scrolls out of view
5. Y/N/A keyboard shortcuts work when Claude panel focused
6. Close and reopen app → last session restored
7. Session history shows past sessions, clicking resumes them
8. Editor tabs and scroll positions restored on reopen
9. Quick action buttons work
10. Slash commands work in input

---

## 9. Session 3: Polish & Completeness

**Goal:** @ autocomplete, image paste, diffs, error handling, keyboard shortcuts, CLI launcher, polish.

### 9.1 Build Order

| Step | Feature | Description |
|---|---|---|
| 1 | Error types + store (19) | `shared/errors.ts`, `errorStore.ts`, `uiStore.ts` |
| 2 | Error handling — main (19) | Crash detect, stderr, restart, SIGINT |
| 3 | Error handling — renderer (19) | ErrorBanner, ErrorCard, HungProcessIndicator |
| 4 | Keyboard shortcuts (20) | Full `useKeyboardShortcuts.ts` with 20+ shortcuts |
| 5 | Diff computation (15) | `diffStore.ts`, `diffComputer.ts`, `diffExtension.ts` |
| 6 | Diff viewer UI (15) | `DiffToolbar`, `DiffFileList` |
| 7 | Auto-open files (16) | `useAutoOpenFiles.ts` |
| 8 | File path parser + links (17) | `filePathParser.ts`, `FileReferenceLink.tsx` |
| 9 | @ autocomplete (13) | `FileAutocomplete.tsx`, `useFileAutocomplete.ts` |
| 10 | Image paste (14) | `ImagePreview.tsx`, `useImagePaste.ts` |
| 11 | Copy buttons (18) | `CopyButton.tsx`, `CodeBlock.tsx` |
| 12 | Light theme polish (21) | `theme.ts`, update components |
| 13 | Quick Open (23) | `fuzzySearch.ts`, `QuickOpen.tsx`, `HighlightedPath.tsx` |
| 14 | CLI launcher (22) | `bin/claude-studio.js`, `ipc-socket.ts` |

### 9.2 Session 3 Verification

1. Process crash → error card with [Restart Session]
2. Rate limit → error card with timer + [Retry Now]
3. >5min thinking → "Still working..." with [Cancel]
4. File system error → amber banner
5. All keyboard shortcuts work
6. Cmd+P opens Quick Open
7. @ autocomplete works in Claude input
8. Cmd+V image → thumbnail preview
9. Claude edits file → auto-opens with diff decorations
10. File paths in Claude text are clickable
11. Code blocks have copy buttons
12. Light theme is visually consistent
13. `claude-studio .` from terminal works

---

## 10. Session Continuity

After each session is fully built and verified, update this plan file by changing the session header:

```markdown
## 7. Session 1: Core  ✅ COMPLETE (YYYY-MM-DD)
```
