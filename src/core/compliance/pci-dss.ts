// PCI-DSS 合规检查模板

import { ComplianceTemplate, ComplianceCheck } from './base-template'
import type { RuleAnalysisResult } from '@/core/rule-engine'

export class PCIDSSTemplate extends ComplianceTemplate {
  readonly framework = 'pci-dss'
  readonly frameworkName = 'PCI-DSS v4.0'
  readonly version = '4.0'

  getChecks(): ComplianceCheck[] {
    return [
      { id: 'PCI-6.5', title: 'Web 应用安全漏洞防护', description: '保护 Web 应用免受常见攻击', status: 'na', details: '', relatedMatches: [] },
      { id: 'PCI-11.4', title: '入侵检测/防御', description: '使用入侵检测/防御系统监控网络', status: 'na', details: '', relatedMatches: [] },
      { id: 'PCI-10.2', title: '审计日志记录', description: '记录所有对系统和数据的访问', status: 'na', details: '', relatedMatches: [] },
      { id: 'PCI-6.2', title: '安全补丁管理', description: '及时安装安全补丁', status: 'na', details: '', relatedMatches: [] },
      { id: 'PCI-8.3', title: '强身份验证', description: '对所有系统组件实施强身份验证', status: 'na', details: '', relatedMatches: [] },
    ]
  }

  protected evaluateChecks(result: RuleAnalysisResult): ComplianceCheck[] {
    const checks = this.getChecks()

    // PCI-6.5: Web 应用安全漏洞防护
    const webAttacks = this.findMatchesByCategory(result, ['SQL注入', 'XSS攻击', '命令注入', '路径遍历', '文件包含'])
    checks[0] = {
      ...checks[0],
      status: webAttacks.length === 0 ? 'pass' : webAttacks.length < 5 ? 'warning' : 'fail',
      details: webAttacks.length === 0
        ? '未检测到 Web 应用安全漏洞攻击'
        : `检测到 ${webAttacks.length} 次 Web 应用攻击，需加强 WAF 规则`,
      relatedMatches: webAttacks.slice(0, 10),
    }

    // PCI-11.4: 入侵检测/防御
    const scannerAttacks = this.findMatchesByCategory(result, ['恶意扫描', '暴力破解', '目录扫描'])
    checks[1] = {
      ...checks[1],
      status: scannerAttacks.length === 0 ? 'pass' : scannerAttacks.length < 10 ? 'warning' : 'fail',
      details: scannerAttacks.length === 0
        ? '未检测到入侵尝试'
        : `检测到 ${scannerAttacks.length} 次入侵尝试，建议部署 IDS/IPS`,
      relatedMatches: scannerAttacks.slice(0, 10),
    }

    // PCI-10.2: 审计日志记录
    const totalMatches = result.matches.length
    checks[2] = {
      ...checks[2],
      status: totalMatches > 0 ? 'pass' : 'warning',
      details: totalMatches > 0
        ? `日志系统正常运行，记录了 ${result.totalLines} 行日志`
        : '未检测到日志活动，确认日志系统是否正常运行',
      relatedMatches: [],
    }

    // PCI-6.2: 安全补丁管理
    const vulnAttacks = this.findMatchesByCategory(result, ['SQL注入', '命令注入', '文件包含', '路径遍历'])
    checks[3] = {
      ...checks[3],
      status: vulnAttacks.length === 0 ? 'pass' : 'fail',
      details: vulnAttacks.length === 0
        ? '未发现已知漏洞利用尝试'
        : `发现 ${vulnAttacks.length} 次漏洞利用尝试，需及时修补漏洞`,
      relatedMatches: vulnAttacks.slice(0, 10),
    }

    // PCI-8.3: 强身份验证
    const authAttacks = this.findMatchesByCategory(result, ['暴力破解'])
    checks[4] = {
      ...checks[4],
      status: authAttacks.length === 0 ? 'pass' : authAttacks.length < 5 ? 'warning' : 'fail',
      details: authAttacks.length === 0
        ? '未检测到暴力破解攻击'
        : `检测到 ${authAttacks.length} 次暴力破解尝试，建议实施账户锁定策略`,
      relatedMatches: authAttacks.slice(0, 10),
    }

    return checks
  }
}
