# Contributing to Claude Studio

Thanks for your interest in contributing! Claude Studio is a young project and contributions of all kinds are welcome.

## Getting Started

### Prerequisites

- **Node.js 20+** (for Electron 40's native module compatibility)
- **Claude Code CLI** installed and authenticated (`claude --version` should work)
- **Anthropic API key** configured via Claude Code

### Dev Setup

```bash
git clone https://github.com/oselcuk2002/claude-studio.git
cd claude-studio
npm install        # runs postinstall → patches SDK + installs Electron deps
npm run dev        # launches Electron in dev mode with hot reload
```

> **Note:** `npm install` runs `scripts/patch-sdk.js` automatically via `postinstall`. This patches the Claude Agent SDK to pass through MCP server config and settings sources. This is expected behavior, not a hack — see the README for details.

### Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier on all source files |
| `npx tsc --noEmit` | Type-check without emitting |

## Code Conventions

- **TypeScript** with `strict: true`
- **Prettier** for formatting (no semicolons, single quotes)
- **Functional React components** with hooks — no class components
- **Zustand** for state management — named imports only (`import { create } from 'zustand'`)
- **Tailwind CSS** for styling — no CSS files except CodeMirror themes
- **File naming:** PascalCase for components, camelCase for utilities
- One component per file

## Project Structure

```
src/
├── main/                    # Electron main process (CJS)
│   ├── index.ts             # App entry, window creation
│   ├── claude-code.ts       # SDK V2 session management
│   ├── ipc-handlers.ts      # IPC bridge (main ↔ renderer)
│   ├── file-system.ts       # File operations
│   ├── external-sessions.ts # Load CLI/VS Code sessions
│   ├── session-persistence.ts
│   └── editor-state-persistence.ts
├── preload/                 # Electron preload scripts
├── renderer/                # React UI (ESM via Vite)
│   └── src/
│       ├── App.tsx
│       ├── components/      # UI components (by feature)
│       │   ├── ClaudePanel/ # Conversation, messages, input
│       │   ├── Editor/      # CodeMirror editor + tabs
│       │   ├── FileTree/    # Project file browser
│       │   ├── Permissions/ # Permission cards, plan mode
│       │   ├── DiffViewer/  # Inline diff display
│       │   └── ...
│       └── store/           # Zustand stores (one per domain)
└── shared/                  # Types shared between main + renderer
```

## Architecture Notes

- **Electron main process** is CJS; **renderer** is ESM via electron-vite
- The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is ESM-only — loaded via dynamic `import()` in the CJS main process
- SDK uses the **V2 Session API** (`unstable_v2_createSession` / `unstable_v2_resumeSession`)
- All Claude Code communication goes through IPC — the renderer never touches the SDK directly

## Pull Request Workflow

1. Fork the repo and create a feature branch from `main`
2. Make your changes
3. Run `npm run lint` and `npm run format`
4. Run `npx tsc --noEmit` to verify types
5. Test with `npm run dev` — make sure the app launches and basic flows work
6. Open a PR with a clear description of what changed and why

### PR Guidelines

- Keep PRs focused — one feature or fix per PR
- Include before/after context if changing UI
- If adding a new store or IPC handler, document the pattern you followed
- Don't modify `scripts/patch-sdk.js` unless the SDK version changes

## Where to Find Things

| Looking for... | Go to... |
|---|---|
| How Claude Code SDK is integrated | `src/main/claude-code.ts` |
| How IPC handlers work | `src/main/ipc-handlers.ts` |
| UI components | `src/renderer/src/components/` |
| State management | `src/renderer/src/store/` |
| Shared types | `src/shared/` |
| SDK patch logic | `scripts/patch-sdk.js` |
| Product requirements | `PRD.md` |
| Build implementation history | `IMPLEMENTATION_PLAN.md` |

## Questions?

Open an issue! We're happy to help newcomers find their way around the codebase.
