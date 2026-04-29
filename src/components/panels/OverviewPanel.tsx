// 分析概览面板 - 风险评分、攻击分布、Top IP、告警时间线

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useThemeStore } from '@/stores/theme-store'
import { useAppStore } from '@/stores/app-store'

export function OverviewPanel() {
  const ruleResult = useAnalysisStore(s => s.localRuleResult)
  const reportText = useAnalysisStore(s => s.localReportText)
  const geoResults = useAnalysisStore(s => s.geoIPResults)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const localStatus = useAnalysisStore(s => s.localStatus)
  const cyberTheme = useThemeStore(s => s.currentTheme)
  const triggerAnalysis = useAppStore(s => s.localAnalysisTrigger)

  const accentColor = cyberTheme === 'cyber' ? '#00f0ff'
    : cyberTheme === 'green' ? '#00ff88'
    : cyberTheme === 'purple' ? '#b44aff'
    : '#ff003c'

  // 风险评分计算 (0-100)
  const riskScore = useMemo(() => {
    if (!ruleResult) return 0
    const { summary } = ruleResult
    const score = summary.critical * 25 + summary.high * 10 + summary.medium * 3 + summary.low * 1
    return Math.min(100, score)
  }, [ruleResult])

  const riskLevel = riskScore >= 80 ? '高危' : riskScore >= 50 ? '中危' : riskScore >= 20 ? '低危' : '安全'
  const riskColor = riskScore >= 80 ? '#ff003c' : riskScore >= 50 ? '#ffaa00' : riskScore >= 20 ? '#00f0ff' : '#00ff88'

  // 攻击类型分布饼图
  const categoryPieOption = useMemo(() => {
    if (!ruleResult) return null
    const data = Object.entries(ruleResult.categoryStats)
      .filter(([_, count]) => count > 0)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { show: false },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        data,
        label: { show: true, color: '#999', fontSize: 10, formatter: '{b}\n{d}%' },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
        itemStyle: {
          borderRadius: 4,
          borderColor: '#0a0e1a',
          borderWidth: 2,
        },
      }],
    }
  }, [ruleResult])

  // 严重级别分布柱状图
  const severityBarOption = useMemo(() => {
    if (!ruleResult) return null
    const { summary } = ruleResult
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { top: 10, right: 10, bottom: 30, left: 40 },
      xAxis: {
        type: 'category',
        data: ['严重', '高危', '中危', '低危'],
        axisLabel: { color: '#999', fontSize: 10 },
        axisLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } },
      },
      series: [{
        type: 'bar',
        data: [
          { value: summary.critical, itemStyle: { color: '#ff003c' } },
          { value: summary.high, itemStyle: { color: '#ff6600' } },
          { value: summary.medium, itemStyle: { color: '#ffaa00' } },
          { value: summary.low, itemStyle: { color: '#00f0ff' } },
        ],
        barWidth: '50%',
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      }],
    }
  }, [ruleResult])

  // Top 5 攻击 IP
  const topIPs = useMemo(() => {
    if (!ruleResult) return []
    const ipCounts: Record<string, number> = {}
    for (const match of ruleResult.matches) {
      const ipMatch = match.line.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
      if (ipMatch) {
        ipCounts[ipMatch[1]] = (ipCounts[ipMatch[1]] || 0) + 1
      }
    }
    return Object.entries(ipCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [ruleResult])

  if (!ruleResult) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <div className="text-sm">请先运行本地规则分析</div>
          <div className="text-xs mt-1">分析完成后将在此显示概览数据</div>
          {currentFile && localStatus === 'idle' && triggerAnalysis && (
            <button onClick={triggerAnalysis}
              className="mt-4 px-5 py-2 text-xs rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]
                hover:bg-[var(--accent-primary)]/30 border border-[var(--accent-primary)]/30 transition-all
                hover:shadow-[0_0_15px_var(--glow-color)]">
              开始本地分析
            </button>
          )}
          {localStatus !== 'idle' && localStatus !== 'done' && (
            <div className="mt-4 text-xs text-[var(--accent-primary)] animate-pulse">分析中...</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto space-y-4 pr-1">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-5 gap-3">
        {/* 风险评分 */}
        <div className="glass-card p-4 flex flex-col items-center justify-center">
          <div className="relative w-20 h-20 mb-2">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#222" strokeWidth="8" />
              <circle cx="50" cy="50" r="40" fill="none" stroke={riskColor} strokeWidth="8"
                strokeDasharray={`${riskScore * 2.51} 251`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${riskColor})` }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-orbitron font-bold" style={{ color: riskColor }}>{riskScore}</span>
            </div>
          </div>
          <span className="text-xs text-[var(--text-dim)]">风险评分</span>
          <span className="text-xs font-bold mt-1" style={{ color: riskColor }}>{riskLevel}</span>
        </div>

        {/* 统计数字 */}
        {[
          { label: '扫描行数', value: ruleResult.totalLines, color: 'var(--accent-primary)' },
          { label: '匹配行数', value: ruleResult.matchedLines, color: 'var(--accent-cyan)' },
          { label: '攻击告警', value: ruleResult.aggregatedAlerts.length, color: 'var(--accent-yellow)' },
          { label: '攻击类别', value: Object.keys(ruleResult.categoryStats).length, color: 'var(--accent-green)' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-4 flex flex-col items-center justify-center">
            <span className="text-2xl font-orbitron font-bold" style={{ color: stat.color }}>
              {stat.value.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--text-dim)] mt-1">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* 中间图表区 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 攻击类型分布 */}
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">攻击类型分布</div>
          {categoryPieOption && (
            <ReactECharts option={categoryPieOption} style={{ height: 220 }} />
          )}
        </div>

        {/* 严重级别分布 */}
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">严重级别分布</div>
          {severityBarOption && (
            <ReactECharts option={severityBarOption} style={{ height: 220 }} />
          )}
        </div>
      </div>

      {/* 底部: Top IP + 最近告警 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top 5 攻击 IP */}
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">Top 攻击 IP</div>
          <div className="space-y-2">
            {topIPs.length === 0 ? (
              <div className="text-xs text-[var(--text-dim)] py-4 text-center">未检测到攻击 IP</div>
            ) : (
              topIPs.map(([ip, count], idx) => (
                <div key={ip} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[var(--text-dim)] w-4">{idx + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-[var(--text-primary)]">{ip}</span>
                      <span className="text-xs text-[var(--accent-primary)]">{count}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${(count / topIPs[0][1]) * 100}%`,
                          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
                        }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 最近告警 */}
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">最近告警</div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {ruleResult.aggregatedAlerts.length === 0 ? (
              <div className="text-xs text-[var(--text-dim)] py-4 text-center">无告警</div>
            ) : (
              ruleResult.aggregatedAlerts.slice(0, 8).map((alert, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded bg-[var(--bg-primary)]">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    alert.rule.severity === 'critical' ? 'bg-red-500/20 text-red-400'
                    : alert.rule.severity === 'high' ? 'bg-orange-500/20 text-orange-400'
                    : alert.rule.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {alert.rule.severity === 'critical' ? '严重' : alert.rule.severity === 'high' ? '高危' : alert.rule.severity === 'medium' ? '中危' : '低危'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-[var(--text-primary)] truncate">{alert.rule.name}</div>
                    <div className="text-xs text-[var(--text-dim)]">{alert.count} 次 · {alert.rule.category}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="flex gap-3">
        <button className="neon-btn primary flex-1 text-xs py-2.5">
          导出报告
        </button>
        <button className="neon-btn flex-1 text-xs py-2.5" style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}>
          查看详细报告
        </button>
      </div>
    </div>
  )
}
