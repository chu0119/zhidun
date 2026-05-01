import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import readline from 'readline'
import { createAppMenu } from './menu'
import { setupContextMenu } from './context-menu'
import { setupAutoUpdater } from './updater'
import { streamAnalyze, StreamingRule } from './streaming-analyzer'

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

  // 流式读取大文件：采样 + 威胁行优先
  ipcMain.handle('file:readLargeText', async (_, filePath: string, options?: {
    maxLines?: number
    encoding?: string
  }) => {
    try {
      const maxLines = options?.maxLines || 50000
      const chardet = require('chardet')

      // 先读一小块检测编码
      const sampleBuf = Buffer.alloc(64 * 1024)
      const fd = fs.openSync(filePath, 'r')
      const bytesRead = fs.readSync(fd, sampleBuf, 0, sampleBuf.length, 0)
      fs.closeSync(fd)
      const detectedEncoding = chardet.detect(sampleBuf.slice(0, bytesRead)) || 'utf-8'
      const encoding = options?.encoding || detectedEncoding

      // 威胁关键词（用于优先保留攻击行）
      const threatRe = /union\s+select|<script|onerror=|onload=|alert\(|etc\/passwd|passwd|shadow|\.\.\/|cmd|exec|eval\(|system\(|shell|wget|curl|sqlmap|nikto|nmap|burp|hydra|sleep\(|benchmark|drop\s+table|insert\s+into|delete\s+from|__proto__|constructor\.prototype|\$where|\$gt|\$ne|\$regex|file:\/\/|gopher:\/\/|dict:\/\/|169\.254\.169\.254|\(\)\s*\{.*\;\}|\/bin\/(bash|sh)|powershell|base64|deserializ|pickle|jndi:|ldap:|xml.*entity|DOCTYPE/i

      // 流式读取 + 蓄水池采样
      const reservoir: string[] = []
      const threatLines: string[] = []
      let totalLines = 0

      const iconv = require('iconv-lite')
      const stream = fs.createReadStream(filePath)
      const decoded = stream.pipe(iconv.decodeStream(encoding))
      const rl = readline.createInterface({ input: decoded, crlfDelay: Infinity })

      for await (const line of rl) {
        if (!line.trim()) continue
        totalLines++

        const isThreat = threatRe.test(line)

        // 蓄水池采样：前 maxLines 行直接保留，之后以概率 maxLines/totalLines 替换
        if (reservoir.length < maxLines) {
          reservoir.push(line)
        } else {
          const j = Math.floor(Math.random() * totalLines)
          if (j < maxLines) {
            reservoir[j] = line
          }
        }

        // 威胁行单独保留（最多 maxLines 的 30%）
        if (isThreat && threatLines.length < Math.floor(maxLines * 0.3)) {
          threatLines.push(line)
        }
      }

      // 合并：威胁行 + 采样行，去重后按原始顺序
      const combined = new Set<string>(threatLines)
      for (const line of reservoir) combined.add(line)

      return {
        success: true,
        lines: Array.from(combined),
        totalLines,
        encoding,
        size: fs.statSync(filePath).size,
        sampledLines: combined.size,
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 流式统计文件行数（快速，不保留内容）
  ipcMain.handle('file:countLines', async (_, filePath: string) => {
    try {
      let count = 0
      const stream = fs.createReadStream(filePath)
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
      for await (const _ of rl) {
        count++
      }
      return { success: true, totalLines: count }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 流式规则引擎全量扫描（大文件专用，不采样，逐行匹配）
  ipcMain.handle('file:streamAnalyze', async (_, filePath: string, rules: StreamingRule[]) => {
    try {
      const result = await streamAnalyze(filePath, rules, {
        maxMatches: 50000,
        onProgress: (linesScanned, matchesFound) => {
          // 通过 webContents 发送进度到渲染进程
          mainWindow?.webContents.send('stream:progress', { linesScanned, matchesFound })
        },
      })
      return result
    } catch (error: any) {
      return { success: false, error: error.message, totalLines: 0, matchedLines: 0, matches: [], summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, categoryStats: {} }
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

  // GeoIP 离线查询（使用 geoip-lite）
  ipcMain.handle('geoip:lookup', async (_, ips: string[]) => {
    try {
      const geoip = require('geoip-lite')
      const results: Record<string, any> = {}
      for (const ip of ips) {
        const r = geoip.lookup(ip)
        if (r) {
          results[ip] = {
            country: r.country || '',
            region: r.region || '',
            city: r.city || '',
            lat: r.ll?.[0] || 0,
            lon: r.ll?.[1] || 0,
            timezone: r.timezone || '',
          }
        }
      }
      return { success: true, results }
    } catch (error: any) {
      return { success: false, error: error.message, results: {} }
    }
  })
}
