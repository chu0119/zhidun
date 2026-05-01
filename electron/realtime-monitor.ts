/**
 * 实时日志监控引擎
 * 支持本地文件监控 (fs.watch) 和 SSH 远程监控 (ssh2 + tail -f)
 */

import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { Client } from 'ssh2'
import type { StreamingRule } from './streaming-analyzer'

// ==================== 类型定义 ====================

export interface MonitorSSHConfig {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
}

export interface WhitelistConfig {
  enabled: boolean
  ipAddresses: string[]
  userAgents: string[]
}

export interface MonitorConfig {
  mode: 'local' | 'ssh'
  filePath: string
  rules: StreamingRule[]
  ssh?: MonitorSSHConfig
  whitelist?: WhitelistConfig
}

export interface RealtimeMatch {
  ruleId: string
  ruleName: string
  category: string
  severity: string
  lineNumber: number
  line: string
  matchedText: string
  description?: string
  remediation?: string
}

export interface RealtimeData {
  type: 'line' | 'match' | 'stats' | 'error' | 'connected'
  payload: any
}

type DataCallback = (data: RealtimeData) => void

// ==================== 规则编译 ====================

function parseRegex(patternStr: string): RegExp | null {
  try {
    const match = patternStr.match(/^\/(.+)\/([gimsuy]*)$/)
    if (match) return new RegExp(match[1], match[2])
    return new RegExp(patternStr, 'i')
  } catch {
    return null
  }
}

interface CompiledRule {
  rule: StreamingRule
  regexes: RegExp[]
}

function compileRules(rules: StreamingRule[]): CompiledRule[] {
  const compiled: CompiledRule[] = []
  for (const rule of rules) {
    const regexes: RegExp[] = []
    for (const p of rule.patterns) {
      const r = parseRegex(p)
      if (r) regexes.push(r)
    }
    if (regexes.length > 0) {
      compiled.push({ rule, regexes })
    }
  }
  return compiled
}

function matchLine(line: string, compiledRules: CompiledRule[]): RealtimeMatch | null {
  for (const { rule, regexes } of compiledRules) {
    for (const regex of regexes) {
      regex.lastIndex = 0
      const m = regex.exec(line)
      if (m) {
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          lineNumber: 0, // 由调用方设置
          line: line.length > 200 ? line.substring(0, 200) + '...' : line,
          matchedText: m[0].substring(0, 80),
          description: rule.description,
          remediation: rule.remediation,
        }
      }
    }
  }
  return null
}

// ==================== 白名单检查（主进程版本） ====================

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
}

function matchCIDR(ip: string, cidr: string): boolean {
  if (!ip || !cidr) return false
  const [range, bits] = cidr.split('/')
  if (!bits) return ip === range
  const mask = ~(2 ** (32 - parseInt(bits)) - 1)
  return (ipToNum(ip) & mask) === (ipToNum(range) & mask)
}

function isWhitelisted(line: string, whitelist: WhitelistConfig): boolean {
  if (!whitelist.enabled) return false

  // IP 白名单
  const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/)
  const lineIP = ipMatch ? ipMatch[1] : ''
  for (const ip of whitelist.ipAddresses) {
    if (ip.includes('/')) {
      if (lineIP && matchCIDR(lineIP, ip)) return true
    } else {
      if (line.includes(ip)) return true
    }
  }

  // User-Agent 白名单
  const lowerLine = line.toLowerCase()
  for (const ua of whitelist.userAgents) {
    if (lowerLine.includes(ua.toLowerCase())) return true
  }

  return false
}

// ==================== 本地监控 ====================

class LocalMonitor {
  private watcher: fs.FSWatcher | null = null
  private lastSize: number = 0
  private buffer: string = ''
  private lineCount: number = 0
  private matchCount: number = 0
  private summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  private categoryStats: Record<string, number> = {}
  private compiledRules: CompiledRule[]
  private onData: DataCallback
  private filePath: string
  private whitelist: WhitelistConfig | null
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private pendingLines: string[] = []
  private pendingMatches: RealtimeMatch[] = []
  private reading: boolean = false

  constructor(config: MonitorConfig, onData: DataCallback) {
    this.compiledRules = compileRules(config.rules)
    this.onData = onData
    this.filePath = config.filePath
    this.whitelist = config.whitelist || null
  }

  start(): { success: boolean; error?: string } {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { success: false, error: `文件不存在: ${this.filePath}` }
      }

      const stat = fs.statSync(this.filePath)
      if (!stat.isFile()) {
        return { success: false, error: `不是文件: ${this.filePath}` }
      }

      this.lastSize = stat.size

      // 先读取最后 100 行作为上下文（不发送匹配告警，仅建立基线），完成后再启动 watcher
      this.readTail(100).then(() => {
        this.watcher = fs.watch(this.filePath, (eventType) => {
          if (eventType === 'change') {
            this.readNewLines()
          }
        })
      })

      // 定时刷新批量数据（每 2 秒）
      this.flushTimer = setInterval(() => this.flush(), 2000)

