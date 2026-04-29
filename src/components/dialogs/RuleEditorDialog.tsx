// 规则编辑器对话框

import React, { useState, useEffect } from 'react'
import { CustomRule } from '@/stores/rules-store'

interface RuleEditorDialogProps {
  open: boolean
  onClose: () => void
  onSave: (rule: Omit<CustomRule, 'id' | 'createdAt' | 'updatedAt'>) => void
  editingRule?: CustomRule | null
}

const SEVERITY_OPTIONS = [
  { value: 'critical', label: '严重', color: '#ff4444' },
  { value: 'high', label: '高危', color: '#ff8800' },
  { value: 'medium', label: '中危', color: '#ffcc00' },
  { value: 'low', label: '低危', color: '#00cc88' },
]

const CATEGORY_OPTIONS = [
  'SQL注入', 'XSS攻击', '命令注入', '路径遍历', '暴力破解',
  'DDoS攻击', '恶意扫描', '目录扫描', '文件包含', '恶意文件上传',
  '信息泄露', '自定义',
]

export function RuleEditorDialog({ open, onClose, onSave, editingRule }: RuleEditorDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('自定义')
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low'>('medium')
  const [description, setDescription] = useState('')
  const [patterns, setPatterns] = useState<string[]>([''])
  const [enabled, setEnabled] = useState(true)
  const [testInput, setTestInput] = useState('')
  const [testResults, setTestResults] = useState<{ pattern: string; matched: boolean; error?: string }[]>([])

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name)
      setCategory(editingRule.category)
      setSeverity(editingRule.severity)
      setDescription(editingRule.description)
      setPatterns(editingRule.patterns)
      setEnabled(editingRule.enabled)
    } else {
      setName('')
      setCategory('自定义')
      setSeverity('medium')
      setDescription('')
      setPatterns([''])
      setEnabled(true)
    }
    setTestInput('')
    setTestResults([])
  }, [editingRule, open])

  if (!open) return null

  const handleSave = () => {
    if (!name.trim() || patterns.every(p => !p.trim())) return
    onSave({
      name: name.trim(),
      category,
      severity,
      description: description.trim(),
      patterns: patterns.filter(p => p.trim()),
      enabled,
    })
    onClose()
  }

  const handleTest = () => {
    const results = patterns.map(pattern => {
      if (!pattern.trim()) return { pattern, matched: false }
      try {
        const regex = new RegExp(pattern, 'i')
        return { pattern, matched: regex.test(testInput) }
      } catch (e: any) {
        return { pattern, matched: false, error: e.message }
      }
    })
    setTestResults(results)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="glass-card w-[600px] max-h-[85vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-orbitron text-[var(--accent-primary)] tracking-wider">
            {editingRule ? '编辑规则' : '新建规则'}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" stroke="var(--text-secondary)" strokeWidth="2" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* 名称 */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">规则名称 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="如: 自定义 SQL 注入检测"
              className="neon-input w-full text-sm" />
          </div>

          {/* 分类和严重级别 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">攻击分类</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="neon-select w-full text-sm">
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1 block">严重级别</label>
              <select value={severity} onChange={e => setSeverity(e.target.value as any)}
                className="neon-select w-full text-sm">
                {SEVERITY_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 描述 */}
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-1 block">描述</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="规则的用途和检测逻辑说明..."
              className="neon-input w-full text-sm h-16 resize-none" />
          </div>

          {/* 正则模式 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[var(--text-secondary)]">匹配模式（正则表达式）*</label>
              <button onClick={() => setPatterns([...patterns, ''])}
                className="text-xs text-[var(--accent-primary)] hover:underline">+ 添加模式</button>
            </div>
            {patterns.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="text" value={p}
                  onChange={e => {
                    const arr = [...patterns]
                    arr[i] = e.target.value
                    setPatterns(arr)
                  }}
                  placeholder="如: union.*select|or.*1=1"
                  className="neon-input flex-1 text-xs font-mono" />
                <button onClick={() => setPatterns(patterns.filter((_, j) => j !== i))}
                  disabled={patterns.length <= 1}
                  className="text-xs px-2 text-red-400 hover:bg-red-500/10 rounded disabled:opacity-30">
                  删除
                </button>
              </div>
            ))}
          </div>

          {/* 启用开关 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-primary)]">
            <span className="text-sm text-[var(--text-secondary)]">启用规则</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={enabled}
                onChange={e => setEnabled(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer
                peer-checked:after:translate-x-full peer-checked:after:border-white after:content-['']
                after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full
                after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]" />
            </label>
          </div>

          {/* 测试区域 */}
          <div className="glass-card p-4">
            <div className="text-xs font-orbitron text-[var(--accent-primary)] tracking-wider mb-3">
              规则测试
            </div>
            <div className="flex gap-2 mb-2">
              <input type="text" value={testInput}
                onChange={e => setTestInput(e.target.value)}
                placeholder="输入测试日志行..."
                className="neon-input flex-1 text-xs" />
              <button onClick={handleTest} className="neon-btn text-xs px-3">测试</button>
            </div>
            {testResults.length > 0 && (
              <div className="space-y-1 mt-2">
                {testResults.map((r, i) => (
                  <div key={i} className={`text-xs p-1.5 rounded ${
                    r.error ? 'bg-red-500/10 text-red-400' :
                    r.matched ? 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]' :
                    'bg-[var(--bg-primary)] text-[var(--text-dim)]'
                  }`}>
                    <span className="font-mono">{r.pattern || '(空)'}</span>
                    <span className="ml-2">
                      {r.error ? `错误: ${r.error}` : r.matched ? '✓ 匹配' : '✗ 不匹配'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="neon-btn text-xs">取消</button>
          <button onClick={handleSave}
            disabled={!name.trim() || patterns.every(p => !p.trim())}
            className="neon-btn primary text-xs disabled:opacity-30">
            {editingRule ? '保存修改' : '创建规则'}
          </button>
        </div>
      </div>
    </div>
  )
}
