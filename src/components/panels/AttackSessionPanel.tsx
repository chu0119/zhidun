// 攻击会话面板 - 按 IP 分组的攻击会话、会话时间线、请求序列

import React, { useMemo, useState } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useAppStore } from '@/stores/app-store'

interface Session {
  ip: string
  attacks: { rule: string; category: string; severity: string; lineNumber: number; line: string }[]
  categories: Set<string>
  maxSeverity: string
  firstLine: number
  lastLine: number
}

export function AttackSessionPanel() {
  const ruleResult = useAnalysisStore(s => s.localRuleResult)
  const logLines = useAnalysisStore(s => s.logLines)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const localStatus = useAnalysisStore(s => s.localStatus)
  const triggerAnalysis = useAppStore(s => s.localAnalysisTrigger)
  const [selectedIP, setSelectedIP] = useState<string | null>(null)

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

  if (!ruleResult) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <div className="text-sm">请先运行本地规则分析</div>
          {currentFile && localStatus === 'idle' && triggerAnalysis && (
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

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return '#ff003c'
      case 'high': return '#ff6600'
      case 'medium': return '#ffaa00'
      default: return '#00f0ff'
    }
  }

  const getSeverityLabel = (sev: string) => {
    switch (sev) {
      case 'critical': return '严重'
      case 'high': return '高危'
      case 'medium': return '中危'
      default: return '低危'
    }
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
              onClick={() => setSelectedIP(session.ip)}
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
            </div>

            {/* 攻击序列 */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {selectedSession.attacks.map((attack, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2 rounded bg-[var(--bg-primary)] text-xs">
                  <span className="text-[var(--text-dim)] w-8 text-right shrink-0">#{attack.lineNumber}</span>
                  <span className="px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: getSeverityColor(attack.severity) + '20', color: getSeverityColor(attack.severity) }}>
                    {attack.category}
                  </span>
                  <span className="text-[var(--text-primary)] flex-1 truncate">{attack.rule}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
