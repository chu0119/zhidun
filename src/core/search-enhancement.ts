// 搜索引擎增强和交互式分析功能

import type { RuleMatch, RuleAnalysisResult, Rule } from './rule-engine'

// 搜索过滤条件
export interface SearchFilters {
  keyword?: string // 关键字搜索
  severity?: ('critical' | 'high' | 'medium' | 'low' | 'info')[] // 严重级别
  ruleIds?: string[] // 规则ID
  ipAddresses?: string[] // IP地址
  dateRange?: {
    start: number // 时间戳
    end: number // 时间戳
  }
  matchType?: 'all' | 'any' // 多条件匹配模式
  excludePatterns?: string[] // 排除模式（正则）
}

export interface SearchResult {
  totalMatches: number
  displayedMatches: number
  matches: RuleMatch[]
  facets: {
    bySeverity: Record<string, number>
    byRuleId: Record<string, number>
    byIP: Record<string, number>
    byTime: Record<string, number> // 按小时分组
  }
}

type ExtendedRuleMatch = RuleMatch & Partial<{
  ruleId: string
  severity: Rule['severity']
  ip: string
  timestamp: number
  logContent: string
  ruleType: string
}>

function getRuleId(match: RuleMatch): string {
  const extended = match as ExtendedRuleMatch
  return extended.ruleId || match.rule.id
}

function getSeverity(match: RuleMatch): Rule['severity'] {
  const extended = match as ExtendedRuleMatch
  return extended.severity || match.rule.severity
}

function getIP(match: RuleMatch): string {
  const extended = match as ExtendedRuleMatch
  return extended.ip || ''
}

function getTimestamp(match: RuleMatch): number {
  const extended = match as ExtendedRuleMatch
  return extended.timestamp || 0
}

function getLogContent(match: RuleMatch): string {
  const extended = match as ExtendedRuleMatch
  return extended.logContent || match.line || ''
}

function getRuleType(match: RuleMatch): string {
  const extended = match as ExtendedRuleMatch
  return extended.ruleType || match.rule.category
}

// 搜索引擎
export class SearchEngine {
  private indexedMatches: RuleMatch[] = []
  private reverseIndex: Map<string, Set<number>> = new Map() // 词 -> match索引集合

  // 索引分析结果
  indexAnalysis(result: RuleAnalysisResult | { matches: RuleMatch[] } | { rules: RuleMatch[] }): void {
    if ('matches' in result && Array.isArray(result.matches)) {
      this.indexedMatches = result.matches
    } else if ('rules' in result && Array.isArray(result.rules)) {
      this.indexedMatches = result.rules
    } else {
      this.indexedMatches = []
    }
    this.buildReverseIndex()
  }

  private buildReverseIndex(): void {
    this.reverseIndex.clear()

    for (let i = 0; i < this.indexedMatches.length; i++) {
      const match = this.indexedMatches[i]
      const keywords = this.extractKeywords(match)

      for (const keyword of keywords) {
        if (!this.reverseIndex.has(keyword)) {
          this.reverseIndex.set(keyword, new Set())
        }
        this.reverseIndex.get(keyword)!.add(i)
      }
    }
  }

  private extractKeywords(match: RuleMatch): string[] {
    const keywords: Set<string> = new Set()
    const ruleId = getRuleId(match)
    const severity = getSeverity(match)
    const ip = getIP(match)
    const ruleType = getRuleType(match)
    const logContent = getLogContent(match)

    // 规则ID
    if (ruleId) keywords.add(`rule:${ruleId}`)

    // 严重级别
    if (severity) keywords.add(`severity:${severity}`)

    // IP地址
    if (ip) keywords.add(`ip:${ip}`)

    // 规则类型/分类
    if (ruleType) keywords.add(`type:${ruleType}`)

    // 提取日志内容中的关键词
    if (logContent) {
      const tokens = logContent.toLowerCase().split(/\s+/)
      for (const token of tokens) {
        if (token.length > 3 && !this.isCommonWord(token)) {
          keywords.add(token)
        }
      }
    }

    return Array.from(keywords)
  }

  private isCommonWord(word: string): boolean {
    const common = ['the', 'and', 'or', 'for', 'to', 'in', 'of', 'a', 'is', 'that', 'it']
    return common.includes(word)
  }

