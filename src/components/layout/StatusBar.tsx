// 底部状态栏

import React, { useEffect, useState } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useConfigStore } from '@/stores/config-store'
import { APP_VERSION } from '@/core/constants'

export function StatusBar() {
  const status = useAnalysisStore(s => s.status)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const [memory, setMemory] = useState<string>('--')

  useEffect(() => {
    const interval = setInterval(() => {
      // @ts-ignore
      if (performance.memory) {
        // @ts-ignore
        const mb = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))
        setMemory(`${mb} MB`)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const statusMap: Record<string, { label: string; className: string }> = {
    idle: { label: '就绪', className: 'ready' },
    preparing: { label: '准备中', className: 'analyzing' },
    analyzing: { label: '分析中', className: 'analyzing' },
    done: { label: '完成', className: 'done' },
    error: { label: '错误', className: 'error' },
    stopped: { label: '已停止', className: 'error' },
  }

  const { label, className } = statusMap[status] || statusMap.idle

  return (
    <div className="h-7 flex items-center justify-between px-4 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] text-xs text-[var(--text-dim)]">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className={`status-dot ${className}`}></span>
          <span>{label}</span>
        </div>
        {currentFile && (
          <span className="text-[var(--text-secondary)]">
            文件: {currentFile.includes('|') ? currentFile.split('|').pop() : currentFile}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span>内存: {memory}</span>
        <span className="font-mono">v{APP_VERSION}</span>
      </div>
    </div>
  )
}
