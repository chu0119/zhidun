// 地理分析面板 - GeoIP 地图、IP 地理分布

import React, { useMemo, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useThemeStore } from '@/stores/theme-store'
import { useAppStore } from '@/stores/app-store'
import { extractIPsFromLines, lookupIPs, GeoIPResult } from '@/core/geoip'

export function GeoPanel() {
  const logLines = useAnalysisStore(s => s.logLines)
  const geoResults = useAnalysisStore(s => s.geoIPResults)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const localStatus = useAnalysisStore(s => s.localStatus)
  const cyberTheme = useThemeStore(s => s.currentTheme)
  const triggerAnalysis = useAppStore(s => s.localAnalysisTrigger)

  const accentColor = cyberTheme === 'cyber' ? '#00f0ff'
    : cyberTheme === 'green' ? '#00ff88'
    : cyberTheme === 'purple' ? '#b44aff'
    : '#ff003c'

  // 如果没有 GeoIP 结果，尝试自动查询
  useEffect(() => {
    if (logLines.length > 0 && (!geoResults || geoResults.size === 0)) {
      const ips = extractIPsFromLines(logLines)
      if (ips.length > 0) {
        lookupIPs(ips).then(results => {
          useAnalysisStore.getState().setGeoIPResults(results)
        }).catch(() => {})
      }
    }
  }, [logLines])

  // 将 Map 转为数组
  const geoArray = useMemo(() => {
    if (!geoResults || geoResults.size === 0) return []
    return Array.from(geoResults.values())
  }, [geoResults])

  // 统计国家/地区分布
  const countryStats = useMemo(() => {
    if (geoArray.length === 0) return []
    const counts: Record<string, number> = {}
    for (const geo of geoArray) {
      const country = geo.country || '未知'
      counts[country] = (counts[country] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
  }, [geoArray])

  // 地图数据
  const mapOption = useMemo(() => {
    if (geoArray.length === 0) return null

    const scatterData = geoArray
      .filter(g => g.lat && g.lon)
      .map(g => ({
        name: g.ip,
        value: [g.lon, g.lat, 1],
        country: g.country,
        city: g.city,
      }))

    if (scatterData.length === 0) return null

    return {
      backgroundColor: 'transparent',
      geo: {
        map: 'world',
        roam: true,
        zoom: 1.5,
        center: [105, 35],
        silent: true,
        itemStyle: {
          areaColor: '#0a0e1a',
          borderColor: '#1a2040',
          borderWidth: 0.5,
        },
        emphasis: {
          itemStyle: {
            areaColor: '#1a2040',
          },
        },
        label: { show: false },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.data) {
            return `${params.data.name}<br/>${params.data.country || ''} ${params.data.city || ''}`
          }
          return params.name
        },
      },
      series: [{
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: scatterData,
        symbolSize: 8,
        showEffectOn: 'render',
        rippleEffect: {
          brushType: 'stroke',
          scale: 3,
          period: 4,
        },
        itemStyle: {
          color: accentColor,
          shadowBlur: 10,
          shadowColor: accentColor,
        },
      }],
    }
  }, [geoArray, accentColor])

  // 国家分布柱状图
  const countryBarOption = useMemo(() => {
    if (countryStats.length === 0) return null
    const top15 = countryStats.slice(0, 15)

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { top: 10, right: 10, bottom: 5, left: 10 },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } },
      },
      yAxis: {
        type: 'category',
        data: top15.map(([name]) => name).reverse(),
        axisLabel: { color: '#999', fontSize: 10 },
        axisLine: { lineStyle: { color: '#333' } },
      },
      series: [{
        type: 'bar',
        data: top15.map(([_, count]) => count).reverse(),
        barWidth: '60%',
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: accentColor + '40' },
              { offset: 1, color: accentColor },
            ],
          },
        },
      }],
    }
  }, [countryStats, accentColor])

  if (logLines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <div className="text-sm">请先加载日志文件并运行分析</div>
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
      {/* 世界地图 */}
      <div className="glass-card p-4">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
          IP 地理分布地图
        </div>
        {mapOption ? (
          <ReactECharts option={mapOption} style={{ height: 350 }} />
        ) : (
          <div className="flex items-center justify-center h-[350px] text-[var(--text-dim)] text-sm">
            {geoArray.length > 0 ? '无有效地理坐标数据' : '正在查询 IP 地理位置...'}
          </div>
        )}
      </div>

      {/* 国家分布 + IP 列表 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
            国家/地区分布 Top 15
          </div>
          {countryBarOption ? (
            <ReactECharts option={countryBarOption} style={{ height: 350 }} />
          ) : (
            <div className="flex items-center justify-center h-[350px] text-[var(--text-dim)] text-sm">
              暂无地理数据
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
            IP 地址列表
          </div>
          <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
            {geoArray.length > 0 ? (
              geoArray.slice(0, 30).map((geo, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded bg-[var(--bg-primary)] text-xs">
                  <span className="font-mono text-[var(--text-primary)] w-32">{geo.ip}</span>
                  <span className="text-[var(--text-secondary)] flex-1 truncate">
                    {geo.country || '未知'} {geo.city || ''}
                  </span>
                  {geo.isp && (
                    <span className="text-[var(--text-dim)] truncate max-w-[120px]">{geo.isp}</span>
                  )}
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
                正在加载...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
