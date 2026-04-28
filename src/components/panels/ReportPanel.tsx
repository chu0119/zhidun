// 详细报告面板

import React, { useState, useRef, useMemo } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { MITRE_TACTIC_COLORS, MITRE_TACTIC_NAMES } from '@/core/constants'
import type { RuleMatch } from '@/core/rule-engine'

interface ReportPanelProps {
  mode: 'ai' | 'local'
}

export function ReportPanel({ mode }: ReportPanelProps) {
  const reportText = useAnalysisStore(
    s => mode === 'ai' ? s.reportText : s.localReportText
  )
  const localRuleResult = useAnalysisStore(s => s.localRuleResult)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set())
  const contentRef = useRef<HTMLDivElement>(null)

  // 按规则ID聚合告警（用于详情展示）
  const alertGroups = useMemo(() => {
    if (!localRuleResult) return new Map<string, RuleMatch[]>()
    const map = new Map<string, RuleMatch[]>()
    for (const match of localRuleResult.matches) {
      const key = match.rule.id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(match)
    }
    return map
  }, [localRuleResult])

  const toggleAlert = (ruleId: string) => {
    setExpandedAlerts(prev => {
      const next = new Set(prev)
      if (next.has(ruleId)) next.delete(ruleId)
      else next.add(ruleId)
      return next
    })
  }

  const handleSearch = (direction: 'next' | 'prev') => {
    if (!searchQuery || !contentRef.current) return

    const container = contentRef.current
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    let node: Text | null

    container.querySelectorAll('.search-highlight').forEach(el => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el)
        parent.normalize()
      }
    })

    while ((node = walker.nextNode() as Text | null)) {
      const idx = (node.textContent || '').indexOf(searchQuery)
      if (idx >= 0) {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + searchQuery.length)
        const span = document.createElement('span')
        span.className = 'search-highlight'
        span.style.cssText = 'background: rgba(0,240,255,0.3); color: #fff; border-radius: 2px; padding: 0 2px;'
        range.surroundContents(span)
        span.scrollIntoView({ behavior: 'smooth', block: 'center' })
        break
      }
    }
  }

  // Ctrl+F 搜索快捷键
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setSearchVisible(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // ATT&CK 徽章组件
  const renderMitreBadge = (tacticId: string, techniqueId?: string) => {
    const color = MITRE_TACTIC_COLORS[tacticId] || '#888'
    const tacticName = MITRE_TACTIC_NAMES[tacticId] || tacticId
    return (
      <span className="inline-flex items-center gap-1.5 ml-2 text-xs">
        <a
          href={`https://attack.mitre.org/tactics/${tacticId}/`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center px-1.5 py-0.5 rounded border font-mono font-bold transition-all hover:scale-105"
          style={{
            color,
            borderColor: color + '60',
            backgroundColor: color + '15',
            textShadow: `0 0 8px ${color}40`,
          }}
          title={`${tacticId} - ${tacticName}`}
        >
          {tacticId}
        </a>
        {techniqueId && (
          <>
            <span style={{ color: color + '80' }}>→</span>
            <a
              href={`https://attack.mitre.org/techniques/${techniqueId}/`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center px-1.5 py-0.5 rounded border font-mono transition-all hover:scale-105"
              style={{
                color,
                borderColor: color + '40',
                backgroundColor: color + '08',
              }}
              title={`${techniqueId} - ${MITRE_TACTIC_NAMES[tacticId] || ''}`}
            >
              {techniqueId}
            </a>
          </>
        )}
      </span>
    )
  }

  // 告警详情展开面板
  const renderAlertDetail = (ruleId: string) => {
    if (mode !== 'local' || !localRuleResult) return null
    const matches = alertGroups.get(ruleId)
    if (!matches || matches.length === 0) return null

    const rule = matches[0].rule
    const isExpanded = expandedAlerts.has(ruleId)

    return (
      <div className="ml-4 mt-1 mb-2 animate-fade-in">
        <button
          onClick={() => toggleAlert(ruleId)}
          className="flex items-center gap-1 text-xs text-[var(--accent-cyan)] hover:text-[var(--accent-primary)] transition-colors"
        >
          <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
          {isExpanded ? '收起详情' : `查看详情 (${matches.length} 条匹配)`}
        </button>
        {isExpanded && (
          <div className="mt-2 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]/50 animate-slide-up-fade">
            <div className="text-sm text-[var(--text-primary)] mb-2 font-bold">{rule.description}</div>
            {rule.cwe && (
              <div className="flex items-center gap-1 mb-2 text-xs">
                <span className="text-[var(--text-dim)]">CWE:</span>
                <a
                  href={`https://cwe.mitre.org/data/definitions/${rule.cwe.replace('CWE-', '')}.html`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center px-1.5 py-0.5 rounded border font-mono font-bold text-[var(--accent-orange)] border-[var(--accent-orange)]/40 bg-[var(--accent-orange)]/10 hover:scale-105 transition-transform"
                >
                  {rule.cwe}
                </a>
              </div>
            )}
            {rule.mitre && (
              <div className="flex items-center gap-1 mb-2 text-xs">
                <span className="text-[var(--text-dim)]">ATT&CK 映射:</span>
                {renderMitreBadge(rule.mitre.tactic, rule.mitre.technique)}
              </div>
            )}
            <div className="text-xs text-[var(--accent-green)] mb-2">
              <span className="text-[var(--text-dim)]">修复建议: </span>
              {rule.remediation}
            </div>
            <div className="text-xs text-[var(--text-dim)] mb-1">匹配行 ({matches.length} 条):</div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {matches.slice(0, 10).map((m, idx) => (
                <div key={idx} className="text-xs font-mono text-[var(--text-dim)] truncate pl-2 border-l border-[var(--border-color)]">
                  <span className="text-[var(--accent-purple)]">L{m.lineNumber}</span>: {m.line.substring(0, 120)}
                </div>
              ))}
              {matches.length > 10 && (
                <div className="text-xs text-[var(--text-dim)] pl-2">... 还有 {matches.length - 10} 条</div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderReport = (text: string) => {
    if (!text) return null

    const lines = text.split('\n')
    const result: React.ReactNode[] = []
    let currentRuleId: string | null = null

    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i].trim()
      if (!stripped) { result.push(<div key={i} className="h-2" />); continue }

      // 主标题
      if (stripped.startsWith('【') && stripped.endsWith('】')) {
        const title = stripped.slice(1, -1)
        result.push(
          <div key={i} className="my-6 animate-slide-up-fade">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50" />
              <h2 className="font-orbitron font-bold text-[var(--accent-primary)] tracking-wider"
                style={{ textShadow: '0 0 15px var(--glow-color)', fontSize: '1.3em' }}>
                {title}
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent opacity-50" />
            </div>
          </div>
        )
        continue
      }

      // 数字标题
      const titleMatch = stripped.match(/^(\d+)\.\s+(.+)/)
      if (titleMatch) {
        const title = titleMatch[2].replace(/\*\*/g, '')
        result.push(
          <h3 key={i} className="mt-5 mb-2 flex items-center gap-2 animate-slide-up-fade">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full
              bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30
              font-orbitron font-bold text-[var(--accent-primary)]"
              style={{ fontSize: '0.75em' }}>
              {titleMatch[1]}
            </span>
            <span className="font-bold text-[var(--text-primary)]" style={{ fontSize: '1.1em' }}>{title}</span>
          </h3>
        )
        continue
      }

      // ATT&CK / CWE 行（来自 rule-engine 报告）
      if (stripped.startsWith('ATT&CK:') || stripped.startsWith('CWE-')) {
        const mitreMatch = stripped.match(/ATT&CK:\s*(TA\d+)\(([^)]+)\)(?:\s*→\s*(T\d+)\(([^)]+)\))?/)
        const cweMatch = stripped.match(/(CWE-\d+)/)
        const parts: React.ReactNode[] = []

        if (cweMatch) {
          parts.push(
            <a key="cwe" href={`https://cwe.mitre.org/data/definitions/${cweMatch[1].replace('CWE-', '')}.html`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center px-1.5 py-0.5 rounded border font-mono font-bold text-[var(--accent-orange)] border-[var(--accent-orange)]/40 bg-[var(--accent-orange)]/10 hover:scale-105 transition-transform text-xs">
              {cweMatch[1]}
            </a>
          )
        }
        if (mitreMatch) {
          if (parts.length > 0) parts.push(<span key="sep" className="text-[var(--text-dim)] mx-1">|</span>)
          parts.push(<span key="at-label" className="text-[var(--text-dim)]">ATT&CK:</span>)
          parts.push(renderMitreBadge(mitreMatch[1], mitreMatch[3]))
        }

        result.push(
          <div key={i} className="pl-10 leading-6 animate-fade-in flex items-center gap-1 text-xs text-[var(--text-dim)]">
            {parts}
          </div>
        )
        continue
      }

      // 告警条目（含规则ID）+ 附加详情面板
      const ruleIdMatch = stripped.match(/\[([A-Z]+-\d+)\]/)
      if (ruleIdMatch) {
        const ruleId = ruleIdMatch[1]
        currentRuleId = ruleId

        // 风险等级标签
        const riskMatch = stripped.match(/(危急|高危|中危|低危)/)
        if (riskMatch) {
          const levelMap: Record<string, string> = {
            '危急': 'critical', '高危': 'high', '中危': 'medium', '低危': 'low'
          }
          const parts = stripped.split(/(危急|高危|中危|低危)/)
          result.push(
            <div key={i} className="text-[var(--text-secondary)] pl-4 leading-7 animate-fade-in">
              {parts.map((part, j) => {
                if (['危急', '高危', '中危', '低危'].includes(part)) {
                  return <span key={j} className={`risk-tag ${levelMap[part]}`}>{part}</span>
                }
                return <span key={j}>{part.replace(/\*\*/g, '')}</span>
              })}
            </div>
          )
          // 在告警行后插入详情面板
          result.push(<React.Fragment key={`${i}-detail`}>{renderAlertDetail(ruleId)}</React.Fragment>)
          continue
        }

        // 一般告警行
        const content = stripped.replace(/\*\*/g, '')
        result.push(
          <div key={i} className="text-[var(--text-secondary)] pl-4 leading-7 animate-fade-in">
            {content}
          </div>
        )
        result.push(<React.Fragment key={`${i}-detail`}>{renderAlertDetail(ruleId)}</React.Fragment>)
        continue
      }

      // 风险等级标签（无规则ID）
      const riskMatch = stripped.match(/(危急|高危|中危|低危)/)
      if (riskMatch) {
        const levelMap: Record<string, string> = {
          '危急': 'critical', '高危': 'high', '中危': 'medium', '低危': 'low'
        }
        const parts = stripped.split(/(危急|高危|中危|低危)/)
        result.push(
          <div key={i} className="text-[var(--text-secondary)] pl-4 leading-7 animate-fade-in">
            {parts.map((part, j) => {
              if (['危急', '高危', '中危', '低危'].includes(part)) {
                return <span key={j} className={`risk-tag ${levelMap[part]}`}>{part}</span>
              }
              return <span key={j}>{part.replace(/\*\*/g, '')}</span>
            })}
          </div>
        )
        continue
      }

      // 子项
      if (stripped.startsWith('•') || stripped.startsWith('-')) {
        const content = stripped.slice(1).trim().replace(/\*\*/g, '')
        result.push(
          <div key={i} className="text-[var(--text-secondary)] pl-6 leading-7 animate-fade-in">
            <span className="text-[var(--accent-cyan)] mr-2">▸</span>
            {content}
          </div>
        )
        continue
      }

      // 缩进项
      if (stripped.startsWith('  -') || stripped.includes('└─') || stripped.startsWith('  ├')) {
        const content = stripped.replace(/^\s*[-└├│]\s*/, '').replace(/\*\*/g, '')
        result.push(
          <div key={i} className="text-[var(--text-dim)] pl-10 leading-6 animate-fade-in">
            <span className="text-[var(--accent-purple)] mr-2">└</span>
            {content}
          </div>
        )
        continue
      }

      // 普通文本
      result.push(
        <div key={i} className="text-[var(--text-secondary)] pl-4 leading-7 animate-fade-in">
          {stripped.replace(/\*\*/g, '')}
        </div>
      )
    }

    return result
  }

  const emptyIcon = mode === 'ai' ? '📋' : '◆'
  const emptyText = mode === 'ai' ? 'AI 分析完成后将在此显示详细报告' : '本地规则分析完成后将在此显示报告'

  return (
    <div className="h-full flex flex-col" style={{ zoom: 'var(--font-report-scale, 1)' }}>
      {/* 搜索工具栏 */}
      {searchVisible && (
        <div className="flex items-center gap-2 mb-3 p-2 glass-card animate-slide-up-fade">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch('next')
              if (e.key === 'Escape') setSearchVisible(false)
            }}
            placeholder="搜索报告内容..."
            className="neon-input flex-1 text-sm py-1.5"
            autoFocus
          />
          <button onClick={() => handleSearch('prev')} className="neon-btn text-xs px-3 py-1.5">▲</button>
          <button onClick={() => handleSearch('next')} className="neon-btn text-xs px-3 py-1.5">▼</button>
          <button onClick={() => setSearchVisible(false)} className="neon-btn text-xs px-3 py-1.5">✕</button>
        </div>
      )}

      {/* 报告内容 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto pr-2">
        {!reportText ? (
          <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
            <div className="text-center animate-slide-up-fade">
              <div className="text-4xl mb-4 opacity-20">{emptyIcon}</div>
              <div>{emptyText}</div>
              <div className="text-xs mt-2">Ctrl+F 搜索报告内容</div>
            </div>
          </div>
        ) : (
          <div className="animate-slide-up-fade">
            {/* 聚合告警摘要（仅本地报告） */}
            {mode === 'local' && localRuleResult && localRuleResult.aggregatedAlerts.length > 0 && (
              <div className="mb-4 p-3 glass-card animate-slide-up-fade">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[var(--accent-cyan)] font-orbitron text-sm font-bold">告警聚合摘要</span>
                  <span className="text-xs text-[var(--text-dim)]">
                    {localRuleResult.matches.length} 条原始 → {localRuleResult.aggregatedAlerts.length} 条聚合
                  </span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {localRuleResult.aggregatedAlerts.slice(0, 15).map((agg, i) => {
                    const sevColors: Record<string, string> = {
                      critical: 'text-[var(--risk-critical)]', high: 'text-[var(--risk-high)]',
                      medium: 'text-[var(--risk-medium)]', low: 'text-[var(--risk-low)]',
                    }
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs py-0.5 border-b border-[var(--border-color)]/30">
                        <span className={sevColors[agg.rule.severity] || 'text-[var(--text-dim)]'}>●</span>
                        <span className="text-[var(--text-primary)] font-mono">{agg.rule.id}</span>
                        <span className="text-[var(--text-secondary)] truncate flex-1">{agg.rule.name}</span>
                        <span className="text-[var(--accent-purple)] font-mono">{agg.sourceIP}</span>
                        <span className="text-[var(--accent-cyan)] font-bold">×{agg.count}</span>
                      </div>
                    )
                  })}
                  {localRuleResult.aggregatedAlerts.length > 15 && (
                    <div className="text-xs text-[var(--text-dim)] text-center pt-1">
                      ... 还有 {localRuleResult.aggregatedAlerts.length - 15} 条
                    </div>
                  )}
                </div>
              </div>
            )}
            {renderReport(reportText)}
          </div>
        )}
      </div>
    </div>
  )
}
