// 告警通知引擎

export type NotificationChannelType =
  | 'webhook' | 'slack' | 'dingtalk' | 'feishu' | 'wechat'
  | 'telegram' | 'email' | 'bark' | 'serverchan' | 'pushplus'
  | 'gotify' | 'wecom_app' | 'desktop'

export interface NotificationConfig {
  enabled: boolean
  channels: NotificationChannel[]
  rules: NotificationRule[]
}

export interface NotificationChannel {
  id: string
  type: NotificationChannelType
  name: string
  url: string
  enabled: boolean
  // 扩展字段（特定渠道使用）
  token?: string         // Telegram bot token, Bark key, PushPlus token, Gotify app token
  chatId?: string        // Telegram chat_id
  emailTo?: string       // 邮件收件人
  emailFrom?: string     // 邮件发件人
  smtpUser?: string      // SMTP 用户名
  smtpPass?: string      // SMTP 密码
  smtpPort?: number      // SMTP 端口
  corpid?: string        // 企业微信 corpid
  corpsecret?: string    // 企业微信 corpsecret
  agentid?: number       // 企业微信 agentid
  soundEnabled?: boolean // 桌面通知声音
  secret?: string        // 钉钉加签密钥 / 飞书签名密钥
}

export interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  severityFilter: string[]
  categoryFilter: string[]
  minAlertCount: number
  cooldownMinutes: number
  channelIds: string[]
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

export interface WhitelistConfig {
  enabled: boolean
  ipAddresses: string[]
  userAgents: string[]
}

export interface RealtimeNotificationConfig {
  enabled: boolean
  throttleSeconds: number
  maxAlertsPerWindow: number
  windowMinutes: number
  whitelist: WhitelistConfig
}

export interface AlertHistoryEntry {
  id: string
  timestamp: string
  ruleId: string
  ruleName: string
  category: string
  severity: string
  sourceIP?: string
  matchedText: string
  filePath?: string
  state: 'new' | 'acknowledged' | 'resolved'
  acknowledgedAt?: string
  resolvedAt?: string
  notified: boolean
  channelResults?: { channel: string; success: boolean }[]
}

export const DEFAULT_REALTIME_NOTIFICATION_CONFIG: RealtimeNotificationConfig = {
  enabled: false,
  throttleSeconds: 300,
  maxAlertsPerWindow: 10,
  windowMinutes: 60,
  whitelist: {
    enabled: false,
    ipAddresses: [],
    userAgents: [],
  },
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
const LAST_ALERT_MAX_ENTRIES = 10000

function cleanupLastAlertTime() {
  const keys = Object.keys(lastAlertTime)
  if (keys.length > LAST_ALERT_MAX_ENTRIES) {
    // 保留最近的一半
    const entries = keys.map(k => ({ key: k, time: lastAlertTime[k] }))
    entries.sort((a, b) => b.time - a.time)
    const keep = entries.slice(0, LAST_ALERT_MAX_ENTRIES / 2)
    lastAlertTime = Object.fromEntries(keep.map(e => [e.key, e.time]))
  }
}

export function getDefaultNotificationConfig(): NotificationConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
}

export function shouldNotify(
  rule: NotificationRule,
  alertCount: number,
  category: string,
  severity: string,
): boolean {
  if (!rule.enabled) return false
  cleanupLastAlertTime()
  if (!rule.severityFilter.includes(severity)) return false
  if (category && rule.categoryFilter.length > 0 && !rule.categoryFilter.includes(category)) return false
  if (alertCount < rule.minAlertCount) return false

  const key = `${rule.id}-${category}-${severity}`
  const now = Date.now()
  const lastTime = lastAlertTime[key] || 0
  if (now - lastTime < rule.cooldownMinutes * 60 * 1000) return false

  lastAlertTime[key] = now
  return true
}

// ==================== 签名计算 ====================

