// 攻击分析面板 - 攻击类别统计、时间线、源IP排行、目标URL排行

import React, { useMemo } from 'react'
import { ScalingChart } from '@/components/common/ScalingChart'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useThemeStore } from '@/stores/theme-store'
import { useAppStore } from '@/stores/app-store'

export function AttackPanel() {
  const ruleResult = useAnalysisStore(s => s.localRuleResult)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const preprocessStatus = useAnalysisStore(s => s.preprocessStatus)
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

  // 攻击时间线（按实际时间分布）
  const timelineOption = useMemo(() => {
    if (!ruleResult || ruleResult.matches.length === 0) return null

    // 从日志行提取时间戳
    const parseLogTimestamp = (line: string): number => {
      // Apache/Nginx: 10/Oct/2024:13:55:36 +0000
      const apacheMatch = line.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?/)
      if (apacheMatch) {
        const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
        const d = parseInt(apacheMatch[1])
        const m = months[apacheMatch[2]]
        const y = parseInt(apacheMatch[3])
        const h = parseInt(apacheMatch[4])
        const mi = parseInt(apacheMatch[5])
        const s = parseInt(apacheMatch[6])
        if (m !== undefined) return new Date(y, m, d, h, mi, s).getTime()
      }
      // ISO/标准: 2024-10-10T13:55:36 or 2024-10-10 13:55:36
      const isoMatch = line.match(/(\d{4})[-/](\d{2})[-/](\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
      if (isoMatch) {
        return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]),
          parseInt(isoMatch[4]), parseInt(isoMatch[5]), parseInt(isoMatch[6])).getTime()
      }
      // Syslog: Oct 10 13:55:36
      const syslogMatch = line.match(/(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/)
      if (syslogMatch) {
        const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
        const m = months[syslogMatch[1]]
        if (m !== undefined) return new Date(new Date().getFullYear(), m, parseInt(syslogMatch[2]),
          parseInt(syslogMatch[3]), parseInt(syslogMatch[4]), parseInt(syslogMatch[5])).getTime()
      }
      return 0
    }

    // 提取所有匹配的时间戳
    const timedMatches = ruleResult.matches
      .map(m => ({ ...m, ts: parseLogTimestamp(m.line) }))
      .filter(m => m.ts > 0)
      .sort((a, b) => a.ts - b.ts)

    // 如果没有有效时间戳，回退到按行号分布
    if (timedMatches.length === 0) {
      const totalLines = ruleResult.totalLines
      const buckets = 30
      const bucketSize = Math.max(1, Math.floor(totalLines / buckets))
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

      const labels = critical.map((_, i) => `行 ${Math.round(i * bucketSize)}`)

      return {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        legend: { data: ['严重', '高危', '中危', '低危'], textStyle: { color: '#999', fontSize: 10 }, top: 0 },
        grid: { top: 30, right: 10, bottom: 30, left: 40 },
        xAxis: { type: 'category', data: labels, axisLabel: { color: '#999', fontSize: 9 }, axisLine: { lineStyle: { color: '#333' } } },
        yAxis: { type: 'value', axisLabel: { color: '#999', fontSize: 10 }, splitLine: { lineStyle: { color: '#222' } } },
        series: [
          { name: '严重', type: 'bar', stack: 'total', data: critical, itemStyle: { color: '#ff003c' }, barWidth: '60%' },
          { name: '高危', type: 'bar', stack: 'total', data: high, itemStyle: { color: '#ff6600' } },
          { name: '中危', type: 'bar', stack: 'total', data: medium, itemStyle: { color: '#ffaa00' } },
          { name: '低危', type: 'bar', stack: 'total', data: low, itemStyle: { color: '#00f0ff' } },
        ],
      }
    }

    // 按时间范围分桶
    const minTs = timedMatches[0].ts
    const maxTs = timedMatches[timedMatches.length - 1].ts
    const timeRange = maxTs - minTs

    // 自动选择合适的分桶数和时间格式
    const bucketCount = Math.min(30, Math.max(5, timedMatches.length))
    const bucketMs = Math.max(1, timeRange / bucketCount)

    // 判断时间跨度，选择合适的显示格式
    const formatTime = (ts: number): string => {
      const d = new Date(ts)
      if (timeRange <= 2 * 60 * 60 * 1000) {
        // 2小时内: 显示 HH:MM:SS
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
      } else if (timeRange <= 24 * 60 * 60 * 1000) {
        // 1天内: 显示 HH:MM
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      } else if (timeRange <= 7 * 24 * 60 * 60 * 1000) {
        // 1周内: 显示 MM-DD HH:MM
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      } else {
        // 超过1周: 显示 MM-DD
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
    }

    // 初始化桶
    const critical = new Array(bucketCount).fill(0)
    const high = new Array(bucketCount).fill(0)
    const medium = new Array(bucketCount).fill(0)
    const low = new Array(bucketCount).fill(0)

    for (const match of timedMatches) {
      const bucket = Math.min(bucketCount - 1, Math.floor((match.ts - minTs) / bucketMs))
      if (match.rule.severity === 'critical') critical[bucket]++
      else if (match.rule.severity === 'high') high[bucket]++
      else if (match.rule.severity === 'medium') medium[bucket]++
      else low[bucket]++
    }

    // 生成时间标签
    const labels = critical.map((_, i) => formatTime(minTs + i * bucketMs + bucketMs / 2))

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!params || params.length === 0) return ''
          let html = `<b>${params[0].axisValue}</b><br/>`
          let total = 0
          for (const p of params) {
            if (p.value > 0) {
              html += `${p.marker} ${p.seriesName}: ${p.value}<br/>`
              total += p.value
            }
          }
          html += `<span style="color:#999">合计: ${total}</span>`
          return html
        },
      },
      legend: {
        data: ['严重', '高危', '中危', '低危'],
        textStyle: { color: '#999', fontSize: 10 },
        top: 0,
      },
      grid: { top: 30, right: 10, bottom: 40, left: 40 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { color: '#999', fontSize: 9, rotate: 30 },
        axisLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } },
        minInterval: 1,
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
          {currentFile && preprocessStatus === 'idle' && triggerAnalysis && (
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
        <ScalingChart option={categoryBarOption} baseHeight={250} />
      </div>

      {/* 攻击时间线 */}
      {timelineOption && (
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">攻击时间线</div>
          <ScalingChart option={timelineOption} baseHeight={200} />
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
