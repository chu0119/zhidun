// 等保 2.0 (GB/T 22239) 合规检查模板

import { ComplianceTemplate, ComplianceCheck } from './base-template'
import type { RuleAnalysisResult } from '@/core/rule-engine'

export class GB22239Template extends ComplianceTemplate {
  readonly framework = 'gb22239'
  readonly frameworkName = '等保 2.0 (GB/T 22239-2019)'
  readonly version = '2019'

  getChecks(): ComplianceCheck[] {
    return [
      { id: 'WAF-01', title: 'Web 应用防火墙', description: '部署 WAF 防护 Web 应用', status: 'na', details: '', relatedMatches: [] },
      { id: 'IDS-01', title: '入侵检测系统', description: '部署 IDS 监控异常流量', status: 'na', details: '', relatedMatches: [] },
      { id: 'LOG-01', title: '日志审计', description: '启用安全日志审计功能', status: 'na', details: '', relatedMatches: [] },
      { id: 'AUTH-01', title: '身份鉴别', description: '实施强身份鉴别机制', status: 'na', details: '', relatedMatches: [] },
      { id: 'NET-01', title: '网络安全', description: '网络边界安全防护', status: 'na', details: '', relatedMatches: [] },
      { id: 'VULN-01', title: '漏洞管理', description: '定期漏洞扫描和修补', status: 'na', details: '', relatedMatches: [] },
      { id: 'DATA-01', title: '数据安全', description: '数据完整性和保密性保护', status: 'na', details: '', relatedMatches: [] },
      { id: 'BACK-01', title: '备份恢复', description: '数据备份和灾难恢复', status: 'na', details: '', relatedMatches: [] },
    ]
  }

  protected evaluateChecks(result: RuleAnalysisResult): ComplianceCheck[] {
    const checks = this.getChecks()

    // WAF-01: Web 应用防火墙
    const webAttacks = this.findMatchesByCategory(result, ['SQL注入', 'XSS攻击', '命令注入', '路径遍历', '文件包含'])
    checks[0] = {
      ...checks[0],
      status: webAttacks.length === 0 ? 'pass' : webAttacks.length < 5 ? 'warning' : 'fail',
      details: webAttacks.length === 0
        ? 'WAF 有效拦截，未检测到 Web 攻击成功'
        : `检测到 ${webAttacks.length} 次 Web 攻击，WAF 需要加强规则`,
      relatedMatches: webAttacks.slice(0, 10),
    }

    // IDS-01: 入侵检测系统
    const scannerAttacks = this.findMatchesByCategory(result, ['恶意扫描', '暴力破解', '目录扫描'])
    checks[1] = {
      ...checks[1],
      status: scannerAttacks.length === 0 ? 'pass' : scannerAttacks.length < 10 ? 'warning' : 'fail',
      details: scannerAttacks.length === 0
        ? '未检测到入侵行为'
        : `检测到 ${scannerAttacks.length} 次入侵尝试，IDS 应触发告警`,
      relatedMatches: scannerAttacks.slice(0, 10),
    }

    // LOG-01: 日志审计
    checks[2] = {
      ...checks[2],
      status: result.totalLines > 0 ? 'pass' : 'fail',
      details: result.totalLines > 0
        ? `日志审计系统正常，已分析 ${result.totalLines} 行日志`
        : '未检测到日志记录，审计系统可能未启用',
      relatedMatches: [],
    }

    // AUTH-01: 身份鉴别
    const authAttacks = this.findMatchesByCategory(result, ['暴力破解'])
    checks[3] = {
      ...checks[3],
      status: authAttacks.length === 0 ? 'pass' : authAttacks.length < 5 ? 'warning' : 'fail',
      details: authAttacks.length === 0
        ? '未检测到身份鉴别攻击'
        : `检测到 ${authAttacks.length} 次暴力破解，需加强账户安全策略`,
      relatedMatches: authAttacks.slice(0, 10),
    }

    // NET-01: 网络安全
    const ddosAttacks = this.findMatchesByCategory(result, ['DDoS攻击'])
    const netAttacks = [...ddosAttacks, ...this.findMatchesByCategory(result, ['恶意扫描'])]
    checks[4] = {
      ...checks[4],
      status: netAttacks.length === 0 ? 'pass' : netAttacks.length < 20 ? 'warning' : 'fail',
      details: netAttacks.length === 0
        ? '网络边界安全状况良好'
        : `检测到 ${netAttacks.length} 次网络层攻击，需加强边界防护`,
      relatedMatches: netAttacks.slice(0, 10),
    }

    // VULN-01: 漏洞管理
    const vulnAttacks = this.findMatchesByCategory(result, ['SQL注入', '命令注入', '文件包含', '路径遍历'])
    checks[5] = {
      ...checks[5],
      status: vulnAttacks.length === 0 ? 'pass' : 'fail',
      details: vulnAttacks.length === 0
        ? '未发现漏洞利用迹象'
        : `发现 ${vulnAttacks.length} 次漏洞利用，需尽快修补`,
      relatedMatches: vulnAttacks.slice(0, 10),
    }

    // DATA-01: 数据安全
    const dataAttacks = this.findMatchesByCategory(result, ['SQL注入', '路径遍历', '文件包含'])
    checks[6] = {
      ...checks[6],
      status: dataAttacks.length === 0 ? 'pass' : 'fail',
      details: dataAttacks.length === 0
        ? '数据安全状况良好'
        : `检测到 ${dataAttacks.length} 次数据访问攻击，需加强数据保护`,
      relatedMatches: dataAttacks.slice(0, 10),
    }

    // BACK-01: 备份恢复 (无法从日志直接检测)
    checks[7] = { ...checks[7], status: 'na', details: '需要确认备份策略和恢复演练记录' }

    return checks
  }
}