async function computeHmacSign(secret: string, timestamp: number): Promise<string> {
  const stringToSign = `${timestamp}\n${secret}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

// ==================== 发送通知 ====================

export async function sendNotification(
  channel: NotificationChannel,
  payload: AlertPayload,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (channel.type === 'desktop') {
      return await sendDesktopNotification(channel, payload)
    }
    if (channel.type === 'email') {
      return await sendEmailNotification(channel, payload)
    }
    if (channel.type === 'bark') {
      return await sendBarkNotification(channel, payload)
    }
    if (channel.type === 'serverchan') {
      return await sendServerChanNotification(channel, payload)
    }
    if (channel.type === 'wecom_app') {
      return await sendWeComAppNotification(channel, payload)
    }

    const body = formatPayload(channel.type, payload, channel)
    let url = channel.url
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (channel.type === 'telegram') {
      url = `https://api.telegram.org/bot${channel.token}/sendMessage`
    }
    if (channel.type === 'gotify') {
      url = `${channel.url.replace(/\/$/, '')}/message`
      headers['X-Gotify-Key'] = channel.token || ''
    }
    if (channel.type === 'pushplus') {
      url = 'https://www.pushplus.plus/send'
    }

    // 钉钉加签
    if (channel.type === 'dingtalk' && channel.secret) {
      const timestamp = Date.now()
      const sign = await computeHmacSign(channel.secret, timestamp)
      const sep = url.includes('?') ? '&' : '?'
      url = `${url}${sep}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
    }

    // 飞书签名校验
    if (channel.type === 'feishu' && channel.secret) {
      const timestamp = Math.floor(Date.now() / 1000)
      const sign = await computeHmacSign(channel.secret, timestamp)
      body.timestamp = String(timestamp)
      body.sign = sign
    }

    const result = await window.electronAPI.httpRequest(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    })
    if (!result.success) return { success: false, error: result.error }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ==================== 特殊渠道发送函数 ====================

async function sendDesktopNotification(_channel: NotificationChannel, payload: AlertPayload) {
  try {
    await window.electronAPI.showDesktopNotification({
      title: payload.title,
      body: payload.summary,
      severity: payload.severity,
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function sendEmailNotification(channel: NotificationChannel, payload: AlertPayload) {
  return window.electronAPI.emailSend({
    host: channel.url,
    port: channel.smtpPort || 587,
    user: channel.smtpUser || '',
    pass: channel.smtpPass || '',
    from: channel.emailFrom || '',
    to: channel.emailTo || '',
    subject: `${payload.title} - 星川智盾告警`,
    html: `<h2>${escapeHtml(payload.title)}</h2><p>${escapeHtml(payload.summary)}</p><p>数量: ${payload.count} | 级别: ${payload.severity}</p><p>时间: ${payload.timestamp}</p>`,
  })
}

async function sendBarkNotification(channel: NotificationChannel, payload: AlertPayload) {
  const body = formatPayload('bark', payload)
  const baseUrl = channel.url || `https://api.day.app/${channel.token}`
  const result = await window.electronAPI.httpRequest(`${baseUrl}/push`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  return { success: result.success, error: result.error }
}

async function sendServerChanNotification(channel: NotificationChannel, payload: AlertPayload) {
  const body = formatPayload('serverchan', payload)
  const url = `https://sctapi.ftqq.com/${channel.token}.send`
  const result = await window.electronAPI.httpRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  return { success: result.success, error: result.error }
}

async function sendWeComAppNotification(channel: NotificationChannel, payload: AlertPayload) {
  const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${channel.corpid}&corpsecret=${channel.corpsecret}`
  const tokenResult = await window.electronAPI.httpRequest(tokenUrl)
  if (!tokenResult.success) return { success: false, error: tokenResult.error }
  const tokenData = JSON.parse(tokenResult.data || '{}')
  if (!tokenData.access_token) return { success: false, error: '获取企业微信 access_token 失败' }

  const body = formatPayload('wecom_app', payload)
  const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tokenData.access_token}`
  const result = await window.electronAPI.httpRequest(sendUrl, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  return { success: result.success, error: result.error }
}

// ==================== 格式化通知内容 ====================

function formatPayload(type: NotificationChannelType, payload: AlertPayload, channel?: NotificationChannel): any {
  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
    info: '🔵',
  }
  const emoji = severityEmoji[payload.severity] || '⚪'

  switch (type) {
    case 'slack':
      return {
        text: `${emoji} *${payload.title}*\n${payload.summary}\n数量: ${payload.count} | 时间: ${payload.timestamp}`,
      }

    case 'dingtalk':
      return {
        msgtype: 'markdown',
        markdown: {
          title: payload.title,
          text: `### ${emoji} ${payload.title}\n\n${payload.summary}\n\n- 告警数量: ${payload.count}\n- 严重级别: ${payload.severity}\n- 时间: ${payload.timestamp}`,
        },
      }

    case 'feishu':
      return {
        msg_type: 'interactive',
        card: {
          header: {
            title: { content: `${emoji} ${payload.title}`, tag: 'plain_text' },
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
          content: `## ${emoji} ${payload.title}\n${payload.summary}\n> 告警数量: ${payload.count}\n> 级别: ${payload.severity}\n> 时间: ${payload.timestamp}`,
        },
      }

    case 'telegram':
      return {
        chat_id: channel?.chatId,
        text: `${emoji} *${payload.title}*\n${payload.summary}\n数量: ${payload.count} | 时间: ${payload.timestamp}`,
        parse_mode: 'Markdown',
      }

    case 'bark':
      return {
        title: `${emoji} ${payload.title}`,
        body: `${payload.summary}\n数量: ${payload.count} | 级别: ${payload.severity}`,
        group: 'zhidun',
      }

    case 'serverchan':
      return {
        title: `${emoji} ${payload.title}`,
        desp: `## ${payload.title}\n\n${payload.summary}\n\n- 告警数量: ${payload.count}\n- 严重级别: ${payload.severity}\n- 时间: ${payload.timestamp}`,
      }

    case 'pushplus':
      return {
        token: channel?.token,
        title: `${emoji} ${payload.title}`,
        content: `<h3>${payload.title}</h3><p>${payload.summary}</p><p>告警数量: ${payload.count} | 级别: ${payload.severity}</p>`,
        template: 'html',
      }

    case 'gotify':
      return {
        title: `${emoji} ${payload.title}`,
        message: `${payload.summary}\n数量: ${payload.count} | 级别: ${payload.severity}`,
        priority: payload.severity === 'critical' ? 10 : payload.severity === 'high' ? 7 : 5,
      }

    case 'wecom_app':
      return {
        touser: '@all',
        msgtype: 'markdown',
        agentid: channel?.agentid,
        markdown: {
          content: `## ${emoji} ${payload.title}\n${payload.summary}\n> 告警数量: ${payload.count}\n> 级别: ${payload.severity}\n> 时间: ${payload.timestamp}`,
        },
      }

    case 'desktop':
    case 'email':
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

// ==================== 批量告警处理 ====================

export async function processAlerts(
  config: NotificationConfig,
  categoryStats: Record<string, number>,
  summary: { critical: number; high: number; medium: number; low: number; info: number },
  source?: string,
): Promise<{ sent: number; failed: number }> {
  if (!config.enabled) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const rule of config.rules) {
    if (!rule.enabled) continue

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

        const channels = config.channels.filter(c => c.enabled && rule.channelIds.includes(c.id))
        for (const channel of channels) {
          const result = await sendNotification(channel, payload)
          if (result.success) sent++
          else failed++
        }
      }
    }

    for (const [category, count] of Object.entries(categoryStats)) {
      if (count === 0) continue

      const severity = 'medium'

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
