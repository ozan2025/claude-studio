# Claude Studio

## What is this?

A lightweight Electron desktop editor purpose-built for Claude Code. Replaces VS Code for developers who use Claude Code as their primary coding interface. Think "VS Code minus everything except what Claude Code users need."

Full PRD: `./PRD.md`

## Architecture

- **Electron main process:** file system ops, Claude Code SDK integration, IPC handlers
- **React renderer:** UI, state (Zustand), user interaction
- **IPC bridge:** main <-> renderer for all system operations
- **Claude Code:** runs via `@anthropic-ai/claude-agent-sdk` V2 Session API (`unstable_v2_createSession`)
- SDK events parsed in main process, forwarded to renderer via IPC
- User responses (approvals, messages) sent back via SDK `session.send()`

## Technical Stack (Pinned Versions)

| Package | Version | Notes |
|---|---|---|
| Electron | 40.2.1 | Node 24, Chromium 144 |
| React + React DOM | 19.2.4 | Use `createRoot`, no UMD |
| TypeScript | 5.9.2 | `strict: true`, `skipLibCheck: true` |
| Tailwind CSS | 4.1.18 | Via `@tailwindcss/postcss` ONLY, not `@tailwindcss/vite` |
| @uiw/react-codemirror | 4.25.4 | React wrapper for CodeMirror 6 |
| jsdiff (diff) | 8.0.3 | Own types, remove `@types/diff` if present |
| chokidar | 4.x | NOT v5 (ESM-only breaks Electron CJS main process) |
| electron-builder | 26.7.0 | For packaging .app |
| Zustand | 5.0.11 | Named imports only: `import { create } from 'zustand'` |
| ESLint | flat config | `@eslint/js` + `typescript-eslint` |
| Prettier | latest | Formatting only |
| eslint-config-prettier | latest | Disables conflicting ESLint rules |

## Key Decisions

- CodeMirror 6 for editor (NOT Monaco -- too heavy)
- Zustand for state (NOT Redux -- overkill)
- Tailwind for styling via PostCSS (NOT Vite plugin -- has issues with electron-vite)
- No integrated terminal -- Claude Code handles all terminal operations
- No git UI -- Claude Code handles all git operations
- No project-wide search UI -- Claude Code handles search
- No extension system, no plugin API, no marketplace
- Light theme is default
- "Allow all for session" auto-responds to prompts at UI level, does NOT use `--dangerously-skip-permissions`
- chokidar v4 not v5 (ESM-only breaks Electron main process CJS)

## SDK V2 Patches

The SDK V2 session API (`unstable_v2_createSession`) hardcodes some options to empty values.
`scripts/patch-sdk.js` fixes this and runs automatically via `postinstall`:

| What | Before (hardcoded) | After (patched) |
|---|---|---|
| MCP servers | `mcpServers: {}` | `mcpServers: X.mcpServers ?? {}` |
| Settings sources | `settingSources: []` | `settingSources: X.settingSources ?? ["user","project","local"]` |

- MCP servers are read from `~/.claude.json` by `loadMcpServers()` in `claude-code.ts`
- Settings sources load skills, permissions, and config from user/project/local settings files
- Patch is safe: pattern-matches before replacing, skips if SDK version changes
- If the SDK natively supports these in a future version, the patch becomes a no-op

## Layout

```
File Tree (20%) | Editor (40%) | Claude Code Panel (40%)
```

All panels resizable. Claude Code panel is the PRIMARY interface.

## Permissions UI

The most frequently used part of the app. Renders as styled cards:
- Tool permissions: Accept/Reject + "Allow all [type] for session" checkbox
- Edit approvals: Accept All / Reject All / Review Each + "Auto-accept edits this session"
- Multiple choice: clickable buttons + "Other" option
- Yes/No: two buttons
- Free text: auto-focuses input area
- Sticky prompt bar: pins to bottom when Claude is waiting
- Keyboard: Y (accept), N (reject), A (allow all for session)

## Session Management

- Multiple sessions via tabs
- Session persistence: last session auto-loaded on project reopen
- Session history: browse and resume past sessions
- Editor state restore: open tabs, active tab, scroll positions
- Each session is an independent Claude Code SDK session

## Error Handling

- Process crashes: show error card + [Restart Session] button, preserve conversation in DOM
- API errors/rate limits: render as styled error cards with [Retry] button
- Hung processes (>5min): show [Cancel] button, sends SIGINT
- File system errors: warning banner at top of app
- Each session tab independent -- one crash doesn't affect others

## Conventions

- TypeScript strict mode
- Functional React components with hooks
- File naming: PascalCase for components, camelCase for utilities
- One component per file
- Tailwind classes, no CSS files except for CodeMirror themes
- Zustand: named imports, one store per domain (editor, fileTree, claudeCode, sessions)
- ESLint flat config + Prettier for formatting
- No semicolons, single quotes (Prettier default can be configured)
