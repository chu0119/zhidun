// 日志列表面板 - 虚拟滚动日志行显示、过滤、高亮

import React, { useState, useMemo, useCallback } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'

export function LogListPanel() {
  const logLines = useAnalysisStore(s => s.logLines)
  const ruleResult = useAnalysisStore(s => s.localRuleResult)
  const [filter, setFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [showAttacksOnly, setShowAttacksOnly] = useState(false)

  // 构建攻击行号集合
  const attackLines = useMemo(() => {
    if (!ruleResult) return new Map<number, string>()
    const map = new Map<number, string>()
    for (const match of ruleResult.matches) {
      map.set(match.lineNumber, match.rule.severity)
    }
    return map
  }, [ruleResult])

  // 过滤后的行
  const filteredLines = useMemo(() => {
    let lines = logLines.map((line, idx) => ({ line, lineNumber: idx + 1 }))

    if (showAttacksOnly) {
      lines = lines.filter(l => attackLines.has(l.lineNumber))
    }

    if (severityFilter !== 'all') {
      lines = lines.filter(l => {
        const sev = attackLines.get(l.lineNumber)
        return sev === severityFilter
      })
    }

    if (filter) {
      const lower = filter.toLowerCase()
      lines = lines.filter(l => l.line.toLowerCase().includes(lower))
    }

    return lines
  }, [logLines, filter, severityFilter, showAttacksOnly, attackLines])

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return '#ff003c'
      case 'high': return '#ff6600'
      case 'medium': return '#ffaa00'
      case 'low': return '#00f0ff'
      default: return 'transparent'
    }
  }

  if (logLines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <div className="text-sm">请先加载日志文件</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="shrink-0 flex items-center gap-3 mb-3">
        <div className="flex-1 relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="搜索日志内容..."
            className="neon-input w-full pl-9 text-xs" />
        </div>

        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="neon-select text-xs">
          <option value="all">全部级别</option>
          <option value="critical">严重</option>
          <option value="high">高危</option>
          <option value="medium">中危</option>
          <option value="low">低危</option>
        </select>

        <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={showAttacksOnly}
            onChange={e => setShowAttacksOnly(e.target.checked)}
            className="accent-[var(--accent-primary)]" />
          仅攻击行
        </label>

        <span className="text-xs text-[var(--text-dim)]">
          {filteredLines.length} / {logLines.length} 行
        </span>
      </div>

      {/* 日志行列表 */}
      <div className="flex-1 overflow-y-auto font-mono text-xs leading-5 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-color)]">
        {filteredLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-dim)]">
            无匹配的日志行
          </div>
        ) : (
          <div className="p-2">
            {filteredLines.map(({ line, lineNumber }) => {
              const sev = attackLines.get(lineNumber)
              return (
                <div key={lineNumber}
                  className={`flex items-start gap-2 py-0.5 px-2 rounded hover:bg-white/5 ${sev ? 'bg-[var(--accent-primary)]/5' : ''}`}>
                  <span className="text-[var(--text-dim)] w-12 text-right shrink-0 select-none">{lineNumber}</span>
                  {sev && (
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ background: getSeverityColor(sev), boxShadow: `0 0 4px ${getSeverityColor(sev)}` }} />
                  )}
                  <span className={`flex-1 break-all ${sev ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                    {line}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
