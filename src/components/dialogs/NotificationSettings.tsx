// 通知设置对话框

import React, { useState, useEffect } from 'react'
import {
  NotificationConfig,
  NotificationChannel,
  NotificationRule,
  getDefaultNotificationConfig,
} from '@/core/notification-engine'

interface NotificationSettingsProps {
  open: boolean
  onClose: () => void
  config: NotificationConfig
  onSave: (config: NotificationConfig) => void
}

const CHANNEL_TYPES = [
  { value: 'webhook', label: 'Webhook', icon: '🔗' },
  { value: 'slack', label: 'Slack', icon: '💬' },
  { value: 'dingtalk', label: '钉钉', icon: '📱' },
  { value: 'feishu', label: '飞书', icon: '🐦' },
  { value: 'wechat', label: '企业微信', icon: '💬' },
]

export function NotificationSettings({ open, onClose, config, onSave }: NotificationSettingsProps) {
  const [local, setLocal] = useState<NotificationConfig>(getDefaultNotificationConfig())

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
    const id = `ch-${Date.now()}`
    setLocal(prev => ({
      ...prev,
      channels: [...prev.channels, {
        id,
        type: 'webhook',
        name: '新渠道',
        url: '',
        enabled: true,
      }],
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
      <div className="glass-card w-[700px] max-h-[85vh] overflow-y-auto p-6"
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
                  <div key={channel.id} className="flex items-start gap-3 p-3 rounded bg-[var(--bg-primary)]">
                    <select value={channel.type}
                      onChange={e => updateChannel(channel.id, { type: e.target.value as any })}
                      className="neon-select text-xs py-1 w-28">
                      {CHANNEL_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                      ))}
                    </select>
                    <input type="text" value={channel.name}
                      onChange={e => updateChannel(channel.id, { name: e.target.value })}
                      placeholder="名称"
                      className="neon-input flex-1 text-xs" />
                    <input type="text" value={channel.url}
                      onChange={e => updateChannel(channel.id, { url: e.target.value })}
                      placeholder="Webhook URL"
                      className="neon-input flex-1 text-xs font-mono" />
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={channel.enabled}
                        onChange={e => updateChannel(channel.id, { enabled: e.target.checked })}
                        className="accent-[var(--accent-primary)]" />
                      启用
                    </label>
                    <button onClick={() => removeChannel(channel.id)}
                      className="text-xs px-2 text-red-400 hover:bg-red-500/10 rounded">删除</button>
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
                    {/* 渠道选择 */}
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
