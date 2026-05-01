// 日志解析器 - 从 Python core/log_parser.py 移植

import type { LogFormat, LogFileInfo } from '@/types/log'
import { MAX_LOG_FILE_SIZE, SUPPORTED_LOG_FORMATS } from './constants'

export class LogParser {
  private filePath: string
  private fileExtension: string

  constructor(filePath: string) {
    this.filePath = filePath
    this.fileExtension = this.getExtension(filePath)
  }

  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.')
    return lastDot >= 0 ? filePath.substring(lastDot).toLowerCase() : ''
  }

  static isSupportedFormat(filePath: string): boolean {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
    return SUPPORTED_LOG_FORMATS.includes(ext)
  }

  static getSupportedExtensions(): string[] {
    return [...SUPPORTED_LOG_FORMATS]
  }

  // 通过 Electron IPC 读取文件（自动选择普通/流式模式）
  async readFile(maxLines?: number): Promise<{ lines: string[]; encoding: string; totalLines: number }> {
    const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024 // 100MB

    // 先获取文件信息判断大小
    const info = await window.electronAPI.getFileInfo(this.filePath)
    const fileSize = info.success && info.info ? info.info.size : 0

    if (fileSize > LARGE_FILE_THRESHOLD) {
      // 大文件：流式读取 + 蓄水池采样
      const result = await window.electronAPI.readLargeTextFile(this.filePath, {
        maxLines: maxLines || 50000,
      })
      if (!result.success) {
        throw new Error(`读取文件失败: ${result.error}`)
      }
      return {
        lines: result.lines || [],
        encoding: result.encoding || 'utf-8',
        totalLines: result.totalLines || 0,
      }
    }

    // 小文件：一次性读取
    const result = await window.electronAPI.readTextFile(this.filePath)
    if (!result.success) {
      throw new Error(`读取文件失败: ${result.error}`)
    }

    const text = (result.text ?? '') as string
    const allLines = text.split('\n')
    const totalLines = allLines.filter(line => line.trim().length > 0).length

    let lines: string[]
    if (maxLines && allLines.length > maxLines) {
      lines = allLines.slice(0, maxLines)
    } else {
      lines = allLines
    }

    return {
      lines,
      encoding: result.encoding || 'utf-8',
      totalLines,
    }
  }

  getFileInfo(info: { name: string; size: number; sizeMB: number; extension: string; modifiedTime: string }): LogFileInfo {
    return {
      name: info.name,
      path: this.filePath,
      size: info.size,
      sizeMB: info.sizeMB,
      extension: info.extension,
      modifiedTime: info.modifiedTime,
    }
  }

  detectFormat(lines: string[]): LogFormat {
    const ext = this.fileExtension

    if (ext === '.csv') return 'csv'
    if (ext === '.json') return 'json'
    if (ext === '.ndjson' || ext === '.jsonl') return 'json_lines'

    // 基于内容检测
    const sampleLines = lines.slice(0, 50)
    const scores: Record<string, number> = {
      text_apache: 0,
      text_nginx: 0,
      text_iis: 0,
      csv: 0,
      json_lines: 0,
      text_generic: 0,
    }

    for (const line of sampleLines) {
      if (!line.trim()) continue

      // Apache: IP 开头 + HTTP 方法
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(line)) scores.text_apache++
      if (/"(GET|POST|PUT|DELETE|HEAD|OPTIONS)/.test(line)) scores.text_apache++
      if (/\[.*?\]/.test(line)) scores.text_apache++

      // Nginx
      if (/^- - \[/.test(line)) scores.text_nginx++

      // IIS
      if (/^\d{4}-\d{2}-\d{2}/.test(line)) scores.text_iis++
      if (/\d{2}:\d{2}:\d{2}/.test(line)) scores.text_iis++

      // CSV
      if (/^[^,]+,[^,]+,[^,]+/.test(line)) scores.csv++

      // JSON Lines
      if (/^\{.*\}$/.test(line.trim())) scores.json_lines++
    }

    const best = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))
    if (best[1] > 0) return best[0] as LogFormat

    return 'text_generic'
  }
}
