# Claude Studio — Product Requirements Document

## Overview

Claude Studio is a lightweight, standalone desktop editor purpose-built for Claude Code. It eliminates the need for VS Code or any third-party IDE by providing only what Claude Code users actually need: a file tree, a code viewer, and a first-class Claude Code interface.

Built with Electron + React. Runs on macOS (primary), with Linux and Windows as future targets.

---

## Problem

Power users of Claude Code use VS Code as a glorified file browser. They don't use IntelliSense, debugging, extensions, linting, or 95% of VS Code's features. Claude Code handles all editing, debugging, and code generation. VS Code is 180MB of overhead for a workflow that needs maybe 10MB of UI.

The dependency on Microsoft's product creates friction: extension API limitations, bloated startup, constant updates, and an interface designed for manual coding — not AI-agent-driven development.

---

## Target User

Developers who use Claude Code as their primary coding interface. They review code, approve changes, and occasionally edit an `.env` file. Claude does everything else — git, terminal commands, search, deployments.

---

## Core Principles

1. **Claude Code is the star.** The Claude Code panel is the primary interface, not the file editor.
2. **Less is more.** Every feature must justify its existence. When in doubt, leave it out.
3. **Fast startup.** Under 2 seconds to open a project. No splash screens, no tips, no welcome tabs.
4. **Native Claude Code integration.** Not a wrapper — Claude Code runs natively inside the app.
5. **Claude handles the hard stuff.** Git, terminal, search, deployments — all done through Claude Code. No need to duplicate these in the UI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Menu Bar                                               │
├────────────┬────────────────────┬───────────────────────┤
│            │                    │                       │
│  File Tree │   Editor Panel     │   Claude Code Panel   │
│            │                    │                       │
│  - Project │   - Tab bar        │   - Session tabs      │
│    files   │   - Code viewer    │   - Conversation      │
│  - Filter  │   - Syntax         │     history           │
│            │     highlighting   │   - Quick actions bar  │
│            │   - Inline diffs   │   - Input area        │
│            │   - Line numbers   │   - Status indicator  │
│            │                    │                       │
│            │                    │                       │
├────────────┴────────────────────┴───────────────────────┤
│  Bottom Bar: File path | Claude Code status             │
└─────────────────────────────────────────────────────────┘
```

### Panel Behavior

- **Default layout:** File tree (20%) | Editor (40%) | Claude Code (40%)
- All panels resizable via drag
- Claude Code panel can be expanded to full width (hide editor + file tree)
- Editor panel can be hidden entirely for "conversation only" mode
- Double-click file tree to open in editor; single-click for preview
- Keyboard shortcut to toggle each panel

---

## Claude Code Communication Protocol

Claude Code runs as a child process. The app communicates with it using `--output-format stream-json`, which provides structured JSON events for:

- **Assistant messages** — text, code blocks, markdown
- **Tool use** — which tool is being called, arguments, results
- **Permission requests** — tool name, command, awaiting approval
- **Questions** — multiple choice, yes/no, free text
- **Status changes** — thinking, executing, idle, waiting for input
- **File changes** — which files were created, edited, or deleted
- **Errors** — process errors, API errors, rate limits

The app parses these events and renders them as UI components. User responses (permission approvals, answers to questions, new messages) are sent back via stdin.

This is **not** a raw terminal emulator. The structured output allows the app to render rich UI (permission cards, clickable file links, collapsible tool output) instead of plain text.

---

## Feature Specifications

### 1. File Tree (Left Panel)

**Must have:**
- Recursive directory listing with expand/collapse
- File type icons (basic set: folders, code files, config, images, markdown)
- Right-click context menu: New File, New Folder, Rename, Delete, Copy Path, Reveal in Finder
- `.gitignore`-aware: hide ignored files by default, toggle to show
- Filter bar at top of file tree
- Auto-refresh when Claude Code creates, renames, or deletes files

**Won't have:**
- Git status indicators (Claude handles git)
- Nested workspace / multi-root folders (one project at a time)
- Drag and drop to move files (v1)

**Future (v0.2+):**
- Drag and drop files into Claude Code input to reference them

### 2. Editor Panel (Center)

**Must have:**
- Tab bar with open files (closeable, reorderable)
- Syntax highlighting for common languages (JS/TS, Python, Rust, Go, HTML, CSS, JSON, YAML, Markdown, SQL, Shell, Java, C/C++, Ruby, Swift)
- Line numbers
- Basic text editing (the user rarely edits, but needs to for `.env` files, quick fixes)
- Find and replace (Cmd+F, Cmd+H)
- Inline diff view when Claude Code modifies a file (green/red highlighting)
- Auto-open files that Claude Code edits
- Read-only mode toggle (prevent accidental edits)
- Word wrap toggle
- Unsaved changes indicator on tabs
- Auto-reload file content when Claude Code modifies a file externally
- **Restore open tabs on project reopen** — remembers which files were open, which tab was active, and scroll position

**Won't have:**
- IntelliSense / autocomplete
- Code folding
- Multi-cursor editing
- Bracket matching / rainbow brackets
- Extensions or plugins
- Debugging tools
- Integrated linting
- Minimap

**Editor library:** CodeMirror 6 (lightweight, extensible, MIT licensed). Not Monaco (that's VS Code's engine — too heavy).

### 3. Claude Code Panel (Right) — PRIMARY INTERFACE

**Must have:**
- Full Claude Code integration (spawns `claude` process via `--output-format stream-json`)
- **Session tabs** — multiple Claude Code sessions open simultaneously
- **Session persistence** — when you close and reopen a project, the last session is loaded and resumable. Open editor tabs are also restored. Works the same as `code .` restoring your workspace
- **Session history** — list of past sessions for the project, click to resume any of them
- **Quick action bar** — buttons for common actions: New Session, `/compact`, `/clear`, `/model`
- Conversation history with full rendering (code blocks, markdown, tool use indicators)
- Input area at bottom with multi-line support (Shift+Enter for newlines)
- Auto-scroll to latest message
- **Copy buttons** — on code blocks, full responses, and file paths
- **Clickable file references** — when Claude mentions a file, click to open in editor
- Status indicator: idle, thinking, executing, waiting for approval
- Keyboard shortcut to focus Claude Code input from anywhere (Cmd+L)

**Input enhancements:**
- **`/` slash commands** — all Claude Code slash commands work natively (`/compact`, `/clear`, `/model`, `/cost`, `/doctor`, `/config`, `/help`, etc.) since input pipes directly to the Claude Code process
- Slash commands also available via the Quick Action bar as clickable buttons
- **`@` file references** — type `@` to get autocomplete dropdown from the file tree, select a file to reference it in your message
- **Screenshot/image paste** — paste images directly into input (Cmd+V) for visual context (UI reviews, error screenshots, etc.)

**Future (v0.2+):**
- **Collapsible tool use** — hide verbose tool output, show summary only, expand on click
- **Pin/bookmark messages** — mark important responses to find later
- Drag and drop files from file tree into Claude Code input

**Won't have:**
- Built-in terminal (Claude Code handles all terminal operations)

### 4. Permissions & Interaction UI

This is the most frequently used part of the app. Claude Code constantly asks for permission to run commands, edit files, and make decisions. The UI must make approving/rejecting fast and frictionless.

**How "Allow all for session" works:** This is a UI-level feature. When enabled for a tool type, the app automatically sends "accept" responses to Claude Code's permission prompts on the user's behalf. Claude Code's own permission system remains intact — the app just auto-responds. This is **not** the same as `--dangerously-skip-permissions`. The user can revoke "allow all" at any time from the session tab header, and it resets when the session ends.

**Tool permission prompts:**
- Rendered as styled cards inline in the conversation
- Clear **Accept** / **Reject** buttons
- **"Allow all [tool type] for this session"** checkbox — so the user doesn't have to approve the same tool 50 times (e.g., allow all Bash, allow all Edits, allow all Read)
- Keyboard shortcuts when prompt is focused: **Y** to accept, **N** to reject, **A** to allow all for session
- **Sticky prompt bar** — when Claude is waiting for approval, the prompt pins to the bottom of the Claude panel so it's always visible even if the user scrolled up

```
┌─────────────────────────────────────┐
│  🔧 Bash                           │
│  npm install tailwindcss            │
│                                     │
│  [Accept]  [Reject]                 │
│  ☐ Allow all Bash for this session  │
└─────────────────────────────────────┘
```

**Edit approval prompts:**
- When Claude edits a file, show inline diff in the editor panel with changes highlighted
- **Accept All** / **Reject All** buttons for when Claude edits multiple files at once
- Per-file accept/reject when reviewing a batch of changes
- **"Auto-accept edits for this session"** option for when the user trusts the flow

```
┌─────────────────────────────────────┐
│  ✏️  Edited 3 files                 │
│  src/app.tsx                        │
│  src/utils/api.ts                   │
│  package.json                       │
│                                     │
│  [Accept All]  [Reject All]         │
│  [Review Each]                      │
│  ☐ Auto-accept edits this session   │
└─────────────────────────────────────┘
```

**Multiple choice questions:**
- Rendered as clickable buttons, not text the user has to type
- Always includes an "Other — type your answer" option

```
┌─────────────────────────────────────┐
│  Which database should we use?      │
│                                     │
│  [PostgreSQL]  [SQLite]  [MongoDB]  │
│  [Other — type your answer]         │
└─────────────────────────────────────┘
```

**Yes/No confirmations:**
- Rendered as two clear buttons
- Keyboard: **Y** / **N**

**Free text questions:**
- Question displayed above the input area
- Input area auto-focused so user can immediately type

**Waiting indicator:**
- Subtle visual pulse on the Claude panel tab when Claude is waiting for user input
- Status bar shows "Waiting for input" state

### 5. Diff Viewer

**Must have:**
- Inline diff view when Claude Code modifies a file (green/red highlighting)
- Accept / Reject buttons per file
- Accept All / Reject All when multiple files changed
- Triggered automatically when Claude Code proposes file changes
- File opens in editor with changes highlighted

**Won't have (v1):**
- Side-by-side vs inline toggle (just inline for v1)
- Per-hunk accept/reject within a single file

### 6. Error Handling & Recovery

Claude Code sessions can crash, disconnect, or encounter errors. The app must handle all of these gracefully.

**Process crashes:**
- Detect when the Claude Code child process exits unexpectedly
- Show a clear error message in the conversation: "Session disconnected"
- Offer a **[Restart Session]** button that spawns a new process in the same session tab
- Preserve the conversation history rendered in the UI (it's already in the DOM) so the user can still read and copy from it
- Do not auto-restart — let the user decide (they may want to read the error first)

**API errors (rate limits, auth failures, network issues):**
- Claude Code reports these via its stream-json output
- Render error messages inline in the conversation as styled error cards
- For rate limits: show the wait time if provided, and a **[Retry]** button
- For auth failures: show a message directing user to run `claude login` in a terminal

```
┌─────────────────────────────────────┐
│  ⚠️  Rate limited                   │
│  Try again in ~45 seconds           │
│                                     │
│  [Retry Now]  [Wait]                │
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│  ❌ Session disconnected             │
│  The Claude Code process exited     │
│  unexpectedly (exit code 1).        │
│                                     │
│  [Restart Session]  [View Logs]     │
└─────────────────────────────────────┘
```

**Hung processes:**
- If Claude Code has been "thinking" for an unusually long time (configurable, default 5 minutes), show a subtle indicator: "Still working..." with a **[Cancel]** button
- Cancel sends SIGINT to the child process (same as Ctrl+C in terminal)

**File system errors:**
- If the project directory is moved, renamed, or deleted while open: show a warning banner at the top of the app and disable file tree until resolved
- If a file fails to save: show an error inline on the editor tab, do not silently fail

**Session tab behavior on error:**
- A crashed session tab shows a red dot indicator
- The tab remains open — user can restart or close it
- Other session tabs are unaffected (each session is an independent process)

### 7. Settings

**Must have:**
- Theme: light (default), dark
- Font family and size
- Tab size (2 or 4 spaces)
- Panel layout preferences (saved per project)
- Claude Code model selection
- Key bindings display (not customizable in v1)

**Won't have:**
- Git configuration (Claude handles git)
- Shell path selection (no integrated terminal)
- Search configuration (Claude handles search)

**Storage:** JSON config file at `~/.claude-studio/settings.json`

### 8. Project Management

**Must have:**
- Open project via: `claude-studio .` from terminal, or File > Open Folder
- Recent projects list on launch (simple list, not a dashboard)
- Window title shows project name
- Multiple windows for multiple projects

**Won't have:**
- Workspaces / multi-root projects
- Project templates

---

## Removed from Original PRD

The following features were removed because Claude Code handles them directly:

| Feature | Reason |
|---|---|
| Git integration | Claude Code handles all git operations |
| Integrated terminal | Claude Code runs all terminal commands |
| Project-wide search | User asks Claude Code to search |
| Git branch in status bar | Not needed — ask Claude Code |
| Complex diff viewer | Simplified to accept/reject inline diffs |
| macOS notifications | User is already looking at the app |

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Focus Claude Code input | Cmd+L |
| Toggle file tree | Cmd+B |
| Toggle Claude Code panel | Cmd+J |
| Open file (quick open) | Cmd+P |
| Find in file | Cmd+F |
| Find and replace | Cmd+H |
| Close tab | Cmd+W |
| New session | Cmd+N |
| New window | Cmd+Shift+N |
| Settings | Cmd+, |
| Accept permission / diff | Y (when prompt focused) |
| Reject permission / diff | N (when prompt focused) |
| Allow all for session | A (when prompt focused) |
| Accept all diffs | Cmd+Enter |
| Reject all diffs | Cmd+Backspace |
| Next session tab | Cmd+Shift+] |
| Previous session tab | Cmd+Shift+[ |
| Cancel Claude operation | Cmd+C (when Claude panel focused) |

---

## Technical Stack

| Component | Technology | Version |
|---|---|---|
| Desktop framework | Electron | 40.2.1 |
| UI framework | React + React DOM | 19.2.4 |
| Language | TypeScript (strict mode) | 5.9.2 |
| Styling | Tailwind CSS (via `@tailwindcss/postcss`) | 4.1.18 |
| Editor | CodeMirror 6 + `@uiw/react-codemirror` | 4.25.4 |
| Diff engine | jsdiff (`diff`) | 8.0.3 |
| File watching | chokidar | 4.x (not v5 — ESM-only breaks Electron CJS) |
| Build / packaging | electron-builder | 26.7.0 |
| State management | Zustand | 5.0.11 |
| Claude Code protocol | `--output-format stream-json` via stdin/stdout | — |

### Dev Tooling

| Tool | Purpose |
|---|---|
| ESLint (flat config) | Code quality — `@eslint/js` + `typescript-eslint` |
| Prettier | Code formatting only |
| eslint-config-prettier | Disables ESLint rules that conflict with Prettier |

**TypeScript:** strict mode enabled (`strict: true`, `skipLibCheck: true` for Electron + @types/node compatibility).

**Tailwind note:** Use `@tailwindcss/postcss` plugin, **not** `@tailwindcss/vite` — the Vite plugin has known issues with electron-vite.

**Removed from stack:** xterm.js (no integrated terminal), simple-git (no git UI)

---

## File Structure

```
claude-studio/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts
│   │   ├── ipc-handlers.ts   # File system, Claude Code process
│   │   └── claude-code.ts    # Claude Code process management
│   ├── renderer/             # React UI
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── FileTree/
│   │   │   ├── Editor/
│   │   │   ├── ClaudePanel/
│   │   │   ├── DiffViewer/
│   │   │   ├── Permissions/   # Permission cards, edit approvals, question prompts
│   │   │   ├── SessionTabs/
│   │   │   ├── QuickActions/
│   │   │   ├── ErrorBanner/   # Crash recovery, error display
│   │   │   └── StatusBar/
│   │   ├── hooks/
│   │   ├── store/            # Zustand stores
│   │   └── styles/
│   └── shared/               # Shared types and utils
├── assets/                   # Icons, themes
├── electron-builder.yml
├── package.json
├── tsconfig.json
├── postcss.config.js
├── eslint.config.js          # ESLint flat config
├── .prettierrc
└── CLAUDE.md
```

---

## CLAUDE.md (For Claude Code to reference when building this)

```markdown
# Claude Studio

