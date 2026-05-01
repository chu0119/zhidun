import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import readline from 'readline'
import { createHash } from 'crypto'
import { createAppMenu } from './menu'
import { setupContextMenu } from './context-menu'
import { setupAutoUpdater } from './updater'
import { streamAnalyze, StreamingRule } from './streaming-analyzer'
import { startMonitor, stopMonitor, stopAllMonitors, testSSHConnection, MonitorConfig, MonitorSSHConfig } from './realtime-monitor'

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

app.on('before-quit', () => {
  stopAllMonitors()
})

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

// 路径安全校验：防止路径穿越攻击
function validatePath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false
  const normalized = path.normalize(filePath)
  // 禁止 .. 组件（防止目录穿越）
  if (normalized.includes('..')) return false
  // 禁止 null 字节
  if (normalized.includes('\x00')) return false
  return true
}

// SSRF 防护：HTTP 请求域名白名单
const ALLOWED_HTTP_HOSTS = [
  'ip-api.com',
  'ipapi.co',
  'ipwhois.app',
  'ipinfo.io',
  'api.telegram.org',
  'open.feishu.cn',
  'oapi.dingtalk.com',
  'qyapi.weixin.qq.com',
  'sctapi.ftqq.com',
  'www.pushplus.plus',
  'api.day.app',
]

function isAllowedHttpHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    return ALLOWED_HTTP_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host))
  } catch {
    return false
  }
}

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
    if (!validatePath(folderPath)) return { success: false, error: '无效的路径', files: [] }
    try {
      const extensions = ['.log', '.txt', '.csv', '.json', '.ndjson', '.jsonl', '.gz']
      const files: string[] = []
      const entries = await fs.promises.readdir(folderPath, { withFileTypes: true })
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
    if (!validatePath(filePath)) return { success: false, error: '无效的文件路径' }
    try {
      const buffer = await fs.promises.readFile(filePath)
      return { success: true, data: buffer.toString('base64'), size: buffer.length }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Read file as text with encoding detection
  ipcMain.handle('file:readText', async (_, filePath: string) => {
    if (!validatePath(filePath)) return { success: false, error: '无效的文件路径' }
    try {
      const chardet = require('chardet')
      const buffer = await fs.promises.readFile(filePath)
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
    if (!validatePath(filePath)) return { success: false, error: '无效的文件路径', lines: [], totalLines: 0, encoding: 'utf-8' }
    try {
      const maxLines = options?.maxLines || 50000
      const chardet = require('chardet')

      // 先读一小块检测编码
      const sampleBuf = Buffer.alloc(64 * 1024)
      const fd = await fs.promises.open(filePath, 'r')
      const { bytesRead } = await fd.read(sampleBuf, 0, sampleBuf.length, 0)
      await fd.close()
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
        size: (await fs.promises.stat(filePath)).size,
        sampledLines: combined.size,
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 流式统计文件行数（快速，不保留内容）
  ipcMain.handle('file:countLines', async (_, filePath: string) => {
    if (!validatePath(filePath)) return { success: false, error: '无效的文件路径' }
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
    if (!validatePath(filePath)) return { success: false, error: '无效的文件路径', totalLines: 0, matchedLines: 0, matches: [], summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, categoryStats: {} }
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

  // Write file (atomic: write to temp file then rename)
  ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
    if (!validatePath(filePath)) return { success: false, error: '无效的文件路径' }
    try {
      const dir = path.dirname(filePath)
      await fs.promises.mkdir(dir, { recursive: true })
      const tmpPath = filePath + '.tmp.' + Date.now()
      await fs.promises.writeFile(tmpPath, content, 'utf-8')
      await fs.promises.rename(tmpPath, filePath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get file info
  ipcMain.handle('file:getInfo', async (_, filePath: string) => {
    if (!validatePath(filePath)) return { success: false, error: '无效的文件路径' }
    try {
      const stat = await fs.promises.stat(filePath)
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

  // Delete file
  ipcMain.handle('file:delete', async (_, filePath: string) => {
    if (!validatePath(filePath)) return { success: false, error: '无效的文件路径' }
    try {
      await fs.promises.unlink(filePath)
      return { success: true }
    } catch (error: any) {
      if (error.code === 'ENOENT') return { success: true }
      return { success: false, error: error.message }
    }
  })

  // Shell open external (只允许 http/https 协议)
  ipcMain.on('shell:openExternal', (_, url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(url)
      }
    } catch {
      // 无效 URL，忽略
    }
  })

  // Get app path
  ipcMain.handle('app:getPath', () => {
    return app.getPath('userData')
  })

  // Get version
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  // Get machine-specific ID (stable per OS installation)
  ipcMain.handle('app:getMachineId', () => {
    const userData = app.getPath('userData')
    return createHash('sha256').update(userData + '_zhidun_machine').digest('hex').slice(0, 32)
  })

  // HTTP request (用于 GeoIP 等外部 API 调用，避免 CORS 限制)
  ipcMain.handle('http:request', async (_, url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }) => {
    if (!isAllowedHttpHost(url)) {
      return { success: false, error: `不允许的请求目标: ${new URL(url).hostname}` }
    }
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

  // GeoIP 离线查询（使用 geoip-lite，分批让步避免阻塞事件循环）
  ipcMain.handle('geoip:lookup', async (_, ips: string[]) => {
    try {
      const geoip = require('geoip-lite')
      const results: Record<string, any> = {}
      const BATCH_SIZE = 100
      for (let i = 0; i < ips.length; i += BATCH_SIZE) {
        const batch = ips.slice(i, i + BATCH_SIZE)
        for (const ip of batch) {
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
        // 让出事件循环，使其他 IPC 请求（如设置保存）有机会执行
        if (i + BATCH_SIZE < ips.length) {
          await new Promise<void>(resolve => setImmediate(resolve))
        }
      }
      return { success: true, results }
    } catch (error: any) {
      return { success: false, error: error.message, results: {} }
    }
  })

  // ==================== 实时监控 ====================

  // 启动实时监控
  ipcMain.handle('realtime:start', async (_, config: MonitorConfig) => {
    try {
      const result = await startMonitor(config, (data) => {
        mainWindow?.webContents.send('realtime:data', data)
      })
      return result
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 停止实时监控
  ipcMain.handle('realtime:stop', async (_, monitorId: string) => {
    try {
      return stopMonitor(monitorId)
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 测试 SSH 连接
  ipcMain.handle('realtime:testSSH', async (_, sshConfig: MonitorSSHConfig) => {
    try {
      return await testSSHConnection(sshConfig)
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ==================== 通知渠道 IPC ====================

  // 邮件发送 (SMTP)
  ipcMain.handle('email:send', async (_, options: { host: string; port: number; user: string; pass: string; from: string; to: string; subject: string; html: string }) => {
    try {
      const nodemailer = require('nodemailer')
      const transporter = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.port === 465,
        auth: { user: options.user, pass: options.pass },
      })
      await transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 桌面通知
  ipcMain.handle('notification:desktop', async (_, options: { title: string; body: string; severity: string }) => {
    const { Notification } = require('electron')
    if (Notification.isSupported()) {
      new Notification({
        title: options.title,
        body: options.body,
        silent: false,
      }).show()
    }
    return { success: true }
  })

  // 声音告警
  ipcMain.handle('notification:playSound', async (_, severity: string) => {
    if (mainWindow && (severity === 'critical' || severity === 'high')) {
      mainWindow.webContents.send('notification:play-sound', severity)
    }
    return { success: true }
  })
}
