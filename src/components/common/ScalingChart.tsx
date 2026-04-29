// 自适应缩放图表组件
// 根据字体大小设置自动调整图表高度和内部字体，确保缩放后图表完全自适应

import React, { useRef, useEffect, useMemo, type CSSProperties } from 'react'
import ReactECharts from 'echarts-for-react'
import { useConfigStore } from '@/stores/config-store'

interface ScalingChartProps {
  option: any
  baseHeight?: number
  className?: string
  style?: CSSProperties
  notMerge?: boolean
  lazyUpdate?: boolean
  scaleFonts?: boolean     // 是否自动缩放内部字体，默认 true（ChartsPanel 已手动缩放，设为 false）
}

// 递归缩放对象中所有 fontSize 属性
function scaleFontSizes(obj: any, scale: number): any {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(item => scaleFontSizes(item, scale))

  const result: any = {}
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (key === 'fontSize' && typeof val === 'number') {
      result[key] = Math.round(val * scale)
    } else if (key === 'rich' && typeof val === 'object') {
      // ECharts rich text 中的 fontSize
      const rich: any = {}
      for (const rk of Object.keys(val)) {
        rich[rk] = scaleFontSizes(val[rk], scale)
      }
      result[key] = rich
    } else if (typeof val === 'object') {
      result[key] = scaleFontSizes(val, scale)
    } else {
      result[key] = val
    }
  }
  return result
}

export function ScalingChart({
  option,
  baseHeight = 280,
  className,
  style,
  notMerge = false,
  lazyUpdate = true,
  scaleFonts = true,
}: ScalingChartProps) {
  const chartRef = useRef<ReactECharts>(null)
  const scale = useConfigStore(s => s.config.fontSizes.panels / 13)
  const skipNextResize = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // 监听容器尺寸变化，触发 ECharts resize（跳过首次触发，避免初始化冲突）
  useEffect(() => {
    const wrapper = chartRef.current?.ele
    if (!wrapper) return

    const observer = new ResizeObserver(() => {
      if (skipNextResize.current) {
        skipNextResize.current = false
        return
      }
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        const instance = chartRef.current?.getEchartsInstance?.()
        if (instance && !instance.isDisposed()) {
          instance.resize({ animation: { duration: 200 } })
        }
      }, 100)
    })

    observer.observe(wrapper)
    return () => {
      observer.disconnect()
      clearTimeout(timerRef.current)
    }
  }, [])

  // 同步缩放高度和内部字体大小
  const scaledOption = useMemo(
    () => {
      if (!option) return null
      return scaleFonts ? scaleFontSizes(option, scale) : option
    },
    [option, scale, scaleFonts]
  )

  if (!scaledOption) return null

  const scaledHeight = Math.round(baseHeight * scale)

  return (
    <ReactECharts
      ref={chartRef}
      option={scaledOption}
      notMerge={notMerge}
      lazyUpdate={lazyUpdate}
      className={className}
      style={{ height: scaledHeight, ...style }}
    />
  )
}
