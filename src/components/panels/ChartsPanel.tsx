// 可视化图表面板

import React, { useMemo, useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useConfigStore } from '@/stores/config-store'
import { extractChartData } from '@/utils/chart-data'
import { generateMapScatterData, aggregateByCountry } from '@/core/geoip'

const WORLD_MAP_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

export function ChartsPanel() {
  const reportText = useAnalysisStore(s => s.reportText)
  const localReportText = useAnalysisStore(s => s.localReportText)
  const logLines = useAnalysisStore(s => s.logLines)
  const geoIPResults = useAnalysisStore(s => s.geoIPResults)
  const botStats = useAnalysisStore(s => s.botStats)
  const localRuleResult = useAnalysisStore(s => s.localRuleResult)
  const fontSizes = useConfigStore(s => s.config.fontSizes)
  const scale = fontSizes.charts / 12
  const [worldMapLoaded, setWorldMapLoaded] = useState(false)

  // 加载世界地图 GeoJSON
  useEffect(() => {
    if (worldMapLoaded || !geoIPResults || geoIPResults.size === 0) return
    fetch(WORLD_MAP_URL)
      .then(res => res.json())
      .then(data => {
        echarts.registerMap('world', data as any)
        setWorldMapLoaded(true)
      })
      .catch(() => {})
  }, [geoIPResults, worldMapLoaded])

  // 合并两份报告的数据
  const chartData = useMemo(() => {
    const text = reportText || localReportText
    if (!text) return null
    // 合并两份报告文本以提取更全面的数据
    const combinedText = [reportText, localReportText].filter(Boolean).join('\n')
    return extractChartData(combinedText, logLines)
  }, [reportText, localReportText, logLines])

  // ECharts 科技感主题
  const themeColors = ['#00f0ff', '#b400ff', '#00ff88', '#ff0040', '#ff8800', '#ffcc00', '#0088ff', '#ff00ff']

  const baseOption = {
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: 'Noto Sans SC, sans-serif',
      color: '#7a8ba8',
      fontSize: Math.round(12 * scale),
    },
  }

  // 攻击类型饼图
  const attackTypeOption = {
    ...baseOption,
    title: {
      text: '攻击类型分布',
      left: 'center',
      top: 10,
      textStyle: { color: '#00f0ff', fontSize: Math.round(14 * scale), fontFamily: 'Orbitron' },
    },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    color: themeColors,
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      itemStyle: {
        borderRadius: 6,
        borderColor: '#0a0e1a',
        borderWidth: 2,
      },
      label: {
        color: '#7a8ba8',
        fontSize: Math.round(11 * scale),
      },
      emphasis: {
        label: { show: true, fontSize: Math.round(14 * scale), fontWeight: 'bold' },
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0, 240, 255, 0.5)' },
      },
      data: chartData?.attackTypes?.length ? chartData.attackTypes : [
        { name: '暂无数据', value: 1 }
      ],
    }],
  }

  // 风险等级柱状图
  const riskLevelOption = {
    ...baseOption,
    title: {
      text: '风险等级分布',
      left: 'center',
      top: 10,
      textStyle: { color: '#00f0ff', fontSize: Math.round(14 * scale), fontFamily: 'Orbitron' },
    },
    tooltip: { trigger: 'axis' },
    color: ['#ff0040', '#ff8800', '#ffcc00', '#0088ff'],
    grid: { left: '10%', right: '10%', bottom: '15%', top: '20%' },
    xAxis: {
      type: 'category',
      data: chartData?.riskLevels?.map(r => r.name) || ['危急', '高危', '中危', '低危'],
      axisLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.2)' } },
      axisLabel: { color: '#7a8ba8' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.2)' } },
      splitLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.05)' } },
      axisLabel: { color: '#7a8ba8' },
    },
    series: [{
      type: 'bar',
      barWidth: '40%',
      data: chartData?.riskLevels?.map((r, i) => ({
        value: r.value,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: ['#ff0040', '#ff8800', '#ffcc00', '#0088ff'][i] },
              { offset: 1, color: 'rgba(0, 0, 0, 0.3)' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
      })) || [0, 0, 0, 0],
    }],
  }

  // IP 统计横向柱图
  const ipStatsOption = {
    ...baseOption,
    title: {
      text: '攻击源 IP 统计',
      left: 'center',
      top: 10,
      textStyle: { color: '#00f0ff', fontSize: Math.round(14 * scale), fontFamily: 'Orbitron' },
    },
    tooltip: { trigger: 'axis' },
    grid: { left: '25%', right: '10%', bottom: '10%', top: '20%' },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.2)' } },
      splitLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.05)' } },
      axisLabel: { color: '#7a8ba8' },
    },
    yAxis: {
      type: 'category',
      data: chartData?.ipStats?.map(ip => ip.name) || ['暂无数据'],
      axisLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.2)' } },
      axisLabel: { color: '#7a8ba8', fontSize: Math.round(11 * scale) },
    },
    series: [{
      type: 'bar',
      barWidth: '50%',
      data: chartData?.ipStats?.map(ip => ({
        value: ip.value,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(0, 0, 0, 0.3)' },
              { offset: 1, color: '#00f0ff' },
            ],
          },
          borderRadius: [0, 4, 4, 0],
        },
      })) || [0],
    }],
  }

  // 时间线折线图
  const timelineOption = {
    ...baseOption,
    title: {
      text: '攻击时间线分析',
      left: 'center',
      top: 10,
      textStyle: { color: '#00f0ff', fontSize: Math.round(14 * scale), fontFamily: 'Orbitron' },
    },
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '10%', bottom: '15%', top: '20%' },
    xAxis: {
      type: 'category',
      data: chartData?.timeline?.map(t => t.time) || ['00:00'],
      axisLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.2)' } },
      axisLabel: { color: '#7a8ba8', rotate: 45 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.2)' } },
      splitLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.05)' } },
      axisLabel: { color: '#7a8ba8' },
    },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#00f0ff', width: 2 },
      itemStyle: { color: '#00f0ff', borderColor: '#0a0e1a', borderWidth: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(0, 240, 255, 0.3)' },
            { offset: 1, color: 'rgba(0, 240, 255, 0)' },
          ],
        },
      },
      data: chartData?.timeline?.map(t => t.count) || [0],
    }],
  }

  // GeoIP 世界地图
  const hasGeoData = geoIPResults && geoIPResults.size > 0 && worldMapLoaded
  const scatterData = useMemo(() => {
    if (!geoIPResults || !localRuleResult) return []
    const ipCounts = new Map<string, number>()
    for (const agg of localRuleResult.aggregatedAlerts) {
      ipCounts.set(agg.sourceIP, (ipCounts.get(agg.sourceIP) || 0) + agg.count)
    }
    return generateMapScatterData(geoIPResults, ipCounts)
  }, [geoIPResults, localRuleResult])

  const worldMapOption = hasGeoData ? {
    ...baseOption,
    title: {
      text: '攻击来源地理分布',
      left: 'center',
      top: 10,
      textStyle: { color: '#00f0ff', fontSize: Math.round(14 * scale), fontFamily: 'Orbitron' },
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.seriesType === 'scatter') {
          return `<div style="font-size:12px">
            <b>${params.data.ip}</b><br/>
            ${params.data.country} ${params.data.city}<br/>
            ISP: ${params.data.isp}<br/>
            攻击次数: <b style="color:#00f0ff">${params.data.value[2]}</b>
          </div>`
        }
        return ''
      },
    },
    geo: {
      map: 'world',
      roam: true,
      zoom: 1.2,
      center: [10, 20],
      itemStyle: {
        areaColor: 'rgba(0, 240, 255, 0.05)',
        borderColor: 'rgba(0, 240, 255, 0.2)',
        borderWidth: 0.5,
      },
      emphasis: {
        itemStyle: { areaColor: 'rgba(0, 240, 255, 0.15)' },
        label: { show: false },
      },
      label: { show: false },
    },
    visualMap: {
      show: true,
      min: 1,
      max: Math.max(...scatterData.map(d => d.value[2]), 10),
      left: 10,
      bottom: 20,
      text: ['高', '低'],
      textStyle: { color: '#7a8ba8', fontSize: Math.round(10 * scale) },
      inRange: { color: ['rgba(0, 240, 255, 0.3)', '#00f0ff', '#ff0040'] },
      calculable: true,
    },
    series: [{
      type: 'scatter',
      coordinateSystem: 'geo',
      data: scatterData,
      symbolSize: (val: number[]) => Math.max(6, Math.min(30, Math.sqrt(val[2]) * 4)),
      itemStyle: {
        color: '#00f0ff',
        shadowBlur: 10,
        shadowColor: 'rgba(0, 240, 255, 0.5)',
      },
      emphasis: {
        itemStyle: { color: '#ff0040', shadowBlur: 20 },
      },
    }],
  } : null

  // Bot/爬虫分类饼图
  const hasBotData = botStats && botStats.length > 0
  const botCategoryData = useMemo(() => {
    if (!botStats) return []
    const categoryMap = new Map<string, number>()
    for (const stat of botStats) {
      categoryMap.set(stat.category, (categoryMap.get(stat.category) || 0) + stat.count)
    }
    const categoryNames: Record<string, string> = {
      search_engine: '搜索引擎',
      benign_bot: '良性爬虫',
      malicious_scanner: '恶意扫描器',
      normal: '正常用户',
      unknown: '未知',
    }
    return [...categoryMap.entries()].map(([name, value]) => ({
      name: categoryNames[name] || name,
      value,
    })).sort((a, b) => b.value - a.value)
  }, [botStats])

  const botCategoryOption = hasBotData ? {
    ...baseOption,
    title: {
      text: '流量来源分类',
      left: 'center',
      top: 10,
      textStyle: { color: '#00f0ff', fontSize: Math.round(14 * scale), fontFamily: 'Orbitron' },
    },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    color: ['#00ff88', '#0088ff', '#ff0040', '#00f0ff', '#7a8ba8'],
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      itemStyle: {
        borderRadius: 6,
        borderColor: '#0a0e1a',
        borderWidth: 2,
      },
      label: {
        color: '#7a8ba8',
        fontSize: Math.round(11 * scale),
      },
      emphasis: {
        label: { show: true, fontSize: Math.round(14 * scale), fontWeight: 'bold' },
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0, 240, 255, 0.5)' },
      },
      data: botCategoryData,
    }],
  } : null

  // 恶意扫描器 Top 10
  const maliciousBots = useMemo(() => {
    if (!botStats) return []
    return botStats
      .filter(b => b.category === 'malicious_scanner')
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [botStats])

  const maliciousBotOption = maliciousBots.length > 0 ? {
    ...baseOption,
    title: {
      text: '恶意扫描器 Top 10',
      left: 'center',
      top: 10,
      textStyle: { color: '#00f0ff', fontSize: Math.round(14 * scale), fontFamily: 'Orbitron' },
    },
    tooltip: { trigger: 'axis' },
    grid: { left: '25%', right: '10%', bottom: '10%', top: '20%' },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.2)' } },
      splitLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.05)' } },
      axisLabel: { color: '#7a8ba8' },
    },
    yAxis: {
      type: 'category',
      data: maliciousBots.map(b => b.name),
      axisLine: { lineStyle: { color: 'rgba(0, 240, 255, 0.2)' } },
      axisLabel: { color: '#7a8ba8', fontSize: Math.round(11 * scale) },
    },
    series: [{
      type: 'bar',
      barWidth: '50%',
      data: maliciousBots.map(b => ({
        value: b.count,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(255, 0, 64, 0.3)' },
              { offset: 1, color: '#ff0040' },
            ],
          },
          borderRadius: [0, 4, 4, 0],
        },
      })),
    }],
  } : null

  const hasData = reportText || localReportText
  const hasExtraCharts = hasGeoData || hasBotData

  return (
    <div className="h-full overflow-y-auto">
      {!hasData ? (
        <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
          <div className="text-center">
            <div className="text-4xl mb-4 opacity-20">📊</div>
            <div>分析完成后将在此显示可视化图表</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-2 animate-fade-in">
          <div className="glass-card p-3">
            <ReactECharts option={attackTypeOption} style={{ height: 280 }} />
          </div>
          <div className="glass-card p-3">
            <ReactECharts option={riskLevelOption} style={{ height: 280 }} />
          </div>
          <div className="glass-card p-3">
            <ReactECharts option={timelineOption} style={{ height: 280 }} />
          </div>
          <div className="glass-card p-3">
            <ReactECharts option={ipStatsOption} style={{ height: 280 }} />
          </div>
          {/* GeoIP 世界地图 */}
          {worldMapOption && (
            <div className="glass-card p-3 xl:col-span-2">
              <ReactECharts option={worldMapOption} style={{ height: 400 }} />
            </div>
          )}
          {/* Bot 分类饼图 */}
          {botCategoryOption && (
            <div className="glass-card p-3">
              <ReactECharts option={botCategoryOption} style={{ height: 280 }} />
            </div>
          )}
          {/* 恶意扫描器 Top 10 */}
          {maliciousBotOption && (
            <div className="glass-card p-3">
              <ReactECharts option={maliciousBotOption} style={{ height: 280 }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
