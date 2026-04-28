// 图表数据提取

import { extractFromReport, analyzeFromLog, extractIpStats, extractTimeline } from '@/core/pattern-matcher'

export interface ChartData {
  attackTypes: { name: string; value: number }[]
  riskLevels: { name: string; value: number }[]
  ipStats: { name: string; value: number }[]
  timeline: { time: string; count: number }[]
}

export function extractChartData(reportText: string, logLines: string[]): ChartData {
  // 从报告中提取攻击类型和风险等级
  const reportStats = extractFromReport(reportText)

  // 从日志中提取补充数据
  const logStats = analyzeFromLog(logLines)

  // 合并攻击类型数据
  const attackMerged: Record<string, number> = {}
  for (const [k, v] of Object.entries(reportStats.attackTypes)) {
    if (v > 0) attackMerged[k] = v
  }
  if (Object.keys(attackMerged).length === 0) {
    for (const [k, v] of Object.entries(logStats.attackTypes)) {
      if (v > 0) attackMerged[k] = v
    }
  }

  // 合并风险等级数据
  const riskMerged: Record<string, number> = {}
  for (const [k, v] of Object.entries(reportStats.riskLevels)) {
    if (v > 0) riskMerged[k] = v
  }
  if (Object.values(riskMerged).every(v => v === 0)) {
    for (const [k, v] of Object.entries(logStats.riskLevels)) {
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
  }
}
