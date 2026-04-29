// 攻击会话面板 - 按 IP 分组的攻击会话、会话时间线、请求序列

import React, { useMemo, useState } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useAppStore } from '@/stores/app-store'

interface AttackEntry {
  rule: string
  category: string
  severity: string
  lineNumber: number
  line: string
  matchedText: string
}

interface Session {
  ip: string
  attacks: AttackEntry[]
  categories: Set<string>
  maxSeverity: string
  firstLine: number
  lastLine: number
}

function getSeverityColor(sev: string) {
  switch (sev) {
    case 'critical': return '#ff003c'
    case 'high': return '#ff6600'
    case 'medium': return '#ffaa00'
    default: return '#00f0ff'
  }
}

function getSeverityLabel(sev: string) {
  switch (sev) {
    case 'critical': return '严重'
    case 'high': return '高危'
    case 'medium': return '中危'
    default: return '低危'
  }
}

// 高亮匹配文本的组件
function HighlightedLog({ line, matchedText, color }: { line: string; matchedText: string; color: string }) {
  if (!matchedText || !line.includes(matchedText)) {
    return (
      <div className="font-mono text-[11px] text-[var(--text-secondary)] break-all leading-relaxed">
        {line}
        {matchedText && !line.includes(matchedText) && (
          <div className="mt-1.5 pt-1.5 border-t border-[var(--border-color)]">
            <span className="text-[10px] text-[var(--text-dim)]">匹配内容: </span>
            <span className="font-mono text-[11px]" style={{ color, background: color + '15', padding: '1px 3px', borderRadius: '2px' }}>
              {matchedText}
            </span>
          </div>
        )}
      </div>
    )
  }

  const idx = line.indexOf(matchedText)
  const before = line.slice(0, idx)
  const match = line.slice(idx, idx + matchedText.length)
  const after = line.slice(idx + matchedText.length)

  return (
    <div className="font-mono text-[11px] text-[var(--text-secondary)] break-all leading-relaxed">
      {before}
      <mark style={{ background: color + '30', color, padding: '1px 2px', borderRadius: '2px' }}>
        {match}
      </mark>
      {after}
    </div>
  )
}

