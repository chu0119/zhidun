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
