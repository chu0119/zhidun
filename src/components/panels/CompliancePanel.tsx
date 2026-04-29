// 合规报告面板

import React, { useState, useMemo } from 'react'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useAppStore } from '@/stores/app-store'
import {
  getAvailableFrameworks,
  generateComplianceReport,
  generateAllComplianceReports,
  ComplianceReport,
} from '@/core/compliance'

export function CompliancePanel() {
  const localRuleResult = useAnalysisStore(s => s.localRuleResult)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const preprocessStatus = useAnalysisStore(s => s.preprocessStatus)
  const triggerAnalysis = useAppStore(s => s.localAnalysisTrigger)
  const frameworks = getAvailableFrameworks()
  const [selectedFramework, setSelectedFramework] = useState<string>('owasp-top10')

  const report = useMemo(() => {
    if (!localRuleResult) return null
    return generateComplianceReport(selectedFramework, localRuleResult)
  }, [localRuleResult, selectedFramework])

  const allReports = useMemo(() => {
    if (!localRuleResult) return []
    return generateAllComplianceReports(localRuleResult)
  }, [localRuleResult])

  if (!localRuleResult) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <div className="text-sm">请先运行本地规则分析以生成合规报告</div>
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#00ff88'
    if (score >= 60) return '#ffcc00'
    if (score >= 40) return '#ff8800'
    return '#ff4444'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <span className="text-[var(--accent-green)]">✓</span>
      case 'fail': return <span className="text-red-400">✗</span>
      case 'warning': return <span className="text-yellow-400">⚠</span>
      case 'na': return <span className="text-[var(--text-dim)]">-</span>
      default: return null
    }
  }

  return (
    <div className="h-full flex flex-col gap-3 min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between shrink-0">
        <div className="text-sm font-orbitron text-[var(--accent-primary)] tracking-wider">
          合规报告
        </div>
        <select
          value={selectedFramework}
          onChange={e => setSelectedFramework(e.target.value)}
          className="neon-select text-xs py-1"
        >
          {frameworks.map(f => (
            <option key={f.framework} value={f.framework}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* 总览卡片 */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        {allReports.map(r => (
          <div key={r.framework}
            className={`glass-card p-3 text-center cursor-pointer transition-all ${
              r.framework === selectedFramework ? 'border-[var(--accent-primary)]' : 'hover:border-[var(--accent-primary)]/50'
            }`}
            onClick={() => setSelectedFramework(r.framework)}>
            <div className="text-2xl font-mono" style={{ color: getScoreColor(r.score) }}>
              {r.score}
            </div>
            <div className="text-xs text-[var(--text-dim)] mt-1">{r.frameworkName.split('(')[0].trim()}</div>
          </div>
        ))}
      </div>

      {report && (
        <>
          {/* 得分仪表 */}
          <div className="glass-card p-6 flex items-center justify-center shrink-0">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* 背景圆 */}
                <circle cx="50" cy="50" r="40" fill="none"
                  stroke="var(--border-color)" strokeWidth="8" />
                {/* 得分弧 */}
                <circle cx="50" cy="50" r="40" fill="none"
                  stroke={getScoreColor(report.score)}
                  strokeWidth="8"
                  strokeDasharray={`${report.score * 2.51} 251`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  style={{ filter: `drop-shadow(0 0 10px ${getScoreColor(report.score)}40)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-mono font-bold" style={{ color: getScoreColor(report.score) }}>
                  {report.score}
                </span>
                <span className="text-xs text-[var(--text-dim)]">合规得分</span>
              </div>
            </div>
            <div className="ml-8 space-y-2">
              <div className="text-lg font-orbitron text-[var(--text-primary)]">
                {report.frameworkName}
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-[var(--accent-green)]">✓ {report.passed} 通过</span>
                <span className="text-red-400">✗ {report.failed} 不通过</span>
                <span className="text-yellow-400">⚠ {report.warnings} 警告</span>
                <span className="text-[var(--text-dim)]">- {report.na} 不适用</span>
              </div>
            </div>
          </div>

          {/* 检查项详情 */}
          <div className="space-y-2">
            {report.checks.map(check => (
              <div key={check.id}
                className={`glass-card p-4 border-l-4 ${
                  check.status === 'pass' ? 'border-l-[var(--accent-green)]' :
                  check.status === 'fail' ? 'border-l-red-400' :
                  check.status === 'warning' ? 'border-l-yellow-400' :
                  'border-l-[var(--text-dim)]'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(check.status)}
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {check.id} — {check.title}
                    </span>
                  </div>
                  {check.relatedMatches.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400">
                      {check.relatedMatches.length} 相关告警
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-dim)] mb-2">{check.description}</p>
                <p className={`text-xs ${
                  check.status === 'pass' ? 'text-[var(--accent-green)]' :
                  check.status === 'fail' ? 'text-red-400' :
                  'text-yellow-400'
                }`}>
                  {check.details}
                </p>

                {/* 相关告警展开 */}
                {check.relatedMatches.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-[var(--accent-primary)] cursor-pointer hover:underline">
                      查看相关告警 ({check.relatedMatches.length})
                    </summary>
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {check.relatedMatches.slice(0, 5).map((m, i) => (
                        <div key={i} className="text-[10px] text-[var(--text-dim)] font-mono bg-[var(--bg-primary)] p-1.5 rounded">
                          <span className="text-[#ff6b6b]">[{m.rule.id}]</span> {m.rule.name}: {m.line.substring(0, 120)}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
