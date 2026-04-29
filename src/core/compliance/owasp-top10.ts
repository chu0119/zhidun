// OWASP Top 10 合规检查模板

import { ComplianceTemplate, ComplianceCheck } from './base-template'
import type { RuleAnalysisResult } from '@/core/rule-engine'

export class OWASPTop10Template extends ComplianceTemplate {
  readonly framework = 'owasp-top10'
  readonly frameworkName = 'OWASP Top 10 (2021)'
  readonly version = '2021'

  getChecks(): ComplianceCheck[] {
    return [
      { id: 'A01', title: '注入漏洞', description: 'SQL、NoSQL、OS、LDAP 注入', status: 'na', details: '', relatedMatches: [] },
      { id: 'A02', title: '加密机制失效', description: '数据加密和密钥管理', status: 'na', details: '', relatedMatches: [] },
      { id: 'A03', title: '注入攻击', description: 'XSS、命令注入等', status: 'na', details: '', relatedMatches: [] },
      { id: 'A04', title: '不安全设计', description: '架构设计缺陷', status: 'na', details: '', relatedMatches: [] },
      { id: 'A05', title: '安全配置错误', description: '目录列表、默认凭据等', status: 'na', details: '', relatedMatches: [] },
      { id: 'A06', title: '过时组件', description: '使用有漏洞的组件', status: 'na', details: '', relatedMatches: [] },
      { id: 'A07', title: '认证失败', description: '暴力破解、凭据填充', status: 'na', details: '', relatedMatches: [] },
      { id: 'A08', title: '数据完整性失败', description: '软件和数据完整性', status: 'na', details: '', relatedMatches: [] },
      { id: 'A09', title: '日志和监控失败', description: '安全日志和监控不足', status: 'na', details: '', relatedMatches: [] },
      { id: 'A10', title: 'SSRF', description: '服务端请求伪造', status: 'na', details: '', relatedMatches: [] },
    ]
  }

  protected evaluateChecks(result: RuleAnalysisResult): ComplianceCheck[] {
    const checks = this.getChecks()

    // A01: 注入漏洞
    const injections = this.findMatchesByCategory(result, ['SQL注入'])
    checks[0] = {
      ...checks[0],
      status: injections.length === 0 ? 'pass' : injections.length < 3 ? 'warning' : 'fail',
      details: injections.length === 0 ? '未检测到 SQL 注入攻击' : `检测到 ${injections.length} 次 SQL 注入攻击`,
      relatedMatches: injections.slice(0, 10),
    }

    // A02: 加密机制 (无法从日志直接检测)
    checks[1] = { ...checks[1], status: 'na', details: '需要 TLS/SSL 证书扫描确认' }

    // A03: XSS、命令注入
    const xss = this.findMatchesByCategory(result, ['XSS攻击', '命令注入'])
    checks[2] = {
      ...checks[2],
      status: xss.length === 0 ? 'pass' : xss.length < 3 ? 'warning' : 'fail',
      details: xss.length === 0 ? '未检测到 XSS/命令注入攻击' : `检测到 ${xss.length} 次注入攻击`,
      relatedMatches: xss.slice(0, 10),
    }

    // A04: 不安全设计 (无法从日志直接检测)
    checks[3] = { ...checks[3], status: 'na', details: '需要架构审查确认' }

    // A05: 安全配置错误 — 目录扫描
    const dirScan = this.findMatchesByCategory(result, ['目录扫描'])
    checks[4] = {
      ...checks[4],
      status: dirScan.length === 0 ? 'pass' : dirScan.length < 10 ? 'warning' : 'fail',
      details: dirScan.length === 0 ? '未检测到目录扫描' : `检测到 ${dirScan.length} 次目录扫描，可能存在配置暴露`,
      relatedMatches: dirScan.slice(0, 10),
    }

    // A06: 过时组件 (无法从日志直接检测)
    checks[5] = { ...checks[5], status: 'na', details: '需要组件版本扫描确认' }

    // A07: 认证失败
    const bruteForce = this.findMatchesByCategory(result, ['暴力破解'])
    checks[6] = {
      ...checks[6],
      status: bruteForce.length === 0 ? 'pass' : bruteForce.length < 5 ? 'warning' : 'fail',
      details: bruteForce.length === 0 ? '未检测到暴力破解攻击' : `检测到 ${bruteForce.length} 次暴力破解尝试`,
      relatedMatches: bruteForce.slice(0, 10),
    }

    // A08: 数据完整性 (无法从日志直接检测)
    checks[7] = { ...checks[7], status: 'na', details: '需要代码和依赖审计确认' }

    // A09: 日志和监控失败
    checks[8] = {
      ...checks[8],
      status: result.totalLines > 0 ? 'pass' : 'fail',
      details: result.totalLines > 0
        ? `日志系统运行正常，已分析 ${result.totalLines} 行日志`
        : '未检测到日志记录，日志系统可能未启用',
      relatedMatches: [],
    }

    // A10: SSRF (无法从日志直接检测)
    checks[9] = { ...checks[9], status: 'na', details: '需要网络流量分析确认' }

    return checks
  }
}
