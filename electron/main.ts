import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { createAppMenu } from './menu'
import { setupContextMenu } from './context-menu'
import { setupAutoUpdater } from './updater'

let mainWindow: BrowserWindow | null = null

const DIST = path.join(__dirname, '../dist')
const PRELOAD = path.join(__dirname, './preload.js')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0e1a',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: PRELOAD,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // 启动时自动最大化
  mainWindow.maximize()

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    mainWindow = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  setupIPC()

  if (mainWindow) {
    const menu = createAppMenu(mainWindow)
    Menu.setApplicationMenu(menu)
    setupContextMenu(mainWindow)
    setupAutoUpdater(mainWindow)
  }
})

// ==================== IPC Handlers ====================

function setupIPC() {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

  // File dialog
  ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择日志文件',
      filters: [
        { name: '日志文件', extensions: ['log', 'txt', 'csv', 'json', 'ndjson', 'jsonl'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Open folder dialog
  ipcMain.handle('dialog:openFolder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择日志文件夹',
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // List log files in folder
  ipcMain.handle('folder:listLogFiles', async (_, folderPath: string) => {
    try {
      const extensions = ['.log', '.txt', '.csv', '.json', '.ndjson', '.jsonl', '.gz']
      const files: string[] = []
      const entries = fs.readdirSync(folderPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (extensions.includes(ext)) {
            files.push(path.join(folderPath, entry.name))
          }
        }
      }
      return { success: true, files }
    } catch (error: any) {
      return { success: false, error: error.message, files: [] }
    }
  })

  // Save dialog
  ipcMain.handle('dialog:saveFile', async (_, options: { title: string; filters: { name: string; extensions: string[] }[]; defaultPath?: string }) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      title: options.title,
      filters: options.filters,
      defaultPath: options.defaultPath,
    })
    return result.canceled ? null : result.filePath
  })

  // Read file
  ipcMain.handle('file:read', async (_, filePath: string) => {
    try {
      const buffer = fs.readFileSync(filePath)
      return { success: true, data: buffer.toString('base64'), size: buffer.length }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Read file as text with encoding detection
  ipcMain.handle('file:readText', async (_, filePath: string) => {
    try {
      const chardet = require('chardet')
      const buffer = fs.readFileSync(filePath)
      const encoding = chardet.detect(buffer) || 'utf-8'
      const iconv = require('iconv-lite')
      const text = iconv.decode(buffer, encoding)
      return { success: true, text, encoding, size: buffer.length }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Write file
  ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
    try {
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, content, 'utf-8')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get file info
  ipcMain.handle('file:getInfo', async (_, filePath: string) => {
    try {
      const stat = fs.statSync(filePath)
      return {
        success: true,
        info: {
          name: path.basename(filePath),
          size: stat.size,
          sizeMB: Math.round((stat.size / (1024 * 1024)) * 100) / 100,
          extension: path.extname(filePath).toLowerCase(),
          modifiedTime: stat.mtime.toISOString(),
        },
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Shell open external
  ipcMain.on('shell:openExternal', (_, url: string) => {
    shell.openExternal(url)
  })

  // Get app path
  ipcMain.handle('app:getPath', () => {
    return app.getPath('userData')
  })

  // Get version
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  // HTTP request (用于 GeoIP 等外部 API 调用，避免 CORS 限制)
  ipcMain.handle('http:request', async (_, url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }) => {
    try {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        body: options?.body,
        headers: options?.headers,
      })
      const text = await response.text()
      return { success: true, status: response.status, data: text }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
