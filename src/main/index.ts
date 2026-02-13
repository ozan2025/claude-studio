import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createApplicationMenu } from './menu'
import { registerIpcHandlers } from './ipc-handlers'
import { setProjectRoot, startWatching, stopWatching } from './file-system'
import { claudeCodeManager } from './claude-code'
import { startIpcSocket, stopIpcSocket } from './ipc-socket'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.claude-studio.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createApplicationMenu()
  registerIpcHandlers()

  // Determine project root: env var > CLI arg > cwd
  const projectPath =
    process.env.CLAUDE_STUDIO_PROJECT ||
    process.argv.find(
      (arg) => !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1],
    ) ||
    process.cwd()
  console.log(
    `[claude-studio] project root: ${projectPath} (env=${process.env.CLAUDE_STUDIO_PROJECT ?? 'unset'})`,
  )
  setProjectRoot(projectPath)

  const mainWindow = createWindow()
  claudeCodeManager.setWindow(mainWindow)
  startWatching(mainWindow)

  // Start IPC socket for CLI launcher
  startIpcSocket((dirPath) => {
    // Open new window with the requested directory
    setProjectRoot(dirPath)
    const win = createWindow()
    claudeCodeManager.setWindow(win)
    startWatching(win)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow()
      claudeCodeManager.setWindow(win)
      startWatching(win)
    }
  })
})

app.on('window-all-closed', () => {
  stopWatching()
  stopIpcSocket()
  claudeCodeManager.killAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
