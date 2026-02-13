# Claude Studio

A lightweight Electron desktop editor purpose-built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Replaces VS Code for developers who use Claude Code as their primary coding interface.

**Think:** VS Code minus everything except what Claude Code users need.

## Why?

Power users of Claude Code use VS Code as a glorified file browser. They don't use IntelliSense, debugging, extensions, or 95% of VS Code's features — Claude Code handles all editing, debugging, search, git, and terminal operations.

Claude Studio strips away the overhead and gives you exactly three things:

1. **A file tree** to browse your project
2. **A code editor** to review changes and edit config files
3. **A first-class Claude Code panel** as the primary interface

That's it. No extensions, no marketplace, no 180MB of features you'll never touch.

## Features

- **Native Claude Code integration** via the official `@anthropic-ai/claude-agent-sdk` V2 Session API
- **Three-panel layout** — File tree (20%) | Editor (40%) | Claude Code (40%), all resizable
- **Permission cards** — Accept/Reject with "Allow all for session" (keyboard: Y/N/A)
- **Edit approval UI** — Accept All / Reject All / Review Each with inline diffs
- **Multiple choice & yes/no prompts** rendered as clickable buttons
- **Plan mode** — full plan/approve/execute workflow
- **Multiple sessions** via tabs with independent state
- **Session persistence** — last session auto-restored on project reopen
- **Session history** — browse and resume past sessions
- **External session support** — load and continue sessions from Claude Code CLI or VS Code
- **Cross-interface sync** — switch between CLI, VS Code, and Studio on the same session
- **Editor state restore** — open tabs, active tab, and scroll positions preserved
- **`@` file autocomplete** — reference project files in your messages
- **Screenshot/image paste** — Cmd+V images into Claude Code input
- **Inline diff viewer** with accept/reject
- **Auto-open files** that Claude edits
- **Clickable file references** in Claude's output
- **Copy buttons** on code blocks
- **Quick actions** — New Session, /compact, /clear
- **Keyboard shortcuts** — Cmd+L (focus input), Cmd+B (toggle tree), Cmd+P (quick open)
- **MCP server support** — reads from your `~/.claude.json` configuration
- **Skills and settings** — loads user/project/local settings automatically

## Prerequisites

- **Node.js 20+**
- **Claude Code CLI** installed and authenticated (`claude --version`)
- **Anthropic API key** configured via Claude Code

## Quick Start

```bash
git clone https://github.com/ozan2025/claude-studio.git
cd claude-studio
npm install
npm run dev
```

Or open a project directly:

```bash
claude-studio /path/to/your/project
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Menu Bar                                               │
├────────────┬────────────────────┬───────────────────────┤
│            │                    │                       │
│  File Tree │   Editor Panel     │   Claude Code Panel   │
│   (20%)    │     (40%)          │      (40%)            │
│            │                    │                       │
│  Browse    │  CodeMirror 6      │  Conversation view    │
│  files     │  Syntax highlight  │  Permission cards     │
│  Filter    │  Inline diffs      │  Session tabs         │
│            │  Tab bar           │  Input area           │
│            │                    │                       │
├────────────┴────────────────────┴───────────────────────┤
│  Status Bar: File path | Claude Code status             │
└─────────────────────────────────────────────────────────┘
```

**Data flow:**

```
Renderer (React/Zustand)  ←──IPC──→  Main Process (Electron/Node)
                                          │
                                          ├── Claude Agent SDK (V2 Session API)
                                          ├── File system (chokidar for watching)
                                          └── Session persistence (~/.claude-studio/)
```

- **Electron main process** (CJS) — SDK integration, file ops, IPC handlers
- **React renderer** (ESM via Vite) — UI, Zustand state, user interaction
- **Preload bridge** — secure IPC between main and renderer
- The SDK is ESM-only — loaded via dynamic `import()` in the CJS main process

## Tech Stack

| Component | Technology | Version |
|---|---|---|
| Desktop framework | Electron | 40.2.1 |
| UI framework | React | 19.x |
| Language | TypeScript (strict) | 5.8.x |
| Styling | Tailwind CSS | 4.1.x |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) | 4.25.4 |
| Diff engine | jsdiff (`diff`) | 8.0.3 |
| File watching | chokidar | 4.x |
| State management | Zustand | 5.0.11 |
| Build tooling | electron-vite | 3.x |
| Packaging | electron-builder | 26.7.0 |
| Claude Code | `@anthropic-ai/claude-agent-sdk` | 0.2.37 |

## About the SDK Patches

During `npm install`, a `postinstall` script runs `scripts/patch-sdk.js`. This patches two hardcoded values in the Claude Agent SDK's V2 session constructor:

| What | SDK default | Patched to |
|---|---|---|
| MCP servers | `mcpServers: {}` | Reads from `~/.claude.json` |
| Settings sources | `settingSources: []` | `["user", "project", "local"]` |

This is necessary because the V2 API (`unstable_v2_createSession`) currently ignores these options. The patch is safe — it pattern-matches before replacing and becomes a no-op if the SDK updates to handle these natively.

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── claude-code.ts       # SDK V2 session management
│   ├── ipc-handlers.ts      # IPC bridge
│   ├── file-system.ts       # File operations + chokidar
│   └── external-sessions.ts # Load CLI/VS Code sessions
├── preload/                 # Electron preload scripts
├── renderer/                # React UI
│   └── src/
│       ├── components/      # Feature-based components
│       └── store/           # Zustand stores (one per domain)
└── shared/                  # Types shared across processes
```

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Focus Claude Code input | Cmd+L |
| Toggle file tree | Cmd+B |
| Toggle Claude panel | Cmd+J |
| Quick open file | Cmd+P |
| Find in file | Cmd+F |
| New session | Cmd+N |
| Accept permission | Y |
| Reject permission | N |
| Allow all for session | A |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, code conventions, and PR guidelines.

## License

[MIT](LICENSE) - Copyright (c) 2025-2026 Ozan Selcuk

## Author

**Ozan Selcuk** — [oselcuk2002@yahoo.com](mailto:oselcuk2002@yahoo.com)

Built with Claude Code.
