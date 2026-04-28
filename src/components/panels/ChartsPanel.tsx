// 可视化图表面板

import React, { useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { extractChartData } from '@/utils/chart-data'

export function ChartsPanel() {
  const reportText = useAnalysisStore(s => s.reportText)
  const localReportText = useAnalysisStore(s => s.localReportText)
  const logLines = useAnalysisStore(s => s.logLines)

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
    },
  }

  // 攻击类型饼图
  const attackTypeOption = {
    ...baseOption,
    title: {
      text: '攻击类型分布',
      left: 'center',
      top: 10,
      textStyle: { color: '#00f0ff', fontSize: 14, fontFamily: 'Orbitron' },
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
        fontSize: 11,
      },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' },
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
      textStyle: { color: '#00f0ff', fontSize: 14, fontFamily: 'Orbitron' },
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
      textStyle: { color: '#00f0ff', fontSize: 14, fontFamily: 'Orbitron' },
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
      axisLabel: { color: '#7a8ba8', fontSize: 11 },
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
      textStyle: { color: '#00f0ff', fontSize: 14, fontFamily: 'Orbitron' },
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

  return (
    <div className="h-full overflow-y-auto" style={{ zoom: 'var(--font-charts-scale, 1)' }}>
      {(!reportText && !localReportText) ? (
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
        </div>
      )}
    </div>
  )
}
