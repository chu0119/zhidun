// 设置对话框

import React, { useState } from 'react'
import { useConfigStore } from '@/stores/config-store'
import { useThemeStore, ThemeName } from '@/stores/theme-store'

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

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { config, updateConfig } = useConfigStore()
  const { currentTheme, setTheme } = useThemeStore()
  const [tab, setTab] = useState<'general' | 'analysis' | 'appearance'>('general')

  const BASE_SIZES: Record<string, number> = { menu: 13, analysis: 13, report: 14, charts: 12, panels: 13 }

  const handleFontChange = (key: keyof typeof config.fontSizes, value: number) => {
    const newFontSizes = { ...config.fontSizes, [key]: value }
    updateConfig({ fontSizes: newFontSizes })
    document.documentElement.style.setProperty(`--font-${key}`, `${value}px`)
    document.documentElement.style.setProperty(`--font-${key}-scale`, `${value / BASE_SIZES[key]}`)
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
          <button onClick={onClose} className="neon-btn">关闭</button>
        </div>
      </div>
    </div>
  )
}