## What is this?
A lightweight Electron desktop editor purpose-built for Claude Code. Think "VS Code minus everything except what Claude Code users need."

## Architecture
- Electron main process handles: file system ops, spawning Claude Code process
- React renderer handles: UI, state, user interaction
- IPC bridge between main and renderer for all system operations
- Claude Code runs as a child process using `--output-format stream-json`
- Structured JSON events parsed in main process, forwarded to renderer via IPC
- User responses (approvals, messages) sent back to Claude Code via stdin

## Key Decisions
- CodeMirror 6 for editor (NOT Monaco — too heavy)
- Zustand for state (NOT Redux — overkill)
- Tailwind for styling
- No integrated terminal — Claude Code handles all terminal operations
- No git UI — Claude Code handles all git operations
- No project-wide search UI — Claude Code handles search
- No extension system, no plugin API, no marketplace
- Light theme is default
- "Allow all for session" auto-responds to prompts at UI level, does NOT use --dangerously-skip-permissions

## Build Order
1. Electron shell with three-panel layout (resizable)
2. File tree with directory listing and file icons
3. CodeMirror editor with tabs and syntax highlighting
4. Claude Code process integration (spawn, stream-json parsing, render output)
5. Permission prompt cards (Accept/Reject/Allow all for session)
6. Edit approval UI (Accept All/Reject All/Review Each)
7. Multiple choice and yes/no prompt rendering
8. Sticky prompt bar for pending approvals
9. Session tabs (multiple concurrent sessions)
10. Session persistence and session history (auto-load last session on project open)
11. Editor state persistence (restore open tabs, active tab, scroll positions)
12. Quick action bar (New Session, /compact, /clear, /model)
13. `@` file autocomplete in Claude input
14. Screenshot/image paste into Claude input
15. Inline diff viewer with accept/reject
16. Auto-open files edited by Claude Code
17. Clickable file references in Claude output
18. Copy buttons on code blocks and responses
19. Error handling: crash recovery, API errors, hung processes
20. Settings and theming (light default, dark option)
21. Polish: keyboard shortcuts, quick open (Cmd+P)

