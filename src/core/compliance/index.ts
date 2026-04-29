// 合规报告模板注册中心

import { ComplianceTemplate, ComplianceReport } from './base-template'
import { PCIDSSTemplate } from './pci-dss'
import { GDPRTemplate } from './gdpr'
import { OWASPTop10Template } from './owasp-top10'
import { GB22239Template } from './gb22239'
import type { RuleAnalysisResult } from '@/core/rule-engine'

export type { ComplianceCheck, ComplianceReport } from './base-template'

const templates: ComplianceTemplate[] = [
  new OWASPTop10Template(),
  new PCIDSSTemplate(),
  new GDPRTemplate(),
  new GB22239Template(),
]

export function getAvailableFrameworks(): { framework: string; name: string; version: string }[] {
  return templates.map(t => ({
    framework: t.framework,
    name: t.frameworkName,
    version: t.version,
  }))
}

export function generateComplianceReport(
  framework: string,
  result: RuleAnalysisResult,
): ComplianceReport | null {
  const template = templates.find(t => t.framework === framework)
  if (!template) return null
  return template.generateReport(result)
}

export function generateAllComplianceReports(
  result: RuleAnalysisResult,
): ComplianceReport[] {
  return templates.map(t => t.generateReport(result))
}
