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

export function recordDiagnosticEvent(
  area: DiagnosticArea,
  action: string,
  details?: Record<string, unknown>
): void {
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
