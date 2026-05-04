// 时间线构建工具

export type TimelineSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface SeverityTimelineSeries {
  labels: string[]
  critical: number[]
  high: number[]
  medium: number[]
  low: number[]
  hasTimestamps: boolean
  rangeLabel: string
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

export function parseLogTimestamp(line: string): number {
  // Apache / Nginx: 10/Oct/2024:13:55:36 +0000
  const apacheMatch = line.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?/) 
  if (apacheMatch) {
    const month = MONTHS[apacheMatch[2]]
    if (month !== undefined) {
      return new Date(
        parseInt(apacheMatch[3]),
        month,
        parseInt(apacheMatch[1]),
        parseInt(apacheMatch[4]),
        parseInt(apacheMatch[5]),
        parseInt(apacheMatch[6]),
      ).getTime()
    }
  }

  // ISO / 标准: 2024-10-10T13:55:36 或 2024-10-10 13:55:36
  const isoMatch = line.match(/(\d{4})[-/](\d{2})[-/](\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3]),
      parseInt(isoMatch[4]),
      parseInt(isoMatch[5]),
      parseInt(isoMatch[6]),
    ).getTime()
  }

  // Syslog: Oct 10 13:55:36
  const syslogMatch = line.match(/(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (syslogMatch) {
    const month = MONTHS[syslogMatch[1]]
    if (month !== undefined) {
      return new Date(
        new Date().getFullYear(),
        month,
        parseInt(syslogMatch[2]),
        parseInt(syslogMatch[3]),
        parseInt(syslogMatch[4]),
        parseInt(syslogMatch[5]),
      ).getTime()
    }
  }

  // 兼容少数日志中直接出现的 epoch 秒 / 毫秒
  const epochMatch = line.match(/\b(\d{10})(\d{3})?\b/)
  if (epochMatch) {
    const seconds = parseInt(epochMatch[1])
    const millis = epochMatch[2] ? parseInt(epochMatch[2]) : 0
    return epochMatch[2] ? (seconds * 1000 + millis) : seconds * 1000
  }

  return 0
}

function formatTimeLabel(ts: number, rangeMs: number): string {
  const d = new Date(ts)
  if (rangeMs <= 2 * 60 * 60 * 1000) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }
  if (rangeMs <= 24 * 60 * 60 * 1000) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  if (rangeMs <= 30 * 24 * 60 * 60 * 1000) {
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  if (rangeMs <= 365 * 24 * 60 * 60 * 1000) {
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function chooseBucketCount(totalPoints: number, rangeMs: number): number {
  if (totalPoints <= 12) return Math.max(1, totalPoints)
  if (rangeMs <= 2 * 60 * 60 * 1000) return Math.min(12, totalPoints)
  if (rangeMs <= 24 * 60 * 60 * 1000) return Math.min(24, totalPoints)
  if (rangeMs <= 7 * 24 * 60 * 60 * 1000) return Math.min(18, totalPoints)
  if (rangeMs <= 30 * 24 * 60 * 60 * 1000) return Math.min(16, totalPoints)
  return Math.min(12, totalPoints)
}

export function buildAdaptiveCountTimelineFromLines(lines: string[], maxSampleLines: number = 50000): { time: string; count: number }[] {
  const sampleLines = lines.length > maxSampleLines ? lines.slice(0, maxSampleLines) : lines
  const parsed = sampleLines
    .map(line => ({ line, ts: parseLogTimestamp(line) }))
    .filter(item => item.ts > 0)
    .sort((a, b) => a.ts - b.ts)

  if (parsed.length === 0) {
    const bucketCount = 24
    const bucketSize = Math.max(1, Math.ceil(sampleLines.length / bucketCount))
    const counts = new Array(bucketCount).fill(0)
    for (let i = 0; i < sampleLines.length; i++) {
      const bucket = Math.min(bucketCount - 1, Math.floor(i / bucketSize))
      counts[bucket]++
    }
    return counts.map((count, idx) => ({
      time: `${Math.round((idx / bucketCount) * 100)}%`,
      count,
    }))
  }

  const minTs = parsed[0].ts
  const maxTs = parsed[parsed.length - 1].ts
  const rangeMs = Math.max(1, maxTs - minTs)
  const bucketCount = chooseBucketCount(parsed.length, rangeMs)
  const bucketMs = Math.max(1, rangeMs / bucketCount)
  const counts = new Array(bucketCount).fill(0)

  for (const item of parsed) {
    const bucket = Math.min(bucketCount - 1, Math.floor((item.ts - minTs) / bucketMs))
    counts[bucket]++
  }

  return counts.map((count, idx) => ({
    time: formatTimeLabel(minTs + idx * bucketMs + bucketMs / 2, rangeMs),
    count,
  }))
}

export function buildAdaptiveSeverityTimeline(
  matches: { line: string; lineNumber: number; severity: TimelineSeverity | string }[],
  totalLines: number,
): SeverityTimelineSeries {
  const parsed = matches
    .map(match => ({ ...match, ts: parseLogTimestamp(match.line) }))
    .filter(match => match.ts > 0)
    .sort((a, b) => a.ts - b.ts)

  // 没有时间戳时按行号分桶，避免整张图全零
  if (parsed.length === 0) {
    const bucketCount = Math.min(30, Math.max(8, Math.ceil(totalLines / 1000)))
    const bucketSize = Math.max(1, Math.ceil(totalLines / bucketCount))
    const critical = new Array(bucketCount).fill(0)
    const high = new Array(bucketCount).fill(0)
    const medium = new Array(bucketCount).fill(0)
    const low = new Array(bucketCount).fill(0)

    for (const match of matches) {
      const bucket = Math.min(bucketCount - 1, Math.floor((match.lineNumber - 1) / bucketSize))
      if (match.severity === 'critical') critical[bucket]++
      else if (match.severity === 'high') high[bucket]++
      else if (match.severity === 'medium') medium[bucket]++
      else low[bucket]++
    }

    return {
      labels: critical.map((_, idx) => `段 ${idx + 1}`),
      critical,
      high,
      medium,
      low,
      hasTimestamps: false,
      rangeLabel: '按日志行分布',
    }
  }

  const minTs = parsed[0].ts
  const maxTs = parsed[parsed.length - 1].ts
  const rangeMs = Math.max(1, maxTs - minTs)
  const bucketCount = chooseBucketCount(parsed.length, rangeMs)
  const bucketMs = Math.max(1, rangeMs / bucketCount)
  const critical = new Array(bucketCount).fill(0)
  const high = new Array(bucketCount).fill(0)
  const medium = new Array(bucketCount).fill(0)
  const low = new Array(bucketCount).fill(0)

  for (const match of parsed) {
    const bucket = Math.min(bucketCount - 1, Math.floor((match.ts - minTs) / bucketMs))
    if (match.severity === 'critical') critical[bucket]++
    else if (match.severity === 'high') high[bucket]++
    else if (match.severity === 'medium') medium[bucket]++
    else low[bucket]++
  }

  return {
    labels: critical.map((_, idx) => formatTimeLabel(minTs + idx * bucketMs + bucketMs / 2, rangeMs)),
    critical,
    high,
    medium,
    low,
    hasTimestamps: true,
    rangeLabel: rangeMs > 24 * 60 * 60 * 1000
      ? `时间跨度 ${Math.ceil(rangeMs / (24 * 60 * 60 * 1000))} 天`
      : `时间跨度 ${Math.max(1, Math.ceil(rangeMs / (60 * 1000)))} 分钟`,
  }
}
