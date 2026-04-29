// 威胁检测面板 - MITRE ATT&CK 映射、CWE 关联、威胁趋势

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useThemeStore } from '@/stores/theme-store'
import { useAppStore } from '@/stores/app-store'

export function ThreatPanel() {
  const ruleResult = useAnalysisStore(s => s.localRuleResult)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const localStatus = useAnalysisStore(s => s.localStatus)
  const cyberTheme = useThemeStore(s => s.currentTheme)
  const triggerAnalysis = useAppStore(s => s.localAnalysisTrigger)

  const accentColor = cyberTheme === 'cyber' ? '#00f0ff'
    : cyberTheme === 'green' ? '#00ff88'
    : cyberTheme === 'purple' ? '#b44aff'
    : '#ff003c'

  // 按 MITRE ATT&CK 战术分组
  const mitreGroups = useMemo(() => {
    if (!ruleResult) return []
    const groups: Record<string, { tactic: string; tacticName: string; techniques: Set<string>; count: number; severity: string }> = {}

    for (const match of ruleResult.matches) {
      const mitre = match.rule.mitre
      if (!mitre) continue
      const key = mitre.tactic
      if (!groups[key]) {
        groups[key] = {
          tactic: mitre.tactic,
          tacticName: mitre.tacticName,
          techniques: new Set(),
          count: 0,
          severity: match.rule.severity,
        }
      }
      groups[key].count++
      if (mitre.technique) groups[key].techniques.add(mitre.technique)
      // 保持最高严重级别
      const sevOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
      if ((sevOrder[match.rule.severity] || 0) > (sevOrder[groups[key].severity] || 0)) {
        groups[key].severity = match.rule.severity
      }
    }

    return Object.values(groups).sort((a, b) => b.count - a.count)
  }, [ruleResult])

  // 按 CWE 分组
  const cweGroups = useMemo(() => {
    if (!ruleResult) return []
    const groups: Record<string, number> = {}
    for (const match of ruleResult.matches) {
      if (match.rule.cwe) {
        groups[match.rule.cwe] = (groups[match.rule.cwe] || 0) + 1
      }
    }
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [ruleResult])

  // 威胁趋势图 (按行号分布模拟时间线)
  const trendOption = useMemo(() => {
    if (!ruleResult || ruleResult.matches.length === 0) return null
    const totalLines = ruleResult.totalLines
    const buckets = 20
    const bucketSize = Math.max(1, Math.floor(totalLines / buckets))
    const counts = new Array(buckets).fill(0)

    for (const match of ruleResult.matches) {
      const bucket = Math.min(buckets - 1, Math.floor(match.lineNumber / bucketSize))
      counts[bucket]++
    }

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { top: 10, right: 10, bottom: 30, left: 40 },
      xAxis: {
        type: 'category',
        data: counts.map((_, i) => `${Math.round((i * bucketSize / totalLines) * 100)}%`),
        axisLabel: { color: '#999', fontSize: 9, rotate: 45 },
        axisLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } },
      },
      series: [{
        type: 'line',
        data: counts,
        smooth: true,
        lineStyle: { color: accentColor, width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: accentColor + '40' },
              { offset: 1, color: accentColor + '05' },
            ],
          },
        },
        itemStyle: { color: accentColor },
        symbol: 'circle',
        symbolSize: 4,
      }],
    }
  }, [ruleResult, accentColor])

  if (!ruleResult) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="text-sm">请先运行本地规则分析</div>
          {currentFile && localStatus === 'idle' && triggerAnalysis && (
            <button onClick={triggerAnalysis}
              className="mt-4 px-5 py-2 text-xs rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]
                hover:bg-[var(--accent-primary)]/30 border border-[var(--accent-primary)]/30 transition-all
                hover:shadow-[0_0_15px_var(--glow-color)]">
              开始本地分析
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto space-y-4 pr-1">
      {/* MITRE ATT&CK 战术映射 */}
      <div className="glass-card p-4">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
          MITRE ATT&CK 战术映射
        </div>
        {mitreGroups.length === 0 ? (
          <div className="text-xs text-[var(--text-dim)] py-4 text-center">未检测到 MITRE ATT&CK 映射</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {mitreGroups.map(group => (
              <div key={group.tactic}
                className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-[var(--accent-cyan)]">{group.tactic}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    group.severity === 'critical' ? 'bg-red-500/20 text-red-400'
                    : group.severity === 'high' ? 'bg-orange-500/20 text-orange-400'
                    : group.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {group.count} 次
                  </span>
                </div>
                <div className="text-sm text-[var(--text-primary)] mb-1">{group.tacticName}</div>
                <div className="text-xs text-[var(--text-dim)]">
                  {group.techniques.size} 个技术 · {group.count} 次匹配
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 威胁趋势 */}
      {trendOption && (
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
            威胁分布趋势
          </div>
          <ReactECharts option={trendOption} style={{ height: 200 }} />
        </div>
      )}

      {/* CWE 漏洞关联 */}
      <div className="glass-card p-4">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
          CWE 漏洞关联 Top 10
        </div>
        {cweGroups.length === 0 ? (
          <div className="text-xs text-[var(--text-dim)] py-4 text-center">未检测到 CWE 关联</div>
        ) : (
          <div className="space-y-2">
            {cweGroups.map(([cwe, count]) => (
              <div key={cwe} className="flex items-center gap-3">
                <span className="text-xs font-mono text-[var(--accent-cyan)] w-20">{cwe}</span>
                <div className="flex-1">
                  <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${(count / cweGroups[0][1]) * 100}%`,
                        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
                      }} />
                  </div>
                </div>
                <span className="text-xs text-[var(--text-primary)] w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
