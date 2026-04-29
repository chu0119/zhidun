// 批处理队列面板

import React, { useCallback, useRef } from 'react'
import { useQueueStore, QueueItem } from '@/stores/queue-store'
import { SUPPORTED_LOG_FORMATS } from '@/core/constants'

interface QueuePanelProps {
  onStartBatch: () => void
  onStopBatch: () => void
  onViewReport: (item: QueueItem) => void
}

export function QueuePanel({ onStartBatch, onStopBatch, onViewReport }: QueuePanelProps) {
  const { items, isRunning, mode, setMode, removeItem, clearAll, addItems } = useQueueStore()
  const stats = useQueueStore(s => s.getStats())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAddFiles = useCallback(async () => {
    const path = await window.electronAPI.openFile()
    if (path) {
      const info = await window.electronAPI.getFileInfo(path)
      if (info.success) {
        addItems([{
          filePath: path,
          fileName: info.info.name,
          fileSize: info.info.size,
        }])
      }
    }
  }, [addItems])

  const handleAddFolder = useCallback(async () => {
    // 使用 openFile 模拟（Electron 没有 openFolder IPC，使用 dialog:openFile 多选）
    // 实际通过 openFile 的 filters 扫描日志文件
    const path = await window.electronAPI.openFile()
    if (path) {
      const dir = path.replace(/[/\\][^/\\]+$/, '')
      const info = await window.electronAPI.getFileInfo(path)
      if (info.success) {
        addItems([{
          filePath: path,
          fileName: info.info.name,
          fileSize: info.info.size,
        }])
      }
    }
  }, [addItems])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const newItems: { filePath: string; fileName: string; fileSize: number }[] = []

    for (const file of files) {
      const filePath = (file as any).path as string
      if (!filePath) continue
      const ext = '.' + filePath.split('.').pop()?.toLowerCase()
      if (!SUPPORTED_LOG_FORMATS.includes(ext)) continue
      newItems.push({
        filePath,
        fileName: file.name,
        fileSize: file.size,
      })
    }

    if (newItems.length > 0) {
      addItems(newItems)
    }
  }, [addItems])

  const statusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'pending': return <span className="text-[var(--text-dim)]">⏳</span>
      case 'analyzing': return <span className="text-[var(--accent-primary)] animate-pulse">⚡</span>
      case 'done': return <span className="text-[var(--accent-green)]">✓</span>
      case 'error': return <span className="text-red-400">✗</span>
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDuration = (start?: number, end?: number) => {
    if (!start) return '-'
    const ms = (end || Date.now()) - start
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* 顶部控制栏 */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-sm font-orbitron text-[var(--accent-primary)] tracking-wider">
            批量分析
          </div>
          {stats.total > 0 && (
            <span className="text-xs text-[var(--text-dim)] font-mono">
              {stats.done}/{stats.total} 完成
              {stats.error > 0 && <span className="text-red-400 ml-2">{stats.error} 错误</span>}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={e => setMode(e.target.value as 'serial' | 'parallel')}
            disabled={isRunning}
            className="neon-select text-xs py-1 px-2"
          >
            <option value="serial">串行执行</option>
            <option value="parallel">并行执行</option>
          </select>
          {!isRunning ? (
            <button
              onClick={onStartBatch}
              disabled={items.length === 0 || stats.pending === 0}
              className="neon-btn primary text-xs px-3 py-1 disabled:opacity-30"
            >
              ▶ 开始批量分析
            </button>
          ) : (
            <button
              onClick={onStopBatch}
              className="neon-btn danger text-xs px-3 py-1"
            >
              ■ 停止
            </button>
          )}
        </div>
      </div>

      {/* 添加文件区域 */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="flex gap-2 shrink-0"
      >
        <button onClick={handleAddFiles}
          className="neon-btn flex-1 text-xs py-2">
          + 添加文件
        </button>
        <button onClick={clearAll}
          disabled={items.length === 0 || isRunning}
          className="neon-btn text-xs px-3 py-2 disabled:opacity-30">
          清空
        </button>
      </div>

      {/* 进度总览 */}
      {stats.total > 0 && (
        <div className="shrink-0">
          <div className="hud-progress" style={{ height: '4px' }}>
            <div className="bar" style={{ width: `${((stats.done + stats.error) / stats.total * 100)}%` }} />
          </div>
        </div>
      )}

      {/* 文件列表 */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
            拖放文件到此处或点击"添加文件"
          </div>
        ) : (
          items.map(item => (
            <div key={item.id}
              className={`glass-card p-3 flex items-center gap-3 ${
                item.status === 'analyzing' ? 'border-[var(--accent-primary)]/50' : ''
              }`}>
              <div className="shrink-0">{statusIcon(item.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-primary)] truncate">{item.fileName}</span>
                  <span className="text-xs text-[var(--text-dim)] font-mono ml-2 shrink-0">
                    {formatSize(item.fileSize)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs ${
                    item.status === 'error' ? 'text-red-400' : 'text-[var(--text-dim)]'
                  }`}>
                    {item.progress}
                  </span>
                  <span className="text-xs text-[var(--text-dim)] font-mono">
                    {formatDuration(item.startTime, item.endTime)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.status === 'done' && (
                  <button
                    onClick={() => onViewReport(item)}
                    className="text-xs px-2 py-1 rounded hover:bg-white/10 text-[var(--accent-primary)]"
                  >
                    查看报告
                  </button>
                )}
                {!isRunning && item.status !== 'analyzing' && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs px-2 py-1 rounded hover:bg-white/10 text-[var(--text-dim)]"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
