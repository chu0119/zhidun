// 设置对话框

import React, { useState } from 'react'
import { useConfigStore } from '@/stores/config-store'
import { useThemeStore, ThemeName } from '@/stores/theme-store'
import { downloadDiagnosticSnapshot, isDiagnosticCollectionEnabled, uploadDiagnosticSnapshot } from '@/core/diagnostics'
import type { RuleEngineConfig } from '@/types/config'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

const THEMES: { name: ThemeName; label: string; color: string }[] = [
  { name: 'cyber', label: 'Cyber 青', color: '#00f0ff' },
  { name: 'purple', label: '能量紫', color: '#b400ff' },
  { name: 'green', label: '矩阵绿', color: '#00ff88' },
  { name: 'red', label: '警报红', color: '#ff0040' },
  { name: 'ocean', label: '深海蓝', color: '#0088ff' },
  { name: 'dark', label: '经典暗', color: '#e0e6f0' },
  { name: 'light', label: '经典亮', color: '#0066cc' },
]

const RULE_PRESETS: Array<{
  id: 'high-sensitivity' | 'low-false-positive' | 'critical-only'
  label: string
  description: string
  config: Partial<RuleEngineConfig>
}> = [
  {
    id: 'high-sensitivity',
    label: '高敏感模式',
    description: '尽量捕获更多可疑行为，适合排查期',
    config: {
      severityThreshold: 'info',
      attackChainWindow: 40,
      categoryWhitelist: [],
      categoryBlacklist: [],
      enabledRuleIds: [],
      disabledRuleIds: [],
      useAnalysisCache: true,
    },
  },
  {
    id: 'low-false-positive',
    label: '低误报模式',
    description: '优先保障准确性，过滤低价值告警',
    config: {
      severityThreshold: 'medium',
      attackChainWindow: 20,
      categoryWhitelist: [],
      categoryBlacklist: ['信息泄露', '爬虫Bot'],
      enabledRuleIds: [],
      disabledRuleIds: [],
      useAnalysisCache: true,
    },
  },
  {
    id: 'critical-only',
    label: '仅高危模式',
    description: '只关注高危与危急事件，适合应急值守',
    config: {
      severityThreshold: 'high',
      attackChainWindow: 15,
      categoryWhitelist: [],
      categoryBlacklist: [],
      enabledRuleIds: [],
      disabledRuleIds: [],
      useAnalysisCache: true,
    },
  },
]

function normalizeStringArray(input?: string[]): string[] {
  return [...new Set((input || []).map(s => s.trim()).filter(Boolean))].sort()
}

