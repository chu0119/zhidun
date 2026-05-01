// 分析 Worker - 将规则引擎、Bot 检测、IP 提取移出渲染主线程
// 通过 postMessage 通信，避免 UI 卡死

import { analyzeWithRules } from '@/core/rule-engine'
import type { Rule, RuleAnalysisResult } from '@/core/rule-engine'
import { detectBots } from '@/core/bot-detector'
import type { BotStat } from '@/core/bot-detector'
import { extractIPsFromLines } from '@/core/geoip'

// 可序列化的规则格式（RegExp → string）
interface SerializableRule {
  id: string
  name: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  patterns: { source: string; flags: string }[]
  description: string
  remediation: string
  mitre?: Rule['mitre']
  cwe?: string
}

// 主线程 → Worker 消息
interface AnalyzeMessage {
  type: 'analyze'
  lines: string[]
  rules: SerializableRule[]
}

interface CancelMessage {
  type: 'cancel'
}

type WorkerInputMessage = AnalyzeMessage | CancelMessage

// Worker → 主线程消息
interface ProgressMessage {
  type: 'progress'
  message: string
}

interface ResultMessage {
  type: 'result'
  result: RuleAnalysisResult
  botStats: BotStat[]
  ips: string[]
}

interface ErrorMessage {
  type: 'error'
  error: string
}

type WorkerOutputMessage = ProgressMessage | ResultMessage | ErrorMessage

let cancelled = false

function reconstructRules(serialized: SerializableRule[]): Rule[] {
  return serialized.map(r => ({
    ...r,
    patterns: r.patterns.map(p => {
      try {
        return new RegExp(p.source, p.flags)
      } catch {
        return new RegExp(p.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), p.flags)
      }
    }),
  }))
}

// 包装 progressCallback，通过 postMessage 发送进度
function createProgressCallback() {
  return (msg: string) => {
    const payload: WorkerOutputMessage = { type: 'progress', message: msg }
    self.postMessage(payload)
  }
}

self.onmessage = (e: MessageEvent<WorkerInputMessage>) => {
  const data = e.data

  if (data.type === 'cancel') {
    cancelled = true
    return
  }

  if (data.type === 'analyze') {
    cancelled = false
    const { lines, rules: serializedRules } = data

    try {
      // 重建 RegExp 对象
      const rules = reconstructRules(serializedRules)

      // 运行规则引擎分析
      const result = analyzeWithRules(lines, createProgressCallback(), rules)

      if (cancelled) return

      // 从匹配行中提取可疑行用于 Bot 检测和 IP 提取
      const suspiciousLines = result.matches.map(m => m.line)

      // Bot 检测
      const botStats = detectBots(suspiciousLines)

      if (cancelled) return

      // IP 提取
      const ips = extractIPsFromLines(suspiciousLines)

      // 返回结果前，剥离 Rule 中的 patterns（RegExp 无法序列化回主线程）
      const stripPatterns = (r: Rule) => ({
        ...r,
        patterns: [] as any,
      })

      const cleanResult: RuleAnalysisResult = {
        ...result,
        matches: result.matches.map(m => ({ ...m, rule: stripPatterns(m.rule) })),
        aggregatedAlerts: result.aggregatedAlerts.map(a => ({ ...a, rule: stripPatterns(a.rule) })),
      }

      const response: WorkerOutputMessage = {
        type: 'result',
        result: cleanResult,
        botStats,
        ips,
      }
      self.postMessage(response)
    } catch (err: any) {
      const errorResponse: WorkerOutputMessage = {
        type: 'error',
        error: err.message || '分析过程中发生未知错误',
      }
      self.postMessage(errorResponse)
    }
  }
}
