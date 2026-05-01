// 实时监控→通知引擎桥接（去重/限流/白名单）

import type { NotificationConfig, AlertPayload, RealtimeNotificationConfig, WhitelistConfig } from './notification-engine'
import { sendNotification } from './notification-engine'
import { isIPWhitelisted, isUserAgentWhitelisted } from '@/utils/cidr'

interface ThrottleEntry {
  lastNotified: number
  count: number
  windowStart: number
}

const throttleState = new Map<string, ThrottleEntry>()
const THROTTLE_MAX_ENTRIES = 5000
const THROTTLE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function cleanupThrottleState() {
  if (throttleState.size <= THROTTLE_MAX_ENTRIES) return
  const now = Date.now()
  for (const [key, entry] of throttleState) {
    if (now - entry.lastNotified > THROTTLE_TTL_MS) {
      throttleState.delete(key)
    }
  }
  // 如果仍然超限，删除最旧的一半
  if (throttleState.size > THROTTLE_MAX_ENTRIES) {
    const entries = [...throttleState.entries()].sort((a, b) => a[1].lastNotified - b[1].lastNotified)
    const toDelete = entries.slice(0, entries.length / 2)
    for (const [key] of toDelete) throttleState.delete(key)
  }
}

export function isWhitelisted(line: string, whitelist: WhitelistConfig): boolean {
  if (!whitelist.enabled) return false
  if (isIPWhitelisted(line, whitelist.ipAddresses)) return true
  if (isUserAgentWhitelisted(line, whitelist.userAgents)) return true
  return false
}

export function shouldNotifyRealtime(
  ruleId: string,
  category: string,
  severity: string,
  rtConfig: RealtimeNotificationConfig,
): boolean {
  cleanupThrottleState()
  const key = `${ruleId}-${category}-${severity}`
  const now = Date.now()
  let entry = throttleState.get(key)

  if (!entry) {
    entry = { lastNotified: 0, count: 0, windowStart: now }
    throttleState.set(key, entry)
  }

  if (now - entry.windowStart > rtConfig.windowMinutes * 60 * 1000) {
    entry.count = 0
    entry.windowStart = now
  }

  if (now - entry.lastNotified < rtConfig.throttleSeconds * 1000) return false
  if (entry.count >= rtConfig.maxAlertsPerWindow) return false

  entry.lastNotified = now
  entry.count++
  return true
}

export function resetThrottleState() {
  throttleState.clear()
}

export async function processRealtimeMatch(
  match: { ruleId: string; ruleName: string; category: string; severity: string; matchedText: string; line: string },
  notifConfig: NotificationConfig,
  rtConfig: RealtimeNotificationConfig,
  filePath?: string,
): Promise<{ notified: boolean; results: { channel: string; success: boolean }[] }> {
  if (!rtConfig.enabled || !notifConfig.enabled) {
    return { notified: false, results: [] }
  }

  if (isWhitelisted(match.line, rtConfig.whitelist)) {
    return { notified: false, results: [] }
  }

  if (!shouldNotifyRealtime(match.ruleId, match.category, match.severity, rtConfig)) {
    return { notified: false, results: [] }
  }

  const results: { channel: string; success: boolean }[] = []
  let desktopNotifiedViaRule = false

  const payload: AlertPayload = {
    title: `[实时] ${match.ruleName}`,
    severity: match.severity,
    category: match.category,
    count: 1,
    summary: `实时检测到 ${match.category} 攻击: ${match.matchedText}`,
    timestamp: new Date().toLocaleString('zh-CN'),
    source: filePath ? `实时监控: ${filePath}` : '实时监控',
  }

  for (const rule of notifConfig.rules) {
    if (!rule.enabled) continue
    if (!rule.severityFilter.includes(match.severity)) continue
    if (rule.categoryFilter.length > 0 && !rule.categoryFilter.includes(match.category)) continue

    const channels = notifConfig.channels.filter(c => c.enabled && rule.channelIds.includes(c.id))
    for (const channel of channels) {
      if (channel.type === 'desktop') desktopNotifiedViaRule = true
      const result = await sendNotification(channel, payload)
      results.push({ channel: channel.name, success: result.success })
    }
  }

  // 桌面通知 + 声音（critical/high）— 仅在规则路径未覆盖时触发
  if (!desktopNotifiedViaRule && (match.severity === 'critical' || match.severity === 'high')) {
    const desktopChannel = notifConfig.channels.find(c => c.type === 'desktop' && c.enabled)
    if (desktopChannel) {
      try {
        await window.electronAPI.showDesktopNotification({
          title: `[${match.severity.toUpperCase()}] ${match.ruleName}`,
          body: `${match.category}: ${(match.matchedText || '').substring(0, 100)}`,
          severity: match.severity,
        })
        if (desktopChannel.soundEnabled) {
          await window.electronAPI.playAlertSound(match.severity)
        }
        results.push({ channel: '桌面通知', success: true })
      } catch {
        results.push({ channel: '桌面通知', success: false })
      }
    }
  }

  return {
    notified: results.some(r => r.success),
    results,
  }
}
