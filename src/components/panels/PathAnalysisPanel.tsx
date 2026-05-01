// 路径分析面板 - URL 路径访问排行、路径攻击热力图、路径参数分析

import React, { useMemo } from 'react'
import { ScalingChart } from '@/components/common/ScalingChart'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useThemeStore } from '@/stores/theme-store'
import { useAppStore } from '@/stores/app-store'

export function PathAnalysisPanel() {
  const ruleResult = useAnalysisStore(s => s.localRuleResult)
  const logLines = useAnalysisStore(s => s.logLines)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const preprocessStatus = useAnalysisStore(s => s.preprocessStatus)
  const cyberTheme = useThemeStore(s => s.currentTheme)
  const triggerAnalysis = useAppStore(s => s.localAnalysisTrigger)

  const accentColor = useMemo(() =>
    cyberTheme === 'cyber' ? '#00f0ff'
    : cyberTheme === 'green' ? '#00ff88'
    : cyberTheme === 'purple' ? '#b44aff'
    : '#ff003c',
  [cyberTheme])

  // 从日志行中提取 URL 路径（大数据量时限制遍历数量）
  const pathStats = useMemo(() => {
    const paths: Record<string, { total: number; attacks: number; methods: Record<string, number>; statuses: Record<string, number> }> = {}
    const linesToScan = logLines.length > 100000 ? logLines.slice(0, 100000) : logLines

    for (const line of linesToScan) {
      const urlMatch = line.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+([^\s"]+)/i)
      if (!urlMatch) continue
      const method = urlMatch[1].toUpperCase()
      const path = urlMatch[2].split('?')[0]

      if (!paths[path]) {
        paths[path] = { total: 0, attacks: 0, methods: {}, statuses: {} }
      }
      paths[path].total++
      paths[path].methods[method] = (paths[path].methods[method] || 0) + 1

      // 提取状态码
      const statusMatch = line.match(/\s(\d{3})\s/)
      if (statusMatch) {
        const status = statusMatch[1]
        paths[path].statuses[status] = (paths[path].statuses[status] || 0) + 1
      }
    }

    // 标记攻击路径（按行号去重，同一行匹配多条规则只计一次）
    if (ruleResult) {
      const counted = new Set<string>()
      for (const match of ruleResult.matches) {
        const urlMatch = match.line.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+([^\s"]+)/i)
        if (urlMatch) {
          const path = urlMatch[2].split('?')[0]
          const key = `${path}:${match.lineNumber}`
          if (paths[path] && !counted.has(key)) {
            counted.add(key)
            paths[path].attacks++
          }
        }
      }
    }

    return Object.entries(paths)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 30)
  }, [logLines, ruleResult])

  // 路径攻击热力图数据
  const heatmapData = useMemo(() => {
    return pathStats
      .filter(([_, data]) => data.attacks > 0)
      .slice(0, 20)
      .map(([path, data]) => ({
        path: path.length > 40 ? '...' + path.slice(-37) : path,
        attacks: data.attacks,
        total: data.total,
        attackRate: Math.round((data.attacks / data.total) * 100),
      }))
  }, [pathStats])

  // Top 路径柱状图（分段堆叠柱形图：正常 + 攻击）
  const topPathOption = useMemo(() => {
    const top15 = pathStats.slice(0, 15)
    if (top15.length === 0) return null

    const paths = top15.map(([path]) => path.length > 30 ? '...' + path.slice(-27) : path).reverse()
    const normalData = top15.map(([_, d]) => Math.max(0, d.total - d.attacks)).reverse()
    const attackData = top15.map(([_, d]) => Math.min(d.attacks, d.total)).reverse()

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          if (!params || params.length === 0) return ''
          const idx = params[0].dataIndex
          const origIdx = top15.length - 1 - idx
          const [path, stats] = top15[origIdx]
          const rate = stats.total > 0 ? Math.round((stats.attacks / stats.total) * 100) : 0
          return [
            path,
            `总访问: <b>${stats.total}</b> 次`,
            `正常: ${stats.total - stats.attacks} 次`,
            `攻击: <span style="color:#ff003c">${stats.attacks}</span> 次 (${rate}%)`,
          ].join('<br/>')
        },
      },
      legend: {
        data: ['正常', '攻击'],
        textStyle: { color: '#999', fontSize: 10 },
        top: 0,
        right: 0,
      },
      grid: { top: 28, right: 20, bottom: 5, left: 10, containLabel: true },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } },
      },
      yAxis: {
        type: 'category',
        data: paths,
        axisLabel: { color: '#ccc', fontSize: 9, width: 130, overflow: 'truncate' },
        axisLine: { lineStyle: { color: '#333' } },
      },
      series: [
        {
          name: '正常',
          type: 'bar',
          stack: 'total',
          data: normalData,
          barWidth: '60%',
          itemStyle: { color: accentColor + '80', borderRadius: [0, 0, 0, 0] },
          label: {
            show: true,
            position: 'inside',
            color: '#fff',
            fontSize: 9,
            formatter: (p: any) => p.value > 0 ? p.value : '',
          },
        },
        {
          name: '攻击',
          type: 'bar',
          stack: 'total',
          data: attackData,
          itemStyle: { color: '#ff003c', borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'inside',
            color: '#fff',
            fontSize: 9,
            formatter: (p: any) => p.value > 0 ? p.value : '',
          },
        },
      ],
    }
  }, [pathStats, accentColor])

  // HTTP 方法分布饼图
  const methodPieOption = useMemo(() => {
    const methodCounts: Record<string, number> = {}
    for (const [_, data] of pathStats) {
      for (const [method, count] of Object.entries(data.methods)) {
        methodCounts[method] = (methodCounts[method] || 0) + count
      }
    }
    const entries = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])
    if (entries.length === 0) return null

    const colors: Record<string, string> = {
      GET: '#00f0ff', POST: '#ff003c', PUT: '#ffaa00', DELETE: '#ff6600',
      PATCH: '#b44aff', HEAD: '#00ff88', OPTIONS: '#666',
    }

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { show: false },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: entries.map(([name, value]) => ({
          name,
          value,
          itemStyle: { color: colors[name] || '#666' },
        })),
        label: { show: true, color: '#999', fontSize: 10, formatter: '{b}\n{d}%' },
        itemStyle: { borderRadius: 4, borderColor: '#0a0e1a', borderWidth: 2 },
      }],
    }
  }, [pathStats])

  if (logLines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <circle cx="12" cy="12" r="2" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
          </svg>
          <div className="text-sm">请先加载日志文件并运行分析</div>
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
      {/* 路径访问排行 + HTTP 方法分布 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
            URL 路径访问排行 Top 15
          </div>
          <ScalingChart option={topPathOption} baseHeight={350} />
        </div>
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
            HTTP 方法分布
          </div>
          <ScalingChart option={methodPieOption} baseHeight={350} />
        </div>
      </div>

      {/* 路径攻击热力图 */}
      <div className="glass-card p-4">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
          路径攻击热力图
        </div>
        {heatmapData.length === 0 ? (
          <div className="text-xs text-[var(--text-dim)] py-8 text-center">未检测到路径攻击</div>
        ) : (
          <div className="space-y-1.5">
            {heatmapData.map(item => (
              <div key={item.path} className="flex items-center gap-3">
                <span className="text-xs font-mono text-[var(--text-primary)] w-60 truncate" title={item.path}>{item.path}</span>
                <div className="flex-1 h-5 bg-[var(--bg-primary)] rounded overflow-hidden relative">
                  {/* 总访问量背景 */}
                  <div className="absolute inset-0 opacity-30"
                    style={{ width: '100%', background: accentColor + '20' }} />
                  {/* 攻击量 */}
                  <div className="absolute inset-y-0 left-0 rounded"
                    style={{
                      width: `${item.attackRate}%`,
                      background: `linear-gradient(90deg, #ff003c80, #ff003c)`,
                    }} />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] text-white">
                    {item.attacks}/{item.total} ({item.attackRate}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 路径详情表格 */}
      <div className="glass-card p-4">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
          路径详情
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left py-2 px-2 text-[var(--text-dim)] font-normal">路径</th>
                <th className="text-right py-2 px-2 text-[var(--text-dim)] font-normal">访问量</th>
                <th className="text-right py-2 px-2 text-[var(--text-dim)] font-normal">攻击数</th>
                <th className="text-right py-2 px-2 text-[var(--text-dim)] font-normal">攻击率</th>
                <th className="text-left py-2 px-2 text-[var(--text-dim)] font-normal">主要方法</th>
                <th className="text-left py-2 px-2 text-[var(--text-dim)] font-normal">状态码</th>
              </tr>
            </thead>
            <tbody>
              {pathStats.slice(0, 20).map(([path, data]) => {
                const mainMethod = Object.entries(data.methods).sort((a, b) => b[1] - a[1])[0]
                const mainStatus = Object.entries(data.statuses).sort((a, b) => b[1] - a[1])[0]
                return (
                  <tr key={path} className="border-b border-[var(--border-color)]/50 hover:bg-white/5">
                    <td className="py-2 px-2 font-mono text-[var(--text-primary)] max-w-[300px] truncate">{path}</td>
                    <td className="py-2 px-2 text-right text-[var(--text-primary)]">{data.total}</td>
                    <td className="py-2 px-2 text-right" style={{ color: data.attacks > 0 ? '#ff003c' : 'var(--text-dim)' }}>{data.attacks}</td>
                    <td className="py-2 px-2 text-right" style={{ color: data.attacks > 0 ? '#ff003c' : 'var(--text-dim)' }}>
                      {data.total > 0 ? Math.round((data.attacks / data.total) * 100) : 0}%
                    </td>
                    <td className="py-2 px-2 text-[var(--text-secondary)]">{mainMethod ? mainMethod[0] : '-'}</td>
                    <td className="py-2 px-2 text-[var(--text-secondary)]">{mainStatus ? mainStatus[0] : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
