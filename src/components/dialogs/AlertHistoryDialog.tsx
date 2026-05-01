// 告警历史对话框

import React, { useState } from 'react'
import { useAlertHistoryStore } from '@/stores/alert-history-store'
import type { AlertHistoryEntry } from '@/core/notification-engine'

interface AlertHistoryDialogProps {
  open: boolean
  onClose: () => void
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ff2d55',
  high: '#ff9500',
  medium: '#ffcc00',
  low: '#34c759',
  info: '#5ac8fa',
}

const STATE_LABELS: Record<string, string> = {
  new: '新告警',
  acknowledged: '已确认',
  resolved: '已解决',
}

const STATE_COLORS: Record<string, string> = {
  new: 'text-red-400',
  acknowledged: 'text-yellow-400',
  resolved: 'text-green-400',
}

export function AlertHistoryDialog({ open, onClose }: AlertHistoryDialogProps) {
  const { alerts, acknowledgeAlert, resolveAlert, deleteAlert, clearResolved } = useAlertHistoryStore()
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  if (!open) return null

  const filtered = alerts.filter(a => {
    if (stateFilter !== 'all' && a.state !== stateFilter) return false
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false
    return true
  })

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="glass-card w-[900px] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-orbitron text-[var(--accent-primary)] tracking-wider">
            告警历史
            <span className="text-xs text-[var(--text-dim)] ml-2 font-mono">({alerts.length})</span>
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10">
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 筛选栏 */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--text-dim)]">状态:</span>
            {['all', 'new', 'acknowledged', 'resolved'].map(s => (
              <button key={s} onClick={() => setStateFilter(s)}
                className={`px-2 py-0.5 text-xs rounded ${stateFilter === s ? 'bg-[var(--accent-primary)] text-black' : 'text-[var(--text-dim)] hover:bg-white/5'}`}>
                {s === 'all' ? '全部' : STATE_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[var(--text-dim)]">级别:</span>
            {['all', 'critical', 'high', 'medium', 'low'].map(s => (
              <button key={s} onClick={() => setSeverityFilter(s)}
                className={`px-2 py-0.5 text-xs rounded ${severityFilter === s ? 'bg-[var(--accent-primary)] text-black' : 'text-[var(--text-dim)] hover:bg-white/5'}`}>
                {s === 'all' ? '全部' : s === 'critical' ? '严重' : s === 'high' ? '高危' : s === 'medium' ? '中危' : '低危'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button onClick={clearResolved}
            className="text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-white/5">
            清除已解决
          </button>
        </div>

        {/* 告警列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="text-center text-[var(--text-dim)] text-xs py-12">暂无告警记录</div>
          ) : (
            <div className="space-y-1">
              {filtered.map(alert => (
                <AlertRow key={alert.id} alert={alert}
                  onAcknowledge={() => acknowledgeAlert(alert.id)}
                  onResolve={() => resolveAlert(alert.id)}
                  onDelete={() => deleteAlert(alert.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AlertRow({ alert, onAcknowledge, onResolve, onDelete }: {
  alert: AlertHistoryEntry
  onAcknowledge: () => void
  onResolve: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const color = SEVERITY_COLORS[alert.severity] || '#888'
  const time = new Date(alert.timestamp).toLocaleString('zh-CN')

  return (
    <div className="rounded bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] transition-colors">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs text-[var(--text-primary)] truncate flex-1 font-medium">{alert.ruleName}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: color + '20', color }}>
          {alert.severity === 'critical' ? '严重' : alert.severity === 'high' ? '高危' : alert.severity === 'medium' ? '中危' : '低危'}
        </span>
        <span className="text-[10px] text-[var(--text-dim)]">{alert.category}</span>
        <span className={`text-[10px] ${STATE_COLORS[alert.state]}`}>{STATE_LABELS[alert.state]}</span>
        <span className="text-[10px] text-[var(--text-dim)] font-mono">{time}</span>
      </div>
      {expanded && (
        <div className="px-3 pb-2 border-t border-[var(--border-color)] mt-1 pt-2">
          <div className="text-xs text-[var(--text-dim)] mb-2">
            <span className="text-[var(--text-secondary)]">匹配文本: </span>
            <code className="font-mono bg-black/30 px-1 rounded">{alert.matchedText}</code>
          </div>
          {alert.filePath && (
            <div className="text-xs text-[var(--text-dim)] mb-2">
              <span className="text-[var(--text-secondary)]">来源: </span>{alert.filePath}
            </div>
          )}
          {alert.channelResults && alert.channelResults.length > 0 && (
            <div className="text-xs text-[var(--text-dim)] mb-2">
              <span className="text-[var(--text-secondary)]">通知结果: </span>
              {alert.channelResults.map((r, i) => (
                <span key={i} className={r.success ? 'text-green-400' : 'text-red-400'}>
                  {r.channel}{r.success ? ' ✓' : ' ✗'}{i < alert.channelResults!.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-1 mt-2">
            {alert.state === 'new' && (
              <button onClick={onAcknowledge}
                className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20">
                确认
              </button>
            )}
            {alert.state !== 'resolved' && (
              <button onClick={onResolve}
                className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20">
                解决
              </button>
            )}
            <button onClick={onDelete}
              className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
