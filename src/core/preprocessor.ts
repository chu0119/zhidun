// 日志预处理引擎

export interface PreprocessConfig {
  enabled: boolean
  timeRange?: { start: string; end: string }
  ipWhitelist: string[]
  ipBlacklist: string[]
  includeRegex: string[]
  excludeRegex: string[]
  httpMethods: string[]        // 空 = 不过滤
  statusCodes: { min: number; max: number }
  minLineLength: number
  maxLineLength: number
}

export const DEFAULT_PREPROCESS_CONFIG: PreprocessConfig = {
  enabled: false,
  ipWhitelist: [],
  ipBlacklist: [],
  includeRegex: [],
  excludeRegex: [],
  httpMethods: [],
  statusCodes: { min: 100, max: 599 },
  minLineLength: 0,
  maxLineLength: 0,
}

// 从日志行中提取字段
function extractLineFields(line: string) {
  const ipMatch = line.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/)
  const methodMatch = line.match(/"(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/i)
  const statusMatch = line.match(/\s(\d{3})\s/)
  const timestampMatch = line.match(/\[(\d{2}\/\w{3}\/\d{4}:\d{2}:\d{2}:\d{2})/)
    || line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/)
    || line.match(/(\d{2}\/\w{3}\/\d{4})/)

  return {
    ip: ipMatch?.[1],
    method: methodMatch?.[1]?.toUpperCase(),
    status: statusMatch ? parseInt(statusMatch[1]) : undefined,
    timestamp: timestampMatch?.[1],
  }
}

// 检查 IP 是否匹配 CIDR
function ipMatchesCIDR(ip: string, pattern: string): boolean {
  if (pattern.includes('/')) {
    const [subnet, bits] = pattern.split('/')
    const mask = ~(2 ** (32 - parseInt(bits)) - 1)
    const ipNum = ip.split('.').reduce((sum, oct) => (sum << 8) + parseInt(oct), 0) >>> 0
    const subnetNum = subnet.split('.').reduce((sum, oct) => (sum << 8) + parseInt(oct), 0) >>> 0
    return (ipNum & mask) === (subnetNum & mask)
  }
  return ip === pattern
}

// 解析常见日志时间格式
function parseLogTime(ts: string): Date | null {
  // NCSA: 10/Oct/2023:13:55:36
  const ncsaMatch = ts.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})/)
  if (ncsaMatch) {
    const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 }
    return new Date(parseInt(ncsaMatch[3]), months[ncsaMatch[2]] || 0, parseInt(ncsaMatch[1]),
      parseInt(ncsaMatch[4]), parseInt(ncsaMatch[5]), parseInt(ncsaMatch[6]))
  }

  // ISO: 2023-10-13T13:55:36 or 2023-10-13 13:55:36
  const isoMatch = ts.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]),
      parseInt(isoMatch[4]), parseInt(isoMatch[5]), parseInt(isoMatch[6]))
  }

  return null
}

// 预处理日志行
export function preprocessLines(lines: string[], config: PreprocessConfig): {
  filtered: string[]
  stats: { total: number; passed: number; filtered: number; byRule: Record<string, number> }
} {
  if (!config.enabled) {
    return { filtered: lines, stats: { total: lines.length, passed: lines.length, filtered: 0, byRule: {} } }
  }

  // 编译正则
  const includeRegexps: RegExp[] = []
  for (const pattern of config.includeRegex) {
    try { includeRegexps.push(new RegExp(pattern, 'i')) } catch {}
  }
  const excludeRegexps: RegExp[] = []
  for (const pattern of config.excludeRegex) {
    try { excludeRegexps.push(new RegExp(pattern, 'i')) } catch {}
  }

  const timeStart = config.timeRange?.start ? parseLogTime(config.timeRange.start) : null
  const timeEnd = config.timeRange?.end ? parseLogTime(config.timeRange.end) : null

  const byRule: Record<string, number> = {}
  const filtered: string[] = []

  for (const line of lines) {
    const fields = extractLineFields(line)
    let excluded = false
    let reason = ''

    // IP 白名单
    if (config.ipWhitelist.length > 0 && fields.ip) {
      const matched = config.ipWhitelist.some(p => ipMatchesCIDR(fields.ip!, p))
      if (!matched) { excluded = true; reason = 'ip-whitelist' }
    }

    // IP 黑名单
    if (!excluded && config.ipBlacklist.length > 0 && fields.ip) {
      const matched = config.ipBlacklist.some(p => ipMatchesCIDR(fields.ip!, p))
      if (matched) { excluded = true; reason = 'ip-blacklist' }
    }

    // HTTP 方法
    if (!excluded && config.httpMethods.length > 0 && fields.method) {
      if (!config.httpMethods.includes(fields.method)) {
        excluded = true; reason = 'http-method'
      }
    }

    // 状态码范围
    if (!excluded && fields.status) {
      if (fields.status < config.statusCodes.min || fields.status > config.statusCodes.max) {
        excluded = true; reason = 'status-code'
      }
    }

    // 行长度
    if (!excluded && config.minLineLength > 0 && line.length < config.minLineLength) {
      excluded = true; reason = 'min-length'
    }
    if (!excluded && config.maxLineLength > 0 && line.length > config.maxLineLength) {
      excluded = true; reason = 'max-length'
    }

    // 时间范围
    if (!excluded && (timeStart || timeEnd) && fields.timestamp) {
      const lineTime = parseLogTime(fields.timestamp)
      if (lineTime) {
        if (timeStart && lineTime < timeStart) { excluded = true; reason = 'time-range' }
        if (timeEnd && lineTime > timeEnd) { excluded = true; reason = 'time-range' }
      }
    }

    // 排除正则
    if (!excluded && excludeRegexps.length > 0) {
      for (const re of excludeRegexps) {
        if (re.test(line)) { excluded = true; reason = 'exclude-regex'; break }
      }
    }

    // 包含正则（必须匹配至少一个）
    if (!excluded && includeRegexps.length > 0) {
      const matched = includeRegexps.some(re => re.test(line))
      if (!matched) { excluded = true; reason = 'include-regex' }
    }

    if (excluded) {
      byRule[reason] = (byRule[reason] || 0) + 1
    } else {
      filtered.push(line)
    }
  }

  return {
    filtered,
    stats: {
      total: lines.length,
      passed: filtered.length,
      filtered: lines.length - filtered.length,
      byRule,
    },
  }
}
