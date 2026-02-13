/**
 * Patches @anthropic-ai/claude-agent-sdk V2 session constructor.
 *
 * The V2 constructor hardcodes two values that ignore caller options:
 *   1. `mcpServers: {}` — ignores MCP servers passed in options
 *   2. `settingSources: []` — skips all settings files (no skills, no permissions)
 *
 * This script patches both to pass through from options, with sensible defaults:
 *   1. `mcpServers: X.mcpServers ?? {}`
 *   2. `settingSources: X.settingSources ?? ["user","project","local"]`
 *
 * Runs automatically via `postinstall` in package.json.
 */

const fs = require('fs')
const path = require('path')

const sdkPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@anthropic-ai',
  'claude-agent-sdk',
  'sdk.mjs',
)

if (!fs.existsSync(sdkPath)) {
  console.log('[patch-sdk] SDK not found, skipping')
  process.exit(0)
}

let src = fs.readFileSync(sdkPath, 'utf-8')
let patched = false

// Patch 1: mcpServers
const mcpBefore = 'mcpServers:{},strictMcpConfig:!1'
const mcpAfter = 'mcpServers:X.mcpServers??{},strictMcpConfig:!1'

if (src.includes(mcpAfter)) {
  console.log('[patch-sdk] mcpServers: already patched')
} else if (src.includes(mcpBefore)) {
  src = src.replace(mcpBefore, mcpAfter)
  patched = true
  console.log('[patch-sdk] mcpServers: patched')
} else {
  console.log('[patch-sdk] WARNING: mcpServers pattern not found — SDK version may have changed')
}

// Patch 2: settingSources
const settingsBefore = 'settingSources:[],'
const settingsAfter = 'settingSources:X.settingSources??["user","project","local"],'

if (src.includes(settingsAfter)) {
  console.log('[patch-sdk] settingSources: already patched')
} else if (src.includes(settingsBefore)) {
  // Only patch the one inside the V2 constructor (class U9), not other occurrences.
  // The V2 occurrence is near `resume:X.resume` — use that as context.
  const v2Pattern = 'resume:X.resume,' + settingsBefore
  const v2Replace = 'resume:X.resume,' + settingsAfter
  if (src.includes(v2Pattern)) {
    src = src.replace(v2Pattern, v2Replace)
    patched = true
    console.log('[patch-sdk] settingSources: patched')
  } else {
    console.log('[patch-sdk] WARNING: settingSources V2 context not found')
  }
} else {
  console.log('[patch-sdk] WARNING: settingSources pattern not found — SDK version may have changed')
}

if (patched) {
  fs.writeFileSync(sdkPath, src, 'utf-8')
  console.log('[patch-sdk] All patches applied')
} else {
  console.log('[patch-sdk] No changes needed')
}
