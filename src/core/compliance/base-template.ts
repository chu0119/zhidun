// 合规报告模板基类

import { RuleAnalysisResult, RuleMatch } from '@/core/rule-engine'

export interface ComplianceCheck {
  id: string
  title: string
  description: string
  status: 'pass' | 'fail' | 'warning' | 'na'
  details: string
  relatedMatches: RuleMatch[]
}

export interface ComplianceReport {
  framework: string
  frameworkName: string
  score: number        // 0-100
  totalChecks: number
  passed: number
  failed: number
  warnings: number
  na: number
  checks: ComplianceCheck[]
  generatedAt: string
}

export abstract class ComplianceTemplate {
  abstract readonly framework: string
  abstract readonly frameworkName: string
  abstract readonly version: string

  abstract getChecks(): ComplianceCheck[]

  // 从分析结果生成合规报告
  generateReport(result: RuleAnalysisResult): ComplianceReport {
    const checks = this.evaluateChecks(result)
    const passed = checks.filter(c => c.status === 'pass').length
    const failed = checks.filter(c => c.status === 'fail').length
    const warnings = checks.filter(c => c.status === 'warning').length
    const na = checks.filter(c => c.status === 'na').length
    const applicable = checks.filter(c => c.status !== 'na').length

    const score = applicable > 0 ? Math.round((passed / applicable) * 100) : 100

    return {
      framework: this.framework,
      frameworkName: this.frameworkName,
      score,
      totalChecks: checks.length,
      passed,
      failed,
      warnings,
      na,
      checks,
      generatedAt: new Date().toISOString(),
    }
  }

  protected abstract evaluateChecks(result: RuleAnalysisResult): ComplianceCheck[]

  // 辅助方法：查找匹配特定类别的告警
  protected findMatchesByCategory(result: RuleAnalysisResult, categories: string[]): RuleMatch[] {
    return result.matches.filter(m => categories.includes(m.rule.category))
  }

  // 辅助方法：查找匹配特定严重级别的告警
  protected findMatchesBySeverity(result: RuleAnalysisResult, severities: string[]): RuleMatch[] {
    return result.matches.filter(m => severities.includes(m.rule.severity))
  }

  // 辅助方法：检查是否存在特定攻击类型
  protected hasAttackType(result: RuleAnalysisResult, categories: string[]): boolean {
    return result.matches.some(m => categories.includes(m.rule.category))
  }

  // 辅助方法：统计特定类别的告警数
  protected countByCategory(result: RuleAnalysisResult, category: string): number {
    return result.matches.filter(m => m.rule.category === category).length
  }
}
