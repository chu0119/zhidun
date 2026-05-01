// 通知设置对话框

import React, { useState, useEffect } from 'react'
import {
  NotificationConfig,
  NotificationChannel,
  NotificationChannelType,
  NotificationRule,
  getDefaultNotificationConfig,
  sendNotification,
} from '@/core/notification-engine'

interface NotificationSettingsProps {
  open: boolean
  onClose: () => void
  config: NotificationConfig
  onSave: (config: NotificationConfig) => void
}

const CHANNEL_TYPES: { value: NotificationChannelType; label: string; icon: string }[] = [
  { value: 'webhook', label: 'Webhook', icon: '🔗' },
  { value: 'slack', label: 'Slack', icon: '💬' },
  { value: 'dingtalk', label: '钉钉', icon: '📱' },
  { value: 'feishu', label: '飞书', icon: '🐦' },
  { value: 'wechat', label: '企业微信(机器人)', icon: '💬' },
  { value: 'wecom_app', label: '企业微信(应用)', icon: '🏢' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
  { value: 'email', label: '邮件(SMTP)', icon: '📧' },
  { value: 'bark', label: 'Bark', icon: '🔔' },
  { value: 'serverchan', label: 'Server酱', icon: '📮' },
  { value: 'pushplus', label: 'PushPlus', icon: '➕' },
  { value: 'gotify', label: 'Gotify', icon: '🚀' },
  { value: 'desktop', label: '桌面通知', icon: '🖥️' },
]

function createDefaultChannel(): NotificationChannel {
  return {
    id: `ch-${Date.now()}`,
    type: 'webhook',
    name: '新渠道',
    url: '',
    enabled: true,
    token: '',
    chatId: '',
    emailTo: '',
    emailFrom: '',
    smtpUser: '',
    smtpPass: '',
    smtpPort: 587,
    corpid: '',
    corpsecret: '',
    agentid: 0,
    soundEnabled: false,
    secret: '',
  }
}

// 渠道提示文本
const CHANNEL_HINTS: Record<string, string> = {
  webhook: '填入接收 POST 请求的 URL 地址',
  slack: '从 Slack App 的 Incoming Webhooks 获取 Webhook URL',
  dingtalk: 'Webhook 格式：https://oapi.dingtalk.com/robot/send?access_token=xxx，可选加签密钥',
  feishu: 'Webhook 格式：https://open.feishu.cn/open-apis/bot/v2/hook/xxx，可选签名校验密钥',
  wechat: 'Webhook 地址含 key 参数，从群设置→群机器人获取',
  wecom_app: '需填 CorpID、CorpSecret、AgentID，从企业微信管理后台获取',
  telegram: '从 @BotFather 获取 Bot Token，Chat ID 从群组或用户获取',
  email: '填入 SMTP 服务器地址、端口、用户名、密码',
  bark: '填入 Bark App 中的 Key，自建服务器可自定义地址',
  serverchan: '从 sct.ftqq.com 获取 SendKey',
  pushplus: '从 pushplus.plus 获取 Token',
  gotify: '填入 Gotify 服务器地址和应用 Token',
  desktop: '使用系统原生通知，可选播放声音',
}

// 渠道专属配置字段
function ChannelFields({ channel, update }: { channel: NotificationChannel; update: (id: string, u: Partial<NotificationChannel>) => void }) {
  const hint = CHANNEL_HINTS[channel.type]
  switch (channel.type) {
    case 'dingtalk':
      return (
        <>
          <div className="mt-2">
            <input type="password" value={channel.secret || ''} onChange={e => update(channel.id, { secret: e.target.value })}
              placeholder="加签密钥（可选，从机器人安全设置获取）" className="neon-input w-full text-xs font-mono" />
          </div>
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    case 'feishu':
      return (
        <>
          <div className="mt-2">
            <input type="password" value={channel.secret || ''} onChange={e => update(channel.id, { secret: e.target.value })}
              placeholder="签名密钥（可选，从机器人安全设置获取）" className="neon-input w-full text-xs font-mono" />
          </div>
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    case 'telegram':
      return (
        <>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input type="password" value={channel.token || ''} onChange={e => update(channel.id, { token: e.target.value })}
              placeholder="Bot Token" className="neon-input text-xs font-mono" />
            <input type="text" value={channel.chatId || ''} onChange={e => update(channel.id, { chatId: e.target.value })}
              placeholder="Chat ID" className="neon-input text-xs" />
          </div>
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    case 'email':
      return (
        <>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input type="text" value={channel.url || ''} onChange={e => update(channel.id, { url: e.target.value })}
              placeholder="SMTP 服务器" className="neon-input text-xs" />
            <input type="number" value={channel.smtpPort || 587} onChange={e => update(channel.id, { smtpPort: parseInt(e.target.value) || 587 })}
              placeholder="端口" className="neon-input text-xs" />
            <input type="text" value={channel.smtpUser || ''} onChange={e => update(channel.id, { smtpUser: e.target.value })}
              placeholder="用户名" className="neon-input text-xs" />
            <input type="password" value={channel.smtpPass || ''} onChange={e => update(channel.id, { smtpPass: e.target.value })}
              placeholder="密码" className="neon-input text-xs" />
            <input type="text" value={channel.emailFrom || ''} onChange={e => update(channel.id, { emailFrom: e.target.value })}
              placeholder="发件人" className="neon-input text-xs" />
            <input type="text" value={channel.emailTo || ''} onChange={e => update(channel.id, { emailTo: e.target.value })}
              placeholder="收件人" className="neon-input text-xs" />
          </div>
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    case 'bark':
      return (
        <>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input type="password" value={channel.token || ''} onChange={e => update(channel.id, { token: e.target.value })}
              placeholder="Bark Key" className="neon-input text-xs font-mono" />
            <input type="text" value={channel.url || ''} onChange={e => update(channel.id, { url: e.target.value })}
              placeholder="自建服务器地址（可选）" className="neon-input text-xs font-mono" />
          </div>
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    case 'serverchan':
      return (
        <>
          <input type="password" value={channel.token || ''} onChange={e => update(channel.id, { token: e.target.value })}
            placeholder="SendKey" className="neon-input w-full text-xs font-mono mt-2" />
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    case 'pushplus':
      return (
        <>
          <input type="password" value={channel.token || ''} onChange={e => update(channel.id, { token: e.target.value })}
            placeholder="Token" className="neon-input w-full text-xs font-mono mt-2" />
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    case 'gotify':
      return (
        <>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input type="text" value={channel.url || ''} onChange={e => update(channel.id, { url: e.target.value })}
              placeholder="Gotify 服务器地址" className="neon-input text-xs font-mono" />
            <input type="password" value={channel.token || ''} onChange={e => update(channel.id, { token: e.target.value })}
              placeholder="应用 Token" className="neon-input text-xs font-mono" />
          </div>
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    case 'wecom_app':
      return (
        <>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <input type="text" value={channel.corpid || ''} onChange={e => update(channel.id, { corpid: e.target.value })}
              placeholder="CorpID" className="neon-input text-xs" />
            <input type="password" value={channel.corpsecret || ''} onChange={e => update(channel.id, { corpsecret: e.target.value })}
              placeholder="CorpSecret" className="neon-input text-xs" />
            <input type="number" value={channel.agentid || ''} onChange={e => update(channel.id, { agentid: parseInt(e.target.value) || 0 })}
              placeholder="AgentID" className="neon-input text-xs" />
          </div>
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    case 'desktop':
      return (
        <>
          <div className="flex items-center gap-2 mt-2">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={channel.soundEnabled || false}
                onChange={e => update(channel.id, { soundEnabled: e.target.checked })}
                className="accent-[var(--accent-primary)]" />
              播放声音
            </label>
          </div>
          {hint && <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div>}
        </>
      )
    default:
      return hint ? <div className="mt-1.5 text-[10px] text-[var(--text-dim)] leading-relaxed">{hint}</div> : null
  }
}

// URL 字段是否需要隐藏（token-based 渠道不需要 URL）
function needsUrl(type: NotificationChannelType): boolean {
  return ['webhook', 'slack', 'dingtalk', 'feishu', 'wechat', 'email', 'gotify'].includes(type)
}

function urlPlaceholder(type: NotificationChannelType): string {
  switch (type) {
    case 'email': return 'SMTP 服务器地址'
    case 'gotify': return 'Gotify 服务器地址'
    case 'wechat': return 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx'
    case 'dingtalk': return 'https://oapi.dingtalk.com/robot/send?access_token=xxx'
    case 'feishu': return 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx'
    default: return 'Webhook URL'
  }
}

export function NotificationSettings({ open, onClose, config, onSave }: NotificationSettingsProps) {
  const [local, setLocal] = useState<NotificationConfig>(getDefaultNotificationConfig())
  const [testing, setTesting] = useState<string | null>(null)

  useEffect(() => {
    if (open) setLocal(JSON.parse(JSON.stringify(config)))
  }, [config, open])

  if (!open) return null

  const updateChannel = (id: string, updates: Partial<NotificationChannel>) => {
    setLocal(prev => ({
      ...prev,
      channels: prev.channels.map(c => c.id === id ? { ...c, ...updates } : c),
    }))
  }

  const addChannel = () => {
    setLocal(prev => ({
      ...prev,
      channels: [...prev.channels, createDefaultChannel()],
    }))
  }

  const removeChannel = (id: string) => {
    setLocal(prev => ({
      ...prev,
      channels: prev.channels.filter(c => c.id !== id),
      rules: prev.rules.map(r => ({
        ...r,
        channelIds: r.channelIds.filter(cid => cid !== id),
      })),
    }))
  }

  const handleTestChannel = async (channel: NotificationChannel) => {
    setTesting(channel.id)
    try {
      const testPayload = {
        title: '测试通知',
        severity: 'medium',
        category: '测试',
        count: 1,
        summary: '这是一条来自星川智盾的测试通知',
        timestamp: new Date().toLocaleString('zh-CN'),
        source: '测试',
      }
      const result = await sendNotification(channel, testPayload)
      if (result.success) {
        alert('测试通知发送成功！')
      } else {
        alert(`发送失败: ${result.error}`)
      }
    } catch (e: any) {
      alert(`发送失败: ${e.message}`)
    } finally {
      setTesting(null)
    }
  }

  const updateRule = (id: string, updates: Partial<NotificationRule>) => {
    setLocal(prev => ({
      ...prev,
      rules: prev.rules.map(r => r.id === id ? { ...r, ...updates } : r),
    }))
  }

  const addRule = () => {
    const id = `rule-${Date.now()}`
    setLocal(prev => ({
      ...prev,
      rules: [...prev.rules, {
        id,
        name: '新规则',
        enabled: true,
        severityFilter: ['critical'],
        categoryFilter: [],
        minAlertCount: 1,
        cooldownMinutes: 5,
        channelIds: [],
      }],
    }))
  }

  const removeRule = (id: string) => {
    setLocal(prev => ({
      ...prev,
      rules: prev.rules.filter(r => r.id !== id),
    }))
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="glass-card w-[800px] max-w-[90vw] max-h-[85vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-orbitron text-[var(--accent-primary)] tracking-wider">
            告警通知设置
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10">
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 启用开关 */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-primary)] mb-4">
          <div>
            <div className="text-sm text-[var(--text-primary)]">启用告警通知</div>
            <div className="text-xs text-[var(--text-dim)]">在检测到安全事件时发送通知</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={local.enabled}
              onChange={e => setLocal(p => ({ ...p, enabled: e.target.checked }))}
              className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer
              peer-checked:after:translate-x-full peer-checked:after:border-white after:content-['']
              after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full
              after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]" />
          </label>
        </div>

        <div className={`space-y-4 ${!local.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* 通知渠道 */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider">
                通知渠道
              </div>
              <button onClick={addChannel} className="text-xs text-[var(--accent-primary)] hover:underline">
                + 添加渠道
              </button>
            </div>
            {local.channels.length === 0 ? (
              <div className="text-xs text-[var(--text-dim)] py-4 text-center">
                暂无通知渠道，点击"添加渠道"开始配置
              </div>
            ) : (
              <div className="space-y-3">
                {local.channels.map(channel => (
                  <div key={channel.id} className="p-3 rounded bg-[var(--bg-primary)] space-y-2">
                    {/* 第一行：类型 + 名称 + 启用/测试/删除 */}
                    <div className="flex items-center gap-2">
                      <select value={channel.type}
                        onChange={e => updateChannel(channel.id, { type: e.target.value as NotificationChannelType })}
                        className="neon-select text-xs py-1 w-40 shrink-0">
                        {CHANNEL_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                        ))}
                      </select>
                      <input type="text" value={channel.name}
                        onChange={e => updateChannel(channel.id, { name: e.target.value })}
                        placeholder="名称"
                        className="neon-input flex-1 min-w-0 text-xs" />
                      <label className="flex items-center gap-1 text-xs cursor-pointer shrink-0">
                        <input type="checkbox" checked={channel.enabled}
                          onChange={e => updateChannel(channel.id, { enabled: e.target.checked })}
                          className="accent-[var(--accent-primary)]" />
                        启用
                      </label>
                      <button onClick={() => handleTestChannel(channel)}
                        disabled={testing === channel.id}
                        className="text-xs px-2 py-1 text-blue-400 hover:bg-blue-500/10 rounded shrink-0 disabled:opacity-50">
                        {testing === channel.id ? '...' : '测试'}
                      </button>
                      <button onClick={() => removeChannel(channel.id)}
                        className="text-xs px-2 py-1 text-red-400 hover:bg-red-500/10 rounded shrink-0">删除</button>
                    </div>
                    {/* 第二行：URL（如需要） */}
                    {needsUrl(channel.type) && (
                      <input type="text" value={channel.url}
                        onChange={e => updateChannel(channel.id, { url: e.target.value })}
                        placeholder={urlPlaceholder(channel.type)}
                        className="neon-input w-full text-xs font-mono" />
                    )}
                    {/* 渠道专属配置 */}
                    <ChannelFields channel={channel} update={updateChannel} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 通知规则 */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider">
                通知规则
              </div>
              <button onClick={addRule} className="text-xs text-[var(--accent-primary)] hover:underline">
                + 添加规则
              </button>
            </div>
            {local.rules.length === 0 ? (
              <div className="text-xs text-[var(--text-dim)] py-4 text-center">
                暂无通知规则
              </div>
            ) : (
              <div className="space-y-3">
                {local.rules.map(rule => (
                  <div key={rule.id} className="p-3 rounded bg-[var(--bg-primary)]">
                    <div className="flex items-center gap-3 mb-2">
                      <input type="text" value={rule.name}
                        onChange={e => updateRule(rule.id, { name: e.target.value })}
                        className="neon-input flex-1 text-xs" />
                      <label className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={rule.enabled}
                          onChange={e => updateRule(rule.id, { enabled: e.target.checked })}
                          className="accent-[var(--accent-primary)]" />
                        启用
                      </label>
                      <button onClick={() => removeRule(rule.id)}
                        className="text-xs px-2 text-red-400 hover:bg-red-500/10 rounded">删除</button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-[var(--text-dim)] block mb-1">严重级别</span>
                        <div className="flex flex-wrap gap-1">
                          {['critical', 'high', 'medium', 'low'].map(s => (
                            <label key={s} className={`px-2 py-0.5 rounded border cursor-pointer ${
                              rule.severityFilter.includes(s)
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                : 'border-[var(--border-color)] text-[var(--text-dim)]'
                            }`}>
                              <input type="checkbox" className="sr-only"
                                checked={rule.severityFilter.includes(s)}
                                onChange={e => {
                                  const filters = e.target.checked
                                    ? [...rule.severityFilter, s]
                                    : rule.severityFilter.filter(f => f !== s)
                                  updateRule(rule.id, { severityFilter: filters })
                                }} />
                              {s === 'critical' ? '严重' : s === 'high' ? '高危' : s === 'medium' ? '中危' : '低危'}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-[var(--text-dim)] block mb-1">最少告警数</span>
                        <input type="number" value={rule.minAlertCount}
                          onChange={e => updateRule(rule.id, { minAlertCount: parseInt(e.target.value) || 1 })}
                          className="neon-input w-full text-xs" min="1" />
                      </div>
                      <div>
                        <span className="text-[var(--text-dim)] block mb-1">冷却（分钟）</span>
                        <input type="number" value={rule.cooldownMinutes}
                          onChange={e => updateRule(rule.id, { cooldownMinutes: parseInt(e.target.value) || 5 })}
                          className="neon-input w-full text-xs" min="1" />
                      </div>
                    </div>
                    {local.channels.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs text-[var(--text-dim)] block mb-1">发送到渠道</span>
                        <div className="flex flex-wrap gap-1">
                          {local.channels.map(ch => (
                            <label key={ch.id} className={`px-2 py-0.5 rounded border cursor-pointer text-xs ${
                              rule.channelIds.includes(ch.id)
                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                : 'border-[var(--border-color)] text-[var(--text-dim)]'
                            }`}>
                              <input type="checkbox" className="sr-only"
                                checked={rule.channelIds.includes(ch.id)}
                                onChange={e => {
                                  const ids = e.target.checked
                                    ? [...rule.channelIds, ch.id]
                                    : rule.channelIds.filter(id => id !== ch.id)
                                  updateRule(rule.id, { channelIds: ids })
                                }} />
                              {ch.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="neon-btn text-xs">取消</button>
          <button onClick={() => { onSave(local); onClose() }} className="neon-btn primary text-xs">保存</button>
        </div>
      </div>
    </div>
  )
}