      this.onData({ type: 'connected', payload: { filePath: this.filePath, mode: 'local' } })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.flush()
  }

  private async readTail(lines: number) {
    let fd: fs.promises.FileHandle | undefined
    try {
      // 只读最后 64KB，避免大文件全量读取
      const stat = await fs.promises.stat(this.filePath)
      const readSize = Math.min(stat.size, 64 * 1024)
      fd = await fs.promises.open(this.filePath, 'r')
      const buf = Buffer.alloc(readSize)
      await fd.read(buf, 0, readSize, Math.max(0, stat.size - readSize))
      await fd.close()
      fd = undefined

      const content = buf.toString('utf-8')
      const allLines = content.split(/\r?\n/).filter(l => l.trim())
      const tailLines = allLines.slice(-lines)
      this.lineCount = tailLines.length
      for (const line of tailLines) {
        this.processLine(line, true) // suppressMatches = true
      }
      this.flush()
    } catch {
      // 编码问题时忽略
    } finally {
      if (fd) await fd.close().catch(() => {})
    }
  }

  private async readNewLines() {
    if (this.reading) return
    this.reading = true
    try {
      const stat = await fs.promises.stat(this.filePath)
      const newSize = stat.size

      if (newSize < this.lastSize) {
        // 文件被截断（日志轮转），从头开始
        this.lastSize = 0
      }

      if (newSize === this.lastSize) return

      let fd: fs.promises.FileHandle | undefined
      try {
        fd = await fs.promises.open(this.filePath, 'r')
        const buf = Buffer.alloc(newSize - this.lastSize)
        await fd.read(buf, 0, buf.length, this.lastSize)
        this.lastSize = newSize

        const text = this.buffer + buf.toString('utf-8')
        const lines = text.split(/\r?\n/)
        this.buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            this.processLine(line)
          }
        }
      } finally {
        if (fd) await fd.close()
      }
    } catch {
      // 文件可能正在写入
    } finally {
      this.reading = false
    }
  }

  private processLine(line: string, suppressMatches = false) {
    this.lineCount++

    // 白名单检查 - 跳过规则匹配
    if (this.whitelist && isWhitelisted(line, this.whitelist)) {
      this.pendingLines.push(line)
      return
    }

    const match = matchLine(line, this.compiledRules)
    if (match) {
      match.lineNumber = this.lineCount
      this.matchCount++
      this.summary[match.severity as keyof typeof this.summary]++
      this.categoryStats[match.category] = (this.categoryStats[match.category] || 0) + 1
      if (!suppressMatches) {
        this.pendingMatches.push(match)
      }
    }
    this.pendingLines.push(line)
  }

  private flush() {
    if (this.pendingLines.length === 0 && this.pendingMatches.length === 0) return

    if (this.pendingLines.length > 0) {
      this.onData({
        type: 'line',
        payload: { lines: this.pendingLines.splice(0) }
      })
    }

    if (this.pendingMatches.length > 0) {
      this.onData({
        type: 'match',
        payload: { matches: this.pendingMatches.splice(0) }
      })
    }

    this.onData({
      type: 'stats',
      payload: {
        totalLines: this.lineCount,
        matchedLines: this.matchCount,
        summary: { ...this.summary },
        categoryStats: { ...this.categoryStats },
      }
    })
  }
}

// ==================== SSH 监控 ====================

class SSHMonitor {
  private ssh: Client | null = null
  private lineCount: number = 0
  private matchCount: number = 0
  private summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  private categoryStats: Record<string, number> = {}
  private compiledRules: CompiledRule[]
  private onData: DataCallback
  private filePath: string
  private sshConfig: MonitorSSHConfig
  private whitelist: WhitelistConfig | null
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private pendingLines: string[] = []
  private pendingMatches: RealtimeMatch[] = []
  private lineBuffer: string = ''

  constructor(config: MonitorConfig, onData: DataCallback) {
    this.compiledRules = compileRules(config.rules)
    this.onData = onData
    this.filePath = config.filePath
    this.sshConfig = config.ssh!
    this.whitelist = config.whitelist || null
  }

