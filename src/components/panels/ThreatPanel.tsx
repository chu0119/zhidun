// 威胁检测面板 - MITRE ATT&CK 映射、CWE 关联、威胁趋势

import React, { useMemo } from 'react'
import { ScalingChart } from '@/components/common/ScalingChart'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useThemeStore } from '@/stores/theme-store'
import { useAppStore } from '@/stores/app-store'

// ===== 战术通俗描述 =====
const TACTIC_DESCRIPTIONS: Record<string, string> = {
  'TA0043': '攻击者在发起攻击前的信息收集阶段，如端口扫描、目录枚举、指纹识别',
  'TA0001': '攻击者首次进入系统的入口，如利用 Web 漏洞、钓鱼邮件、弱口令',
  'TA0002': '攻击者在目标系统上运行恶意代码，如命令注入、脚本执行',
  'TA0003': '攻击者维持对系统的长期访问权限，如植入 WebShell、定时任务',
  'TA0004': '攻击者获取更高权限，如从普通用户提升到管理员',
  'TA0005': '攻击者绕过安全检测和防护机制，如编码混淆、日志清除',
  'TA0006': '攻击者窃取或破解账号密码，如暴力破解、凭证填充、JWT 篡改',
  'TA0007': '攻击者探测系统信息，如目录遍历、敏感文件发现、环境变量泄露',
  'TA0009': '攻击者收集感兴趣的数据准备外传',
  'TA0011': '攻击者与被控系统建立通信通道，如反弹 Shell、DNS 隧道',
  'TA0010': '攻击者将窃取的数据从目标系统传出',
  'TA0040': '攻击者对系统造成破坏，如数据删除、服务中断、勒索加密',
}

// ===== 技术 ID → 中文描述 =====
const TECHNIQUE_NAMES: Record<string, string> = {
  'T1190': '利用公开应用漏洞',
  'T1189': '钓鱼/水坑攻击',
  'T1059': '命令与脚本执行',
  'T1110': '暴力破解',
  'T1595': '主动扫描探测',
  'T1505': '植入服务器组件',
  'T1556': '篡改认证过程',
  'T1082': '系统信息发现',
  'T1083': '文件和目录发现',
}

