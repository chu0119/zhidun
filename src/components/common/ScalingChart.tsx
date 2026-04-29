// 自适应缩放图表组件
// 根据字体大小设置自动调整图表高度，并通过 ResizeObserver 确保 ECharts 正确响应尺寸变化

import React, { useRef, useEffect, useCallback, type CSSProperties } from 'react'
import ReactECharts from 'echarts-for-react'
import { useConfigStore } from '@/stores/config-store'

interface ScalingChartProps {
  option: any
  baseHeight?: number
  className?: string
  style?: CSSProperties
  notMerge?: boolean
  lazyUpdate?: boolean
}

export function ScalingChart({
  option,
  baseHeight = 280,
  className,
  style,
  notMerge = false,
  lazyUpdate = true,
}: ScalingChartProps) {
  const chartRef = useRef<ReactECharts>(null)
  const scale = useConfigStore(s => s.config.fontSizes.panels / 13)
  const skipNextResize = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  // 监听容器尺寸变化，触发 ECharts resize（跳过首次触发，避免初始化冲突）
  useEffect(() => {
    const wrapper = chartRef.current?.ele
    if (!wrapper) return

    const observer = new ResizeObserver((entries) => {
      // 跳过初始 mount 触发
      if (skipNextResize.current) {
        skipNextResize.current = false
        return
      }
      // 防抖：避免频繁 resize
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

  if (!option) return null

  const scaledHeight = Math.round(baseHeight * scale)

  return (
    <ReactECharts
      ref={chartRef}
      option={option}
      notMerge={notMerge}
      lazyUpdate={lazyUpdate}
      className={className}
      style={{ height: scaledHeight, ...style }}
    />
  )
}
