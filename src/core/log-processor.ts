// 日志处理器 - 从 Python core/log_processor.py 移植

import type { LogFormat, LogSampleResult } from '@/types/log'
import { DEFAULT_LINES_TO_ANALYZE, MAX_LOG_FILE_SIZE } from './constants'
import { estimateTokens } from './analyzer'

// 威胁关键词
const THREAT_KEYWORDS = [
  'sql', 'union', 'select', 'insert', 'delete', 'drop',
  'script', 'alert', 'javascript', 'xss',
  'cmd', 'powershell', 'bash', 'sh',
  '../', '..\\', 'etc/passwd', 'boot.ini',
  ' 400', ' 401', ' 403', ' 404', ' 500', ' 502', ' 503',
  'sqlmap', 'nikto', 'nmap', 'burp', 'metasploit',
  'havij', 'acunetix', 'appscan',
  'bot', 'spider', 'crawler', 'scanner',
]

function calculateThreatScore(line: string): number {
  const lower = line.toLowerCase()
  let score = 0
  for (const keyword of THREAT_KEYWORDS) {
    if (lower.includes(keyword)) score++
  }
  return score
}

export function smartSample(
  lines: string[],
  maxLines: number = DEFAULT_LINES_TO_ANALYZE,
  maxTokens: number = 32000,
  includeContext: boolean = true
): string[] {
  if (lines.length <= maxLines) {
    const text = lines.join('\n')
    if (estimateTokens(text) <= maxTokens) return lines
  }

  // 计算威胁分数
  const scored = lines.map((line, index) => ({
    line,
    index,
    score: calculateThreatScore(line),
  }))

  // 按分数排序
  scored.sort((a, b) => b.score - a.score)

  // 取前 maxLines 行
  const selected = scored.slice(0, maxLines)
  const selectedIndices = new Set(selected.map(s => s.index))

  // 添加上下文
  if (includeContext && lines.length > maxLines) {
    const contextIndices = new Set<number>()
    for (const idx of selectedIndices) {
      for (let offset = -2; offset <= 2; offset++) {
        const ctxIdx = idx + offset
        if (ctxIdx >= 0 && ctxIdx < lines.length && !selectedIndices.has(ctxIdx)) {
          contextIndices.add(ctxIdx)
        }
      }
    }
    for (const idx of contextIndices) {
      selectedIndices.add(idx)
    }
  }

  // 按原始顺序排列
  const result = Array.from(selectedIndices)
    .sort((a, b) => a - b)
    .map(idx => lines[idx])

  // 检查 token 限制
  const text = result.join('\n')
  const tokens = estimateTokens(text)
  if (tokens > maxTokens) {
    const scale = maxTokens / tokens
    const newMax = Math.max(10, Math.floor(result.length * scale * 0.9))
    return result.slice(0, newMax)
  }

  return result
}

export function compressLogForAI(lines: string[], formatType: LogFormat): string {
  if (formatType === 'csv') {
    // CSV: 每行截断到 80 字符
    return lines.map(line => line.substring(0, 80)).join('\n')
  }

  if (formatType === 'json_lines' || formatType === 'json') {
    // JSON: 紧凑输出
    return lines.map(line => {
      try {
        const obj = JSON.parse(line)
        return JSON.stringify(obj)
      } catch {
        return line.substring(0, 200)
      }
    }).join('\n')
  }

  // 文本格式: 直接返回，截断过长行
  return lines.map(line => line.length > 500 ? line.substring(0, 500) + '...' : line).join('\n')
}

export function processLog(
  lines: string[],
  totalLines: number,
  formatType: LogFormat,
  encoding: string,
  fileSizeMB: number,
  maxLines: number = DEFAULT_LINES_TO_ANALYZE,
  maxTokens: number = 32000
): LogSampleResult {
  // 过滤空行
  const filtered = lines.filter(l => l.trim().length > 0)

  // 智能采样
  const sampled = smartSample(filtered, maxLines, maxTokens)

  // 估算 token
  const compressed = compressLogForAI(sampled, formatType)
  const estimatedTokens = estimateTokens(compressed)

  return {
    lines: sampled,
    totalLines,
    sampledLines: sampled.length,
    skippedLines: totalLines - sampled.length,
    formatType,
    encoding,
    fileSizeMB,
    estimatedTokens,
  }
}
