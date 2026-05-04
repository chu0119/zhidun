import { globalPerformanceTracker } from '@/core/performance-tracker'

export type DiagnosticArea = 'app' | 'analysis' | 'realtime' | 'config' | 'benchmark' | 'ui'

export interface DiagnosticEvent {
  timestamp: string
  area: DiagnosticArea
  action: string
  details?: Record<string, unknown>
}

export interface DiagnosticSnapshot {
  generatedAt: string
  userAgent: string
  appVersion?: string
  performance: ReturnType<typeof globalPerformanceTracker.getMetrics>
  events: DiagnosticEvent[]
  extra?: Record<string, unknown>
}

const MAX_EVENTS = 500
const events: DiagnosticEvent[] = []
let collectionEnabled = false

export function setDiagnosticCollectionEnabled(enabled: boolean): void {
  collectionEnabled = !!enabled
}

export function isDiagnosticCollectionEnabled(): boolean {
  return collectionEnabled
}

export function recordDiagnosticEvent(
  area: DiagnosticArea,
  action: string,
  details?: Record<string, unknown>
): void {
  if (!collectionEnabled) return

  events.push({
    timestamp: new Date().toISOString(),
    area,
    action,
    details,
  })

  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS)
  }
}

export function getDiagnosticEvents(limit = 100): DiagnosticEvent[] {
  return events.slice(-Math.max(1, limit))
}

export function clearDiagnosticEvents(): void {
  events.length = 0
}

export function buildDiagnosticSnapshot(extra?: Record<string, unknown>): DiagnosticSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    appVersion: undefined,
    performance: globalPerformanceTracker.getMetrics(),
    events: getDiagnosticEvents(500),
    extra,
  }
}

export function downloadDiagnosticSnapshot(filename = `zhidun-diagnostics-${Date.now()}.json`, extra?: Record<string, unknown>): void {
  const payload = JSON.stringify(buildDiagnosticSnapshot(extra), null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function redactSensitiveData(value: unknown, keyHint = ''): unknown {
  const key = keyHint.toLowerCase()
  const sensitiveKey = /(password|token|api[_-]?key|secret|authorization)/i.test(key)

  if (value == null) return value

  if (typeof value === 'string') {
    if (sensitiveKey) return '***redacted***'

    const maskedIp = value.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3})\.(\d{1,3})\b/g, '$1.xxx')
    return maskedIp.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '***@***')
  }

  if (Array.isArray(value)) {
    return value.map(item => redactSensitiveData(item, keyHint))
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = redactSensitiveData(v, k)
    }
    return out
  }

  return value
}

export async function uploadDiagnosticSnapshot(extra?: Record<string, unknown>): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!collectionEnabled) {
      return { success: false, error: '诊断采集未开启，无法上传。' }
    }

    const snapshot = buildDiagnosticSnapshot(extra)
    const safeSnapshot = redactSensitiveData(snapshot) as DiagnosticSnapshot
    const payload = JSON.stringify(safeSnapshot, null, 2)

    const res = await window.electronAPI.httpRequest('https://paste.rs', {
      method: 'POST',
      body: payload,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    })

    if (!res.success || !res.data) {
      return { success: false, error: res.error || '上传失败：未收到上传地址。' }
    }

    return { success: true, url: res.data.trim() }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}