## Error Handling
- Detect child process crashes, show restart button
- Parse API errors from stream-json, render as error cards
- Cancel via SIGINT for hung processes
- File system errors shown as banners
- Each session tab is independent — one crash doesn't affect others

## Testing
- Each component should be buildable and testable independently
- Test the Electron IPC layer with mock data before connecting real file system
- Test Claude Code integration with a simple echo process first
- Test error handling with mock crashes and error events

## Conventions
- TypeScript strict mode
- Functional React components with hooks
- File naming: PascalCase for components, camelCase for utilities
- One component per file
- Tailwind classes, no CSS files except for CodeMirror themes
```

---

## MVP Scope (v0.1)

Ship the absolute minimum that replaces VS Code for a Claude Code user:

1. Three-panel layout (file tree, editor, Claude Code)
2. File tree with expand/collapse, file icons, and filter
3. CodeMirror editor with syntax highlighting and tabs
4. Claude Code integration via `stream-json` with conversation rendering
5. **Permission prompt cards** with Accept/Reject buttons and "Allow all for session"
6. **Edit approval UI** with Accept All / Reject All / Review Each
7. **Multiple choice & yes/no** rendered as clickable buttons
8. **Sticky prompt bar** — pins pending prompts to bottom of Claude panel
9. Session tabs (multiple concurrent sessions)
10. **Session persistence** — last session auto-loaded on project reopen, conversation history preserved
11. **Session history** — list of past sessions, click to resume any
12. **Restore editor state** — open tabs, active tab, and scroll positions restored on project reopen
13. Quick action bar (New Session, `/compact`, `/clear`)
14. `/` slash commands working natively
15. **`@` file autocomplete** — type `@` to reference files from the file tree
16. **Screenshot/image paste** — Cmd+V images into Claude input
17. Basic inline diff viewer with accept/reject
18. Auto-open files that Claude edits
19. Clickable file references in Claude output
20. Copy buttons on code blocks
21. **Error handling** — crash recovery, API error display, cancel hung processes
22. Keyboard shortcuts (Cmd+L, Cmd+B, Cmd+P, Cmd+N, Y/N/A for prompts)
23. Light theme (default)
24. Open project from terminal: `claude-studio .`

**Cut from MVP (v0.2+):** Pin/bookmark messages, dark theme, collapsible tool use, settings UI, drag-and-drop files to input.

---

## Success Criteria

- Opens a project in under 2 seconds
- App size under 100MB (ideally under 50MB)
- Claude Code works identically to terminal experience
- User can go an entire workday without opening VS Code
- A developer with no docs can figure out the UI in under 60 seconds
- Crashes are recoverable without losing conversation history
- Permission approvals take one click or one keystroke
- `claude-studio .` restores last session and open tabs — same workflow as `code .`

---

## Future (v0.2+)

- Dark theme
- Pin/bookmark important messages
- Collapsible tool use output
- Settings UI
- Drag-and-drop files into Claude input
- Split editor (two files side by side)
- Image preview for png/jpg/svg
- Markdown preview
- MCP server status indicator
- CLAUDE.md and MEMORY.md quick access buttons
- Auto-update via electron-updater