function isSameStringArray(a?: string[], b?: string[]): boolean {
  const left = normalizeStringArray(a)
  const right = normalizeStringArray(b)
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

function isSameRuleConfig(current: Partial<RuleEngineConfig>, preset: Partial<RuleEngineConfig>): boolean {
  const sameSeverity = (current.severityThreshold || 'info') === (preset.severityThreshold || 'info')
  const sameWindow = (current.attackChainWindow || 25) === (preset.attackChainWindow || 25)
  const sameCache = (current.useAnalysisCache ?? true) === (preset.useAnalysisCache ?? true)
  const sameCategoryWhitelist = isSameStringArray(current.categoryWhitelist, preset.categoryWhitelist)
  const sameCategoryBlacklist = isSameStringArray(current.categoryBlacklist, preset.categoryBlacklist)
  const sameEnabledRules = isSameStringArray(current.enabledRuleIds, preset.enabledRuleIds)
  const sameDisabledRules = isSameStringArray(current.disabledRuleIds, preset.disabledRuleIds)

  return sameSeverity
    && sameWindow
    && sameCache
    && sameCategoryWhitelist
    && sameCategoryBlacklist
    && sameEnabledRules
    && sameDisabledRules
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { config, updateConfig } = useConfigStore()
  const { currentTheme, setTheme } = useThemeStore()
  const [tab, setTab] = useState<'general' | 'analysis' | 'appearance'>('general')
  const [uploadingDiagnostics, setUploadingDiagnostics] = useState(false)
  const [uploadedDiagnosticsUrl, setUploadedDiagnosticsUrl] = useState('')
  const [diagnosticsUploadError, setDiagnosticsUploadError] = useState('')

  const ruleEngineConfig = config.ruleEngineConfig || {
    enabledRuleIds: [],
    disabledRuleIds: [],
    categoryWhitelist: [],
    categoryBlacklist: [],
    severityThreshold: 'info' as const,
    attackChainWindow: 25,
    useAnalysisCache: true,
  }

  const BASE_SIZES: Record<string, number> = { menu: 13, analysis: 13, report: 14, charts: 12, panels: 13 }

  const handleFontChange = (key: keyof typeof config.fontSizes, value: number) => {
    const newFontSizes = { ...config.fontSizes, [key]: value }
    updateConfig({ fontSizes: newFontSizes })
    document.documentElement.style.setProperty(`--font-${key}`, `${value}px`)
    document.documentElement.style.setProperty(`--font-${key}-scale`, `${value / BASE_SIZES[key]}`)
  }

  const handleExportDiagnostics = () => {
    if (!config.diagnosticsEnabled) return

    downloadDiagnosticSnapshot('zhidun-diagnostics.json', {
      config: {
        ...config,
        currentModel: {
          ...config.currentModel,
          apiKey: config.currentModel.apiKey ? '***masked***' : '',
        },
      },
      theme: currentTheme,
      generatedBy: 'SettingsDialog',
    })
  }

  const handleUploadDiagnostics = async () => {
    if (!config.diagnosticsEnabled || uploadingDiagnostics) return

    setUploadingDiagnostics(true)
    setDiagnosticsUploadError('')
    setUploadedDiagnosticsUrl('')
    try {
      const result = await uploadDiagnosticSnapshot({
        config: {
          ...config,
          currentModel: {
            ...config.currentModel,
            apiKey: config.currentModel.apiKey ? '***masked***' : '',
          },
        },
        theme: currentTheme,
        generatedBy: 'SettingsDialog.upload',
      })

      if (!result.success || !result.url) {
        setDiagnosticsUploadError(result.error || '上传失败')
        return
      }

      setUploadedDiagnosticsUrl(result.url)
    } catch (err: any) {
      setDiagnosticsUploadError(err?.message || String(err))
    } finally {
      setUploadingDiagnostics(false)
    }
  }

  const updateRuleEngineConfig = (partial: Partial<typeof ruleEngineConfig>) => {
    updateConfig({
      ruleEngineConfig: {
        ...ruleEngineConfig,
        ...partial,
      },
    })
  }

  const parseMultiline = (value: string) => value
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)

  const activePreset = RULE_PRESETS.find(p => isSameRuleConfig(ruleEngineConfig, p.config))

  const applyRulePreset = (preset: (typeof RULE_PRESETS)[number]) => {
    updateRuleEngineConfig(preset.config)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}>
      <div className="glass-card w-[90vw] max-w-[600px] max-h-[80vh] overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h2 className="font-orbitron text-lg font-bold text-[var(--accent-primary)] tracking-wider">设置</h2>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-[var(--border-color)]">
          {(['general', 'analysis', 'appearance'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`tab-item ${tab === t ? 'active' : ''}`}>
              {t === 'general' ? '通用' : t === 'analysis' ? '分析' : '外观'}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {tab === 'general' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">默认分析行数</label>
                <input type="number" value={config.defaultLines}
                  onChange={(e) => updateConfig({ defaultLines: parseInt(e.target.value) || 1000 })}
                  className="neon-input w-full" min="100" max="10000" step="100" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="autoSave" checked={config.autoSave}
                  onChange={(e) => updateConfig({ autoSave: e.target.checked })}
                  className="accent-[var(--accent-primary)]" />
                <label htmlFor="autoSave" className="text-sm text-[var(--text-secondary)]">自动保存配置</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="showWelcome" checked={config.showWelcome}
                  onChange={(e) => updateConfig({ showWelcome: e.target.checked })}
                  className="accent-[var(--accent-primary)]" />
                <label htmlFor="showWelcome" className="text-sm text-[var(--text-secondary)]">显示启动动画</label>
              </div>

              <div className="pt-2 border-t border-[var(--border-color)]/60 space-y-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="diagnosticsEnabled"
                    checked={!!config.diagnosticsEnabled}
                    onChange={(e) => updateConfig({ diagnosticsEnabled: e.target.checked })}
                    className="accent-[var(--accent-primary)]"
                  />
                  <label htmlFor="diagnosticsEnabled" className="text-sm text-[var(--text-secondary)]">
                    允许采集诊断事件（用于问题排查）
                  </label>
                </div>
                <div className="text-xs text-[var(--text-dim)]">
                  仅在你开启后采集。可随时关闭；关闭后不再记录新事件。
                </div>
                {config.diagnosticsEnabled && !isDiagnosticCollectionEnabled() && (
                  <div className="text-xs text-[var(--accent-primary)]">
                    诊断采集将在当前页面状态同步后生效。
                  </div>
                )}
                {config.diagnosticsEnabled && (
                  <div className="text-xs text-[var(--text-dim)]">
                    上传会先做脱敏（隐藏密钥、邮箱，IP 末段掩码），用于你主动反馈问题。
                  </div>
                )}
                {!!uploadedDiagnosticsUrl && (
                  <div className="text-xs text-[var(--accent-green)] break-all">
                    上传成功：{uploadedDiagnosticsUrl}
                  </div>
                )}
                {!!diagnosticsUploadError && (
                  <div className="text-xs text-red-400 break-all">
                    上传失败：{diagnosticsUploadError}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'analysis' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">最大 Tokens</label>
                <input type="number" value={config.currentModel.maxTokens}
                  onChange={(e) => useConfigStore.getState().updateModel({ maxTokens: parseInt(e.target.value) || 4096 })}
                  className="neon-input w-full" min="256" max="32768" step="256" />
              </div>
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">温度 (Temperature)</label>
                <input type="range" min="0" max="1" step="0.1" value={config.currentModel.temperature}
                  onChange={(e) => useConfigStore.getState().updateModel({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-[var(--accent-primary)]" />
                <div className="text-xs text-[var(--text-dim)] text-right mt-1">{config.currentModel.temperature}</div>
              </div>

              <div className="pt-2 border-t border-[var(--border-color)]/60">
                <label className="text-sm text-[var(--text-secondary)] mb-2 block">规则预设模板</label>
                <div className="mb-2">
                  <span className="text-xs px-2 py-1 rounded border border-[var(--border-color)] text-[var(--text-secondary)]">
                    当前策略：{activePreset ? activePreset.label : '自定义'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {RULE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyRulePreset(preset)}
                      className="text-left p-2 rounded border border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-colors"
                    >
                      <div className="text-sm text-[var(--text-primary)]">{preset.label}</div>
                      <div className="text-xs text-[var(--text-dim)] mt-0.5">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border-color)]/60">
                <label className="text-sm text-[var(--text-secondary)] mb-2 block">规则引擎最低风险阈值</label>
                <select
                  value={ruleEngineConfig.severityThreshold}
                  onChange={(e) => updateRuleEngineConfig({ severityThreshold: e.target.value as any })}
                  className="neon-input w-full"
                >
                  <option value="info">信息及以上</option>
                  <option value="low">低危及以上</option>
                  <option value="medium">中危及以上</option>
                  <option value="high">高危及以上</option>
                  <option value="critical">仅危急</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-1 block">攻击链窗口（行数）</label>
                <input
                  type="number"
                  value={ruleEngineConfig.attackChainWindow}
                  onChange={(e) => updateRuleEngineConfig({ attackChainWindow: Math.max(5, parseInt(e.target.value) || 25) })}
                  className="neon-input w-full"
                  min="5"
                  max="500"
                  step="1"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useAnalysisCache"
                  checked={!!ruleEngineConfig.useAnalysisCache}
                  onChange={(e) => updateRuleEngineConfig({ useAnalysisCache: e.target.checked })}
                  className="accent-[var(--accent-primary)]"
                />
                <label htmlFor="useAnalysisCache" className="text-sm text-[var(--text-secondary)]">启用分析结果缓存</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">分类白名单（每行一个）</label>
                  <textarea
                    value={ruleEngineConfig.categoryWhitelist.join('\n')}
                    onChange={(e) => updateRuleEngineConfig({ categoryWhitelist: parseMultiline(e.target.value) })}
                    className="neon-input w-full h-24 resize-none"
                    placeholder="SQL注入&#10;XSS攻击"
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">分类黑名单（每行一个）</label>
                  <textarea
                    value={ruleEngineConfig.categoryBlacklist.join('\n')}
                    onChange={(e) => updateRuleEngineConfig({ categoryBlacklist: parseMultiline(e.target.value) })}
                    className="neon-input w-full h-24 resize-none"
                    placeholder="信息泄露"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">规则 ID 白名单（每行一个）</label>
                  <textarea
                    value={ruleEngineConfig.enabledRuleIds.join('\n')}
                    onChange={(e) => updateRuleEngineConfig({ enabledRuleIds: parseMultiline(e.target.value) })}
                    className="neon-input w-full h-24 resize-none"
                    placeholder="SQL-001&#10;XSS-002"
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--text-secondary)] mb-1 block">规则 ID 黑名单（每行一个）</label>
                  <textarea
                    value={ruleEngineConfig.disabledRuleIds.join('\n')}
                    onChange={(e) => updateRuleEngineConfig({ disabledRuleIds: parseMultiline(e.target.value) })}
                    className="neon-input w-full h-24 resize-none"
                    placeholder="SCAN-004"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="text-sm text-[var(--text-secondary)] mb-3 block">主题颜色</label>
                <div className="grid grid-cols-4 gap-3">
                  {THEMES.map(theme => (
                    <button key={theme.name} onClick={() => setTheme(theme.name)}
                      className={`p-3 rounded-lg border-2 transition-all text-center text-xs
                        ${currentTheme === theme.name
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                          : 'border-[var(--border-color)] hover:border-[var(--border-glow)]'}`}>
                      <div className="w-6 h-6 rounded-full mx-auto mb-1.5"
                        style={{ background: theme.color, boxShadow: `0 0 10px ${theme.color}` }} />
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm text-[var(--text-secondary)] block">字体大小设置</label>
                {([
                  { key: 'menu' as const, label: '菜单/侧边栏' },
                  { key: 'analysis' as const, label: '分析日志 (本地/AI)' },
                  { key: 'report' as const, label: '分析报告 (本地/AI)' },
                  { key: 'panels' as const, label: '数据面板 (威胁/攻击/会话/路径/地理)' },
                  { key: 'charts' as const, label: '可视化图表' },
                ]).map(item => (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-dim)] w-24 shrink-0">{item.label}</span>
                    <input type="range" min="10" max="40" step="1"
                      value={config.fontSizes[item.key]}
                      onChange={(e) => handleFontChange(item.key, parseInt(e.target.value))}
                      className="flex-1 accent-[var(--accent-primary)]" />
                    <span className="text-xs font-mono text-[var(--accent-primary)] w-10 text-right">
                      {config.fontSizes[item.key]}px
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 p-4 border-t border-[var(--border-color)]">
          <button
            onClick={handleExportDiagnostics}
            disabled={!config.diagnosticsEnabled}
            className="neon-btn disabled:opacity-40 disabled:cursor-not-allowed"
            title={config.diagnosticsEnabled ? '导出诊断' : '请先在通用设置中启用诊断采集'}
          >
            导出诊断
          </button>
          <button
            onClick={handleUploadDiagnostics}
            disabled={!config.diagnosticsEnabled || uploadingDiagnostics}
            className="neon-btn disabled:opacity-40 disabled:cursor-not-allowed"
            title={config.diagnosticsEnabled ? '上传脱敏诊断' : '请先在通用设置中启用诊断采集'}
          >
            {uploadingDiagnostics ? '上传中...' : '上传诊断'}
          </button>
          <button onClick={onClose} className="neon-btn">关闭</button>
        </div>
      </div>
    </div>
  )
}
