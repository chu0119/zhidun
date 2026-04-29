// 告警通知引擎

export interface NotificationConfig {
  enabled: boolean
  channels: NotificationChannel[]
  rules: NotificationRule[]
}

export interface NotificationChannel {
  id: string
  type: 'webhook' | 'slack' | 'dingtalk' | 'feishu' | 'wechat'
  name: string
  url: string
  enabled: boolean
}

export interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  severityFilter: string[]      // ['critical', 'high', 'medium', 'low']
  categoryFilter: string[]      // 攻击类别，空 = 全部
  minAlertCount: number         // 最少告警数才触发
  cooldownMinutes: number       // 冷却时间（分钟）
  channelIds: string[]          // 发送到哪些渠道
}

export interface AlertPayload {
  title: string
  severity: string
  category: string
  count: number
  summary: string
  timestamp: string
  source?: string
}

const DEFAULT_CONFIG: NotificationConfig = {
  enabled: false,
  channels: [],
  rules: [
    {
      id: 'default-critical',
      name: '严重告警',
      enabled: true,
      severityFilter: ['critical'],
      categoryFilter: [],
      minAlertCount: 1,
      cooldownMinutes: 5,
      channelIds: [],
    },
    {
      id: 'default-high',
      name: '高危告警',
      enabled: true,
      severityFilter: ['high'],
      categoryFilter: [],
      minAlertCount: 3,
      cooldownMinutes: 10,
      channelIds: [],
    },
  ],
}

let lastAlertTime: Record<string, number> = {}

export function getDefaultNotificationConfig(): NotificationConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
}

// 评估是否应该发送通知
export function shouldNotify(
  rule: NotificationRule,
  alertCount: number,
  category: string,
  severity: string,
): boolean {
  if (!rule.enabled) return false
  if (!rule.severityFilter.includes(severity)) return false
  if (rule.categoryFilter.length > 0 && !rule.categoryFilter.includes(category)) return false
  if (alertCount < rule.minAlertCount) return false

  // 冷却时间检查
  const key = `${rule.id}-${category}-${severity}`
  const now = Date.now()
  const lastTime = lastAlertTime[key] || 0
  if (now - lastTime < rule.cooldownMinutes * 60 * 1000) return false

  lastAlertTime[key] = now
  return true
}

// 发送通知到指定渠道
export async function sendNotification(
  channel: NotificationChannel,
  payload: AlertPayload,
): Promise<{ success: boolean; error?: string }> {
  try {
    const body = formatPayload(channel.type, payload)
    const result = await window.electronAPI.httpRequest(channel.url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    if (!result.success) {
      return { success: false, error: result.error }
    }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 格式化通知内容
function formatPayload(type: NotificationChannel['type'], payload: AlertPayload): any {
  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  }

  switch (type) {
    case 'slack':
      return {
        text: `${severityEmoji[payload.severity] || '⚪'} *${payload.title}*\n${payload.summary}\n数量: ${payload.count} | 时间: ${payload.timestamp}`,
      }

    case 'dingtalk':
      return {
        msgtype: 'markdown',
        markdown: {
          title: payload.title,
          text: `### ${severityEmoji[payload.severity] || ''} ${payload.title}\n\n${payload.summary}\n\n- 告警数量: ${payload.count}\n- 严重级别: ${payload.severity}\n- 时间: ${payload.timestamp}`,
        },
      }

    case 'feishu':
      return {
        msg_type: 'interactive',
        card: {
          header: {
            title: { content: `${severityEmoji[payload.severity] || ''} ${payload.title}`, tag: 'plain_text' },
            template: payload.severity === 'critical' ? 'red' : payload.severity === 'high' ? 'orange' : 'blue',
          },
          elements: [
            { tag: 'div', text: { content: payload.summary, tag: 'plain_text' } },
            { tag: 'div', text: { content: `告警数量: ${payload.count} | 级别: ${payload.severity}`, tag: 'plain_text' } },
          ],
        },
      }

    case 'wechat':
      return {
        msgtype: 'markdown',
        markdown: {
          content: `## ${severityEmoji[payload.severity] || ''} ${payload.title}\n${payload.summary}\n> 告警数量: ${payload.count}\n> 级别: ${payload.severity}\n> 时间: ${payload.timestamp}`,
        },
      }

    case 'webhook':
    default:
      return {
        title: payload.title,
        severity: payload.severity,
        category: payload.category,
        count: payload.count,
        summary: payload.summary,
        timestamp: payload.timestamp,
        source: payload.source || '星川智盾',
      }
  }
}

// 处理分析结果并触发通知
export async function processAlerts(
  config: NotificationConfig,
  categoryStats: Record<string, number>,
  summary: { critical: number; high: number; medium: number; low: number },
  source?: string,
): Promise<{ sent: number; failed: number }> {
  if (!config.enabled) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const rule of config.rules) {
    if (!rule.enabled) continue

    // 检查各级别
    for (const [severity, count] of Object.entries(summary)) {
      if (count === 0) continue

      if (shouldNotify(rule, count, '', severity)) {
        const payload: AlertPayload = {
          title: `${rule.name} - ${severity.toUpperCase()}`,
          severity,
          category: '综合',
          count,
          summary: `检测到 ${count} 个${severity}级别安全告警`,
          timestamp: new Date().toLocaleString('zh-CN'),
          source,
        }

        // 发送到配置的渠道
        const channels = config.channels.filter(c => c.enabled && rule.channelIds.includes(c.id))
        for (const channel of channels) {
          const result = await sendNotification(channel, payload)
          if (result.success) sent++
          else failed++
        }
      }
    }

    // 检查各类别
    for (const [category, count] of Object.entries(categoryStats)) {
      if (count === 0) continue

      // 找到最严重的级别
      const severity = summary.critical > 0 ? 'critical' : summary.high > 0 ? 'high' : 'medium'

      if (shouldNotify(rule, count, category, severity)) {
        const payload: AlertPayload = {
          title: `${category}攻击告警`,
          severity,
          category,
          count,
          summary: `检测到 ${count} 次 ${category} 攻击`,
          timestamp: new Date().toLocaleString('zh-CN'),
          source,
        }

        const channels = config.channels.filter(c => c.enabled && rule.channelIds.includes(c.id))
        for (const channel of channels) {
          const result = await sendNotification(channel, payload)
          if (result.success) sent++
          else failed++
        }
      }
    }
  }

  return { sent, failed }
}