  start(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        this.ssh = new Client()

        const connectConfig: any = {
          host: this.sshConfig.host,
          port: this.sshConfig.port || 22,
          username: this.sshConfig.username,
          readyTimeout: 10000,
        }

        if (this.sshConfig.privateKey) {
          connectConfig.privateKey = this.sshConfig.privateKey
        } else if (this.sshConfig.password) {
          connectConfig.password = this.sshConfig.password
        }

        this.ssh.on('ready', () => {
          // Validate path: no null bytes, no control characters (including newline/tab)
          if (/[\x00-\x1f]/.test(this.filePath)) {
            resolve({ success: false, error: '文件路径包含非法字符' })
            return
          }
          const escapedPath = this.filePath.replace(/'/g, "'\\''")
          this.ssh!.exec(`tail -n 100 -f -- '${escapedPath}'`, (err: Error | undefined, stream: any) => {
            if (err) {
              resolve({ success: false, error: `执行命令失败: ${err.message}` })
              return
            }

            stream.on('data', (data: Buffer) => {
              this.handleStreamData(data)
            })

            stream.stderr.on('data', (data: Buffer) => {
              const msg = data.toString().trim()
              if (msg) {
                this.onData({ type: 'error', payload: { message: msg } })
              }
            })

            stream.on('close', () => {
              this.onData({ type: 'error', payload: { message: 'SSH 连接已断开' } })
            })

            this.flushTimer = setInterval(() => this.flush(), 2000)
            this.onData({ type: 'connected', payload: { filePath: this.filePath, mode: 'ssh', host: this.sshConfig.host } })
            resolve({ success: true })
          })
        })

        this.ssh.on('error', (err) => {
          resolve({ success: false, error: `SSH 连接失败: ${err.message}` })
        })

        this.ssh.on('close', () => {
          this.onData({ type: 'error', payload: { message: 'SSH 连接已关闭' } })
        })

        this.ssh.connect(connectConfig)
      } catch (error: any) {
        resolve({ success: false, error: error.message })
      }
    })
  }

  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    this.flush()
    if (this.ssh) {
      this.ssh.end()
      this.ssh = null
    }
  }

  private handleStreamData(data: Buffer) {
    const text = this.lineBuffer + data.toString('utf-8')
    const lines = text.split(/\r?\n/)
    this.lineBuffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        this.processLine(line)
      }
    }
  }

  private processLine(line: string) {
    this.lineCount++

    // 白名单检查 - 跳过规则匹配
    if (this.whitelist && isWhitelisted(line, this.whitelist)) {
      this.pendingLines.push(line)
      return
    }

    const match = matchLine(line, this.compiledRules)
    if (match) {
      match.lineNumber = this.lineCount
      this.matchCount++
      this.summary[match.severity as keyof typeof this.summary]++
      this.categoryStats[match.category] = (this.categoryStats[match.category] || 0) + 1
      this.pendingMatches.push(match)
    }
    this.pendingLines.push(line)
  }

  private flush() {
    if (this.pendingLines.length === 0 && this.pendingMatches.length === 0) return

    if (this.pendingLines.length > 0) {
      this.onData({
        type: 'line',
        payload: { lines: this.pendingLines.splice(0) }
      })
    }

    if (this.pendingMatches.length > 0) {
      this.onData({
        type: 'match',
        payload: { matches: this.pendingMatches.splice(0) }
      })
    }

    this.onData({
      type: 'stats',
      payload: {
        totalLines: this.lineCount,
        matchedLines: this.matchCount,
        summary: { ...this.summary },
        categoryStats: { ...this.categoryStats },
      }
    })
  }
}

// ==================== 管理器 ====================

const activeMonitors = new Map<string, { monitor: LocalMonitor | SSHMonitor; mode: string }>()
let monitorIdCounter = 0

export async function startMonitor(
  config: MonitorConfig,
  onData: DataCallback
): Promise<{ success: boolean; monitorId?: string; error?: string }> {
  const id = `monitor_${++monitorIdCounter}_${Date.now()}`

  if (config.mode === 'local') {
    const monitor = new LocalMonitor(config, onData)
    const result = monitor.start()
    if (result.success) {
      activeMonitors.set(id, { monitor, mode: 'local' })
      return { success: true, monitorId: id }
    }
    return { success: false, error: result.error }
  } else {
    const monitor = new SSHMonitor(config, onData)
    const result = await monitor.start()
    if (result.success) {
      activeMonitors.set(id, { monitor, mode: 'ssh' })
      return { success: true, monitorId: id }
    }
    return { success: false, error: result.error }
  }
}

export function stopMonitor(monitorId: string): { success: boolean; error?: string } {
  const entry = activeMonitors.get(monitorId)
  if (!entry) {
    return { success: false, error: '监控实例不存在' }
  }
  entry.monitor.stop()
  activeMonitors.delete(monitorId)
  return { success: true }
}

export function stopAllMonitors(): void {
  for (const [, entry] of activeMonitors) {
    entry.monitor.stop()
  }
  activeMonitors.clear()
}

export function testSSHConnection(config: MonitorSSHConfig): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const ssh = new Client()

    const connectConfig: any = {
      host: config.host,
      port: config.port || 22,
      username: config.username,
      readyTimeout: 10000,
    }

    if (config.privateKey) {
      connectConfig.privateKey = config.privateKey
    } else if (config.password) {
      connectConfig.password = config.password
    }

    ssh.on('ready', () => {
      ssh.exec('echo "zhidun_test_ok"', (err, stream) => {
        if (err) {
          ssh.end()
          resolve({ success: false, error: `执行测试命令失败: ${err.message}` })
          return
        }
        let resolved = false
        stream.on('close', () => {
          if (!resolved) { resolved = true; ssh.end(); resolve({ success: true }) }
        })
        stream.stderr.on('data', (data: Buffer) => {
          if (!resolved) { resolved = true; ssh.end(); resolve({ success: false, error: data.toString() }) }
        })
      })
    })

    ssh.on('error', (err) => {
      resolve({ success: false, error: `SSH 连接失败: ${err.message}` })
    })

    ssh.connect(connectConfig)
  })
}
