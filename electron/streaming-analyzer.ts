/**
 * 流式规则引擎 - 在主进程中对大文件进行全量扫描
 * 边读边匹配，只存储命中行，内存占用恒定
 */

import fs from 'fs'
import readline from 'readline'
import path from 'path'

export interface StreamingRule {
  id: string
  name: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  patterns: string[] // 正则字符串，带 flags，格式: "/pattern/flags"
  description: string
  remediation: string
}

export interface StreamingMatch {
  ruleId: string
  ruleName: string
  category: string
  severity: string
  lineNumber: number
  line: string
  matchedText: string
  description: string
  remediation: string
}

export interface StreamingResult {
  success: boolean
  totalLines: number
  matchedLines: number
  matches: StreamingMatch[]
  summary: { critical: number; high: number; medium: number; low: number; info: number }
  categoryStats: Record<string, number>
  error?: string
}

function parseRegex(patternStr: string): RegExp | null {
  try {
    const match = patternStr.match(/^\/(.+)\/([gimsuy]*)$/)
    if (match) return new RegExp(match[1], match[2])
    return new RegExp(patternStr, 'i')
  } catch {
    return null
  }
}

export async function streamAnalyze(
  filePath: string,
  rules: StreamingRule[],
  options?: {
    encoding?: string
    maxMatches?: number
    onProgress?: (linesScanned: number, matchesFound: number) => void
  }
): Promise<StreamingResult> {
  const maxMatches = options?.maxMatches || 50000
  const chardet = require('chardet')
  const iconv = require('iconv-lite')

  // 检测编码
  let encoding = options?.encoding
  if (!encoding) {
    const sampleBuf = Buffer.alloc(64 * 1024)
    const fd = fs.openSync(filePath, 'r')
    const bytesRead = fs.readSync(fd, sampleBuf, 0, sampleBuf.length, 0)
    fs.closeSync(fd)
    encoding = chardet.detect(sampleBuf.slice(0, bytesRead)) || 'utf-8'
  }

  // 预编译正则
  const compiledRules: { rule: StreamingRule; regexes: RegExp[] }[] = []
  for (const rule of rules) {
    const regexes: RegExp[] = []
    for (const p of rule.patterns) {
      const r = parseRegex(p)
      if (r) regexes.push(r)
    }
    if (regexes.length > 0) {
      compiledRules.push({ rule, regexes })
    }
  }

  // 流式扫描
  const matches: StreamingMatch[] = []
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  const categoryStats: Record<string, number> = {}
  let totalLines = 0
  let matchedLineSet = new Set<number>()

  const stream = fs.createReadStream(filePath)
  const decoded = stream.pipe(iconv.decodeStream(encoding))
  const rl = readline.createInterface({ input: decoded, crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line.trim()) continue
    totalLines++

    for (const { rule, regexes } of compiledRules) {
      for (const regex of regexes) {
        regex.lastIndex = 0
        const m = regex.exec(line)
        if (m) {
          if (matches.length < maxMatches) {
            matches.push({
              ruleId: rule.id,
              ruleName: rule.name,
              category: rule.category,
              severity: rule.severity,
              lineNumber: totalLines,
              line: line.length > 300 ? line.substring(0, 300) + '...' : line,
              matchedText: m[0].substring(0, 100),
              description: rule.description,
              remediation: rule.remediation,
            })
            matchedLineSet.add(totalLines)
            summary[rule.severity]++
            categoryStats[rule.category] = (categoryStats[rule.category] || 0) + 1
          }
          break // 同一行同一条规则只匹配一次
        }
      }
    }

    // 进度回调（每 100 万行）
    if (totalLines % 1000000 === 0) {
      options?.onProgress?.(totalLines, matches.length)
    }
  }

  return {
    success: true,
    totalLines,
    matchedLines: matchedLineSet.size,
    matches,
    summary,
    categoryStats,
  }
}
