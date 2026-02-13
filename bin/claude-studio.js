#!/usr/bin/env node

const path = require('path')
const net = require('net')
const { spawn } = require('child_process')
const os = require('os')

const SOCKET_PATH = path.join(os.homedir(), '.claude-studio', 'ipc.sock')

// Resolve directory argument
const dirArg = process.argv[2] || '.'
const projectDir = path.resolve(dirArg)

// Try to connect to existing instance
const client = net.createConnection(SOCKET_PATH, () => {
  // Send open-directory command
  client.write(JSON.stringify({ type: 'open-directory', path: projectDir }))
  client.end()
  process.exit(0)
})

client.on('error', () => {
  // No existing instance — launch Electron
  const electronPath = path.join(__dirname, '..', 'node_modules', '.bin', 'electron')
  const mainPath = path.join(__dirname, '..', 'out', 'main', 'index.js')

  const child = spawn(electronPath, [mainPath, projectDir], {
    detached: true,
    stdio: 'ignore',
  })

  child.unref()
  process.exit(0)
})
