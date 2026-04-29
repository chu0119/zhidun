// 日志预处理配置对话框

import React, { useState } from 'react'
import { PreprocessConfig, DEFAULT_PREPROCESS_CONFIG } from '@/core/preprocessor'

interface PreprocessDialogProps {
  open: boolean
  onClose: () => void
  config: PreprocessConfig
  onSave: (config: PreprocessConfig) => void
}

export function PreprocessDialog({ open, onClose, config, onSave }: PreprocessDialogProps) {
  const [local, setLocal] = useState<PreprocessConfig>({ ...config })

  if (!open) return null

  const update = (updates: Partial<PreprocessConfig>) => {
    setLocal(prev => ({ ...prev, ...updates }))
  }

  const handleSave = () => {
    onSave(local)
    onClose()
  }

  const handleReset = () => {
    setLocal({ ...DEFAULT_PREPROCESS_CONFIG })
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="glass-card w-[600px] max-h-[85vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}>
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-orbitron text-[var(--accent-primary)] tracking-wider">
            日志预处理配置
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 启用开关 */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-primary)] mb-4">
          <div>
            <div className="text-sm text-[var(--text-primary)]">启用预处理过滤</div>
            <div className="text-xs text-[var(--text-dim)]">在分析前过滤日志行，减少噪音数据</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={local.enabled}
              onChange={e => update({ enabled: e.target.checked })}
              className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer
              peer-checked:after:translate-x-full peer-checked:after:border-white after:content-['']
              after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full
              after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]" />
          </label>
        </div>

        <div className={`space-y-4 ${!local.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* HTTP 方法 */}
          <div className="glass-card p-4">
            <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
              HTTP 方法过滤
            </div>
            <div className="flex flex-wrap gap-2">
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map(method => (
                <label key={method}
                  className={`px-3 py-1.5 rounded border cursor-pointer text-xs transition-colors ${
                    local.httpMethods.includes(method)
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                      : 'border-[var(--border-color)] text-[var(--text-dim)] hover:border-[var(--accent-primary)]/50'
                  }`}>
                  <input type="checkbox" className="sr-only"
                    checked={local.httpMethods.includes(method)}
                    onChange={e => {
                      const methods = e.target.checked
                        ? [...local.httpMethods, method]
                        : local.httpMethods.filter(m => m !== method)
                      update({ httpMethods: methods })
                    }} />
                  {method}
                </label>
              ))}
            </div>
            <div className="text-xs text-[var(--text-dim)] mt-2">不选则不过滤</div>
          </div>

          {/* 状态码范围 */}
          <div className="glass-card p-4">
            <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
              状态码范围
            </div>
            <div className="flex items-center gap-3">
              <input type="number" value={local.statusCodes.min}
                onChange={e => update({ statusCodes: { ...local.statusCodes, min: parseInt(e.target.value) || 100 } })}
                className="neon-input w-24 text-sm" min="100" max="599" />
              <span className="text-[var(--text-dim)]">至</span>
              <input type="number" value={local.statusCodes.max}
                onChange={e => update({ statusCodes: { ...local.statusCodes, max: parseInt(e.target.value) || 599 } })}
                className="neon-input w-24 text-sm" min="100" max="599" />
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => update({ statusCodes: { min: 200, max: 299 } })}
                className="text-xs px-2 py-1 rounded border border-[var(--border-color)] hover:border-[var(--accent-primary)]">
                仅 2xx
              </button>
              <button onClick={() => update({ statusCodes: { min: 400, max: 499 } })}
                className="text-xs px-2 py-1 rounded border border-[var(--border-color)] hover:border-[var(--accent-primary)]">
                仅 4xx
              </button>
              <button onClick={() => update({ statusCodes: { min: 500, max: 599 } })}
                className="text-xs px-2 py-1 rounded border border-[var(--border-color)] hover:border-[var(--accent-primary)]">
                仅 5xx
              </button>
              <button onClick={() => update({ statusCodes: { min: 100, max: 599 } })}
                className="text-xs px-2 py-1 rounded border border-[var(--border-color)] hover:border-[var(--accent-primary)]">
                全部
              </button>
            </div>
          </div>

          {/* IP 过滤 */}
          <div className="glass-card p-4">
            <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
              IP 过滤
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-[var(--text-secondary)] mb-1 block">白名单（每行一个，支持 CIDR）</span>
                <textarea value={local.ipWhitelist.join('\n')}
                  onChange={e => update({ ipWhitelist: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                  placeholder="192.168.1.0/24&#10;10.0.0.1"
                  className="neon-input w-full text-xs h-20 resize-none" />
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)] mb-1 block">黑名单（每行一个，支持 CIDR）</span>
                <textarea value={local.ipBlacklist.join('\n')}
                  onChange={e => update({ ipBlacklist: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                  placeholder="1.2.3.4&#10;5.6.7.0/24"
                  className="neon-input w-full text-xs h-20 resize-none" />
              </div>
            </div>
          </div>

          {/* 正则过滤 */}
          <div className="glass-card p-4">
            <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
              正则表达式过滤
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-[var(--text-secondary)] mb-1 block">包含匹配（必须匹配至少一个）</span>
                {local.includeRegex.map((re, i) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <input type="text" value={re}
                      onChange={e => {
                        const arr = [...local.includeRegex]
                        arr[i] = e.target.value
                        update({ includeRegex: arr })
                      }}
                      className="neon-input flex-1 text-xs" placeholder="正则表达式" />
                    <button onClick={() => update({ includeRegex: local.includeRegex.filter((_, j) => j !== i) })}
                      className="text-xs px-2 text-red-400 hover:bg-red-500/10 rounded">删除</button>
                  </div>
                ))}
                <button onClick={() => update({ includeRegex: [...local.includeRegex, ''] })}
                  className="text-xs text-[var(--accent-primary)] hover:underline">+ 添加</button>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)] mb-1 block">排除匹配（匹配到的行将被过滤）</span>
                {local.excludeRegex.map((re, i) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <input type="text" value={re}
                      onChange={e => {
                        const arr = [...local.excludeRegex]
                        arr[i] = e.target.value
                        update({ excludeRegex: arr })
                      }}
                      className="neon-input flex-1 text-xs" placeholder="正则表达式" />
                    <button onClick={() => update({ excludeRegex: local.excludeRegex.filter((_, j) => j !== i) })}
                      className="text-xs px-2 text-red-400 hover:bg-red-500/10 rounded">删除</button>
                  </div>
                ))}
                <button onClick={() => update({ excludeRegex: [...local.excludeRegex, ''] })}
                  className="text-xs text-[var(--accent-primary)] hover:underline">+ 添加</button>
              </div>
            </div>
          </div>

          {/* 行长度限制 */}
          <div className="glass-card p-4">
            <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
              行长度限制
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-secondary)]">最小</span>
              <input type="number" value={local.minLineLength}
                onChange={e => update({ minLineLength: parseInt(e.target.value) || 0 })}
                className="neon-input w-24 text-sm" min="0" />
              <span className="text-xs text-[var(--text-secondary)]">最大</span>
              <input type="number" value={local.maxLineLength}
                onChange={e => update({ maxLineLength: parseInt(e.target.value) || 0 })}
                className="neon-input w-24 text-sm" min="0" />
              <span className="text-xs text-[var(--text-dim)]">（0 = 不限制）</span>
            </div>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-between mt-6">
          <button onClick={handleReset} className="neon-btn text-xs">
            重置默认
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="neon-btn text-xs">取消</button>
            <button onClick={handleSave} className="neon-btn primary text-xs">保存</button>
          </div>
        </div>
      </div>
    </div>
  )
}
