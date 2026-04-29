// 攻击分析面板 - 攻击类别统计、时间线、源IP排行、目标URL排行

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useThemeStore } from '@/stores/theme-store'
import { useAppStore } from '@/stores/app-store'

export function AttackPanel() {
  const ruleResult = useAnalysisStore(s => s.localRuleResult)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const localStatus = useAnalysisStore(s => s.localStatus)
  const cyberTheme = useThemeStore(s => s.currentTheme)
  const triggerAnalysis = useAppStore(s => s.localAnalysisTrigger)

  const accentColor = cyberTheme === 'cyber' ? '#00f0ff'
    : cyberTheme === 'green' ? '#00ff88'
    : cyberTheme === 'purple' ? '#b44aff'
    : '#ff003c'

  // 攻击类别统计柱状图
  const categoryBarOption = useMemo(() => {
    if (!ruleResult) return null
    const entries = Object.entries(ruleResult.categoryStats)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { top: 10, right: 10, bottom: 60, left: 50 },
      xAxis: {
        type: 'category',
        data: entries.map(([name]) => name),
        axisLabel: { color: '#999', fontSize: 9, rotate: 30 },
        axisLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } },
      },
      series: [{
        type: 'bar',
        data: entries.map(([_, count]) => count),
        barWidth: '60%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: accentColor },
              { offset: 1, color: accentColor + '40' },
            ],
          },
        },
      }],
    }
  }, [ruleResult, accentColor])

  // 攻击源 IP 排行
  const topIPs = useMemo(() => {
    if (!ruleResult) return []
    const ipCounts: Record<string, { count: number; categories: Set<string>; severities: Set<string> }> = {}
    for (const match of ruleResult.matches) {
      const ipMatch = match.line.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
      if (ipMatch) {
        const ip = ipMatch[1]
        if (!ipCounts[ip]) ipCounts[ip] = { count: 0, categories: new Set(), severities: new Set() }
        ipCounts[ip].count++
        ipCounts[ip].categories.add(match.rule.category)
        ipCounts[ip].severities.add(match.rule.severity)
      }
    }
    return Object.entries(ipCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
  }, [ruleResult])

  // 攻击目标 URL 排行
  const topURLs = useMemo(() => {
    if (!ruleResult) return []
    const urlCounts: Record<string, number> = {}
    for (const match of ruleResult.matches) {
      // 尝试提取 URL 路径
      const urlMatch = match.line.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+([^\s"]+)/i)
      if (urlMatch) {
        const url = urlMatch[2].split('?')[0] // 去掉查询参数
        urlCounts[url] = (urlCounts[url] || 0) + 1
      }
    }
    return Object.entries(urlCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
  }, [ruleResult])

  // 攻击时间线（按行号分布）
  const timelineOption = useMemo(() => {
    if (!ruleResult || ruleResult.matches.length === 0) return null
    const totalLines = ruleResult.totalLines
    const buckets = 30
    const bucketSize = Math.max(1, Math.floor(totalLines / buckets))

    // 按严重级别分层
    const critical = new Array(buckets).fill(0)
    const high = new Array(buckets).fill(0)
    const medium = new Array(buckets).fill(0)
    const low = new Array(buckets).fill(0)

    for (const match of ruleResult.matches) {
      const bucket = Math.min(buckets - 1, Math.floor(match.lineNumber / bucketSize))
      if (match.rule.severity === 'critical') critical[bucket]++
      else if (match.rule.severity === 'high') high[bucket]++
      else if (match.rule.severity === 'medium') medium[bucket]++
      else low[bucket]++
    }

    const labels = critical.map((_, i) => `${Math.round((i * bucketSize / totalLines) * 100)}%`)

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['严重', '高危', '中危', '低危'],
        textStyle: { color: '#999', fontSize: 10 },
        top: 0,
      },
      grid: { top: 30, right: 10, bottom: 30, left: 40 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#999', fontSize: 9 },
        axisLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } },
      },
      series: [
        { name: '严重', type: 'bar', stack: 'total', data: critical, itemStyle: { color: '#ff003c' }, barWidth: '60%' },
        { name: '高危', type: 'bar', stack: 'total', data: high, itemStyle: { color: '#ff6600' } },
        { name: '中危', type: 'bar', stack: 'total', data: medium, itemStyle: { color: '#ffaa00' } },
        { name: '低危', type: 'bar', stack: 'total', data: low, itemStyle: { color: '#00f0ff' } },
      ],
    }
  }, [ruleResult])

  if (!ruleResult) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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
      {/* 攻击类别统计 */}
      <div className="glass-card p-4">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">攻击类别统计</div>
        {categoryBarOption && <ReactECharts option={categoryBarOption} style={{ height: 250 }} />}
      </div>

      {/* 攻击时间线 */}
      {timelineOption && (
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">攻击时间线</div>
          <ReactECharts option={timelineOption} style={{ height: 200 }} />
        </div>
      )}

      {/* 双列: Top IP + Top URL */}
      <div className="grid grid-cols-2 gap-4">
        {/* 攻击源 IP 排行 */}
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">攻击源 IP 排行</div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {topIPs.length === 0 ? (
              <div className="text-xs text-[var(--text-dim)] py-4 text-center">无数据</div>
            ) : (
              topIPs.map(([ip, data], idx) => (
                <div key={ip} className="p-2 rounded bg-[var(--bg-primary)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-[var(--text-primary)]">{ip}</span>
                    <span className="text-xs text-[var(--accent-primary)]">{data.count} 次</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[...data.categories].slice(0, 3).map(cat => (
                      <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 攻击目标 URL 排行 */}
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">攻击目标 URL 排行</div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {topURLs.length === 0 ? (
              <div className="text-xs text-[var(--text-dim)] py-4 text-center">无数据</div>
            ) : (
              topURLs.map(([url, count], idx) => (
                <div key={url} className="flex items-center gap-3 p-2 rounded bg-[var(--bg-primary)]">
                  <span className="text-xs text-[var(--text-dim)] w-4">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-[var(--text-primary)] truncate">{url}</div>
                  </div>
                  <span className="text-xs text-[var(--accent-primary)] shrink-0">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
