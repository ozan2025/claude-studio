import * as net from 'net'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { app } from 'electron'

const SOCKET_DIR = path.join(app.getPath('home'), '.claude-studio')

// Per-instance socket so multiple instances don't clobber each other.
// Uses the userData path (already hashed per project in index.ts).
const instanceHash = crypto
  .createHash('md5')
  .update(app.getPath('userData'))
  .digest('hex')
  .slice(0, 8)
const SOCKET_PATH = path.join(SOCKET_DIR, `ipc-${instanceHash}.sock`)

let server: net.Server | null = null

export function startIpcSocket(onOpenDirectory: (dirPath: string) => void): void {
  // Ensure directory exists
  fs.mkdirSync(SOCKET_DIR, { recursive: true })

  // Remove stale socket
  try {
    fs.unlinkSync(SOCKET_PATH)
  } catch {
    // Socket may not exist
  }

  server = net.createServer((connection) => {
    let data = ''
    connection.on('data', (chunk) => {
      data += chunk.toString()
    })
    connection.on('end', () => {
      try {
        const msg = JSON.parse(data)
        if (msg.type === 'open-directory' && msg.path) {
          onOpenDirectory(msg.path)
        }
      } catch {
        // Invalid message
      }
    })
  })

  server.listen(SOCKET_PATH)
}

export function stopIpcSocket(): void {
  if (server) {
    server.close()
    server = null
  }
  try {
    fs.unlinkSync(SOCKET_PATH)
  } catch {
    // Socket may not exist
  }
}
