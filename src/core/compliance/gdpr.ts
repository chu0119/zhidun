// GDPR 合规检查模板

import { ComplianceTemplate, ComplianceCheck } from './base-template'
import type { RuleAnalysisResult } from '@/core/rule-engine'

export class GDPRTemplate extends ComplianceTemplate {
  readonly framework = 'gdpr'
  readonly frameworkName = 'GDPR (通用数据保护条例)'
  readonly version = '2018'

  getChecks(): ComplianceCheck[] {
    return [
      { id: 'Art.5', title: '数据处理原则', description: '合法、公正、透明处理个人数据', status: 'na', details: '', relatedMatches: [] },
      { id: 'Art.25', title: '数据保护设计', description: '默认数据保护和隐私设计', status: 'na', details: '', relatedMatches: [] },
      { id: 'Art.32', title: '处理安全性', description: '确保处理系统的安全性', status: 'na', details: '', relatedMatches: [] },
      { id: 'Art.33', title: '数据泄露通知', description: '72 小时内报告数据泄露', status: 'na', details: '', relatedMatches: [] },
      { id: 'Art.35', title: '影响评估', description: '数据保护影响评估 (DPIA)', status: 'na', details: '', relatedMatches: [] },
    ]
  }

  protected evaluateChecks(result: RuleAnalysisResult): ComplianceCheck[] {
    const checks = this.getChecks()

    // Art.5: 数据处理原则 — 检查是否有数据泄露迹象
    const dataLeaks = this.findMatchesByCategory(result, ['SQL注入', '路径遍历', '文件包含'])
    checks[0] = {
      ...checks[0],
      status: dataLeaks.length === 0 ? 'pass' : 'fail',
      details: dataLeaks.length === 0
        ? '未检测到数据泄露风险'
        : `检测到 ${dataLeaks.length} 次数据泄露风险攻击，可能违反数据处理原则`,
      relatedMatches: dataLeaks.slice(0, 10),
    }

    // Art.25: 数据保护设计 — 检查安全配置
    const configIssues = this.findMatchesByCategory(result, ['目录扫描', 'XSS攻击'])
    checks[1] = {
      ...checks[1],
      status: configIssues.length === 0 ? 'pass' : configIssues.length < 5 ? 'warning' : 'fail',
      details: configIssues.length === 0
        ? '未检测到安全配置问题'
        : `检测到 ${configIssues.length} 次安全配置相关攻击`,
      relatedMatches: configIssues.slice(0, 10),
    }

    // Art.32: 处理安全性
    const allAttacks = result.matches
    checks[2] = {
      ...checks[2],
      status: allAttacks.length === 0 ? 'pass' : allAttacks.length < 10 ? 'warning' : 'fail',
      details: allAttacks.length === 0
        ? '系统安全性良好，未检测到攻击'
        : `检测到 ${allAttacks.length} 次安全事件，需加强系统安全性`,
      relatedMatches: allAttacks.slice(0, 10),
    }

    // Art.33: 数据泄露通知 — 检查是否有严重攻击
    const criticalAttacks = this.findMatchesBySeverity(result, ['critical'])
    checks[3] = {
      ...checks[3],
      status: criticalAttacks.length === 0 ? 'pass' : 'fail',
      details: criticalAttacks.length === 0
        ? '未检测到严重安全事件'
        : `检测到 ${criticalAttacks.length} 个严重安全事件，需评估是否需要数据泄露通知`,
      relatedMatches: criticalAttacks.slice(0, 10),
    }

    // Art.35: 影响评估 — 综合风险评估
    const highRiskAttacks = this.findMatchesBySeverity(result, ['critical', 'high'])
    checks[4] = {
      ...checks[4],
      status: highRiskAttacks.length === 0 ? 'pass' : highRiskAttacks.length < 5 ? 'warning' : 'fail',
      details: highRiskAttacks.length === 0
        ? '当前风险等级较低'
        : `存在 ${highRiskAttacks.length} 个高风险事件，建议进行 DPIA 评估`,
      relatedMatches: highRiskAttacks.slice(0, 10),
    }

    return checks
  }
}
