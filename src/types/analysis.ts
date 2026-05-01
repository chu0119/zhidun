// 分析结果类型

export type AnalysisStatus = 'idle' | 'preparing' | 'analyzing' | 'done' | 'error' | 'stopped'

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface AnalysisHistory {
  id: string
  timestamp: string
  filePath: string
  fileName: string
  fileSize: number
  linesAnalyzed: number
  modelProvider: string
  modelName: string
  analysisTime: number
  hasReport: boolean
  reportText: string
  notes: string
  hasSnapshot?: boolean
}

export interface AnalysisSnapshot {
  localRuleResult: {
    totalLines: number
    matchedLines: number
    matches: { rule: { id: string; name: string; category: string; severity: string; description: string; remediation: string; mitre?: { tactic: string; tacticName: string; technique?: string; techniqueName?: string }; cwe?: string }; line: string; lineNumber: number; matchedText: string }[]
    aggregatedAlerts: { rule: { id: string; name: string; category: string; severity: string; description: string; remediation: string; mitre?: { tactic: string; tacticName: string; technique?: string; techniqueName?: string }; cwe?: string }; sourceIP: string; count: number; lineNumbers: number[]; firstSeen: string; lastSeen: string; sampleLine: string }[]
    summary: { critical: number; high: number; medium: number; low: number; info: number }
    categoryStats: Record<string, number>
    report: string
  } | null
  localReportText: string
  aiReportText: string
  botStats: { category: string; name: string; count: number; sampleUA: string }[]
  geoIPResults: Record<string, { ip: string; country: string; countryCode: string; region: string; city: string; lat: number; lon: number; isp: string; org: string; as: string }>
  preprocessResult: { totalLines: number; suspiciousLines: number; suspiciousContent: string[]; matchedCategories: string[] } | null
  logLines: string[]
  savedAt: string
}

export interface AnalysisProgress {
  phase: string
  message: string
  percent?: number
}

export interface AttackStats {
  attackTypes: Record<string, number>
  riskLevels: Record<string, number>
  ipStats: Record<string, number>
  timeline: { time: string; count: number }[]
}
