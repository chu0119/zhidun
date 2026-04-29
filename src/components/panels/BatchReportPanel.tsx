// 批量分析汇总报告面板

import React from 'react'
import { useQueueStore, QueueItem } from '@/stores/queue-store'

interface BatchReportPanelProps {
  onViewReport: (item: QueueItem) => void
}

export function BatchReportPanel({ onViewReport }: BatchReportPanelProps) {
  const { items } = useQueueStore()
  const doneItems = items.filter(i => i.status === 'done' && i.result)

  if (doneItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-dim)] text-sm">
        暂无批量分析结果
      </div>
    )
  }

  // 汇总统计
  const totalMatches = doneItems.reduce((sum, i) => sum + (i.result?.matches.length || 0), 0)
  const totalCritical = doneItems.reduce((sum, i) => sum + (i.result?.summary.critical || 0), 0)
  const totalHigh = doneItems.reduce((sum, i) => sum + (i.result?.summary.high || 0), 0)
  const totalMedium = doneItems.reduce((sum, i) => sum + (i.result?.summary.medium || 0), 0)
  const totalLow = doneItems.reduce((sum, i) => sum + (i.result?.summary.low || 0), 0)

  // 分类统计汇总
  const categoryMap: Record<string, number> = {}
  for (const item of doneItems) {
    if (!item.result) continue
    for (const [cat, count] of Object.entries(item.result.categoryStats)) {
      categoryMap[cat] = (categoryMap[cat] || 0) + count
    }
  }
  const sortedCategories = Object.entries(categoryMap).sort(([, a], [, b]) => b - a)

  // 每个文件的风险评级
  const fileRisk = doneItems.map(item => {
    const r = item.result!
    const score = r.summary.critical * 10 + r.summary.high * 5 + r.summary.medium * 2 + r.summary.low
    return { item, score, matches: r.matches.length }
  }).sort((a, b) => b.score - a.score)

  const getRiskLabel = (score: number) => {
    if (score >= 50) return { text: '高风险', color: '#ff4444' }
    if (score >= 20) return { text: '中风险', color: '#ff8800' }
    if (score >= 5) return { text: '低风险', color: '#ffcc00' }
    return { text: '安全', color: '#00ff88' }
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0 overflow-y-auto">
      <div className="text-sm font-orbitron text-[var(--accent-primary)] tracking-wider">
        批量分析汇总报告
      </div>

      {/* 总览卡片 */}
      <div className="grid grid-cols-5 gap-3">
        <div className="glass-card p-3 text-center">
          <div className="text-2xl font-mono text-[var(--accent-primary)]">{doneItems.length}</div>
          <div className="text-xs text-[var(--text-dim)]">分析文件</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-2xl font-mono text-[#ff4444]">{totalCritical}</div>
          <div className="text-xs text-[var(--text-dim)]">严重</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-2xl font-mono text-[#ff8800]">{totalHigh}</div>
          <div className="text-xs text-[var(--text-dim)]">高危</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-2xl font-mono text-[#ffcc00]">{totalMedium}</div>
          <div className="text-xs text-[var(--text-dim)]">中危</div>
        </div>
        <div className="glass-card p-3 text-center">
          <div className="text-2xl font-mono text-[var(--accent-green)]">{totalLow}</div>
          <div className="text-xs text-[var(--text-dim)]">低危</div>
        </div>
      </div>

      {/* 文件风险排名 */}
      <div className="glass-card p-4">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
          文件风险排名
        </div>
        <div className="space-y-2">
          {fileRisk.map(({ item, score, matches }) => {
            const risk = getRiskLabel(score)
            return (
              <div key={item.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-white/3 cursor-pointer"
                onClick={() => onViewReport(item)}>
                <div className="w-16 text-xs font-mono text-center px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${risk.color}20`, color: risk.color }}>
                  {risk.text}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[var(--text-primary)] truncate">{item.fileName}</span>
                </div>
                <div className="text-xs text-[var(--text-dim)] font-mono shrink-0">
                  {matches} 告警
                </div>
                <div className="text-xs text-[var(--text-dim)] font-mono shrink-0">
                  分值 {score}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 攻击类型分布 */}
      {sortedCategories.length > 0 && (
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
            攻击类型分布
          </div>
          <div className="space-y-1">
            {sortedCategories.map(([cat, count]) => {
              const maxCount = sortedCategories[0][1]
              const percent = (count / maxCount) * 100
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-secondary)] w-24 truncate shrink-0">{cat}</span>
                  <div className="flex-1 h-4 bg-[var(--bg-primary)] rounded overflow-hidden">
                    <div className="h-full rounded"
                      style={{
                        width: `${percent}%`,
                        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                      }} />
                  </div>
                  <span className="text-xs font-mono text-[var(--accent-primary)] w-10 text-right shrink-0">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
