// 历史记录对话框

import React, { useState } from 'react'
import { useHistoryStore } from '@/stores/history-store'
import { useAnalysisStore } from '@/stores/analysis-store'
import { formatTime } from '@/utils/helpers'

interface HistoryDialogProps {
  open: boolean
  onClose: () => void
}

export function HistoryDialog({ open, onClose }: HistoryDialogProps) {
  const { history, searchHistory, deleteRecord, clearAll } = useHistoryStore()
  const setReportText = useAnalysisStore(s => s.setReportText)
  const [keyword, setKeyword] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null)

  if (!open) return null

  const filtered = keyword ? searchHistory(keyword) : history
  const selected = history.find(r => r.id === selectedRecord)

  const handleViewReport = (record: typeof history[0]) => {
    if (record.reportText) {
      setReportText(record.reportText)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}>
      <div className="glass-card w-[900px] max-h-[85vh] overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h2 className="font-orbitron text-lg font-bold text-[var(--accent-primary)] tracking-wider">
            分析历史
            <span className="ml-3 text-xs text-[var(--text-dim)]">({history.length} 条记录)</span>
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={() => { if (confirm('确定清空所有历史记录?')) clearAll() }}
              className="neon-btn danger text-xs px-3 py-1.5">清空</button>
            <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* 搜索 */}
        <div className="p-3 border-b border-[var(--border-color)]">
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索文件名..."
            className="neon-input w-full text-sm" />
        </div>

        {/* 内容 */}
        <div className="flex h-[60vh]">
          {/* 列表 */}
          <div className="w-1/2 overflow-y-auto border-r border-[var(--border-color)]">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
                暂无历史记录
              </div>
            ) : (
              filtered.map(record => (
                <div key={record.id}
                  onClick={() => setSelectedRecord(record.id)}
                  className={`p-3 border-b border-[var(--border-color)] cursor-pointer transition-all
                    hover:bg-[var(--accent-primary)]/5
                    ${selectedRecord === record.id ? 'bg-[var(--accent-primary)]/10 border-l-2 border-l-[var(--accent-primary)]' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">{record.fileName}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteRecord(record.id) }}
                      className="text-[var(--text-dim)] hover:text-[var(--accent-red)] text-xs">删除</button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]">
                    <span>{record.timestamp}</span>
                    <span>{record.modelProvider}</span>
                    <span>{formatTime(Math.floor(record.analysisTime))}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 详情 */}
          <div className="w-1/2 overflow-y-auto p-4">
            {selected ? (
              <div className="animate-fade-in">
                <div className="text-sm text-[var(--text-secondary)] space-y-2 mb-4">
                  <div><span className="text-[var(--text-dim)]">文件:</span> {selected.fileName}</div>
                  <div><span className="text-[var(--text-dim)]">时间:</span> {selected.timestamp}</div>
                  <div><span className="text-[var(--text-dim)]">模型:</span> {selected.modelProvider} / {selected.modelName}</div>
                  <div><span className="text-[var(--text-dim)]">行数:</span> {selected.linesAnalyzed}</div>
                  <div><span className="text-[var(--text-dim)]">耗时:</span> {formatTime(Math.floor(selected.analysisTime))}</div>
                </div>
                {selected.reportText && (
                  <button onClick={() => handleViewReport(selected)}
                    className="neon-btn primary w-full text-sm">
                    查看报告
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
                选择一条记录查看详情
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