export function ThreatPanel() {
  const ruleResult = useAnalysisStore(s => s.localRuleResult)
  const currentFile = useAnalysisStore(s => s.currentFile)
  const preprocessStatus = useAnalysisStore(s => s.preprocessStatus)
  const cyberTheme = useThemeStore(s => s.currentTheme)
  const triggerAnalysis = useAppStore(s => s.localAnalysisTrigger)

  const accentColor = cyberTheme === 'cyber' ? '#00f0ff'
    : cyberTheme === 'green' ? '#00ff88'
    : cyberTheme === 'purple' ? '#b44aff'
    : '#ff003c'

  // 按 MITRE ATT&CK 战术分组（增强版：含技术详情和匹配规则）
  const mitreGroups = useMemo(() => {
    if (!ruleResult) return []
    const groups: Record<string, {
      tactic: string; tacticName: string;
      techniques: Map<string, string>; // technique ID → name
      matchedRules: Set<string>; count: number; severity: string;
    }> = {}

    for (const match of ruleResult.matches) {
      const mitre = match.rule.mitre
      if (!mitre) continue
      const key = mitre.tactic
      if (!groups[key]) {
        groups[key] = {
          tactic: mitre.tactic,
          tacticName: mitre.tacticName,
          techniques: new Map(),
          matchedRules: new Set(),
          count: 0,
          severity: match.rule.severity,
        }
      }
      const g = groups[key]
      g.count++
      if (mitre.technique) g.techniques.set(mitre.technique, mitre.techniqueName || mitre.technique)
      g.matchedRules.add(match.rule.name)
      const sevOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
      if ((sevOrder[match.rule.severity] || 0) > (sevOrder[g.severity] || 0)) {
        g.severity = match.rule.severity
      }
    }

    return Object.values(groups).sort((a, b) => b.count - a.count)
  }, [ruleResult])

  // 按 CWE 分组
  const cweGroups = useMemo(() => {
    if (!ruleResult) return []
    const groups: Record<string, number> = {}
    for (const match of ruleResult.matches) {
      if (match.rule.cwe) {
        groups[match.rule.cwe] = (groups[match.rule.cwe] || 0) + 1
      }
    }
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [ruleResult])

  // 威胁趋势图 (按行号分布模拟时间线)
  const trendOption = useMemo(() => {
    if (!ruleResult || ruleResult.matches.length === 0) return null
    const totalLines = ruleResult.totalLines
    const buckets = 20
    const bucketSize = Math.max(1, Math.floor(totalLines / buckets))
    const counts = new Array(buckets).fill(0)

    for (const match of ruleResult.matches) {
      const bucket = Math.min(buckets - 1, Math.floor(match.lineNumber / bucketSize))
      counts[bucket]++
    }

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { top: 10, right: 10, bottom: 30, left: 40 },
      xAxis: {
        type: 'category',
        data: counts.map((_, i) => `${Math.round((i * bucketSize / totalLines) * 100)}%`),
        axisLabel: { color: '#999', fontSize: 9, rotate: 45 },
        axisLine: { lineStyle: { color: '#333' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#999', fontSize: 10 },
        splitLine: { lineStyle: { color: '#222' } },
      },
      series: [{
        type: 'line',
        data: counts,
        smooth: true,
        lineStyle: { color: accentColor, width: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: accentColor + '40' },
              { offset: 1, color: accentColor + '05' },
            ],
          },
        },
        itemStyle: { color: accentColor },
        symbol: 'circle',
        symbolSize: 4,
      }],
    }
  }, [ruleResult, accentColor])

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'critical': return { bg: 'bg-red-500/20', text: 'text-red-400', label: '严重' }
      case 'high': return { bg: 'bg-orange-500/20', text: 'text-orange-400', label: '高危' }
      case 'medium': return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '中危' }
      default: return { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: '低危' }
    }
  }

  if (!ruleResult) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-[var(--text-dim)]">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" className="mx-auto mb-3 opacity-50">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
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
    <div className="h-full overflow-y-auto space-y-4 pr-1">
      {/* MITRE ATT&CK 战术映射 */}
      <div className="glass-card p-4">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-1">
          MITRE ATT&CK 战术映射
        </div>
        <div className="text-xs text-[var(--text-dim)] mb-4 leading-relaxed">
          MITRE ATT&amp;CK 是全球通用的攻击行为分类框架，将攻击过程分为多个阶段（称为「战术」），
          每个战术下包含具体的攻击技术。以下展示本次分析中检测到的攻击行为在各战术阶段的分布情况。
        </div>

        {mitreGroups.length === 0 ? (
          <div className="text-xs text-[var(--text-dim)] py-4 text-center">未检测到 MITRE ATT&CK 映射</div>
        ) : (
          <div className="space-y-3">
            {mitreGroups.map(group => {
              const sev = getSeverityStyle(group.severity)
              const tacticUrl = `https://attack.mitre.org/tactics/${group.tactic}/`
              const description = TACTIC_DESCRIPTIONS[group.tactic] || ''
              const ruleList = [...group.matchedRules].slice(0, 5)

              return (
                <div key={group.tactic}
                  className="p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]
                    hover:border-[var(--accent-primary)]/30 transition-colors">
                  {/* 标题行 */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{group.tacticName}</span>
                      <a href={tacticUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-mono text-[var(--accent-cyan)] hover:underline"
                        title="在 MITRE ATT&CK 官网查看">
                        {group.tactic} ↗
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>{sev.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                        {group.count} 次
                      </span>
                    </div>
                  </div>

                  {/* 通俗描述 */}
                  {description && (
                    <div className="text-xs text-[var(--text-dim)] mb-2 leading-relaxed">{description}</div>
                  )}

                  {/* 涉及技术 */}
                  {group.techniques.size > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className="text-[10px] text-[var(--text-dim)]">涉及技术:</span>
                      {[...group.techniques.entries()].map(([tid, tname]) => (
                        <a key={tid} href={`https://attack.mitre.org/techniques/${tid}/`} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]
                            hover:bg-[var(--accent-primary)]/20 transition-colors"
                          title="在 MITRE ATT&CK 官网查看">
                          {tid} {TECHNIQUE_NAMES[tid] || tname}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 匹配规则 */}
                  {ruleList.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-dim)]">匹配规则:</span>
                      {ruleList.map(rule => (
                        <span key={rule} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                          {rule}
                        </span>
                      ))}
                      {group.matchedRules.size > 5 && (
                        <span className="text-[10px] text-[var(--text-dim)]">+{group.matchedRules.size - 5} 更多</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 威胁趋势 */}
      {trendOption && (
        <div className="glass-card p-4">
          <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
            威胁分布趋势
          </div>
          <ScalingChart option={trendOption} baseHeight={200} />
        </div>
      )}

      {/* CWE 漏洞关联 */}
      <div className="glass-card p-4">
        <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
          CWE 漏洞关联 Top 10
        </div>
        {cweGroups.length === 0 ? (
          <div className="text-xs text-[var(--text-dim)] py-4 text-center">未检测到 CWE 关联</div>
        ) : (
          <div className="space-y-2">
            {cweGroups.map(([cwe, count]) => (
              <div key={cwe} className="flex items-center gap-3">
                <a href={`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-', '')}.html`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs font-mono text-[var(--accent-cyan)] w-20 hover:underline"
                  title="在 CWE 官网查看">
                  {cwe} ↗
                </a>
                <div className="flex-1">
                  <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${(count / cweGroups[0][1]) * 100}%`,
                        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
                      }} />
                  </div>
                </div>
                <span className="text-xs text-[var(--text-primary)] w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
