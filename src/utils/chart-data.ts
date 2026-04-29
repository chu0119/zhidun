// 图表数据提取

import { extractFromReport, analyzeFromLog, extractIpStats, extractTimeline } from '@/core/pattern-matcher'

export interface ChartData {
  attackTypes: { name: string; value: number }[]
  riskLevels: { name: string; value: number }[]
  ipStats: { name: string; value: number }[]
  timeline: { time: string; count: number }[]
  httpMethods?: { name: string; value: number }[]
  statusCodes?: { name: string; value: number }[]
  urlPaths?: { name: string; value: number }[]
  attackHeatmap?: { hour: number; category: string; count: number }[]
}

export function extractChartData(reportText: string, logLines: string[]): ChartData {
  // 从日志中逐行扫描攻击类型（准确的每行计数）
  const logStats = analyzeFromLog(logLines)

  // 从报告文本中提取攻击类型（仅作补充）
  const reportStats = extractFromReport(reportText)

  // 合并攻击类型：优先使用日志逐行统计（准确计数），报告仅补充日志未覆盖的类型
  const attackMerged: Record<string, number> = {}
  for (const [k, v] of Object.entries(logStats.attackTypes)) {
    if (v > 0) attackMerged[k] = v
  }
  // 报告中提到但日志逐行扫描未命中的类型，标记为 1（存在但无法精确计数）
  for (const [k, v] of Object.entries(reportStats.attackTypes)) {
    if (v > 0 && !attackMerged[k]) attackMerged[k] = v
  }

  // 合并风险等级：优先使用日志逐行统计
  const riskMerged: Record<string, number> = {}
  for (const [k, v] of Object.entries(logStats.riskLevels)) {
    if (v > 0) riskMerged[k] = v
  }
  if (Object.values(riskMerged).every(v => v === 0)) {
    for (const [k, v] of Object.entries(reportStats.riskLevels)) {
      if (v > 0) riskMerged[k] = v
    }
  }

  // IP 统计
  const ipStats = extractIpStats(logLines)

  // 时间线
  const timeline = extractTimeline(logLines)

  return {
    attackTypes: Object.entries(attackMerged).map(([name, value]) => ({ name, value })),
    riskLevels: Object.entries(riskMerged).map(([name, value]) => ({ name, value })),
    ipStats: Object.entries(ipStats).map(([name, value]) => ({ name, value })),
    timeline,
    httpMethods: extractHttpMethods(logLines),
    statusCodes: extractStatusCodes(logLines),
    urlPaths: extractUrlPaths(logLines),
    attackHeatmap: extractAttackHeatmap(logLines, reportText),
  }
}

// HTTP 方法分布
function extractHttpMethods(logLines: string[]): { name: string; value: number }[] {
  const methods: Record<string, number> = {}
  for (const line of logLines) {
    const match = line.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s/i)
    if (match) {
      const method = match[1].toUpperCase()
      methods[method] = (methods[method] || 0) + 1
    }
  }
  return Object.entries(methods)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))
}

// 状态码分布
function extractStatusCodes(logLines: string[]): { name: string; value: number }[] {
  const codes: Record<string, number> = {}
  for (const line of logLines) {
    const match = line.match(/\s(2\d{2}|3\d{2}|4\d{2}|5\d{2})\s/)
    if (match) {
      const code = match[1]
      codes[code] = (codes[code] || 0) + 1
    }
  }
  return Object.entries(codes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, value]) => ({ name, value }))
}

// URL 路径 Top 20
function extractUrlPaths(logLines: string[]): { name: string; value: number }[] {
  const paths: Record<string, number> = {}
  for (const line of logLines) {
    const match = line.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+([^\s"]+)/i)
    if (match) {
      const path = match[2].split('?')[0]
      paths[path] = (paths[path] || 0) + 1
    }
  }
  return Object.entries(paths)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, value]) => ({ name, value }))
}

// 攻击热力图（按小时×攻击类别）
function extractAttackHeatmap(logLines: string[], reportText: string): { hour: number; category: string; count: number }[] {
  // 从日志行中提取时间和攻击类别
  const categories = ['SQL注入', 'XSS', '命令注入', '路径遍历', '文件包含', 'SSRF', 'WebShell', '扫描探测']
  const heatmap: Record<string, number> = {}

  for (const line of logLines) {
    // 提取小时
    const timeMatch = line.match(/(\d{2}):(\d{2}):\d{2}/)
    if (!timeMatch) continue
    const hour = parseInt(timeMatch[1])

    // 检查是否包含攻击特征
    for (const cat of categories) {
      const key = `${hour}-${cat}`
      // 简单的关键词匹配
      const lower = line.toLowerCase()
      if (cat === 'SQL注入' && (/union\s+select|or\s+1\s*=\s*1|select\s+.*\s+from/i.test(lower) || /%27|%22|exec\s*\(/i.test(line))) {
        heatmap[key] = (heatmap[key] || 0) + 1
      } else if (cat === 'XSS' && (/<script|javascript:|onerror|onload|alert\s*\(/i.test(line) || /%3cscript/i.test(line))) {
        heatmap[key] = (heatmap[key] || 0) + 1
      } else if (cat === '命令注入' && (/;\s*ls|;\s*cat|;\s*whoami|\|\s*ls|\|\s*cat|`whoami`/i.test(line))) {
        heatmap[key] = (heatmap[key] || 0) + 1
      } else if (cat === '路径遍历' && (/\.\.\//i.test(line) || /\.\.%2f/i.test(line))) {
        heatmap[key] = (heatmap[key] || 0) + 1
      }
    }
  }

  return Object.entries(heatmap).map(([key, count]) => {
    const [hourStr, category] = key.split('-')
    return { hour: parseInt(hourStr), category, count }
  })
}
