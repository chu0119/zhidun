// 搜索引擎 - 正则、字段、时间范围过滤

export interface SearchQuery {
  text: string
  isRegex: boolean
  caseSensitive: boolean
  fields: FieldFilter[]
  timeRange?: { start: string; end: string }
  ipWhitelist: string[]
  ipBlacklist: string[]
}

export interface FieldFilter {
  field: 'ip' | 'url' | 'status' | 'method' | 'ua' | 'attack'
  value: string
  operator: 'contains' | 'equals' | 'regex' | 'startsWith' | 'notContains'
}

export interface SearchResult {
  lineNumber: number
  line: string
  highlights: { start: number; end: number }[]
}

// 从日志行中提取字段
function extractFields(line: string): Record<string, string> {
  const fields: Record<string, string> = {}

  // IP
  const ipMatch = line.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
  if (ipMatch) fields.ip = ipMatch[1]

  // URL/路径
  const urlMatch = line.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)/i)
    || line.match(/"(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(\S+)/i)
  if (urlMatch) fields.url = urlMatch[urlMatch.length - 1]

  // HTTP 方法
  const methodMatch = line.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/i)
  if (methodMatch) fields.method = methodMatch[1].toUpperCase()

  // 状态码
  const statusMatch = line.match(/\s(\d{3})\s/)
  if (statusMatch) fields.status = statusMatch[1]

  // User-Agent
  const uaMatch = line.match(/User-Agent:\s*([^"]+?)(?:\s*"|\s*$)/i)
    || line.match(/"([^"]*(?:Mozilla|Chrome|Firefox|Safari|bot|spider)[^"]*)"/i)
  if (uaMatch) fields.ua = uaMatch[1].trim()

  return fields
}

// 检查 IP 是否匹配 CIDR 或精确匹配
function ipMatches(ip: string, pattern: string): boolean {
  if (pattern.includes('/')) {
    // CIDR 匹配
    const [subnet, bits] = pattern.split('/')
    const mask = ~(2 ** (32 - parseInt(bits)) - 1)
    const ipNum = ip.split('.').reduce((sum, oct) => (sum << 8) + parseInt(oct), 0) >>> 0
    const subnetNum = subnet.split('.').reduce((sum, oct) => (sum << 8) + parseInt(oct), 0) >>> 0
    return (ipNum & mask) === (subnetNum & mask)
  }
  return ip === pattern
}

// 执行搜索
export function searchLines(lines: string[], query: SearchQuery): SearchResult[] {
  const results: SearchResult[] = []

  // 编译正则
  let textRegex: RegExp | null = null
  if (query.text) {
    try {
      textRegex = query.isRegex
        ? new RegExp(query.text, query.caseSensitive ? 'g' : 'gi')
        : new RegExp(escapeRegex(query.text), query.caseSensitive ? 'g' : 'gi')
    } catch {
      // 无效正则，降级为字面量匹配
      textRegex = new RegExp(escapeRegex(query.text), query.caseSensitive ? 'g' : 'gi')
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 文本匹配
    if (textRegex) {
      const matches = [...line.matchAll(textRegex)]
      if (matches.length === 0) continue

      const highlights = matches.map(m => ({
        start: m.index!,
        end: m.index! + m[0].length,
      }))

      // 检查其他过滤条件
      if (!passesFilters(line, query)) continue

      results.push({ lineNumber: i + 1, line, highlights })
    } else if (query.fields.length > 0 || query.ipWhitelist.length > 0 || query.ipBlacklist.length > 0 || query.timeRange) {
      // 无文本搜索，仅靠字段过滤
      if (!passesFilters(line, query)) continue
      results.push({ lineNumber: i + 1, line, highlights: [] })
    }
  }

  return results
}

function passesFilters(line: string, query: SearchQuery): boolean {
  const fields = extractFields(line)

  // 字段过滤
  for (const filter of query.fields) {
    const fieldValue = fields[filter.field]
    if (!fieldValue) {
      if (filter.operator === 'notContains') continue
      return false
    }

    switch (filter.operator) {
      case 'contains':
        if (!fieldValue.toLowerCase().includes(filter.value.toLowerCase())) return false
        break
      case 'equals':
        if (fieldValue.toLowerCase() !== filter.value.toLowerCase()) return false
        break
      case 'notContains':
        if (fieldValue.toLowerCase().includes(filter.value.toLowerCase())) return false
        break
      case 'startsWith':
        if (!fieldValue.toLowerCase().startsWith(filter.value.toLowerCase())) return false
        break
      case 'regex':
        try {
          if (!new RegExp(filter.value, 'i').test(fieldValue)) return false
        } catch { return false }
        break
    }
  }

  // IP 黑名单
  if (query.ipBlacklist.length > 0 && fields.ip) {
    for (const pattern of query.ipBlacklist) {
      if (ipMatches(fields.ip, pattern)) return false
    }
  }

  // IP 白名单
  if (query.ipWhitelist.length > 0 && fields.ip) {
    let matched = false
    for (const pattern of query.ipWhitelist) {
      if (ipMatches(fields.ip, pattern)) { matched = true; break }
    }
    if (!matched) return false
  }

  return true
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 预置搜索条件
export interface SavedSearch {
  id: string
  name: string
  query: SearchQuery
}

export const PRESET_SEARCHES: SavedSearch[] = [
  {
    id: 'all-attacks',
    name: '所有攻击',
    query: {
      text: '',
      isRegex: false,
      caseSensitive: false,
      fields: [{ field: 'attack', value: '', operator: 'contains' }],
      ipWhitelist: [],
      ipBlacklist: [],
    },
  },
  {
    id: 'sql-injection',
    name: 'SQL 注入',
    query: {
      text: "(union|select|insert|update|delete|drop|'|--|;)",
      isRegex: true,
      caseSensitive: false,
      fields: [],
      ipWhitelist: [],
      ipBlacklist: [],
    },
  },
  {
    id: 'xss-attacks',
    name: 'XSS 攻击',
    query: {
      text: "(<script|javascript:|onerror=|onload=|alert\\()",
      isRegex: true,
      caseSensitive: false,
      fields: [],
      ipWhitelist: [],
      ipBlacklist: [],
    },
  },
  {
    id: '404-errors',
    name: '404 错误',
    query: {
      text: '',
      isRegex: false,
      caseSensitive: false,
      fields: [{ field: 'status', value: '404', operator: 'equals' }],
      ipWhitelist: [],
      ipBlacklist: [],
    },
  },
  {
    id: '5xx-errors',
    name: '5xx 服务器错误',
    query: {
      text: '\\s5\\d{2}\\s',
      isRegex: true,
      caseSensitive: false,
      fields: [],
      ipWhitelist: [],
      ipBlacklist: [],
    },
  },
  {
    id: 'post-requests',
    name: 'POST 请求',
    query: {
      text: '',
      isRegex: false,
      caseSensitive: false,
      fields: [{ field: 'method', value: 'POST', operator: 'equals' }],
      ipWhitelist: [],
      ipBlacklist: [],
    },
  },
]