export function AttackSessionPanel() {
  const ruleResult = useAnalysisStore(s => s.localRuleResult)
  const logLines = useAnalysisStore(s => s.logLines)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const preprocessStatus = useAnalysisStore(s => s.preprocessStatus)
  const triggerAnalysis = useAppStore(s => s.localAnalysisTrigger)
  const [selectedIP, setSelectedIP] = useState<string | null>(null)
  const [expandedAttacks, setExpandedAttacks] = useState<Set<number>>(new Set())

  // 按 IP 分组攻击会话
  const sessions = useMemo(() => {
    if (!ruleResult) return []
    const ipMap: Record<string, Session> = {}

    for (const match of ruleResult.matches) {
      const ipMatch = match.line.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
      if (!ipMatch) continue
      const ip = ipMatch[1]

      if (!ipMap[ip]) {
        ipMap[ip] = {
          ip,
          attacks: [],
          categories: new Set(),
          maxSeverity: 'low',
          firstLine: match.lineNumber,
          lastLine: match.lineNumber,
        }
      }

      const session = ipMap[ip]
      session.attacks.push({
        rule: match.rule.name,
        category: match.rule.category,
        severity: match.rule.severity,
        lineNumber: match.lineNumber,
        line: match.line,
        matchedText: match.matchedText,
      })
      session.categories.add(match.rule.category)
      session.lastLine = Math.max(session.lastLine, match.lineNumber)
      session.firstLine = Math.min(session.firstLine, match.lineNumber)

      const sevOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
      if ((sevOrder[match.rule.severity] || 0) > (sevOrder[session.maxSeverity] || 0)) {
        session.maxSeverity = match.rule.severity
      }
    }

    return Object.values(ipMap).sort((a, b) => b.attacks.length - a.attacks.length)
  }, [ruleResult])

  const selectedSession = selectedIP ? sessions.find(s => s.ip === selectedIP) : null

  // 切换展开状态
  const toggleExpand = (idx: number) => {
    setExpandedAttacks(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // 切换 IP 时清空展开状态
  const handleSelectIP = (ip: string) => {
    setSelectedIP(ip)
    setExpandedAttacks(new Set())
  }

  if (!ruleResult) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <div className="text-sm">请先运行本地规则分析</div>
          {currentFile && preprocessStatus === 'idle' && triggerAnalysis && (
            <button onClick={triggerAnalysis}
              className="mt-4 px-5 py-2 text-xs rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]
                hover:bg-[var(--accent-primary)]/30 border border-[var(--accent-primary)]/30 transition-all
                hover:shadow-[0_0_15px_var(--glow-color)]">
              开始本地分析
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex gap-4 overflow-hidden">
      {/* 左侧: 会话列表 */}
      <div className="w-80 flex flex-col overflow-hidden">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
          攻击会话 ({sessions.length} 个 IP)
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {sessions.map(session => (
            <div key={session.ip}
              onClick={() => handleSelectIP(session.ip)}
              className={`p-3 rounded-lg cursor-pointer transition-all border ${
                selectedIP === session.ip
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                  : 'border-[var(--border-color)] bg-[var(--bg-primary)] hover:border-[var(--accent-primary)]/30'
              }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-mono text-[var(--text-primary)]">{session.ip}</span>
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: getSeverityColor(session.maxSeverity) + '20', color: getSeverityColor(session.maxSeverity) }}>
                  {getSeverityLabel(session.maxSeverity)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]">
                <span>{session.attacks.length} 次攻击</span>
                <span>{session.categories.size} 个类别</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {[...session.categories].slice(0, 4).map(cat => (
                  <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                    {cat}
                  </span>
                ))}
              </div>
              {/* 会话时间线条 */}
              <div className="mt-2 h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div className="h-full rounded-full"
                  style={{
                    width: '100%',
                    background: `linear-gradient(90deg, ${getSeverityColor(session.maxSeverity)}40, ${getSeverityColor(session.maxSeverity)})`,
                  }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧: 会话详情 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedSession ? (
          <div className="flex-1 flex items-center justify-center text-[var(--text-dim)]">
            <div className="text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-2 opacity-50">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <div className="text-sm">选择一个 IP 查看攻击详情</div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-orbitron text-[var(--accent-primary)]">{selectedSession.ip}</span>
                <span className="text-xs text-[var(--text-dim)] ml-3">
                  {selectedSession.attacks.length} 次攻击 · 行 {selectedSession.firstLine}-{selectedSession.lastLine}
                </span>
              </div>
              <button
                onClick={() => {
                  if (expandedAttacks.size === selectedSession.attacks.length) {
                    setExpandedAttacks(new Set())
                  } else {
                    setExpandedAttacks(new Set(selectedSession.attacks.map((_, i) => i)))
                  }
                }}
                className="text-xs text-[var(--accent-primary)] hover:text-[var(--accent-primary)]/80 transition-colors">
                {expandedAttacks.size === selectedSession.attacks.length ? '全部收起' : '全部展开'}
              </button>
            </div>

            {/* 攻击序列 */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {selectedSession.attacks.map((attack, idx) => {
                const isExpanded = expandedAttacks.has(idx)
                const color = getSeverityColor(attack.severity)

                return (
                  <div key={idx} className="rounded bg-[var(--bg-primary)] overflow-hidden">
                    {/* 条目头部（可点击） */}
                    <div
                      onClick={() => toggleExpand(idx)}
                      className="flex items-start gap-3 p-2 text-xs cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors">
                      <span className="text-[var(--text-dim)] w-8 text-right shrink-0">#{attack.lineNumber}</span>
                      <span className="px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: color + '20', color }}>
                        {attack.category}
                      </span>
                      <span className="text-[var(--text-primary)] flex-1 truncate">{attack.rule}</span>
                      <span className="text-[var(--text-dim)] shrink-0 text-[10px]">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>

                    {/* 展开区域 */}
                    {isExpanded && (
                      <div className="px-2 pb-2 border-t border-[var(--border-color)]">
                        {/* 匹配内容（高亮） */}
                        <div className="mt-2">
                          <div className="text-[10px] text-[var(--text-dim)] mb-1">匹配内容:</div>
                          <div className="p-2 rounded bg-[var(--bg-secondary)] overflow-x-auto">
                            <HighlightedLog
                              line={attack.line}
                              matchedText={attack.matchedText}
                              color={color}
                            />
                          </div>
                        </div>

                        {/* 匹配到的具体文本 */}
                        {attack.matchedText && (
                          <div className="mt-2">
                            <div className="text-[10px] text-[var(--text-dim)] mb-1">触发规则的特征字符串:</div>
                            <div className="p-1.5 rounded text-[11px] font-mono break-all"
                              style={{ background: color + '10', color, border: `1px solid ${color}30` }}>
                              {attack.matchedText}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