  // 搜索
  search(filters: SearchFilters): SearchResult {
    let matchedIndices: Set<number> | null = null

    // 关键字搜索
    if (filters.keyword) {
      const keywordTokens = filters.keyword.toLowerCase().split(/\s+/)
      const tokenMatches: Set<number>[] = []

      for (const token of keywordTokens) {
        const matches = this.reverseIndex.get(token) || new Set()
        if (matches.size > 0) {
          tokenMatches.push(matches)
        }
      }

      if (tokenMatches.length > 0) {
        if (filters.matchType === 'all') {
          // 取交集
          matchedIndices = new Set(
            [...tokenMatches[0]].filter(idx => tokenMatches.every(set => set.has(idx)))
          )
        } else {
          // 取并集
          matchedIndices = new Set(tokenMatches.flatMap(set => [...set]))
        }
      } else {
        matchedIndices = new Set()
      }
    }

    // 初始化为所有索引
    if (!matchedIndices) {
      matchedIndices = new Set(this.indexedMatches.map((_, i) => i))
    }

    // 应用其他过滤条件
    let results = [...matchedIndices].map(i => this.indexedMatches[i])

    if (filters.severity && filters.severity.length > 0) {
      results = results.filter(m => filters.severity!.includes(getSeverity(m)))
    }

    if (filters.ruleIds && filters.ruleIds.length > 0) {
      results = results.filter(m => filters.ruleIds!.includes(getRuleId(m)))
    }

    if (filters.ipAddresses && filters.ipAddresses.length > 0) {
      results = results.filter(m => filters.ipAddresses!.includes(getIP(m)))
    }

    if (filters.dateRange) {
      results = results.filter(m => {
        const ts = getTimestamp(m) || 0
        return ts >= filters.dateRange!.start && ts <= filters.dateRange!.end
      })
    }

    if (filters.excludePatterns && filters.excludePatterns.length > 0) {
      const regexes = filters.excludePatterns.map(p => new RegExp(p, 'i'))
      results = results.filter(m =>
        !regexes.some(re => re.test(getLogContent(m) || ''))
      )
    }

    // 计算 facets
    const facets = this.computeFacets(results)

    return {
      totalMatches: this.indexedMatches.length,
      displayedMatches: results.length,
      matches: results,
      facets,
    }
  }

  private computeFacets(
    matches: RuleMatch[]
  ): SearchResult['facets'] {
    const facets: SearchResult['facets'] = {
      bySeverity: {},
      byRuleId: {},
      byIP: {},
      byTime: {},
    }

    for (const match of matches) {
      // 按严重级别
      const severity = getSeverity(match)
      facets.bySeverity[severity] = (facets.bySeverity[severity] || 0) + 1

      // 按规则ID
      const ruleId = getRuleId(match)
      facets.byRuleId[ruleId] = (facets.byRuleId[ruleId] || 0) + 1

      // 按IP
      const ip = getIP(match)
      if (ip) {
        facets.byIP[ip] = (facets.byIP[ip] || 0) + 1
      }

      // 按时间
      const timestamp = getTimestamp(match)
      if (timestamp) {
        const hour = new Date(timestamp).toISOString().slice(0, 13)
        facets.byTime[hour] = (facets.byTime[hour] || 0) + 1
      }
    }

    return facets
  }
}

// 交互式钻取分析
export interface DrillDownContext {
  initialMatch: RuleMatch
  relatedMatches: RuleMatch[]
  correlatedData: {
    sameIP: RuleMatch[]
    sameRule: RuleMatch[]
    timeSeries: RuleMatch[]
  }
}

export class InteractiveDrillDown {
  private allMatches: RuleMatch[] = []

  setMatches(matches: RuleMatch[]): void {
    this.allMatches = matches
  }

  // 从一条规则钻取到相关数据
  drillDown(match: RuleMatch): DrillDownContext {
    const relatedMatches: RuleMatch[] = []
    const sameIP: RuleMatch[] = []
    const sameRule: RuleMatch[] = []
    const timeSeries: RuleMatch[] = []

    for (const other of this.allMatches) {
      if (other === match) continue
      const matchRuleId = getRuleId(match)
      const otherRuleId = getRuleId(other)
      const matchIP = getIP(match)
      const otherIP = getIP(other)
      const matchTimestamp = getTimestamp(match)
      const otherTimestamp = getTimestamp(other)

      // 同一IP的所有匹配
      if (matchIP && otherIP === matchIP) {
        sameIP.push(other)
        relatedMatches.push(other)
      }

      // 同一规则的所有匹配
      if (otherRuleId === matchRuleId) {
        sameRule.push(other)
        relatedMatches.push(other)
      }

      // 时间序列：前后1小时内的匹配
      if (matchTimestamp && otherTimestamp) {
        const timeDiff = Math.abs(otherTimestamp - matchTimestamp)
        if (timeDiff < 60 * 60 * 1000) {
          timeSeries.push(other)
          relatedMatches.push(other)
        }
      }
    }

    // 去重
    const deduped = Array.from(new Set(relatedMatches))

    return {
      initialMatch: match,
      relatedMatches: deduped,
      correlatedData: {
        sameIP,
        sameRule,
        timeSeries,
      },
    }
  }

  // 生成关联分析报告
  generateDrillDownReport(context: DrillDownContext): string {
    const lines = [
      '═══ 交互式钻取分析 ═══',
      '',
      `初始规则匹配: ${getRuleId(context.initialMatch)}`,
      `触发行: ${context.initialMatch.lineNumber}`,
      '',
      '【相关数据统计】',
      `- 同IP的匹配: ${context.correlatedData.sameIP.length} 条`,
      `- 同规则的匹配: ${context.correlatedData.sameRule.length} 条`,
      `- 时间序列相关: ${context.correlatedData.timeSeries.length} 条`,
      `- 总关联数据: ${context.relatedMatches.length} 条`,
    ]

    if (context.correlatedData.sameIP.length > 0) {
      lines.push('')
      lines.push('【同IP攻击分析】')
      const ipAttacks = context.correlatedData.sameIP.slice(0, 5)
      for (const attack of ipAttacks) {
        lines.push(`- ${getRuleId(attack)}: 行${attack.lineNumber} (${getSeverity(attack)})`)
      }
      if (context.correlatedData.sameIP.length > 5) {
        lines.push(`... 还有 ${context.correlatedData.sameIP.length - 5} 条`)
      }
    }

    if (context.correlatedData.timeSeries.length > 0) {
      lines.push('')
      lines.push('【时间序列分析】')
      const sortedByTime = context.correlatedData.timeSeries.sort(
        (a, b) => (getTimestamp(a) || 0) - (getTimestamp(b) || 0)
      )
      const timeWindows = sortedByTime.slice(0, 5)
      for (const event of timeWindows) {
        const time = new Date(getTimestamp(event) || 0).toLocaleTimeString()
        lines.push(`- [${time}] ${getRuleId(event)}`)
      }
      if (sortedByTime.length > 5) {
        lines.push(`... 还有 ${sortedByTime.length - 5} 条`)
      }
    }

    return lines.join('\n')
  }

  private getRuleId(match: RuleMatch): string {
    const extended = match as RuleMatch & Partial<{ ruleId: string }>
    return extended.ruleId || match.rule.id
  }

  private getSeverity(match: RuleMatch): Rule['severity'] {
    const extended = match as RuleMatch & Partial<{ severity: Rule['severity'] }>
    return extended.severity || match.rule.severity
  }

  private getIP(match: RuleMatch): string {
    const extended = match as RuleMatch & Partial<{ ip: string }>
    return extended.ip || ''
  }

  private getTimestamp(match: RuleMatch): number {
    const extended = match as RuleMatch & Partial<{ timestamp: number }>
    return extended.timestamp || 0
  }

  private getLogContent(match: RuleMatch): string {
    const extended = match as RuleMatch & Partial<{ logContent: string }>
    return extended.logContent || match.line || ''
  }

  private getRuleType(match: RuleMatch): string {
    const extended = match as RuleMatch & Partial<{ ruleType: string }>
    return extended.ruleType || match.rule.category
  }
}

// 全局搜索引擎实例
export const globalSearchEngine = new SearchEngine()
